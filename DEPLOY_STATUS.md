# Bollmark - Güncel Durum

Son güncelleme: 2026-10-13

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
- **Önizleme kapısı:** 2026-10-02'de yeniden açıldı (`src/proxy.ts`). Şifresiz
  ziyaretçi `/yapim-asamasinda` içeriğini görür.
- **Ödeme:** iyzico sanal POS canlıda (kullanıcı teyidi, 2026-10-09).
- **Vega:** Ticimax taklidi SOAP servisi (`src/app/Servis`) çalışıyor (2026-09-11).
- **Cron (Vercel, günde 1):** sepet hatırlatma, ödeme mutabakatı.
- **Yeni bilgisayarda kurulum:** `KURULUM-NOTLARI.md` ve `.env.example`.

## Açık işler

| İş | Durum | Plan |
|---|---|---|
| Blob'dan R2'ye görsel taşıma | Taşıma (2026-10-12) ve Faz 3 kod temizliği (2026-10-13) bitti; kod artık Blob'a hiç yazmıyor/okumuyor. Kalan Faz 4: Blob deposunu kapatma, kullanıcı, 1–2 gün Blob grafiği izlendikten sonra. | `docs/planlar/BLOB_TAMAMEN_KALDIRMA_PLANI.md` |
| Google'da "Çok yakında" sonucu | Kod uygulandı (2026-10-13). Kalan: push ile birlikte kapının kapatılması, sonra kullanıcının Search Console adımları. | `docs/planlar/GOOGLE_ARAMA_SONUCLARI_DUZELTME_PLANI.md` |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
