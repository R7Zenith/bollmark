import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { put } from "@vercel/blob";
import { authOptions } from "@/lib/auth";
import { compressImage } from "@/lib/image-compress";
import { deleteBlobUrls } from "@/lib/blob";

const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
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
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Sadece JPG, PNG veya WEBP yükleyebilirsiniz." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: "Dosya boyutu en fazla 4.5MB olabilir." }, { status: 400 });
  }

  try {
    const original = Buffer.from(await file.arrayBuffer());
    const { buffer, contentType, ext } = await compressImage(original);
    const baseName = file.name.replace(/\.[^./\\]+$/, "");
    const blob = await put(`${baseName}.${ext}`, buffer, {
      access: "public",
      contentType,
      addRandomSuffix: true
    });
    return NextResponse.json({ url: blob.url });
  } catch {
    return NextResponse.json({ error: "Yükleme başarısız oldu, lütfen tekrar deneyin." }, { status: 500 });
  }
}

// Bu oturumda yuklenip kaydedilmeden silinen gorselleri Blob'dan temizler.
// deleteBlobUrls sadece bizim Vercel Blob URL'lerimizi siler, digerlerini atlar.
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
