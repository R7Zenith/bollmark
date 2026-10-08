# iyzico Sanal POS — Test Raporu (Faz 4)

Tarih: 2026-09-21 · Ortam: production alan adı (bollmark.com), Sanal POS **SANDBOX** modunda · Kod: `main` (Faz 1–3 + bu fazdaki tek metin düzeltmesi)

Kaynak plan: `IYZICO_SANAL_POS_PLANI.md` bölüm 8 (16 senaryo). Faz 3'te sandbox'ta geçenler bu fazda **tekrar koşulmadı**, "Faz 3'te doğrulandı" diye işaretlendi. Faz 2'de geçenler de tekrar koşulmadı; yalnızca son kod üzerinde bir uçtan uca regresyon (aşağıda) yapıldı.

## 1. Özet

| Sonuç | Adet | Maddeler |
|---|---|---|
| Geçti | 13 | 1, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14 |
| Kısmen geçti (bir alt parça koşulamadı) | 2 | 3, 15 |
| Koşulamadı | 1 | 16 (taksit) |
| Kaldı (başarısız) | 0 | — |

- `npm test`: 79/79 geçti · `npx tsc --noEmit`: temiz · `npm run build`: başarılı.
- `npm run lint`: **tüm projede temiz değil** (74 hata). Ödeme ile ilgili dosyalarda (`src/lib/payment`, `api/odeme`, `odeme/`, `admin/sanal-pos`, ödeme kartı bileşenleri) **0 hata**; kalanı `.open-next` üretilmiş çıktısı ve ödeme dışı, önceden var olan dosyalardaki `set-state-in-effect` uyarıları.
- Bu fazda bulunan tek hata: panelin "Test Rehberi"nde OTP `123456` yazıyordu, sandbox bunu reddediyor (bkz. 4.1). Düzeltildi.

## 2. Senaryo tablosu (plan bölüm 8)

