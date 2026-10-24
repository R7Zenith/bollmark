# Bollmark - Güncel Durum

Son güncelleme: 2026-10-24

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
| SEO Faz 6: özgün ürün açıklamaları + ürün yönlendirmeleri | Kod yayında (2026-10-13): eski ürün adresleri yönlendiriliyor (slug değişimi, silme, arşiv). 217 ürünün özgün açıklama taslağı admin'de onay bekliyor (`/admin/urunler?aciklama=taslak`), 1 onaylı. Kalan: kullanıcının taslakları onaylaması; sonra Search Console'da dizine eklenen ürün sayısını izleme. Taslaklar API'siz yazılır (`scripts/ai-taslak-aktar.ts`). | `docs/planlar/SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md` |
| Anasayfa alt bölüm yenileme (Yeni Gelenler'in altı) | Faz 1 (otomatik bölümler, stok fotoğraflar silindi) yerel commit'te, push edilmedi (2026-10-22). "Ne arıyorsun?" kutularında görsel tekrarı düzeltmesi push edildi (2026-10-23; plan arşivde: `ANASAYFA_KUTU_GORSEL_TEKRARI_PLANI.md`). Kalan: Faz 2 Kombini Tamamla (Bundle modeline alan eklenecek, migration öncesi kullanıcıya sorulacak), Faz 3 Instagram otomatik çekim. Mağaza fotoğraflarını kullanıcı `public/magaza/` altına koyacak. | `docs/planlar/ANASAYFA_ALT_BOLUM_YENILEME_PLANI.md` |
| KVKK çerez bandı ve rıza yönetimi | Kod yayında (2026-10-24): bant, tercih paneli, `bm_consent` çerezi, `lib/consent.ts` (Consent Mode v2 + Pixel kontrol noktası), `/cerez-politikasi`. **`ConsentLog` tablosu DB'de yok** (db push kullanıcı onayı bekliyor); o zamana kadar rıza ispat kaydı düşmez, bant çalışır. Açık sorular: Google Haritalar iframe'i rızaya bağlansın mı, Gizlilik Politikası 10. madde, adres yazımı (Runguçpaşa/Runguşpaşa). | `docs/planlar/CEREZ_BANDI_PLANI.md` |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
