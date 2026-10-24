# Bollmark - Güncel Durum

Son güncelleme: 2026-10-25

Bu dosya projenin **şu anki** durumunu kısa tutar. Yeni bir oturumda kaldığın
yerden devam etmek için önce bunu, sonra gerekirse ilgili günlük dosyasını oku.

- Oturum günlükleri (ne yapıldı, neden, nasıl doğrulandı): `docs/gunluk/`
- Planlar (açık olanlar ve arşiv): `docs/planlar/README.md`

## Altyapı

- **Canlı site:** Vercel, proje `bollmark`; domain `bollmark.com`, DNS Cloudflare'de.
  `main`'e push otomatik deploy tetikler. Yalnız `.md` değişen commit'ler deploy
  ETMEZ (`vercel.json` `ignoreCommand`).
- **Repo:** https://github.com/R7Zenith/bollmark.git (`main`)
- **Veritabanı:** Neon Postgres, Prisma 7. Yerel geliştirme ve canlı site **AYNI**
  veritabanını kullanır; yerelde yazan her test canlı veriye yazar.
- **Görseller:** hepsi Cloudflare R2'de (`img.bollmark.com`). Eski Vercel Blob
  görselleri 2026-10-12'de taşındı; Blob deposu henüz silinmedi (aşağıda).
- **Önizleme kapısı:** kapalı (2026-10-13), site herkese açık; tekrar açmak için
  `PREVIEW_GATE` env'ini sil/`on` yap + redeploy (`src/proxy.ts`).
- **Ödeme:** iyzico sanal POS canlıda (kullanıcı teyidi, 2026-10-09).
- **Vega:** Ticimax taklidi SOAP servisi (`src/app/Servis`) çalışıyor (2026-09-11).
- **Cron (Vercel, günde 1):** sepet hatırlatma, ödeme mutabakatı, Instagram kareleri (`/api/cron/instagram`).
- **Yeni bilgisayarda kurulum:** `KURULUM-NOTLARI.md` ve `.env.example`.

## Açık işler

| İş | Durum | Plan |
|---|---|---|
| Blob'dan R2'ye görsel taşıma | Taşıma (2026-10-12) ve Faz 3 kod temizliği (2026-10-13) bitti; kod artık Blob'a hiç yazmıyor/okumuyor. Kalan Faz 4: Blob deposunu kapatma, kullanıcı, 1–2 gün Blob grafiği izlendikten sonra. | `docs/planlar/BLOB_TAMAMEN_KALDIRMA_PLANI.md` |
| Meta Pixel + Conversions API | Push edildi (2026-10-24). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_META_PIXEL_ID` ve `META_CAPI_ACCESS_TOKEN` (sensitive) CLI ile eklendi; `META_TEST_EVENT_CODE` Vercel'de YOK (yalnız yerel `.env`). Ayrı redeploy yapılmadı, bu push'un yayını değişkenleri alır. `CONSENT_VERSION` 2 (herkese bant yeniden çıkar). `Order.metaCapiContext` / `metaPurchaseSentAt` db push ile eklendi. Gizlilik Politikası Meta maddeleri DB'ye hedefli yazıldı. Kalan: canlıda Olay Yöneticisi'nde AddToCart/InitiateCheckout/Purchase sunucu olaylarının ve tekilleştirmenin doğrulanması. | `docs/planlar/META_PIXEL_CAPI_PLANI.md` |
| Ön Bilgilendirme Formu + ödeme onay kutusu + kargo bilgisi | Yerel commit'te, push edilmedi (2026-10-25). `/on-bilgilendirme-formu` (statik, kod tarafında), ödemede iki belge pencerede açılıyor (Ön Bilgilendirme siparişe özel). Ürün sayfası ve sepette kargo ücreti (panel > Ayarlar, şu an 350 TL), 1.500 TL eşiği ve 1-3 iş günü notu. DB değişikliği yok. Kalan: push; canlıda kutu işaretlenince "Ödemeye Geç"in açıldığının denenmesi (yerelde ödeme kapalı); satıcı telefonu ve MERSİS sitede yok. | — |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