| # | Senaryo | Beklenen | Gerçekleşen | Sonuç | Not |
|---|---|---|---|---|---|
| 1 | Başarılı ödeme (Visa kredi + 3DS) | Sipariş PAID, stok düşer, tek mail, teşekkür sayfası, günlük | Faz 4 regresyonu: PAID, stok 3→2, teşekkür sayfası, günlük kayıtları tam (bkz. 3). | Geçti | **Mail tekliği gelen kutusunda doğrulanmadı**; yalnızca kodda tek çağrı. |
| 2 | Debit, Troy, AmEx, yabancı kart | Başarılı | Faz 2'de doğrulandı (Visa/MasterCard/Troy/AmEx/yabancı, debit için otomatik 3DS). | Geçti | Faz 2 |
| 3 | Yetersiz bakiye / CVC / SKT / do-not-honour | Türkçe mesaj, sipariş PENDING kalır, "Tekrar dene" çalışır | Yanlış OTP → başarısız sayfası → "Tekrar Dene" → başarılı (Faz 2). iyzico formu bu hata kartlarını **tarayıcıda reddediyor**, sunucuya hiç gitmiyor. | **Kısmen** | Kod → Türkçe mesaj eşlemesi yalnızca birim testli; gerçek bir 10051/10054 callback'i alınmadı. |
| 4 | `4151…`, `4131…`, `4141…` | Sonuç gözlemlenip yazılır | `4131`/`4141` (mdStatus 0/4) → FAILED. `4151` (3DS başlamadı) iyzico formunda takılı kalıyor, callback gelmiyor (Faz 2). | Geçti | Davranış belgelendi |
| 5 | Ödeme sonrası tarayıcı kapanır (callback ulaşmaz) | Webhook/sorgu ile PAID | Callback engellendi → sipariş PENDING kaldı → imzasız webhook → `paid`, tek stok düşümü (Faz 3). | Geçti | Faz 3 |
| 6 | Callback tekrarı / yenileme / webhook çakışması | Yan etki tek sefer | Faz 4'te aynı callback 2 kez daha POST edildi: ikisi de 303 + `already`, stok 2'de kaldı. Faz 2'de 3 seri + 5 eşzamanlı, Faz 3'te webhook tekrarı. | Geçti | |
| 7 | İki sekmede aynı siparişi iki kez ödeme | Çift ödeme işaretlenir | "ÇOKLU ÖDEME" işaretlendi, `needsAttention` (Faz 2). | Geçti | Panelden iade yolu yok (bkz. 6) |
| 8 | Süre dolumu / geç ödeme | İptal + kupon/puan iadesi; geç ödeme `needsAttention` | Sipariş iptal, kupon 1→0, 50 puan iade, ikinci taramada çift iade yok; geç ödeme CANCELLED+PAID+`needsAttention` (Faz 2). | Geçti | Faz 2 |
| 9 | İndirim dağıtımı birim testleri | Σ sepet = toplam | 1000 rastgele senaryo, %100 indirim, ücretsiz kargo, tek kalem, kuruş kalıntıları (`basket.test.ts`). | Geçti | Bu fazda `npm test` 79/79 |
| 10 | Tutar uyuşmazlığı, bozuk imza | REDDEDİLİR | Tutar uyuşmazlığı canlıda (DB 134100 ≠ iyzico 134000): PAID sayılmadı, REVIEW + `needsAttention` (Faz 2). Bozuk/eksik imza: `evaluate.test.ts`. | Geçti | Sahte imzalı yanıt canlıda üretilemediği için imza yalnızca birim düzeyinde |
| 11 | İade: tam, kısmi, ardışık, fazla tutar, `5406670000000009`, aynı gün iptal | Bölüm 8/11 | Hepsi Faz 3'te canlıda doğrulandı; başarısız iadede sayaçlar değişmedi. | Geçti | Faz 3 |
| 12 | POS kapalı → 503; yerelde LIVE → zorla SANDBOX | 503; SANDBOX | Faz 4'te canlıda: kapalıyken 503 → açıkken 400 (kapı açıldı) → kapatınca tekrar 503. LIVE→SANDBOX zorlaması `mode.test.ts` ile. | Geçti | LIVE zorlaması canlıda denenemez (production'da LIVE geçerli) |
| 13 | PERSONEL `/admin/sanal-pos` ve iade | Erişemez | Sayfalar `/admin`'e yönlendirildi, ödeme kartı salt okunur (Faz 3). | Geçti | Server action'ların `requireAdmin` koruması kod düzeyinde; PERSONEL ile doğrudan action çağrısı denenmedi |
| 14 | Telefon biçimleri, tek kelimelik ad, Türkçe karakter | Kabul | Birim testler + Faz 4 canlı: `0555 123 45 67` ve "Şükrü Öztürk" ile başlatma başarılı. | Geçti | |
| 15 | Webhook: geçerli/hatalı/imzasız/bilinmeyen | Bölüm 8/15 | Bozuk JSON 400, farklı olay 200, bilinmeyen token 200, **yanlış imza 401**, imzasız gerçek token işlendi (Faz 3). **Geçerli imzalı webhook canlıda denenemedi** (Secret Key yerelde yok). | **Kısmen** | İmza doğrulaması yalnızca elle hesaplanmış HMAC ile birim testli |
| 16 | Taksit seçenekleri ve `paidPrice ≠ price` | Form seçenekleri değişir, iade tavanı doğru | `maxInstallment=3` iyzico'ya doğru iletildi (1.340 TL için 2 taksit 1.383,14; 3 taksit 1.410,29). **Sandbox test kartları ödeme sayfasında yalnızca "Tek Çekim" sunuyor**, taksitli ödeme tamamlanamadı (Faz 3). | Koşulamadı | Taksitli iade tavanı yalnızca birim düzeyi |

## 3. Faz 4 canlı regresyonu (son kod, production, SANDBOX)

Amaç: Faz 3 düzeltmelerinden sonra ana akışın hâlâ çalıştığını kanıtlamak. Sipariş `BLM260921-1013`: BEYAZ/M gömlek 990 TL + kargo 350 TL = **1.340 TL**.

