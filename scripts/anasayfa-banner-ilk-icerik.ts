// Anasayfa banner'larinin ilk icerigi (docs/planlar/ANASAYFA_BANNER_YONETIMI_PLANI.md,
// bolum 6 + Ek). Gorselleri banner profiliyle (2400 px, WebP ~82, JPEG kopyasi
// yok) public/anasayfa/banner/ altina yazar (deploy ile yayina cikar; yerelde R2
// anahtari olmadigi icin R2 yerine - kullanici karari 2026-11-25), 5 slayt satiri
// yazar, islem gecmisine not duser. Sonraki gorseller panelden R2'ye yuklenir.
// HomeSlide tablosunda satir varsa hicbir sey yapmaz (iki kez calismaz).
//
//   npx tsx scripts/anasayfa-banner-ilk-icerik.ts            -> dry-run, hicbir sey yazmaz
//   npx tsx scripts/anasayfa-banner-ilk-icerik.ts --uygula   -> gorselleri yazar, DB'ye yazar
import { config } from "dotenv";
config({ path: ".env", quiet: true });
config({ path: ".env.local", override: true, quiet: true });
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";

const APPLY = process.argv.includes("--uygula");
const ACTOR = "script:anasayfa-banner-ilk-icerik";
const END = new Date("2026-11-29T23:59:59+03:00");

const FILES = {
  aDesktop: "Claude outputs/muhtesem-kasim/muhtesem-kasim-banner-desktop.png",
  aMobile: "Claude outputs/muhtesem-kasim/muhtesem-kasim-banner-mobil.jpg",
  bDesktop: "Claude outputs/muhtesem-kasim/muhtesem-kasim-B-desktop.png",
  bMobile: "Claude outputs/muhtesem-kasim/muhtesem-kasim-B-mobil.png",
  kargoDesktop: "Claude outputs/anasayfa-banner/kargo-ucretsiz-desktop.png",
  kargoMobile: "Claude outputs/anasayfa-banner/kargo-ucretsiz-mobil.png"
} as const;

