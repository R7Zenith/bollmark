import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichOne, type KotonEnrichmentResult } from "@/lib/koton-images";
import type { KotonEnrichmentTarget } from "@/lib/excel-import";

export const maxDuration = 30;

function isValidTarget(v: unknown): v is KotonEnrichmentTarget {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.productId === "string" &&
    typeof t.productCode === "string" &&
    typeof t.productName === "string" &&
    typeof t.firstBarcode === "string" &&
    typeof t.colorValueIdByLabel === "object" &&
    t.colorValueIdByLabel !== null
  );
}

// Excel aktarımının 2. fazı: TEK bir yeni ürün için Koton görsel/açıklama
// arar. İstemci (excel-import-wizard.tsx) bu endpoint'i yeni ürün başına bir
// kez, aralarda kendi bekleme süresini koyarak çağırır - böylece büyük
// dosyalarda tek bir uzun istek yerine birçok kısa istek olur, hiçbiri zaman
// aşımına uğramaz ve istemci gerçek bir ilerleme yüzdesi gösterebilir.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const target = body?.target;
  if (!isValidTarget(target)) {
    return NextResponse.json({ error: "Geçersiz hedef." }, { status: 400 });
  }

  let result: KotonEnrichmentResult;
  try {
    result = await enrichOne(target);
  } catch (error) {
    console.error(`Koton görsel eşleştirme başarısız (ürün kodu: ${target.productCode}):`, error);
    result = { productId: target.productId, productCode: target.productCode, found: false, imagesAdded: 0, descriptionUpdated: false };
  }
  return NextResponse.json(result);
}
