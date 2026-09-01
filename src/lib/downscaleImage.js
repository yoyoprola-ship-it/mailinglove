// Shrink a picked image to something reasonable to upload (chat attachments,
// etc.). Returns a File; falls back to the original on any failure.
export async function downscaleImage(file, { max = 1600, quality = 0.85 } = {}) {
  try {
    if (!file || !file.type.startsWith('image/')) return file
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 900 * 1024) return file

    const w = Math.round(bitmap.width * scale)
    const h = Math.round(bitmap.height * scale)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close?.()

    const blob = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
    if (!blob) return file
    return new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', {
      type: 'image/jpeg',
    })
  } catch {
    return file
  }
}
