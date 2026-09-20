# iyzico Sanal POS Entegrasyonu — Plan ve Teknik Şartname

Durum: uygulama bekliyor. Uygulama sırası ve promptlar: `IYZICO_SANAL_POS_PROMPTLARI.md`.
Kural: ödeme = hassas alan. "Muhtemelen çalışır" yok; her adım sandbox'ta uçtan uca kanıtlanır.

Hedef: iyzico başvurusu onaylanmadan sistemin tamamı hazır ve sandbox'ta test edilmiş olsun.
Onay gelince yapılacak tek şey: panelde Sanal POS sayfasına canlı API Key + Secret Key'i
yapıştırmak ve modu "Canlı"ya almak.

---

## 1. Araştırma bulguları (iyzico resmi dokümanından doğrulandı)

### 1.1 Ortamlar ve anahtarlar
- Sandbox: `https://sandbox-api.iyzipay.com` — Canlı: `https://api.iyzipay.com`
- İki ortamın anahtarları tamamen ayrıdır. Sandbox anahtarları `sandbox-` ile başlar.
- Sandbox hesabı başvuru onayını beklemeden açılabilir: sandbox-merchant.iyzipay.com/auth/register →
  giriş → Ayarlar > Merchant Settings > API Keys > "Show detail".
- Sandbox 3D Secure OTP kodu: `123456`.