| Adım | Gözlem |
|---|---|
| Checkout | Ürün + toplam doğru, "Test ödeme modu: gerçek kart çekilmez" uyarısı görünüyor. |
| Ödemeye Geç | iyzico sandbox sayfasına yönlendi; sayfadaki tutar `1.340,00 TL` (DB toplamıyla aynı). |
| Kart | Visa kredi `4603 45…`, 3D Secure işaretli, yalnızca "Tek Çekim" seçeneği. |
| 3DS | Sahte onay sayfası kodu ekranda gösterdi (`283126`), kabul edildi. |
| Callback | Teşekkür sayfasına 303 ile dönüldü: "Siparişiniz alındı ve ödemeniz onaylandı." |
| DB | `status=PAID`, `paymentStatus=PAID`, `paymentMode=SANDBOX`, `paidCents=134000`, `installment=1`, kalem ve kargo `paymentTransactionId` kayıtlı, kargo `35000`, `needsAttention=false`. Deneme `SUCCESS`, `fraudStatus=1`, VISA / CREDIT_CARD. |
| Stok | 3 → 2 (tek düşüm). |
| Tekrar callback ×2 | 303 + `already`, stok 2'de kaldı. |
| Günlük | INIT → RETRIEVE (PAID) → CALLBACK paid → CALLBACK already ×2. |
| Denetim | `ORDER_STATUS_CHANGED PENDING_PAYMENT → PAID (iyzico, callback)`, aktör "SISTEM". |

