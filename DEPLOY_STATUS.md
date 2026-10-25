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
- **Vega:** Ticimax taklidi SOAP servisi (`src/app/Servis`) çalışıyor (2026-09-11). Vega'daki Site Adı `vega.bollmark.com` (2026-10-25); Cloudflare Worker `vega-bridge-worker` hem bu adı hem `www.` ekli halini hem eski workers.dev adresini taşıyor.
- **Cron (Vercel, günde 1):** sepet hatırlatma, ödeme mutabakatı, Instagram kareleri (`/api/cron/instagram`).
- **Yeni bilgisayarda kurulum:** `KURULUM-NOTLARI.md` ve `.env.example`.

## Açık işler

| İş | Durum | Plan |
|---|---|---|
| Blob'dan R2'ye görsel taşıma | Taşıma (2026-10-12) ve Faz 3 kod temizliği (2026-10-13) bitti; kod artık Blob'a hiç yazmıyor/okumuyor. Kalan Faz 4: Blob deposunu kapatma, kullanıcı, 1–2 gün Blob grafiği izlendikten sonra. | `docs/planlar/BLOB_TAMAMEN_KALDIRMA_PLANI.md` |
| Meta Pixel + Conversions API | Push edildi (2026-10-24). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_META_PIXEL_ID` ve `META_CAPI_ACCESS_TOKEN` (sensitive) CLI ile eklendi; `META_TEST_EVENT_CODE` Vercel'de YOK (yalnız yerel `.env`). Ayrı redeploy yapılmadı, bu push'un yayını değişkenleri alır. `CONSENT_VERSION` 2 (herkese bant yeniden çıkar). `Order.metaCapiContext` / `metaPurchaseSentAt` db push ile eklendi. Gizlilik Politikası Meta maddeleri DB'ye hedefli yazıldı. Kalan: canlıda Olay Yöneticisi'nde AddToCart/InitiateCheckout/Purchase sunucu olaylarının ve tekilleştirmenin doğrulanması. | `docs/planlar/META_PIXEL_CAPI_PLANI.md` |
| Google Analytics 4 (GA4) + KDV oranları | Push edildi (2026-10-25). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_GA4_MEASUREMENT_ID` CLI ile eklendi (ayrı redeploy yok, bu push'un yayını alır); `NEXT_PUBLIC_GA4_DEBUG` yalnız yerel `.env`. `CONSENT_VERSION` 3 (herkese bant yeniden çıkar). `Category.vatRate` / `Product.vatRate` db push ile eklendi; kategori oranları girildi (Parfüm, Takı & Bijuteri, Saç Aksesuarları %20; diğer 40 kategori %10). Vega `SelectUrun` artık bu oranı gönderiyor. Gizlilik Politikası (`gizlilik-politikasi`) GA4/Google maddeleri push ile birlikte DB'ye yalnız bu kayıt hedeflenerek yazıldı. Kalan: canlıda Realtime/DebugView'da olayları ve `purchase`'ı doğrulamak. | `GA4_KURULUM_PLANI.md` |
| Ön Bilgilendirme Formu + ödeme onay kutusu + kargo bilgisi | Push edildi (2026-10-25, GA4 ile birlikte). `/on-bilgilendirme-formu` (statik, kod tarafında), ödemede iki belge pencerede açılıyor (Ön Bilgilendirme siparişe özel). Ürün sayfası ve sepette kargo ücreti (panel > Ayarlar, şu an 350 TL), 1.500 TL eşiği ve 1-3 iş günü notu. DB değişikliği yok. Kalan: canlıda kutu işaretlenince "Ödemeye Geç"in açıldığının denenmesi (yerelde ödeme kapalı); satıcı telefonu ve MERSİS sitede yok. | — |
| Vega sipariş aktarımı | Faz 0–1 canlıda (2026-10-25): Vega Site Adı artık `vega.bollmark.com` (sipariş isteği `www.` ekli geliyor, Worker'a iki özel alan adı bağlandı); `SelectSiparis` geçerli boş liste dönüyor. Faz 2-3 canlıda (2026-10-26): `Order.vegaId`/`vegaFetchedAt` db push ile eklendi; ödenmiş siparişler Vega'ya düşüyor (test siparişi listede), stok koruması aktif, acil kapatma `VEGA_SIPARIS_AKTARIM=off`. Kalan: Vega'da stok ayırmanın doğrulanması, Sipariş No/ödeme tarihi düzeltmesinin bir sonraki siparişte kontrolü | `docs/planlar/VEGA_SIPARIS_AKTARIM_PLANI.md` |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
