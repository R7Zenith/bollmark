# Muhteşem Kasım: kampanya adı değişikliği (2026-11-24)

"Efsane Cuma" görünen adı "Muhteşem Kasım" oldu. Kural, tarihler (26–29 Kasım), indirim hesabı ve veritabanı değişmedi.

## Değişen dosyalar

| Dosya | Ne değişti |
|---|---|
| `src/lib/efsane-cuma.ts` | Kampanya adı, sepet satırı etiketi, kupon/Kalp notları; `EFSANE_PATH` → `/muhtesem-kasim` |
| `src/components/efsane-cuma/vitrin.tsx` | Üst şerit "MUHTEŞEM KASIM: …", ana sayfa bandı "Muhteşem Kasım · 26–29 Kasım" |
| `src/components/kalp-topla/kalp-ara-notu.tsx` | Kalp Topla ara notundaki bağlantı metni |
| `src/lib/use-automatic-discount.ts` | Sepet/çekmece/ödeme "İndirim (Muhteşem Kasım)" satırı |
| `src/app/(site)/efsane-cuma/` → `src/app/(site)/muhtesem-kasim/` | Koşullar sayfası taşındı; başlık, açıklama, canonical |
| `next.config.mjs` | `/efsane-cuma` → `/muhtesem-kasim` kalıcı yönlendirme (301) |
| `src/app/(admin)/admin/efsane-cuma/page.tsx` | Admin başlığı ve koşullar sayfası bağlantısı |
| `src/components/admin/sidebar.tsx` | Admin menü adı |
| `src/lib/audit-actions.ts` | İşlem geçmişi etiketi |
| `src/app/(admin)/admin/siparisler/[id]/page.tsx` | Sipariş detayındaki indirim notu |

Siparişe yazılan satır etiketi (`campaignLabel`) ve sipariş e-postası etiketi aynı sabitten gelir; yeni siparişlerde "Muhteşem Kasım – 2. ürüne %50" olur.

## Bilerek değiştirilmeyenler (görünmüyor)

- Kod içi adlar: `efsane-cuma.ts`, `EFSANE_*`, `Efsane*` bileşenleri, kod yorumları.
- Admin adresi `/admin/efsane-cuma` (yalnız yönetici görür).
- Veritabanı tablosu `EfsaneCumaSettings`, işlem kodu `EFSANE_CUMA_AYAR_DEGISTI`, migration adı. Bunları değiştirmek şema değişikliği gerektirir.
- Yerel test ortam değişkenleri `EFSANE_CUMA_TEST_START/END`.
- Geçmiş belgeler (`docs/reklam/efsane-cuma-2026.md`, günlük).

## Veritabanı

Salt okunur tarama (tüm metin/JSON kolonları): "efsane" hiçbir satırda geçmiyor. `EfsaneCumaSettings` satırı yok, kampanya etiketli sipariş yok. **Bekleyen veritabanı işi yok.**

## Görseller

"Efsane Cuma" yazan görsel dosyası yok; şerit ve bant düz metin.

## Doğrulama

- `tsc` hatasız, `npm test` 280/280.
- Yerelde: `/efsane-cuma` → 301 → `/muhtesem-kasim`; yeni sayfa başlığı "Muhteşem Kasım Kampanya Koşulları"; ana sayfa ve ürün sayfasında "Efsane Cuma" geçmiyor.