Bu regresyonda **iade koşulmadı** (admin oturumu yok; iade Faz 3'te doğrulandı).

## 4. Plan 1.9 — "doğrulanamayanlar" için gözlenen gerçek davranış

| # | Konu | Gözlem | Canlı öncesi iyzico teyidi |
|---|---|---|---|
| 1 | `identityNumber` | Placeholder `11111111111` sandbox'ta kabul edildi (Faz 2; bu fazda da). | **Evet** |
| 2 | CF token ömrü | Başlatma yanıtında `tokenExpireTime: 1800` (30 dk). Terk edilmiş token sorgusu `5122` döner. | Hayır (canlıda aynı olduğu doğrulanabilir) |
| 3 | Aynı gün iade mi iptal mi | `/payment/refund` aynı gün kısmi iadeyi **başarıyla** yapıyor (`hostReference` dönüyor), iptal zorunlu değil; `/payment/cancel` tam tutar aynı gün çalışıyor (Faz 3). | **Evet** (canlı bankada) |
| 4 | `paymentPageUrl` / `checkoutFormContent` | `paymentPageUrl` dönüyor (`sandbox-cpp.iyzipay.com?token=…`); `checkoutFormContent` Base64 değil düz HTML script. Yönlendirme yöntemi seçildi, gömülü form yok (Faz 2). | Hayır |
| 5 | Taksitte `paidPrice` | İyzico tablosu vade farkını gösteriyor (1.340 TL → 1.383,14 / 1.410,29), yani `paidPrice ≠ price`. Ancak taksitli ödeme tamamlanamadı, iade tavanı gerçek denenmedi. | **Evet** |
| 6 | Yanıt imzası fiyat biçimi | Başlatma ve sorgulama imzaları dokümandaki formülle doğrulandı (`price`/`paidPrice` sondaki sıfırlar atılarak). `fraudStatus` ve `itemTransactions` yanıtta geliyor (Faz 2). | Hayır |

Bunlara ek gözlemler:
- **4.1 OTP:** Sandbox 3DS sahte sayfası dokümandaki `123456`'yı reddediyor, sayfada gösterilen kodu (`283126`) kabul ediyor. Panelin "Test Rehberi"ndeki metin buna göre düzeltildi. `IYZICO_SANAL_POS_PLANI.md` bölüm 1.1 hâlâ `123456` yazıyor; plan dosyasına dokunulmadı.
- **4.2** Sandbox 3DS ekranındayken sorgu `paymentStatus=FAILURE` dönüyor (hata kodu yok). Bu yüzden FAILURE yalnızca callback/webhook'ta ya da token ömrü dolunca kesin sayılıyor; erken FAILED yazmak doğru kodu girip ödeyen müşteriyi "ödenmedi" bırakırdı.
- **4.3** iyzico formu hata kartlarını tarayıcıda reddediyor (sunucuya gitmiyor). `4151…` formda takılı kalıyor.
- **4.4** İade yanıtının `signature` alanı doğrulanmıyor; iade yalnızca `status=success` + HTTPS/IYZWSv2 kimlik doğrulaması ile kabul ediliyor.

## 5. Güvenlik geçişi (plan bölüm 7, kod üzerinde)

| Madde | Sonuç | Kanıt |
|---|---|---|
| Tutar/indirim/kargo DB'den | Geçti | `/api/odeme/baslat` istemciden yalnızca `orderNumber` alır; `initializePayment` tutarı `order.totalCents`'ten kurar; `/api/orders` satır fiyatını DB'den (`effectivePrice`) okur. |
| Secret/API key sızıntısı (kod) | Geçti | `logPayment` çağrılarında yalnızca kısa özet; `client.ts` istek/yanıt gövdesi loglamıyor, hata metni genel. `process.env` kullanımı yalnızca `PAYMENT_ENCRYPTION_KEY` ve `VERCEL_ENV`. |
| Secret/API key sızıntısı (istemci paketi) | Geçti | Üretilmiş `.next/static` (83 dosya) tarandı: `secretKey`, `IYZWSv2`, `iyzipay.com`, `createHmac`, `aes-256-gcm`, `SecretKeyEnc`, `ApiKeyEnc`, `DATABASE_URL`, `CRON_SECRET`, `NEXTAUTH_SECRET` → 0 eşleşme. `PAYMENT_ENCRYPTION_KEY` ve `sandbox-` yalnızca Türkçe hata **metinlerinde** geçiyor (değer değil). `.env` içindeki 12+ karakterlik hiçbir değer istemci çıktısında yok. |
| Ödeme modülleri istemciye giremez | Geçti | `iyzico/client.ts`, `settings.ts`, `reconcile.ts`, `refund.ts` vb. `server-only`; `"use client"` dosyalarından `lib/payment` importu yok. Panel yalnızca "son 4" / "kayıtlı (gizli)" metni alır. |
| LIVE yalnızca production | Geçti | `effectiveMode` → `resolveModeFrom(mode, VERCEL_ENV)`; `refund.ts` yerel/preview'da LIVE iadeyi reddeder; canlı bağlantı testi yalnızca production. |
| HMAC karşılaştırmaları `timingSafeEqual` | Geçti | Tüm imza doğrulamaları `safeEqualHex`'ten geçiyor; koddaki başka `===` imza karşılaştırması yok. |
| Callback/webhook bilinmeyen girdide 500 vermez | Geçti (bir tasarım istisnasıyla) | Callback tokensiz/bilinmeyen → 303. Webhook bozuk gövde 400, bilinmeyen token 200. **İstisna:** iyzico'da henüz ödemesi olmayan geçerli token için webhook 500 döner (iyzico yeniden dener, tasarım gereği). |
| noindex | Geçti | `/odeme`, `/odeme/basarisiz`, `/odeme/tesekkurler` → `noindex, nofollow`; `/api/odeme/durum` → `X-Robots-Tag: noindex`; `robots.txt` `/odeme` ve `/api/odeme` Disallow. |
| Kart / TCKN saklanmaz | Geçti | Kart bilgisi yalnızca iyzico formunda; yalnızca marka, tip, BIN, son 4 saklanıyor. TCKN toplanmıyor. |
| Yetkisiz erişim | Geçti | `/admin/sanal-pos` → 307 `/admin/login`; cron uç noktası Bearer olmadan 401. |

## 6. Bilinen açıklar ve öneriler (hiçbiri değiştirilmedi)

1. **Çift ödeme için panelde iade yolu yok.** İkinci denemenin `itemTransactions`'ı saklanmıyor; şimdilik iyzico panelinden iade + "Uyarıyı kapat". İstenirse `/v2/payment/refund` ile eklenebilir.
2. **İadede kupon hakkı ve sadakat puanı geri verilmiyor** (planda yok).
3. `CRON_SECRET` Bearer karşılaştırması `!==` (sabit zamanlı değil). Bu bir HMAC karşılaştırması değil ve aynı desen mevcut `sepet-hatirlatma` rotasında da var; yeni açık değil, düşük risk.
4. `POST /api/orders` geçersiz JSON gövdesinde 500 döner (`req.json()` try/catch dışında). Mevcut davranış, ödeme akışının parçası değil.
5. `GET /api/odeme/durum?siparis=…` kimlik doğrulamasız; sipariş numarasını bilen biri yalnızca durum bilgisini görür (kişisel veri yok). `kontrol=1` açık denemesi olan siparişte iyzico'yu sorgular; hız sınırı yok. Düşük risk.
6. Bu fazdaki panel metni düzeltmesi dışında ödeme mantığında değişiklik yapılmadı.

## 7. iyzico'ya sorulacaklar

1. **Geçerli imzalı webhook (`X-IYZ-SIGNATURE-V3`):** Hesapta imza özelliğinin açılması (entegrasyon@iyzico.com) ve canlı bir bildirimde formülün (`secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status`) doğrulanması. Şu an yalnızca dokümandaki formülle birim testli; canlıda hiç geçerli imzalı istek denenmedi.
2. **Taksitli ödeme:** Sandbox test kartları taksit sunmadığı için koşulamadı. Canlıda taksitli işlemde `paidPrice`, `itemTransactions[].paidPrice` dağılımı ve **kalem bazlı iade tavanının** `price` mı `paidPrice` mı olduğu. Teyit gelene kadar taksit "Tek çekim" kalmalı.
3. **`identityNumber` placeholder** `11111111111`: canlıda kabul ediliyor mu, sözleşme/onay gerekir mi? (TCKN toplamıyoruz.)
4. **Aynı gün iade/iptal davranışı** canlı bankada: sandbox'ta `/payment/refund` aynı gün hata vermiyor, canlıda iptal zorunlu olabilir mi? İptalin kart ekstresine yansıması.
5. **İade yanıtı imzası:** `/payment/refund` ve `/payment/cancel` yanıtının `signature` alanının hangi alanlardan hesaplandığı (şu an doğrulanmıyor).
6. **Callback alan adı:** `callbackUrl` olarak `https://bollmark.com/...` kullanılıyor; `www` ile ilgili bir kısıt var mı? (İkisi de yönlendirmesiz 200 dönüyor.)
7. Bilgi: dokümandaki sandbox 3DS OTP'si `123456`, gerçek sahte sayfa farklı kod gösteriyor; doküman tutarsızlığı.

## 8. Değişiklik özeti (Sanal POS işi, `9087d39..HEAD`, `DEPLOY_STATUS.md` hariç)

70 dosya, +5473 / −101. Yalnızca ödeme: `src/lib/payment`, `api/odeme`, `api/cron/odeme-mutabakat`, `odeme/`, `admin/sanal-pos`, `prisma` → 40 dosya, +4054 / −33. Faz 4'te tek kod değişikliği: `src/app/(admin)/admin/sanal-pos/page.tsx` içinde OTP metni.

## 9. Test verisi temizliği

Faz 4 regresyonundan sonra POS **tekrar kapatıldı** (`isEnabled=false`, `/api/orders` yine 503). Test verisi kullanıcı talimatıyla silindi: test siparişi `BLM260921-1013` ve bağlı ödeme denemesi, terk edilmiş sepet kaydı, 5 ödeme günlüğü satırı ve 1 denetim satırı. Gömlek BEYAZ/M stoğu 3'e geri yazıldı. Doğrulama: 0 sipariş, 0 ödeme denemesi, 8 günlük (başlangıç değeri), POS ayarları başlangıç durumunda.
Test siparişinin admin/müşteri "yeni sipariş" mailleri example.com ve admin adresine gitmiş olabilir.
