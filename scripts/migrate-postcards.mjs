// One-time migration: turn the bundled postcard catalog (src/data/postcards.json
// + the live config/catalog overlay + config/overrides crops) into real
// Firestore documents in the `postcards` collection, each with its image
// copied to Cloud Storage at postcards/<id>.<ext>.
//
// Safe to re-run: it overwrites docs and storage objects in place.
//
//   GOOGLE_APPLICATION_CREDENTIALS=... node scripts/migrate-postcards.mjs
//   (or run where Application Default Credentials are available)

import { readFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp, applicationDefault } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
import { getStorage } from 'firebase-admin/storage'

const PROJECT = process.env.GCLOUD_PROJECT || 'mailinglove-eb540'
const BUCKET = process.env.STORAGE_BUCKET || 'mailinglove-eb540-hires'
const DRY = process.argv.includes('--dry')
const CONCURRENCY = 12

const app = initializeApp(
  { projectId: PROJECT, credential: applicationDefault(), storageBucket: BUCKET },
  'migrate-postcards'
)
const db = getFirestore(app)
const bucket = getStorage(app).bucket()

const root = fileURLToPath(new URL('..', import.meta.url))
const publicDir = path.join(root, 'public')
const base = JSON.parse(readFileSync(path.join(root, 'src/data/postcards.json'), 'utf8'))

const extOf = (ct) => (ct === 'image/png' ? 'png' : ct === 'image/webp' ? 'webp' : 'jpg')

async function tryDownload(p) {
  try {
    const [buf] = await bucket.file(p).download()
    return buf
  } catch {
    return null
  }
}

async function run() {
  const overlaySnap = await db.collection('config').doc('catalog').get()
  const overlay = overlaySnap.exists ? overlaySnap.data() : {}
  const added = Array.isArray(overlay.added) ? overlay.added : []
  const removed = new Set(Array.isArray(overlay.removed) ? overlay.removed : [])

  const ovSnap = await db.collection('config').doc('overrides').get()
  const ovMap = ovSnap.exists ? ovSnap.data().map || {} : {}

  // Effective card list: base (minus hidden) + admin-added, then the hidden
  // base cards at the end flagged hidden so nothing is lost.
  const cards = []
  base.postcards.forEach((p) => {
    if (!removed.has(p.id)) cards.push({ ...p, _hidden: false })
  })
  added.forEach((p) => cards.push({ ...p, _hidden: false, _custom: true }))
  base.postcards.forEach((p) => {
    if (removed.has(p.id)) cards.push({ ...p, _hidden: true })
  })

  console.log(
    `${cards.length} cards (base ${base.postcards.length}, added ${added.length}, hidden ${removed.size}), ${Object.keys(ovMap).length} crops`
  )
  if (DRY) {
    console.log('dry run — nothing written')
    return
  }

  let order = 0
  let done = 0
  let skipped = 0
  const queue = cards.map((p, i) => ({ p, order: i }))

  async function worker() {
    while (queue.length) {
      const { p, order: ord } = queue.shift()
      const id = p.id
      let bytes = null
      let ct = 'image/jpeg'

      const ov = ovMap[id]
      if (ov?.path) {
        bytes = await tryDownload(ov.path)
        if (bytes) ct = ov.contentType || 'image/jpeg'
      }
      if (!bytes && p.storagePath) {
        bytes = await tryDownload(p.storagePath)
        if (bytes) ct = p.contentType || 'image/jpeg'
      }
      if (!bytes && p.image) {
        const fp = path.join(publicDir, p.image.replace(/^\/+/, ''))
        if (existsSync(fp)) {
          bytes = readFileSync(fp)
          ct = 'image/jpeg'
        }
      }
      if (!bytes) {
        console.warn('  SKIP (no image found):', id)
        skipped++
        continue
      }

      const storagePath = `postcards/${id}.${extOf(ct)}`
      await bucket
        .file(storagePath)
        .save(bytes, { contentType: ct, resumable: false, metadata: { cacheControl: 'no-cache' } })

      const now = Date.now()
      await db
        .collection('postcards')
        .doc(id)
        .set({
          id,
          type: p.type,
          subcategory: p.subcategory || null,
          title: p.title,
          storagePath,
          contentType: ct,
          hidden: Boolean(p._hidden),
          order: ord,
          createdAt: p.createdAt || now,
          updatedAt: now,
        })

      done++
      if (done % 25 === 0) console.log(`  ${done}/${cards.length}`)
      void order
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))
  console.log(`\ndone: ${done} written, ${skipped} skipped`)

  const count = (await db.collection('postcards').count().get()).data().count
  console.log(`postcards collection now holds ${count} documents`)
}

run().then(
  () => process.exit(0),
  (err) => {
    console.error(err)
    process.exit(1)
  }
)
