import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { compressImage } from "@/lib/image-compress";
import { deleteBlobUrls } from "@/lib/blob";
import { R2ConfigError, uploadImage } from "@/lib/image-storage";
import { isAcceptedImage } from "@/lib/client-image-resize";

// Vercel fonksiyon istek govdesi siniri (~4.5 MB) ile tutarli.
const MAX_SIZE_BYTES = 4.5 * 1024 * 1024;

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Dosya bulunamadı." }, { status: 400 });
  }
  if (!isAcceptedImage(file)) {
    return NextResponse.json({ error: "Sadece JPG, PNG, WEBP veya AVIF yükleyebilirsiniz." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Dosya boyutu en fazla 4.5MB olabilir." }, { status: 400 });
  }

  // profile=banner: anasayfa hero gorselleri (2400 px, JPEG kopyasi yok; bkz.
  // ANASAYFA_BANNER_YONETIMI_PLANI.md). Yalniz tam yetkili yukleyebilir.
  const banner = formData?.get("profile") === "banner";
  if (banner && session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 403 });
  }

  try {
    const original = Buffer.from(await file.arrayBuffer());
    const { buffer, contentType, ext, jpeg } = banner
      ? await compressImage(original, { maxWidth: 2400, quality: 82, jpeg: false })
      : await compressImage(original);
    const baseName = file.name.replace(/\.[^./\\]+$/, "");
    const url = await uploadImage({
      folder: banner ? "banner" : "admin-upload",
      nameHint: baseName,
      buffer,
      contentType,
      ext,
      jpeg
    });
    return NextResponse.json({ url });
  } catch (error) {
    if (error instanceof R2ConfigError) {
      console.error(error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: "Yükleme başarısız oldu, lütfen tekrar deneyin." }, { status: 500 });
  }
}

// Bu oturumda yuklenip kaydedilmeden silinen gorselleri depodan temizler.
// deleteBlobUrls sadece bizim R2 URL'lerimizi siler, digerlerini atlar.
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const url = body?.url;
  if (typeof url !== "string" || !url) {
    return NextResponse.json({ error: "URL bulunamadı." }, { status: 400 });
  }

  await deleteBlobUrls([url]);
  return NextResponse.json({ ok: true });
}