### 1.2 Kimlik doğrulama (IYZWSv2, HMAC-SHA256)
Her istek için:
1. `randomKey` üret (her istekte benzersiz, ör. zaman damgası + rastgele sayı).
2. `payload = randomKey + uriPath + requestBodyString` (uriPath sorgu parametresiz sadece yol,
   örn. `/payment/iyzipos/checkoutform/initialize/auth/ecom`; body, gönderilen JSON string'in birebir aynısı).
3. `signature = HMAC_SHA256(payload, secretKey)` → **hex**.
4. `authString = "apiKey:" + apiKey + "&randomKey:" + randomKey + "&signature:" + signature`
5. Header'lar: `Authorization: IYZWSv2 <base64(authString)>` (IYZWSv2 ile base64 arasında tek boşluk),
   `x-iyzi-rnd: <randomKey>`, `Content-Type: application/json`.
- Hatalar: 1000 Geçersiz imza, 1001 API bilgileri bulunamadı, 1004 rnd eksik, 1006/1007 api key/imza eksik.

### 1.3 Ödeme Formu (Checkout Form, CF) — seçilen yöntem
Kart bilgisi hiçbir zaman sitemize gelmez, iyzico'nun formunda girilir; 3D Secure ve BIN kontrolü
form içinde yürür.

**Başlatma:** `POST /payment/iyzipos/checkoutform/initialize/auth/ecom`
- Zorunlu: `price`, `paidPrice`, `currency`(TRY), `callbackUrl` (geçerli SSL), `buyer`, `shippingAddress`
  (PHYSICAL ürün varsa), `billingAddress`, `basketItems` (en az 1).
- Opsiyonel: `locale`(tr), `conversationId`, `basketId`, `paymentGroup`(PRODUCT), `enabledInstallments`.
- buyer zorunlu: id, name, surname, identityNumber, email, gsmNumber, registrationAddress, city, country
  (+ ip; CF/PWI şemasında zorunlu işaretli).
- address zorunlu: address, contactName, city, country. basketItem zorunlu: id, price, name, category1, itemType (PHYSICAL/VIRTUAL).
- Yanıt: `status`, `token`, `checkoutFormContent` (dokümana göre Base64), `paymentPageUrl`, `signature`, `conversationId`.
- Doğrulama kuralları / hatalar: sepet kalemleri toplamı `price`'a eşit olmalı (5062), kalem fiyatı 0 veya
  negatif olamaz (5050), hesap limiti aşılırsa 5008, telefon `+90` ile başlamalı (27), e-posta formatı (3/5).

**Sonuç sorgulama:** `POST /payment/iyzipos/checkoutform/auth/ecom/detail` gövde: `{locale, conversationId, token}`
- Yanıt: `status`, `paymentStatus`(SUCCESS/FAILURE), `paymentId`, `price`, `paidPrice`, `installment`, `currency`,
  `basketId`, `conversationId`, `token`, `fraudStatus`, `cardType`, `cardAssociation`, `cardFamily`,
  `binNumber`, `lastFourDigits`, `hostReference`, `authCode`, `signature`, `itemTransactions[]`.
- `fraudStatus`: **1** onaylı, **0** inceleniyor (kargolama! sadece 1'de yapılır, 0'da bildirimi bekle), **-1** red.
- `itemTransactions[]`: her kalem için `paymentTransactionId` (İADE için şart, kesin saklanacak), `itemId`,
  `price`, `paidPrice`, `transactionStatus`.
- Callback davranışı: form bitince iyzico tarayıcıyı `callbackUrl`'e yönlendirir (POST), içinde `token` gelir;
  sonuç YALNIZCA bu token ile sorgulanarak öğrenilir.

### 1.4 Yanıt imzası doğrulama (HMAC-SHA256, hex, alanlar `:` ile birleştirilir, anahtar = secretKey)
- CF başlatma: `conversationId:token`
- CF sorgulama: `paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token`
- Fiyat alanlarında **sondaki sıfırlar atılır** (`10.50` → `10.5`, `10.00` → `10`) — imza hesabından önce.

### 1.5 Webhook (bildirim)
- CF/HPP formatı olayı: `CHECKOUT_FORM_AUTH` (diğerleri: BANK_TRANSFER_AUTH, CREDIT_PAYMENT_* …).
- Gövde: `paymentConversationId, merchantId, token, status, iyziReferenceCode, iyziEventType, iyziEventTime, iyziPaymentId`.
- İmza header'ı: `X-IYZ-SIGNATURE-V3` = HMAC-SHA256 hex( `secretKey + iyziEventType + iyziPaymentId + token + paymentConversationId + status` ).
  (Eski `X-Iyz-Signature` ve `-V2` kullanımdan kalktı.)
- İlk bildirim ödeme denemesinden 10–15 sn sonra; 2xx dönene kadar 15 dk arayla en fazla 3 tekrar.
- URL, iyzico merchant panelinde Ayarlar > Firma Ayarları'na (HTTPS) girilir.
- İmza özelliği hesapta ayrıca açtırılmalı: entegrasyon@iyzico.com.

### 1.6 İptal ve iade
- **İptal** `POST /payment/cancel` (`paymentId`; opsiyonel reason/description/ip/conversationId): sadece aynı gün,
  banka gün sonu kesintisinden önce; **sadece tam tutar**; kart ekstresine yansımaz.
- **İade** `POST /payment/refund` (`paymentTransactionId`, `price`, opsiyonel ip/reason/description/conversationId/currency):
  ödemeden sonra **365 güne kadar**; tam veya **kısmi**, **birden çok kısmi** iade mümkün; iade tutarı işlemin
  kalan iade edilebilir tutarını aşamaz; yanıtta `retryable` ve `signature` var. Karta yansıma süresi banka bağlı.
- **İade v2** `POST /v2/payment/refund` (`paymentId`, `price`): tutar bazlı, sistem kalemlere otomatik dağıtır.
- `reason`: `OTHER | FRAUD | BUYER_REQUEST | DOUBLE_PAYMENT`.
- Karar: kalem bazlı iade için v1 (`paymentTransactionId`) kullanılır.

### 1.7 Sandbox test kartları
Başarılı: Visa kredi `4603450000000000`, Visa debit `4766620000000001`, MasterCard kredi `5526080000000006`,
MasterCard debit `5890040000000016`, Troy kredi `9792030000000000`, AmEx `374427000000003`,
yabancı kart `5400010000000004`. SKT gelecek tarih, CVC rastgele 3 hane.
Hata kartları: `4111111111111129` yetersiz bakiye · `4129111111111111` do not honour · `4128111111111112` geçersiz işlem ·
`4125111111111115` süresi dolmuş · `4124111111111116` geçersiz CVC · `4121111111111119` fraud şüphesi ·
`4130111111111118` genel hata · `4131111111111117` mdStatus 0 · `4141111111111115` mdStatus 4 ·
`4151111111111112` 3DS başlatılamadı · `5406670000000009` başarılı ama iptal/iade edilemez (iade hata yolunu test eder).

### 1.8 Hata kodu özeti (kullanıcıya ham gösterilmez, Türkçe eşleme yapılır)
10051 limit/bakiye yetersiz · 10054 SKT hatalı · 10084 CVC hatalı · 10093 internet alışverişine kapalı ·
10012/10005/10201/10220 banka reddi · 10215 geçersiz kart · 10217 banka kartı sadece 3DS · 10218 debit taksit yapamaz ·
10221 yabancı kart kapalı · 10034 güvenlik denetimi · 10041/10043 kayıp/çalıntı kart (kullanıcıya genel mesaj).

### 1.9 Doğrulanamayanlar (kodda varsayım yapılmayacak; sandbox'ta gözlemlenip rapora yazılacak)
1. `identityNumber` için biçim/placeholder kuralı (dokümanda "zorunlu" yazıyor). Planlanan: TCKN toplamıyoruz (KVKK),
   `11111111111` placeholder. Sandbox'ta çalıştığı doğrulanacak, canlı için iyzico entegrasyon desteğinden teyit alınacak.
2. CF token geçerlilik süresi (dokümanda yok). Bu yüzden sonuç sorgusu kısa sürede ve tekrar tekrar güvenli çalışacak şekilde tasarlandı.
3. Aynı gün iade mi iptal mi zorunlu, `/payment/refund` aynı gün ne yapıyor → sandbox'ta iki yol da denenip davranış kaydedilecek.
4. `paymentPageUrl` sandbox'ta dönüyor mu, `checkoutFormContent` Base64 mi düz mü.
5. Taksitli işlemde `paidPrice` ondalık hassasiyeti ve vade farkının yansıması (iyzico sözleşmesine bağlı).
6. Yanıt imzasında fiyatların tam biçimi (ör. `100.5` mi `"100.50"` mi geliyor).

---

## 2. Mevcut kodda tespit edilen boşluklar (ödeme bağlanınca kırılacak yerler)

| # | Bulgu | Etki | Çözüm |
|---|-------|------|-------|
| a | `api/orders/route.ts` siparişi oluşturur oluşturmaz admin + müşteri "sipariş alındı" maili atıyor, `checkout-form.tsx` sepeti temizleyip teşekkürler'e yönlendiriyor | Ödeme yokken "siparişiniz alındı" denir | Mail, sepet temizleme ve teşekkürler ekranı **ödeme doğrulanınca** çalışacak |
| b | Kupon `usedCount` artışı ve sadakat puanı düşümü sipariş oluşurken yapılıyor | Ödeme başarısız/terk olursa kupon hakkı ve puan kaybolur | Başarısız/süresi dolan siparişte geri verme (release) fonksiyonu |
| c | Sitede stok hiç düşmüyor (stok Vega'dan `Servis` rotasıyla mutlak değer olarak yazılıyor) | Aşırı satış | Ödeme başarılı anında atomik stok düşümü; Vega mutlak değer yazdığı için çift sayım oluşmaz |
| d | Admin sipariş sayfasında "Ödendi Olarak İşaretle" butonu var | Kart ödemesi olmadan sipariş ödenmiş sayılır | İyzico denemesi olan siparişte gizlenir; diğerlerinde onay + denetim kaydı |
| e | `notifyCustomerStatusChange` PAID durumunda ayrıca mail atıyor | Ödeme başarısında iki mail | Ödeme sonrası tek birleşik "siparişiniz alındı ve ödemeniz onaylandı" maili; otomatik geçişte durum maili tetiklenmez |
| f | `generateOrderNumber()` günlük 4 haneli rastgele sayı, `orderNumber @unique` | Nadir çakışmada 500 | Çakışmada yeniden deneme döngüsü |
| g | `formatPrice()` kuruşu yuvarlayıp gösteriyor | Ödeme tutarı için kullanılırsa hata | Ödeme için ayrı, tam sayı kuruş tabanlı para yardımcıları |
| h | `.env` ve Neon veritabanı yerel ile canlıda **aynı** | Yerelde canlı anahtar kullanılırsa gerçek kart çekilir | LIVE modu yalnızca `VERCEL_ENV === "production"`'da geçerli, diğer her yerde zorla SANDBOX |
| i | `order-notifications.ts` içinde `https://bollmark.com` sabit yazılı | Domain değişirse kırılır | Tek `SITE_URL` env kaynağı |
| j | `odeme/tesekkurler/page.tsx` `searchParams`'ı eşzamanlı tip olarak okuyor; proje "Next 16, bildiğin Next değil" uyarısı taşıyor | Yeni sayfalarda yanlış API | `node_modules/next/dist/docs/` okunacak (AGENTS.md kuralı) |
| k | `proxy.ts` matcher `api`'yi hariç tutuyor | Callback/webhook önizleme kapısına takılmaz (iyi) | Değişiklik gerekmez; test edilecek |
| l | Vega `Servis` rotasında bugün sipariş uç noktası görünmüyor | İleride sipariş çekilirse ödenmemişler karışabilir | Not: Vega'ya sadece `paymentStatus=PAID` siparişler verilecek (Claude Code teyit etsin) |
| m | PENDING_PAYMENT'ta bekleyen siparişleri temizleyen bir mekanizma yok | Terk edilen ödemeler sonsuza kadar bekler, stok/kupon/puan bağlı kalır | Süre dolumu + mutabakat (bölüm 5.E) |

---

## 3. Mimari kararlar

1. **Yöntem:** iyzico Ödeme Formu (CF). Kendi kart formumuz yok.
2. **Gösterim:** Başlatma yanıtındaki `paymentPageUrl`'e yönlendirme (script enjekte etmekten daha az riskli). Sandbox'ta
   `paymentPageUrl` dönmezse `checkoutFormContent` ile gömülü form (script yeniden çalıştırma dikkat gerektirir) fallback olur; ikisi birden yazılmaz, sandbox sonucuna göre biri seçilir.
3. **İstemci:** resmi `iyzipay` npm paketi yerine ince, tip güvenli kendi istemcimiz (`fetch` + `node:crypto`).
   Gerekçe: sadece ~6 uç nokta, imza kodu kısa, bağımlılık ve Next 16 uyum riski yok, davranış sandbox'ta kanıtlanır.
4. **Anahtar saklama (önceki "sadece env" önerisinin güncellenmiş hali):** Anahtarlar panelden girilir ama veritabanında
   **AES-256-GCM ile şifreli** durur; şifreleme anahtarı `PAYMENT_ENCRYPTION_KEY` (Vercel env + yerel `.env`, rastgele 32 bayt).
   Secret istemciye hiçbir zaman geri gönderilmez. Böylece "onay gelince kodları yapıştır" akışı çalışır ve DB sızsa bile anahtar açık olmaz.
5. **Mod belirleme (tek fonksiyon):** `resolveMode()` → DB'de LIVE ve `VERCEL_ENV==="production"` ise LIVE; aksi halde SANDBOX.
6. **Sanal POS kapalıysa/hazır değilse** `/api/orders` sipariş oluşturmaz (503 + anlaşılır mesaj). Site herkese açıkken ödemesiz sahte sipariş oluşmasın.
7. **Sandbox modunda checkout'ta görünür uyarı:** "Test ödeme modu: gerçek kart çekilmez." (iyzico incelemecisi ve müşteri şeffaflığı için). Canlıda uyarı kalkar.
8. **Şema değişiklikleri sadece eklemeli** (yeni tablo/nullable veya varsayılanlı sütun). Veritabanı yerel/canlı ortak olduğu için `prisma db push` anında canlıyı etkiler; hiçbir mevcut sütun silinmez/yeniden adlandırılmaz.
9. **Callback host'u kanonik olmalı:** `SITE_URL` Vercel'deki birincil alan adıyla birebir aynı olacak (www ↔ non-www yönlendirmesi POST'u GET'e çevirir ve callback'i bozar). Claude Code Vercel domain ayarını okuyup teyit edecek.

---

## 4. Veri modeli (yeni / eklenen alanlar)

```
PaymentSettings (singleton, id="singleton")
  provider "IYZICO" | isEnabled false | mode "SANDBOX" | maxInstallment 1
  orderExpiryMinutes 60
  sandboxApiKeyEnc? sandboxSecretKeyEnc? liveApiKeyEnc? liveSecretKeyEnc?   (AES-256-GCM: iv+tag+ciphertext, base64)
  sandboxKeyLast4? liveKeyLast4?  (yalnızca panelde "son 4 hane" göstermek için)
  lastTestAt? lastTestOk? lastTestMode? lastTestMessage?
  updatedAt

Order (ekler)
  paymentStatus  default "UNPAID"   // UNPAID | PAID | REVIEW | FAILED | PARTIALLY_REFUNDED | REFUNDED
  paymentProvider? paymentMode? paidAt? paidCents? installment?
  paymentExpiresAt?
  needsAttention Boolean default false, attentionNote String?
  shippingPaymentTransactionId? shippingPaidCents? shippingRefundedCents default 0

OrderItem (ekler)
  paymentTransactionId? paidCents? refundedCents default 0

PaymentAttempt   // her ödeme denemesi
  id, orderId, mode, token @unique, conversationId, status  // INITIATED|SUCCESS|FAILED|REVIEW|EXPIRED
  errorCode?, errorMessage?, paymentId?, paidCents?, installment?, fraudStatus?
  cardAssociation?, cardType?, cardFamily?, binNumber?, lastFourDigits?
  createdAt, completedAt?

PaymentRefund
  id, orderId, attemptId, orderItemId?/isShipping, paymentTransactionId, amountCents, kind "REFUND"|"CANCEL",
  reason, description?, status "PENDING"|"SUCCESS"|"FAILED", errorCode?, errorMessage?, hostReference?,
  restock Boolean, createdByEmail, createdAt, completedAt?

PaymentLog       // yalnızca gözlem: kart/anahtar/secret/token ASLA yok
  id, createdAt, kind (INIT|CALLBACK|RETRIEVE|WEBHOOK|REFUND|CANCEL|TEST|RECONCILE|EXPIRE|SETTINGS),
  orderId?, attemptId?, ok Boolean, httpStatus?, errorCode?, summary (kısa metin)
```
Indexler: PaymentAttempt(orderId), (status, createdAt); PaymentLog(createdAt), (orderId); Order(paymentStatus).

---

## 5. Akışlar

### A) Checkout → başlatma
1. `POST /api/orders` (mevcut, değiştirilir): Sanal POS hazır mı kontrol; sipariş `PENDING_PAYMENT` + `paymentStatus=UNPAID`
   + `paymentExpiresAt = now + orderExpiryMinutes`; **mail yok, sepet temizleme yok**; sipariş no çakışmasında yeniden deneme.
   Kupon/puan mevcut mantıkla düşülür (release yolu bölüm E).
2. İstemci `POST /api/odeme/baslat {orderNumber}` çağırır. Sunucu:
   - Siparişi DB'den okur; `PENDING_PAYMENT`, silinmemiş, süresi dolmamış olmalı. Aynı siparişe 10 dk'da en fazla 5 başlatma (hız sınırı).
   - Her satırın stoğunu yeniden kontrol eder (yetersizse anlaşılır mesaj).
   - `totalCents === 0` ise iyzico'ya gitmeden serbest sipariş olarak sonlandırır (paymentProvider "NONE").
   - Sepeti kurar: her `OrderItem` için **tek** basketItem (`id=OrderItem.id`, `name`, `category1`, `itemType=PHYSICAL`,
     `price` = satır tutarı − orantılı indirim payı). Kargo > 0 ise ayrı kalem (`id="SHIPPING"`, `category1="Kargo"`); ücretsizse gönderilmez.
   - **İndirim dağıtımı:** toplam indirim (bundle + kupon + puan) satır toplamlarına oranla **en büyük kalan (largest remainder)** yöntemiyle kuruş kuruş dağıtılır;
     kalem toplamı her zaman `totalCents − shippingCents`'e tam eşit olur. Bir kalem 0'a düşerse 1 kuruşa sabitlenir, fark en büyük kalemden alınır.
     Gönderimden önce `Σ basket === totalCents` kontrolü; tutmazsa **iyzico'ya gitme**, logla, kullanıcıya genel hata ver.
   - `price = paidPrice = totalCents/100` (iki ondalık string). `currency=TRY`, `paymentGroup=PRODUCT`, `locale=tr`,
     `basketId = orderNumber`, `conversationId = attempt.id`, `callbackUrl = ${SITE_URL}/api/odeme/iyzico/callback`,
     `enabledInstallments` = panel ayarına göre (1..max, izinli kümeden).
   - buyer: `id = customerId ?? "guest-"+order.id`; ad/soyad `customerName`'den bölünür (tek kelime ise soyad = ad);
     `gsmNumber` `+90XXXXXXXXXX` normalize edilir (geçersizse form hatası); `identityNumber` placeholder (bkz. 1.9/1); `email`; `ip` (`x-forwarded-for` ilk değer veya `x-real-ip`);
     shipping ve billing adres aynı (`contactName`, `city`, `country="Turkey"`, `zipCode` varsa).
   - Yanıtı doğrular: `status==="success"` + başlatma imzası (`conversationId:token`) → `PaymentAttempt(INITIATED, token)` kaydı → istemciye `paymentPageUrl`.
     Başarısızsa attempt `FAILED`, hata kodu/mesajı log'a, kullanıcıya Türkçe genel mesaj.
3. İstemci `window.location = paymentPageUrl`.

### B) Callback (`POST /api/odeme/iyzico/callback`)
- `formData().token` oku (yoksa JSON/query fallback). Token → `PaymentAttempt`. Bilinmeyen token → loglayıp anasayfaya 303.
- **Sonuç yalnızca sunucudan sorgulanarak** öğrenilir: `retrieve(token)` (yönlendirmedeki hiçbir parametreye güvenilmez).
- **PAID sayılması için hepsi doğru olmalı:** HTTP başarılı ∧ `status=success` ∧ `paymentStatus=SUCCESS` ∧ yanıt imzası geçerli ∧
  `token==attempt.token` ∧ `conversationId==attempt.id` ∧ `basketId==order.orderNumber` ∧ `currency=TRY` ∧
  `price == order.totalCents` (kuruş, tam sayı karşılaştırma, float çarpma yok) ∧ `paidPrice ≥ price`.
- `fraudStatus`: `1` → PAID; `0` → `paymentStatus=REVIEW` (kargolama/hazırlama yok, webhook veya "iyzico'dan sorgula" ile çözülür); `-1` → FAILED.
- **Tam bir kez çalışma (idempotency):** durum geçişi koşullu güncellemeyle yapılır
  (`updateMany({where:{id, status:"INITIATED"}})` → sayı 1 ise kazanan). Yenile/tekrar POST, webhook ile çakışma, çift tık → yan etkiler (stok, mail, durum) **bir kez** çalışır.
- PAID işlemi tek transaction: `Order.status=PAID`, `paymentStatus=PAID`, `paidAt`, `paidCents`, `installment`;
  `itemTransactions` → her `OrderItem.paymentTransactionId/paidCents` (eşleme `itemId`), kargo kalemi `shippingPaymentTransactionId`;
  attempt `SUCCESS` + kart meta; **atomik stok düşümü** (`updateMany where stock >= qty`; biri başarısızsa siparişi geri almaz — para alındı —
  `needsAttention=true` + not + admin maili).
- Transaction sonrası (best-effort, hata akışı bozmaz): admin "Yeni sipariş" maili + müşteri birleşik onay maili, terk edilmiş sepet `recoveredAt`, denetim kaydı (aktör "sistem/iyzico").
- **Çift ödeme:** sipariş zaten PAID iken ikinci bir attempt SUCCESS dönerse → o attempt kaydedilir, `needsAttention` + "ÇİFT ÖDEME — iade edin" notu, admin maili (otomatik iade yok).
- **Geç ödeme:** sipariş süresi dolup CANCELLED olduktan sonra ödeme gelirse → ödeme kaydedilir, sipariş otomatik yeniden açılmaz, `needsAttention` + not (elle iade veya yeniden açma).
- Sonunda **303** ile yönlendir (POST→GET): başarı `/odeme/tesekkurler?siparis=…`, başarısız `/odeme/basarisiz?siparis=…`. Tüm rota `try/catch`: tarayıcıya asla 500 verme.
- `export const dynamic = "force-dynamic"`, Node runtime.

### C) Sayfalar
- `/odeme/tesekkurler`: DB'deki gerçek duruma bakar (URL'ye güvenmez). PAID → teşekkür + sepeti temizle. REVIEW/beklemede → "Ödemeniz doğrulanıyor…" (birkaç sn'de bir `GET /api/odeme/durum?siparis=` ile yoklama). FAILED → başarısız sayfası. Kişisel veri göstermez.
- `/odeme/basarisiz`: Türkçe eşlenmiş sebep + "Tekrar dene" (süre dolmadıysa aynı siparişe yeni başlatma) + "Sepete dön".
- Checkout'ta "Siparişi Tamamla" → "Ödemeye Geç" ; mevcut "test modu" kutusu sandbox uyarısıyla değiştirilir.

### D) Webhook (`POST /api/odeme/iyzico/webhook`) — güvenlik ağı
- Gövdeyi zod ile doğrula. `X-IYZ-SIGNATURE-V3` varsa `timingSafeEqual` ile doğrula (yanlışsa 401 + log).
  İmza header'ı hiç yoksa (özellik henüz açılmamış olabilir) **yine de** işlem yapılır çünkü aksiyon payload'a değil, `retrieve(token)` sonucuna dayanır.
- `CHECKOUT_FORM_AUTH` → `reconcile(token)` (B ile aynı ortak fonksiyon). Diğer olaylar: loglanır, 200.
- Yanıt: işlendi / zaten işlenmişti / bilinmeyen token → **200**. Geçici hata (DB, iyzico ağ) → 5xx (iyzico yeniden dener: 15 dk arayla en fazla 3).

### E) Süre dolumu ve mutabakat
- `reconcile()` ortak fonksiyonu: bekleyen (INITIATED) attempt için `retrieve` çağırır; ödendiyse sonlandırır.
- Süresi dolan (`paymentExpiresAt < now`) PENDING_PAYMENT sipariş: önce son bir sorgu (ödemiş olabilir); ödenmemişse `CANCELLED`,
  attempt'ler `EXPIRED`, **kupon `usedCount` −1**, **puan iadesi** (LoyaltyTransaction geri kaydı + müşteri bakiyesi), denetim kaydı.
- Tetikleyiciler: (1) günlük cron `/api/cron/odeme-mutabakat` (mevcut `CRON_SECRET` deseni; `vercel.json`'daki plan limitlerine bak),
  (2) tembel tetik: `/api/odeme/baslat` ve admin sipariş listesi açılışında küçük parti (≤20), (3) admin "iyzico'dan durumu sorgula" butonu.

### F) İade / iptal (yalnızca ADMIN rolü)
- Sipariş detayında "Ödeme" kartı: sağlayıcı, mod, `paymentId`, ödenen tutar, taksit, kart markası + son 4 hane, fraud durumu, kalem bazlı "iade edilebilir kalan" tablosu, iade geçmişi.
- Eylemler: **Tam iade**, **Kalem/kısmi iade** (tutar ≤ kalan), sebep seçimi (`BUYER_REQUEST/DOUBLE_PAYMENT/FRAUD/OTHER`), "stoğa geri ekle" onay kutusu, onay penceresi.
- Sunucu: `PaymentRefund(PENDING)` oluştur (eşzamanlı çift tık koruması: kalan tutar transaction içinde kilitli hesaplanır) → `POST /payment/refund` (`conversationId = refund.id`, `ip`, `reason`) →
  başarılıysa `SUCCESS`, `OrderItem.refundedCents` artır, `Order.paymentStatus` = PARTIALLY_REFUNDED/REFUNDED, tam iade ise `Order.status=REFUNDED`, (seçildiyse) stok iadesi, müşteri maili, denetim kaydı (`PAYMENT_REFUND_CREATED`).
  Başarısızsa `FAILED` + iyzico hata mesajı admin'e gösterilir, sayaçlar **değişmez**.
- Aynı gün, gönderilmemiş, tam iptal: `POST /payment/cancel` (yalnızca tam tutar). Hangi yolun ne zaman çalıştığı sandbox'ta test edilip rapora yazılır; refund aynı gün hata verirse arayüz otomatik "iptal" önerir.
- Ödemesi iyzico ile alınmış siparişte "Ödendi Olarak İşaretle" butonu gizlenir.

---

## 6. Admin panel: **Sistem → Sanal POS** (`/admin/sanal-pos`, yalnızca ADMIN)
Sidebar "Sistem" grubuna `CreditCard` ikonlu "Sanal POS" eklenir; `PERSONEL` rolü erişemez (`roles.ts` mevcut mantığı yeterli, test edilecek).

1. **Durum kartı:** rozet (Kapalı / Test (Sandbox) / Canlı) + "Ödeme almaya hazır mı" kontrol listesi:
   anahtarlar tanımlı ✓ · `PAYMENT_ENCRYPTION_KEY` var ✓ · bağlantı testi başarılı ✓ · `SITE_URL` HTTPS ✓ · (Canlıda) production ortamı ✓.
2. **Ayarlar formu:** Sanal POS aç/kapat · Mod (Test/Canlı; Canlıya geçişte onay penceresi + canlı anahtarlar tanımlı ve son canlı bağlantı testi başarılı olmalı) ·
   4 alan: Sandbox API Key, Sandbox Secret Key, Canlı API Key, Canlı Secret Key (`type=password`, kaydedilince "•••• son 4: xxxx", boş bırakılırsa değişmez, "Değiştir" ile yenisi) ·
   Maksimum taksit (1/2/3/6/9/12) · Sipariş bekleme süresi (dk).
   Doğrulamalar: değerler `trim`; Sandbox anahtarı `sandbox-` ile **başlamalı**, Canlı anahtarı `sandbox-` ile **başlamamalı** (karışıklığı yakalar).
3. **Bağlantıyı Test Et:** yan etkisiz bir çağrı (`POST /payment/bin/check`, örnek BIN) ile kimlik doğrulamasını sınar; sonucu (başarılı / hata kodu + Türkçe açıklama, zaman) kaydeder. 1000/1001 → "anahtarlar geçersiz".
4. **Entegrasyon adresleri** (kopyala butonlu): Callback URL, Webhook URL ve iyzico panelindeki yeri (Ayarlar > Firma Ayarları), webhook imzası için entegrasyon@iyzico.com notu.
5. **Ödeme Günlüğü:** `PaymentLog` tablosu (sayfalı, tür/sonuç/sipariş no filtreli). Kart, anahtar, secret, token gösterilmez/saklanmaz.
6. **Test rehberi** (yalnız Sandbox'ta görünür): test kartları, OTP 123456.
7. Sipariş listesi: "Ödeme" rozeti + "Dikkat gerekiyor" filtresi; sidebar'da `needsAttention` sayısı rozeti.
- Denetim kaydı eylemleri (`audit-actions.ts`'e eklenir, **anahtar değerleri asla yazılmaz**): `PAYMENT_SETTINGS_CHANGED` (hangi alanlar), `PAYMENT_MODE_CHANGED`, `PAYMENT_CONNECTION_TESTED`, `PAYMENT_REFUND_CREATED`, `PAYMENT_CANCEL_CREATED`, `PAYMENT_MANUAL_RECONCILE`.

---

## 7. Güvenlik kontrol listesi
- Tutar/indirim/kargo **her zaman DB'den**; istemciden gelen tutara hiçbir yerde güvenilmez.
- Secret ve API key: loglara, hata yanıtlarına, istemci bundle'ına, `PaymentLog`'a asla girmez. Şifreli saklama, anahtar yoksa POS "hazır değil".
- Tüm HMAC karşılaştırmaları `timingSafeEqual`.
- Yanıt imzası doğrulanamıyorsa ödeme PAID **sayılmaz**; imza kontrolü sessizce kapatılmaz (sandbox'ta uyuşmazsa nedeni bulunur ve raporlanır).
- LIVE yalnızca production ortamında; preview/yerel her zaman SANDBOX.
- Callback/webhook: kimlik doğrulama beklemez ama sadece token → sunucu-sunucu sorgusuyla çalışır; bilinmeyen token güvenli şekilde yok sayılır.
- Kullanıcıya ham iyzico hata metni gösterilmez (Türkçe eşleme + genel mesaj).
- `/odeme/*` ve `/api/odeme/*` arama motoru dizinine alınmaz (noindex).
- KVKK: TCKN toplanmaz; logda kişisel veri yok; IP sadece istek anında iyzico'ya iletilir.

---

## 8. Sandbox test matrisi (hepsi geçmeden "hazır" denmez)
1. Başarılı ödeme (Visa kredi + 3DS OTP 123456) → sipariş PAID, stok düştü, tek mail, teşekkür sayfası, log kayıtları.
2. Debit kart, Troy, AmEx, yabancı kart başarılı akışları.
3. Yetersiz bakiye / CVC / SKT / do-not-honour → doğru Türkçe mesaj, sipariş PENDING kalır, "Tekrar dene" çalışır.
4. `4151111111111112` (3DS başlamadı), `4131111111111117` ve `4141111111111115` (mdStatus 0/4) → sonuç kaydedilir; beklenen davranış (başarı/başarısız) gözlemlenip dokümante edilir.
5. Ödeme sonrası tarayıcıyı kapatma (callback ulaşmıyor) → webhook veya "iyzico'dan sorgula" ile PAID olur.
6. Callback'e tekrar POST / sayfa yenileme / webhook + callback çakışması → yan etkiler tek sefer.
7. İki sekmede aynı siparişi iki kez ödeme → çift ödeme işaretlenir.
8. Süre dolumu: sipariş CANCELLED, kupon hakkı ve puan geri verildi. Süresi dolmuş siparişe geç ödeme → needsAttention.
9. İndirim dağıtımı birim testleri: 1000 rastgele senaryoda `Σ basket == totalCents`; %100 indirim; ücretsiz kargo; tek kalem; tek kuruş kalıntıları.
10. Tutar uyuşmazlığı (DB total ≠ iyzico price) ve bozulmuş imza ile sahte yanıt → REDDEDİLİR.
11. İade: tam, kısmi, ardışık birden çok kısmi, fazla tutar reddi, `5406670000000009` ile başarısız iade (sayaçlar değişmez), aynı gün iptal.
12. Sanal POS kapalı → `/api/orders` 503; yerelde LIVE seçili → zorla SANDBOX.
13. `PERSONEL` rolü `/admin/sanal-pos` ve iade işlemine erişemez.
14. Telefon biçimleri (`0555…`, `+90 555…`, `555…`), tek kelimelik ad, Türkçe karakterler.
15. Webhook: geçerli imza, hatalı imza (401), imzasız (yine sorgu ile doğrulanır), bilinmeyen token (200).
16. Taksit seçenekleri panelde değişince form seçenekleri değişir; taksitli ödemede `paidPrice ≠ price` durumu kaydedilir ve iade tavanı doğru hesaplanır.

## 9. Canlıya geçiş (iyzico onayı sonrası) — kullanıcı için tek sayfa
1. Panel > Sanal POS > Canlı API Key + Secret Key yapıştır > Kaydet.
2. "Bağlantıyı Test Et" (Canlı) → başarılı olmalı.
3. iyzico merchant panelinde Ayarlar > Firma Ayarları'na Webhook URL'yi gir (panelden kopyala); entegrasyon@iyzico.com'a webhook imzasını açtırma talebi gönder.
4. Modu "Canlı"ya al (onay penceresi).
5. Kendi kartınla en küçük tutarlı gerçek siparişi ver → PAID görün → panelden iade et → kartına yansımasını doğrula.
6. Tamam: gerçek müşteri ödemesi açık.
Geri dönüş: modu tek tıkla "Test"e veya "Kapalı"ya al.

## 10. Kullanıcıdan gereken (Claude Code'un yapamayacağı) tek şeyler
- Sandbox hesabı açıp iki anahtarı panele yapıştırmak (~5 dk). Bundan sonrası Claude Code'un sandbox testleri.
- Onay sonrası canlı anahtarlar + iyzico panelinde webhook URL.
- (Claude Code Vercel env'leri — `PAYMENT_ENCRYPTION_KEY`, `SITE_URL` — kendisi ekler.)

## 11. Kaynaklar
- https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-baslatma
- https://docs.iyzico.com/odeme-metotlari/odeme-formu/cf-entegrasyonu/cf-sorgulama
- https://docs.iyzico.com/ek-servisler/imza-yanitinin-dogrulanmasi
- https://docs.iyzico.com/ek-servisler/webhook
- https://docs.iyzico.com/ek-servisler/iptal-ve-iade
- https://docs.iyzico.com/ek-bilgiler/test-kartlari
- https://docs.iyzico.com/ek-bilgiler/hata-kodlari
- https://docs.iyzico.com/on-hazirliklar/live-vs-sandbox
