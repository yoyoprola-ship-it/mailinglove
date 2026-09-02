import path from 'node:path'
import { readFile } from 'node:fs/promises'
import { downloadFile } from './bucket.js'
import { getPostcard, adminList, catalog } from './catalog.js'

// Postcard images live one-per-card in Cloud Storage (see catalog.js). This
// module just streams them out through /api/postcard-image/:id so the bucket
// can stay private.

// Stream a card's image. `versioned` (the URL carried ?v=<updatedAt>) means
// the URL changes whenever the image is replaced, so it's safe to cache it
// hard. `download` sends it as an attachment for the admin print file.
export async function streamImage(postcardId, res, { download = false, versioned = false } = {}) {
  const card = await getPostcard(postcardId)
  if (!card) return res.status(404).end()

  // Safety net for the migration window: a card with no bucket image yet
  // still has its bundled static path — serve that.
  if (!card.storagePath) {
    if (!card.image) return res.status(404).end()
    try {
      const buf = await readFile(path.join(process.cwd(), 'dist', card.image.replace(/^\/+/, '')))
      res.setHeader('Content-Type', 'image/jpeg')
      if (download) {
        res.setHeader('Content-Disposition', `attachment; filename="${postcardId}.jpg"`)
        res.setHeader('Cache-Control', 'no-store')
      } else {
        res.setHeader('Cache-Control', 'public, max-age=60')
      }
      return res.end(buf)
    } catch {
      return res.status(404).end()
    }
  }

  try {
    const buf = await downloadFile(card.storagePath)
    res.setHeader('Content-Type', card.contentType || 'application/octet-stream')
    if (download) {
      const ext = (path.extname(card.storagePath) || '.jpg').slice(1) || 'jpg'
      res.setHeader('Content-Disposition', `attachment; filename="${postcardId}.${ext}"`)
      res.setHeader('Cache-Control', 'no-store')
    } else if (versioned) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('Cache-Control', 'public, max-age=60')
    }
    res.end(buf)
  } catch (err) {
    console.error('[assets] stream failed:', err?.message || err)
    if (!res.headersSent) res.status(404).end()
  }
}

// Catalog for the admin gallery.
export async function adminCatalog() {
  const list = await adminList()
  return {
    types: catalog.types,
    postcards: list.map((p) => ({
      id: p.id,
      type: p.type,
      subcategory: p.subcategory || null,
      title: p.title,
      image: p.image,
      hidden: p.hidden,
      updatedAt: p.updatedAt,
    })),
  }
}
