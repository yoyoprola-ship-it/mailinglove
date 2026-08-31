import { getStorage } from 'firebase-admin/storage'

// Low-level Cloud Storage helpers, shared by assets.js (hi-res replacements
// for catalog cards) and catalog.js (images for admin-created cards). Keeping
// this separate avoids an import cycle between those two modules.
const BUCKET = process.env.STORAGE_BUCKET || 'mailinglove-eb540-hires'
const b = () => getStorage().bucket(BUCKET)

export const EXT = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

export async function saveFile(path, buffer, contentType) {
  await b()
    .file(path)
    .save(buffer, { contentType, resumable: false, metadata: { cacheControl: 'no-cache' } })
}

export async function downloadFile(path) {
  const [buf] = await b().file(path).download()
  return buf
}

export async function deleteFile(path) {
  await b()
    .file(path)
    .delete()
    .catch(() => {})
}
