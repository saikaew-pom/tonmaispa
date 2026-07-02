// Client-only. Cloudinary's unsigned free-tier upload caps at 10MB per file,
// and modern phone/camera photos routinely blow past that (a 4032x3024 JPEG
// is often 12-15MB). Resize in the browser before upload so this never
// surfaces as a confusing "Cloudinary error" to whoever's uploading.
export async function resizeImageForUpload(file, { maxDimension = 2000, quality = 0.85 } = {}) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif') return file

  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height))

  // Already small enough on both dimensions and file size — skip re-encoding.
  if (scale === 1 && file.size <= 8 * 1024 * 1024) {
    bitmap.close?.()
    return file
  }

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close?.()

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
  if (!blob) return file // canvas encoding failed — fall back to the original

  const newName = file.name.replace(/\.\w+$/, '') + '.jpg'
  return new File([blob], newName, { type: 'image/jpeg' })
}
