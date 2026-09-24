// Tarayicida, yuklemeden once gorseli kucultur. Vercel fonksiyonlarinin istek
// govdesi siniri ~4.5 MB oldugu icin telefon fotograflari aksi halde 413 aliyor.
// Uzun kenar MAX_EDGE'i asiyorsa (ya da dosya sinirdan buyukse) canvas ile
// kucultulup JPEG'e cevrilir; sunucudaki sharp sikistirmasi aynen devam eder.

export const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;
const MAX_EDGE = 2000;

export async function resizeImageForUpload(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const longEdge = Math.max(bitmap.width, bitmap.height);
    if (longEdge <= MAX_EDGE && file.size <= MAX_UPLOAD_BYTES) {
      bitmap.close();
      return file;
    }

    const scale = Math.min(1, MAX_EDGE / longEdge);
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    // Seffaf PNG'ler JPEG'de siyah zemine donmesin.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) return file;
    const name = file.name.replace(/\.[^./\\]+$/, "") + ".jpg";
    return new File([blob], name, { type: "image/jpeg" });
  } catch {
    return file;
  }
}
