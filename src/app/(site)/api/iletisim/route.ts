import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyContactMessage } from "@/lib/contact-notifications";
import { contactPrefs } from "@/lib/status";

// Hiz siniri: ayni IP'den 10 dakikada en fazla 3 mesaj. Projede mevcut bir
// rate limit altyapisi yok ve sunucusuz ortamda bellek ici sayac guvenilmez,
// bu yuzden sayac ContactMessage tablosunun kendisinden (ipHash + createdAt)
// hesaplanir. Ham IP saklanmaz, tuzlanmis SHA-256 ozeti saklanir.
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

const PHONE_PATTERN = /^[+\d][\d\s().-]{6,19}$/;

const schema = z
  .object({
    firstName: z.string().trim().min(1, "Ad zorunludur.").max(60, "Ad çok uzun."),
    lastName: z.string().trim().min(1, "Soyad zorunludur.").max(60, "Soyad çok uzun."),
    email: z.string().trim().max(254, "E-posta çok uzun.").email("Geçerli bir e-posta adresi girin."),
    phone: z.string().trim().max(20, "Telefon numarası çok uzun.").optional(),
    contactPrefs: z.array(z.enum(contactPrefs)).max(contactPrefs.length).default([]),
    message: z
      .string()
      .trim()
      .min(3, "Lütfen mesajınızı yazın.")
      .max(2000, "Mesaj en fazla 2000 karakter olabilir."),
    // Gorunmez tuzak alan - gercek kullanici asla doldurmaz.
    website: z.string().optional()
  })
  .superRefine((data, ctx) => {
    const needsPhone = data.contactPrefs.includes("TELEFON") || data.contactPrefs.includes("SMS");
    if (needsPhone && !data.phone) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Telefon veya SMS için telefon numarası zorunludur." });
    } else if (data.phone && !PHONE_PATTERN.test(data.phone)) {
      ctx.addIssue({ code: "custom", path: ["phone"], message: "Geçerli bir telefon numarası girin." });
    }
  });

function hashIp(req: NextRequest): string | null {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip")?.trim();
  if (!ip) return null;
  return createHash("sha256").update(`${process.env.NEXTAUTH_SECRET ?? ""}:${ip}`).digest("hex");
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Lütfen formu kontrol edip tekrar deneyin." },
      { status: 400 }
    );
  }
  const data = parsed.data;

  // Botu bilgilendirmemek icin honeypot dolu ise basarili gibi cevap verilir,
  // ne kaydedilir ne mail atilir.
  if (data.website) {
    return NextResponse.json({ ok: true });
  }

  const ipHash = hashIp(req);
  if (ipHash) {
    const recentCount = await prisma.contactMessage.count({
      where: { ipHash, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } }
    });
    if (recentCount >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: "Kısa sürede çok fazla mesaj gönderdiniz. Lütfen birkaç dakika sonra tekrar deneyin." },
        { status: 429 }
      );
    }
  }

  const needsPhone = data.contactPrefs.includes("TELEFON") || data.contactPrefs.includes("SMS");
  const saved = await prisma.contactMessage.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email,
      phone: needsPhone ? data.phone : null,
      contactPrefs: [...new Set(data.contactPrefs)],
      message: data.message,
      ipHash
    }
  });

  // Kayit once yapildi; mail basarisiz olsa da musteriye basarili donulur,
  // hata sadece sunucu loguna yazilir (bkz. lib/mail.ts).
  try {
    await notifyContactMessage(saved);
  } catch (error) {
    console.error("İletişim formu maili gönderilemedi (kayıt yapıldı, yoksayıldı):", error);
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