async function main() {
  const { prisma } = await import("../src/lib/prisma");
  const { compressImage } = await import("../src/lib/image-compress");
  const { KALP_SLIDE_ID } = await import("../src/lib/home-slides");
  const { SHIPPING_THRESHOLD_CENTS } = await import("../src/lib/shipping");

  if (SHIPPING_THRESHOLD_CENTS !== 150000) throw new Error(`Ucretsiz kargo esigi 1.500 TL degil (${SHIPPING_THRESHOLD_CENTS}); durduruldu.`);

  // Dry-run tablo henuz yokken de (migration oncesi) calisabilsin.
  const existing = await prisma.homeSlide.count().catch((e) => {
    if (APPLY) throw e;
    console.log("(HomeSlide tablosu henuz yok - dry-run devam ediyor)");
    return 0;
  });
  if (existing > 0) {
    console.log(`HomeSlide tablosunda zaten ${existing} satir var; hicbir sey yapilmadi.`);
    return;
  }

  const urls = {} as Record<keyof typeof FILES, string>;
  if (APPLY) mkdirSync("public/anasayfa/banner", { recursive: true });
  for (const [key, path] of Object.entries(FILES) as [keyof typeof FILES, string][]) {
    const out = await compressImage(readFileSync(path), { maxWidth: 2400, quality: 82, jpeg: false });
    const sharp = (await import("sharp")).default;
    const meta = await sharp(out.buffer).metadata();
    console.log(`${key}: ${path} -> ${meta.width}x${meta.height} webp, ${(out.buffer.length / 1024).toFixed(0)} KB`);
    urls[key] = `/anasayfa/banner/${basename(path).replace(/\.[^.]+$/, "")}.webp`;
    if (APPLY) writeFileSync(`public${urls[key]}`, out.buffer);
  }

  const now = new Date();
  const slides = [
    {
      name: "Muhteşem Kasım A",
      kind: "IMAGE_ONLY",
      enabled: true,
      sortOrder: 1,
      startsAt: now,
      endsAt: END,
      desktopImageUrl: urls.aDesktop,
      mobileImageUrl: urls.aMobile,
      altText: "Muhteşem Kasım: tüm ürünlerde 2. ürüne %50 indirim, 25–29 Kasım",
      href: "/urunler"
    },
    {
      name: "Muhteşem Kasım B",
      kind: "TEXT_OVERLAY",
      enabled: false,
      sortOrder: 1,
      startsAt: now,
      endsAt: END,
      desktopImageUrl: urls.bDesktop,
      mobileImageUrl: urls.bMobile,
      altText: "Kraft alışveriş poşetleriyle akşam şehirde yürüyen, kışlık montlu gülümseyen bir çift",
      href: "/urunler",
      eyebrow: "Muhteşem Kasım · 25–29 Kasım",
      title: "Tüm ürünlerde 2. ürüne %50",
      subtitle: "Sepetindeki 2. ürün yarı fiyatına.",
      buttonLabel: "Alışverişe başla",
      textAlign: "LEFT",
      textTone: "LIGHT",
      overlay: "LIGHT",
      showCountdown: true
    },
    {
      name: "Ücretsiz kargo",
      kind: "TEXT_OVERLAY",
      enabled: true,
      sortOrder: 2,
      desktopImageUrl: urls.kargoDesktop,
      mobileImageUrl: urls.kargoMobile,
      altText: "Keten zemin üzerinde katlanmış krem triko ve iple bağlanmış kraft kutu",
      href: "/urunler",
      eyebrow: "Kargo",
      title: "1.500 TL üzeri ücretsiz kargo",
      subtitle: "Siparişin özenle paketlenip kapına gelsin.",
      buttonLabel: "Alışverişe başla",
      textAlign: "LEFT",
      textTone: "DARK",
      overlay: "NONE"
    },
    {
      // Eski sabit sezon hero'su, birebir (page.tsx'teki onceki icerik).
      name: "Sezon hero'su (2026 Sonbahar / Kış)",
      kind: "TEXT_OVERLAY",
      enabled: true,
      sortOrder: 3,
      desktopImageUrl: "/hero-model.jpg",
      mobileImageUrl: null,
      desktopFocus: "50% 18%",
      mobileFocus: "50% 18%",
      altText: "Bollmark kampanya görseli",
      href: "/urunler",
      eyebrow: "2026 Sonbahar / Kış",
      title: "Her gün için, her parça için",
      buttonLabel: "Keşfet",
      textAlign: "CENTER",
      textTone: "LIGHT",
      overlay: "MEDIUM"
    },
    { id: KALP_SLIDE_ID, name: "Kalp Topla", kind: "KALP_TOPLA", enabled: true, sortOrder: 4 }
  ];

  console.table(
    slides.map((s) => ({
      sira: s.sortOrder,
      ad: s.name,
      tur: s.kind,
      durum: s.enabled ? "AÇIK" : "KAPALI",
      pencere: "endsAt" in s && s.endsAt ? `şimdi → ${s.endsAt.toISOString()}` : "süresiz"
    }))
  );

  if (!APPLY) {
    console.log("Dry-run: hicbir sey yazilmadi. Uygulamak icin --uygula.");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const s of slides) {
      const created = await tx.homeSlide.create({ data: { ...s, updatedByEmail: ACTOR } });
      await tx.auditLog.create({
        data: {
          actorEmail: ACTOR,
          actorRole: "ADMIN",
          action: "ANASAYFA_BANNER_EKLENDI",
          targetType: "HomeSlide",
          targetId: created.id,
          detail: `"${s.name}" ilk içerik olarak eklendi; ${s.enabled ? "açık" : "kapalı"}, sıra ${s.sortOrder}`
        }
      });
    }
  });
  console.log("Yazildi:", await prisma.homeSlide.count(), "slayt.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
