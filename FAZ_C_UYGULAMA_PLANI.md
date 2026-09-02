## İlerleme Durumu

- **C.3 (Denetim Kaydı) tamamlandı.** `AuditLog` modeli eklendi,
  `src/lib/audit-log.ts` (`logAudit`, best-effort) ve sabitler
  `src/lib/audit-actions.ts`'e ayrıldı (client bileşenlerine prisma/Neon
  sızmasını önlemek için — ilk denemede bu ayrım yokken Turbopack build'i
  "chunking context does not support external modules (node:module)"
  hatasıyla çöktü). Çağrı noktaları: sipariş durum değişikliği (tekli +
  toplu), iade durum değişikliği, personel oluşturma/güncelleme/
  pasif-aktif. `/admin/islem-gecmisi` sayfası (aksiyon tipi + tarih
  aralığı filtresi, `DataTable`) ve sidebar linki eklendi — sadece ADMIN
  (`personelAllowedPaths` dışında, `proxy.ts` PERSONEL'i otomatik
  engelliyor). `npx tsc --noEmit` + `npm run build` temiz. Gerçek Neon
  DB'ye karşı test: NextAuth credentials girişiyle (geçici test admin/
  personel hesapları) gerçek HTTP istekleriyle doğrulandı —
  `/api/admin/siparisler/bulk` üzerinden durum değişikliği ve
  `/admin/personel` form gönderimi (Next.js server action'ın progressive-
  enhancement `$ACTION_ID` alanı curl ile taklit edilerek) ikisi de doğru
  `AuditLog` satırı oluşturdu, `/admin/islem-gecmisi` filtreleriyle doğru
  görünüyor, PERSONEL rolü sayfaya erişemiyor (307 → `/admin`). Test
  verisi (audit log satırları, geçici hesaplar, sipariş durumu) temizlendi.
  Commit: bir sonraki adımda atılacak.
- Sıradaki: **C.5 (Yasal Sayfalar + Checkout Onayı).**

**Kapsam dışı bırakılan (kullanıcı isteğiyle):** Pazaryeri entegrasyonu
(Trendyol/Hepsiburada/N11) ve e-Fatura/e-Arşiv entegrasyonu — bu ikisi
`ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'deki Faz C'nin bir parçasıydı ama
kullanıcı şimdilik atlanmasını istedi, ileride ayrı bir oturumda ele alınabilir
(e-Fatura özellikle yasal bir eşik meselesi, ciro büyüdükçe mali müşavire
danışılarak zamanlaması netleştirilmeli).

---

# Bollmark – Faz C Uygulama Planı (Müşteri Hesabı+Sadakat, Bundle/Ön Sipariş, Denetim Kaydı, Ürün Yorumu, Yasal Sayfalar, Wishlist, İlgili Ürün, SEO)

Bu dosya, `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de tanımlanan **Faz C**
maddelerinden pazaryeri ve e-Fatura hariç kalan yedi maddenin, artı "zaten
planlı, ayrı iş" olarak not düşülmüş dört maddenin (ürün yorumu, yasal
sayfalar, wishlist, ilgili ürün, SEO — toplam sekiz özellik) uygulamaya hazır
planıdır. Repo (`prisma/schema.prisma`, `src/lib`, `src/app/(site)`,
`src/app/(admin)`, Faz A/B'de kurulan `mail.ts`/`order-notifications.ts`/
`coupons.ts`/`roles.ts` altyapısı) okunarak hazırlandı. Faz A/B'de izlenen
üslup korunuyor: Türkçe yorumlar, zod validasyonu, server-side hesaplama
("istemciden gelen değere güvenme" prensibi — fiyat/indirim/puan hep
sunucuda yeniden hesaplanır), mevcut admin bileşenlerinin (`DataTable`,
`Card`, `Badge`, `searchable-multi-select.tsx`, `multi-image-field.tsx`,
`*-feedback.tsx`, `*-row.tsx`) yeniden kullanımı, e-posta/yan-etkilerin asıl
işlemi asla engellememesi (`sendMail` best-effort deseni).

**Kullanıcı tercihi (önceki fazlardan hatırlanan):** Claude Code her fazdan
sonra onay/"devam et" beklemesin, testleri geçtikçe kendiliğinden bir sonraki
maddeye otomatik geçsin — sadece geri dönüşsüz/riskli adımlarda (migration,
mevcut müşteri verisiyle etkileşen değişiklikler) durup sorması istendi.

## 0) Genel mimari notu — neden 8 ayrı migration

Faz B'deki gibi tek migration'da toplama burada **önerilmiyor**: Faz B'de 4
küçük opsiyonel alan vardı, Faz C'de 8 bağımsız özellik ve ~10 yeni model
var. Her madde kendi `prisma db push`'unu yapıp kendi başına test
edilip commit'lensin — bir maddede sorun çıkarsa diğerlerini etkilemez,
geri alması da (rollback) çok daha kolay olur.

---

## C.3) Denetim Kaydı (Audit Log)

En küçük ve en bağımsız madde — önce bu yapılırsa, sonraki fazlarda eklenen
her kritik işlem (durum değişikliği, personel yönetimi, puan düzeltmesi)
baştan loglanmış olur.

### Şema
```prisma
model AuditLog {
  id         String   @id @default(cuid())
  actorEmail String
  actorRole  String
  action     String   // "ORDER_STATUS_CHANGED", "RETURN_STATUS_CHANGED", "PERSONEL_CREATED", "PERSONEL_UPDATED", "LOYALTY_ADJUSTED" ...
  targetType String   // "Order" | "ReturnRequest" | "AdminUser" | "Customer" ...
  targetId   String
  detail     String?  // kısa metin, örn. "PENDING_PAYMENT -> PAID"
  createdAt  DateTime @default(now())

  @@index([targetType, targetId])
  @@index([createdAt])
}
```

### Yardımcı fonksiyon
Yeni dosya `src/lib/audit-log.ts` (`order-notifications.ts` ile aynı
best-effort prensip — loglama asıl işlemi asla engellemez):
```ts
export async function logAudit(params: {
  actorEmail: string; actorRole: string; action: string;
  targetType: string; targetId: string; detail?: string;
}) {
  await prisma.auditLog.create({ data: params }).catch((e) =>
    console.error("Denetim kaydı yazılamadı (yoksayıldı):", e)
  );
}
```

### Çağrı noktaları (v1 — sadece kritik işlemler, gürültü yaratmasın diye ürün
düzenleme gibi sık işlemler DIŞARIDA bırakılıyor)
- Sipariş durum değişikliği: `admin/siparisler/[id]/page.tsx` (`setOrderStatus`),
  `api/admin/siparisler/bulk/route.ts`.
- İade durum değişikliği: `admin/iadeler` satır güncelleme action'ı.
- Personel oluşturma/güncelleme/pasifleştirme: `admin/personel` action'ları.
- Sadakat puanı elle düzeltme (C.1'de eklenecek).

### Admin sayfası
Yeni sayfa `/admin/islem-gecmisi` (`requireAdmin()` ile korunur, sadece
ADMIN — `personelAllowedPaths` dışında). `DataTable` deseni: tarih, aktör
(e-posta), aksiyon, hedef, detay sütunları; tarih aralığı + aksiyon tipi
filtresi (`raporlar-filters.tsx` deseniyle aynı `<select>`+URL query).
Sidebar'a `{ href: "/admin/islem-gecmisi", label: "İşlem Geçmişi", icon:
History }` eklenir (Raporlar'ın altına).

### Test
Bir sipariş durumu değiştirilip `AuditLog` tablosunda doğru satırın
oluştuğu, `/admin/islem-gecmisi` sayfasında göründüğü, `PERSONEL` rolünün bu
sayfaya erişemediği doğrulanır.

---

## C.5) Yasal Sayfalar + Checkout Onay Kutusu

Bağımsız, düşük risk, launch öncesi kritik (mesafeli satış sözleşmesi onayı
olmadan sipariş almak hukuken risklidir).

### Şema
```prisma
model LegalPage {
  id        String   @id @default(cuid())
  slug      String   @unique // "hakkimizda" | "kargo-bilgisi" | "iade-kosullari" | "gizlilik-politikasi" | "mesafeli-satis-sozlesmesi"
  title     String
  content   String   // duz metin, satir sonlari `whitespace-pre-line` ile render edilir (v1'de markdown kutuphanesi eklenmiyor)
  updatedAt DateTime @updatedAt
}
```
`prisma/seed.ts`'e 5 sayfa için kısa varsayılan içerikle `upsert` eklenir
(kullanıcı gerçek metni sonra admin panelden girer — placeholder olduğu
kod yorumunda belirtilir).

### Site tarafı
Yeni dinamik route `src/app/(site)/sayfa/[slug]/page.tsx` — `LegalPage`'i
slug'a göre çeker, yoksa `notFound()`. `site-footer.tsx`'teki şu an düz
metin olan "Hakkımızda", "Kargo Bilgisi", "Gizlilik Politikası" linklere
çevrilir (`İade & Değişim` zaten `/siparis-durumu`'na bağlı, o kalır).

### Checkout onay kutusu
`odeme/page.tsx` formuna zorunlu checkbox: "Mesafeli Satış Sözleşmesi'ni
okudum, kabul ediyorum" + `/sayfa/mesafeli-satis-sozlesmesi` linki
(yeni sekmede açılır ki kullanıcı doldurduğu formu kaybetmesin). `orders/
route.ts`'teki `orderSchema`'ya `termsAccepted: z.literal(true, { message:
"Mesafeli satış sözleşmesini onaylamalısınız." })` eklenir — client
tarafındaki `required` disable yetmez, sunucu da reddetmeli (mevcut
"istemciden gelen değere güvenme" prensibiyle aynı gerekçe).

### Admin panel
Yeni sayfa `/admin/yasal-sayfalar` — liste + içerik düzenleme formu
(StoreSettings sayfasındaki textarea deseniyle aynı, 5 sabit satır — yeni
sayfa ekleme/silme v1 kapsamında yok, sadece içerik düzenleme).

### Test
5 sayfanın seed'den geldiği, admin panelden içerik güncellenince
`/sayfa/[slug]`'ın yeni içeriği gösterdiği, checkbox işaretlenmeden
`POST /api/orders`'ın `termsAccepted` hatasıyla reddedildiği doğrulanır.

---

## C.1) Gerçek Customer Hesap Modeli + Sadakat/Puan Programı

En büyük madde — C.6 (wishlist'in DB'ye bağlı kısmı) buna dayanıyor.

### Mimari not — mevcut misafir akışı korunur
Bollmark'ta şu an sipariş için hesap **zorunlu değil** (sipariş no+e-posta
ile takip). Bu davranış korunur: hesap oluşturmak **opsiyonel bir katman**
olarak eklenir, giriş yapmayan kullanıcı yine misafir olarak sipariş
verebilir. Giriş yapmışsa sipariş otomatik hesabına bağlanır ve puan
kazanır; misafir siparişinde puan işlemez.

### Şema
```prisma
model Customer {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  phone         String?
  passwordHash  String
  loyaltyPoints Int      @default(0)
  createdAt     DateTime @default(now())
  addresses     CustomerAddress[]
  orders        Order[]
  loyaltyLedger LoyaltyTransaction[]
  wishlistItems WishlistItem[] // C.6
  reviews       ProductReview[] // C.4 ile opsiyonel iliski (bkz. C.4)
}

model CustomerAddress {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  label      String   // "Ev", "İş" vb.
  name       String
  phone      String
  address    String
  city       String
  district   String
  postalCode String?
  isDefault  Boolean  @default(false)
  createdAt  DateTime @default(now())
}

// Pozitif = kazanc (siparis DELIVERED oldugunda), negatif = kullanim
// (checkout'ta indirime cevrildiginde) veya admin elle duzeltmesi.
model LoyaltyTransaction {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  points     Int
  reason     String   // "SIPARIS_KAZANC" | "SIPARIS_KULLANIM" | "ADMIN_DUZELTME"
  orderId    String?
  createdAt  DateTime @default(now())
}
```
`Order` modeline eklenir: `customerId String?`, `customer Customer?`
(opsiyonel — misafir siparişte null), `pointsEarned Int @default(0)`,
`pointsRedeemed Int @default(0)`, `loyaltyDiscountCents Int @default(0)`.

### Kimlik doğrulama — ayrı bir NextAuth örneği
Mevcut `authOptions` (`src/lib/auth.ts`) sadece admin girişi için. Müşteri
girişi için **ayrı** bir yapı gerekiyor çünkü ikisinin de oturum çerezi
aynı isimde çakışmamalı:
- Yeni `src/lib/customer-auth.ts`: `customerAuthOptions` — aynı
  `CredentialsProvider` deseni ama `prisma.customer` tablosuna karşı,
  `cookies: { sessionToken: { name: "musteri-oturum-token" } }` ile admin
  çerezinden ayrıştırılır (aksi halde ikisi aynı tarayıcıda çakışabilir).
- Yeni route `src/app/(site)/api/musteri-auth/[...nextauth]/route.ts`.
- Kayıt için ayrı endpoint `POST /api/musteri-kayit` (bcrypt hash, e-posta
  benzersizliği kontrolü — "bu e-posta zaten kayıtlı" mesajı bilgi
  sızdırmadan genel tutulur).

### Site sayfaları
- `/hesap/giris` — giriş + kayıt (iki sekme/form), `site-header.tsx`'e
  "Hesabım" linki eklenir (giriş yapılmışsa ad, yapılmamışsa "Giriş Yap").
- `/hesap` — özet: son siparişler, puan bakiyesi, adres sayısı (oturum
  yoksa `/hesap/giris`'e yönlendirir).
- `/hesap/siparislerim` — `siparis-durumu` sayfasındaki sorgu mantığının
  aynısı ama e-posta/sipariş no girmeye gerek yok, doğrudan
  `session.customer.email`'e ait siparişler listelenir; iade/değişim
  talebi oluşturma akışı buraya da bağlanır (kod tekrarını azaltmak için
  ortak bir `order-lookup.ts` yardımcı fonksiyonuna çıkarılabilir).
- `/hesap/adreslerim` — CRUD (ekle/düzenle/sil/varsayılan yap).
- `/hesap/puanlarim` — bakiye + `LoyaltyTransaction` geçmişi tablosu.

### Sadakat puanı mantığı
Yeni `src/lib/loyalty.ts` — kupon (`coupons.ts`) ile aynı desende, iki
sabit: `LOYALTY_EARN_RATE = 0.01` (100 TL harcama = 1 puan) ve
`LOYALTY_REDEEM_RATE_CENTS = 10` (1 puan = 10 kuruş indirim — v1 basit
oranlar, `StoreSettings`'e taşınabilir ama kapsam dışı).
- **Kazanç:** `notifyCustomerStatusChange`'in çağrıldığı aynı 3 noktada,
  durum `DELIVERED` olduğunda (iade riski en düşük an) `awardLoyaltyPoints
  (order)` çağrılır — `Math.floor(order.totalCents * LOYALTY_EARN_RATE /
  100)` puan hesaplanır, `LoyaltyTransaction` + `Customer.loyaltyPoints`
  aynı transaction'da güncellenir, `order.pointsEarned` yazılır.
- **Kullanım:** checkout'ta giriş yapmış müşteriye "X puanınız var, Y puan
  kullan" input'u (`CouponField` ile yan yana, benzer UI). Sunucuda
  `validateLoyaltyRedemption(tx, customerId, pointsToRedeem, subtotalCents)`
  — bakiyeyi aşan/negatif istek reddedilir, indirim tutarı ASLA
  istemciden gelen değerle değil burada hesaplanır (kupon deseniyle
  birebir aynı gerekçe). Kupon ile aynı anda kullanılabilir (ikisi ayrı
  indirim kalemleri, ikisi de subtotal üzerinden düşülür).

### Admin panel
`/admin/musteriler` V1'den (sipariş verisinden türetilen liste) gerçek
`Customer` tablosuna geçirilir — hesabı olmayan (misafir) müşteriler için
eski türetme mantığı fallback olarak korunur (iki liste birleştirilip
gösterilir, hesaplı olanlarda "Hesaplı" rozeti + puan bakiyesi sütunu).
Satır aksiyonu: "Puan Ekle/Çıkar" (admin not girer, `ADMIN_DUZELTME`
kaydı oluşur, C.3'teki audit log'a da yazılır).

### Test
Kayıt→giriş→adres ekleme; giriş yapmış müşteri sipariş verince
`Order.customerId`'nin doluyor olması; sipariş `DELIVERED` olunca puanın
doğru hesaplanıp eklenmesi; checkout'ta puan kullanımının indirimi doğru
düşürmesi ve bakiyeyi aşan istekle reddedilmesi; misafir siparişte hiçbir
puan hareketi oluşmaması; admin elle puan düzeltmesinin bakiyeyi ve
audit log'u doğru güncellemesi.

---

## C.6) Wishlist (Favoriler)

C.1'deki `Customer`/`WishlistItem` modeline dayanır, guest kısmı bağımsız
çalışabilir.

### Şema
```prisma
model WishlistItem {
  id         String   @id @default(cuid())
  customerId String
  customer   Customer @relation(fields: [customerId], references: [id], onDelete: Cascade)
  productId  String
  product    Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  createdAt  DateTime @default(now())

  @@unique([customerId, productId])
}
```

### Misafir (localStorage) + hesaplı (DB) ikili model
`CartProvider` (`lib/cart.tsx`) ile birebir aynı desende yeni
`WishlistProvider` (`lib/wishlist.tsx`) — ürün id listesini localStorage'da
tutar (`bollmark-wishlist` anahtarı). Giriş yapılmış oturumda sayfa
yüklenince bir kerelik senkronizasyon: localStorage'daki id'ler
`POST /api/favoriler/senkronize`'a gönderilir, DB'deki `WishlistItem`'lara
eklenir (var olanlar atlanır — `@@unique` zaten koruyor), sonra
localStorage temizlenir ve favoriler DB'den okunmaya geçilir.

### UI
`product-card.tsx` ve `ProductViewer`'a kalp ikonu toggle eklenir
(`useWishlist()` hook'u — giriş yapılmışsa API çağrısı, yapılmamışsa
localStorage). Yeni sayfa `/hesap/favorilerim` (giriş gerektirir; guest
kullanıcı ürün sayfasında "favorileriniz bu cihazda saklanıyor, kalıcı
olması için giriş yapın" notu görür, favoriler sayfasına gitmeye çalışırsa
`/hesap/giris`'e yönlendirilir).

### Test
Guest olarak favoriye ekleme→localStorage'da görünmesi; giriş
yapınca localStorage listesinin DB'ye senkronize olup temizlenmesi; aynı
ürünü iki kez favoriye eklemenin hata vermemesi (`@@unique` upsert
davranışı); favoriden çıkarmanın hem guest hem hesaplı akışta çalışması.

---

## C.4) Ürün Yorumu + Fotoğraf

Bağımsız; C.1 tamamlanmışsa "doğrulanmış alıcı" bağlantısı opsiyonel
olarak eklenir, tamamlanmamışsa da (sadece isim/e-posta ile) çalışır —
bu yüzden C.1'den sonra sıralandı ama zorunlu bağımlılığı yok.

### Şema
```prisma
model ProductReview {
  id             String   @id @default(cuid())
  productId      String
  product        Product  @relation(fields: [productId], references: [id], onDelete: Cascade)
  customerId     String?  // C.1 sonrasi giris yapmis musteriye baglanabilir, misafir yorumunda null
  customer       Customer? @relation(fields: [customerId], references: [id])
  customerName   String
  customerEmail  String
  rating         Int      // 1-5
  comment        String
  imageUrls      String?  // "\n" ayrik URL listesi - Product.images ile ayni format
  status         String   @default("BEKLIYOR") // "BEKLIYOR" | "ONAYLANDI" | "REDDEDILDI"
  createdAt      DateTime @default(now())

  @@index([productId, status])
}
```
`Product`'a `reviews ProductReview[]` eklenir.

### Site tarafı
Ürün sayfasına (`ProductViewer` altına) yorumlar bölümü: ortalama puan +
yıldız gösterimi (`prisma.productReview.aggregate({ _avg: { rating: true },
_count: true, where: { productId, status: "ONAYLANDI" } })`), onaylanmış
yorumların listesi (fotoğraflı olanlar öne çıkar), yorum ekleme formu
(isim/e-posta/puan/yorum + opsiyonel fotoğraf — mevcut
`multi-image-field.tsx` yeniden kullanılır). Gönderilen yorum hemen
yayınlanmaz (`BEKLIYOR`), "Yorumunuz onaylandıktan sonra yayınlanacak"
mesajı gösterilir.

### Admin panel
Yeni sayfa `/admin/yorumlar` — `returns-table.tsx` ile aynı satır-içi
düzenleme deseni: ürün adı, puan, yorum önizleme, durum (`<select>`:
Bekliyor/Onayla/Reddet). Sidebar'a `{ href: "/admin/yorumlar", label:
"Yorumlar", icon: MessageSquare }` eklenir.

### Ürün kartı / listeleme
`product-card.tsx`'e küçük yıldız+ortalama gösterimi eklenir (opsiyonel,
yorum yoksa hiç gösterilmez) — bunun için `getPublishedProducts`'a
`_count`/`_avg` join'i eklemek performans açısından N+1'e yol açabilir,
bu yüzden v1'de sadece ürün detay sayfasında gösterilir, liste
sayfasındaki yıldız gösterimi opsiyonel/ikinci öncelik olarak not düşülür.

### Test
Yorum gönderimi→admin panelde `BEKLIYOR` görünmesi→onaylanınca ürün
sayfasında görünmesi; reddedilen yorumun hiçbir yerde görünmemesi;
ortalama puan hesabının sadece `ONAYLANDI` durumundakileri saydığı;
fotoğraflı yorumun görsellerinin doğru render edildiği.

---

## C.7) İlgili Ürün (Cross-sell)

Küçük, bağımsız — ekstra model gerekmez, v1'de otomatik kategori bazlı
öneri yeterli tutuluyor (elle eşleştirme istenirse ayrı, daha sonraki bir
iş olarak eklenebilir — plana bilinçli olarak dahil edilmedi, kapsamı
büyütmemek için).

### Uygulama
`lib/catalog.ts`'e `getRelatedProducts(product)` eklenir: aynı
`categoryId`, `id` farklı, `status: "PUBLISHED"`, `orderBy: [{ isFeatured:
"desc" }, { createdAt: "desc" }]`, `take: 4`. `categoryId` null ise boş
dizi döner (bölüm hiç gösterilmez). `urunler/[slug]/page.tsx` bu
fonksiyonu çağırıp `ProductViewer` altına yeni bir "Benzer Ürünler"
bölümü (mevcut `product-card.tsx` grid'i) ekler.

### Test
Aynı kategoride başka ürün varsa görünmesi, kategori boşsa/tek ürün varsa
bölümün hiç gösterilmemesi, mevcut ürünün kendisinin listede çıkmaması.

---

## C.2) Bundle/Set İndirimi + Ön Sipariş (Pre-order)

Orta risk — checkout hesaplama mantığına dokunuyor, kupon/puan ile
etkileşimi dikkatli test edilmeli, bu yüzden plana en sona yakın
yerleştirildi (C.1'deki puan indirimiyle birlikte üç indirim kalemi aynı
anda doğru toplanmalı).

### Bundle — şema
```prisma
model Bundle {
  id              String    @id @default(cuid())
  name            String
  discountPercent Int       // sepette bundle'a dahil TUM urunler varsa, bu urunlerin toplamina uygulanan indirim
  isActive        Boolean   @default(true)
  products        Product[] // implicit many-to-many
  createdAt       DateTime  @default(now())
}
```

### Bundle — mantık ve v1 kuralı
Basitlik için v1 kuralı: bir bundle'ın **tüm** ürünlerinden en az 1'er
adet sepette olmalı (kısmi eşleşme indirim tetiklemez). Yeni
`src/lib/bundles.ts` — `resolveBundleDiscount(tx, lines)`: aktif tüm
bundle'ları çekip sepetteki ürün id'leriyle karşılaştırır, eşleşen
bundle'ların (varsa birden fazla eşleşirse en yüksek indirimli olan tek
bir tanesi — üst üste binmesin) ürünlerine ait satır toplamına
`discountPercent` uygular. `orders/route.ts`'teki subtotal hesaplamasına
kupon/puan ile **aynı sırada, ayrı bir kalem olarak** eklenir (üçü de
sunucuda, istemciden gelen değere güvenmeden hesaplanır).

### Bundle — UI
Ürün sayfasında (ürün bir bundle'a dahilse) "Bu ürünü [diğer ürün adları]
ile birlikte al, %X indirim kazan" rozeti — v1'de sadece bilgilendirici,
sepete otomatik ekleme yapılmaz, kullanıcı ürünleri kendi ekler, indirim
sepette otomatik hesaplanır. Sepet özetinde (`sepet/page.tsx`, `odeme/
page.tsx`) "Bundle İndirimi" satırı kupon/puan indirimiyle yan yana
gösterilir.

### Bundle — admin panel
`/admin/kampanyalar` sayfasına ikinci sekme "Bundle" (veya ayrı
`/admin/bundle-kampanyalari`) — `searchable-multi-select.tsx` ile ürün
çoklu seçimi + indirim yüzdesi + aktif/pasif toggle.

### Ön sipariş — şema
`Product.allowPreorder Boolean @default(false)`, `Product.preorderNote
String?` (örn. "15 Ekim'de kargoya verilir"), `OrderItem.isPreorder
Boolean @default(false)`.

### Ön sipariş — mantık
Şu an `orders/route.ts`'te stok kontrolü **zaten yok** (satır oluşturma
sadece ürün/varyantın var olduğunu kontrol ediyor, `variant.stock >=
quantity` kontrolü hiç yapılmıyor — bu Faz C planı için önemli bir tespit,
uygulamaya başlamadan önce bunun bilinçli bir tasarım kararı mı yoksa
eksik mi olduğu kullanıcıya sorulmalı). Bu tespit doğruysa, ön sipariş
özelliği aslında yeni bir server-side kısıtlama eklemekten çok, **client
tarafındaki** "Stokta Yok" kilidini `allowPreorder` true olan ürünlerde
kaldırıp butonu "Ön Sipariş Ver" olarak aktif bırakmak + sipariş satırına
`isPreorder: true` işaretlemek anlamına geliyor. `ProductViewer`'daki
`outOfStock` kontrolü `allowPreorder` prop'unu da dikkate alacak şekilde
güncellenir.

### Ön sipariş — admin panel
Ürün ekleme/düzenleme formuna "Ön Siparişe Aç" toggle + not alanı
eklenir. Sipariş detay sayfasında (`admin/siparisler/[id]`) ön sipariş
satırları rozetle ("Ön Sipariş") işaretlenir ki hazırlık ekibi ayırt
edebilsin.

### Test
Bundle'a dahil tüm ürünler sepetteyken doğru indirimin uygulanması, kısmi
eşleşmede indirim uygulanmaması, kupon+bundle+puan üçünün aynı anda doğru
toplanması; ön siparişe açık, stoğu 0 bir üründe "Ön Sipariş Ver"
butonunun aktif olması ve siparişin `isPreorder: true` ile oluşması;
ön siparişe kapalı, stoğu 0 bir üründe eski davranışın (buton disable)
değişmediği (regresyon).

---

## C.8) SEO Altyapısı

En sona bırakıldı çünkü JSON-LD structured data'daki ürün rating'i C.4'te
eklenen yorum ortalamasını kullanacak.

### Uygulama
- `src/app/(site)/urunler/[slug]/page.tsx`'e `generateMetadata` — ürün
  adı/açıklaması/ilk görsel `og:image` olarak.
- `src/app/sitemap.ts` (Next.js dosya tabanlı sitemap) — published
  ürünler, kategoriler, `LegalPage` slug'ları (C.5) tek listede toplanır.
- `src/app/robots.ts` — `/admin` ve `/hesap` dışlanır (sitemap referansı
  eklenir).
- Ürün sayfasında JSON-LD (`<script type="application/ld+json">`) —
  `Product` schema.org tipi: isim, açıklama, fiyat, para birimi (TRY),
  görsel, `aggregateRating` (C.4'teki ortalama+yorum sayısı, yorum yoksa
  bu alan hiç eklenmez — boş/sıfır rating göstermek yanıltıcı olur).
- Ana sayfa ve kategori listesi sayfalarına da temel `generateMetadata`
  eklenir (şu an sadece root layout'ta statik metadata var).

### Test
`next build` sonrası `/sitemap.xml` ve `/robots.txt`'in doğru üretildiği,
bir ürün sayfasının kaynak kodunda (`curl` ile) doğru JSON-LD ve meta
etiketlerinin göründüğü (Google'ın Rich Results Test aracıyla da elle
doğrulanabilir, opsiyonel).

---

## Önerilen uygulama sırası

1. **C.3) Denetim kaydı** — en küçük, bağımsız, sonraki fazların kritik
   işlemlerini baştan loglar.
2. **C.5) Yasal sayfalar + checkout onayı** — bağımsız, düşük risk,
   launch öncesi kritik.
3. **C.1) Müşteri hesabı + sadakat** — en büyük madde, C.6'nın temeli.
4. **C.6) Wishlist** — C.1'e dayanır (guest kısmı bağımsız).
5. **C.4) Ürün yorumu + fotoğraf** — bağımsız, C.1 varsa doğrulanmış
   alıcı bağlantısı eklenir.
6. **C.7) İlgili ürün** — küçük, bağımsız.
7. **C.2) Bundle/set indirimi + ön sipariş** — checkout hesaplamasına
   dokunduğu için diğer indirim kalemleri (kupon, puan) netleştikten
   sonra yapılması daha güvenli.
8. **C.8) SEO altyapısı** — C.4'teki rating verisini kullanır, en sona
   bırakıldı.

Her madde kendi şemasını `prisma db push` ile ayrı uygular, gerçek Neon
DB'ye karşı test edilip commit'lenir (Faz A/B'de izlenen yöntemle aynı —
hepsini tek seferde yazıp sona test etmek yerine).

## Riskler / Dikkat Edilecekler

- **Müşteri auth çerez çakışması (C.1):** admin ve müşteri girişi için
  ayrı `NextAuth` örneği kullanılacağından çerez isimleri kesinlikle
  farklı olmalı, aksi halde bir tarayıcıda admin oturumuyla müşteri
  oturumu birbirini geçersiz kılabilir — bu nokta migration'dan önce
  kod incelemesinde ayrıca doğrulanmalı.
- **Puan/kupon/bundle üçünün birlikte hesaplanması (C.1 + C.2):**
  `orders/route.ts`'teki subtotal hesaplama sırası netleştirilmeli
  (örn. önce bundle, sonra kupon, sonra puan — hangi sırayla
  hesaplanırsa hesaplansın sonuç deterministik ve test edilebilir
  olmalı), yanlış sıralama negatif toplam gibi saçma sonuçlara yol
  açabilir.
- **Stok kontrolü tespiti (C.2):** yukarıda not edildiği gibi
  `orders/route.ts`'te şu an gerçek bir stok kontrolü yok gibi
  görünüyor — Claude Code uygulamaya başlamadan önce bunun kasıtlı
  olup olmadığını netleştirmeli (belki admin panelden elle stok
  yönetimi tercih edilmiştir), çünkü ön sipariş özelliğinin tasarımı
  buna göre değişir.
- **E-posta gürültüsü:** puan kazancı/kullanımı, favori senkronizasyonu
  gibi işlemler için ayrıca mail atılmıyor (v1'de sadece hesap
  sayfasında görünür) — mevcut "sadece kritik 3 durum geçişinde mail"
  prensibiyle tutarlı, gürültü yaratmasın diye bilinçli tercih.
- **Migration geri dönüşsüzlüğü yok bu fazda** (Faz B'deki
  `ProductVariant.imageUrl` kaldırma gibi kolon düşürme işlemi C
  fazında hiçbir maddede yok — hepsi yeni model/opsiyonel alan ekleme,
  bu yüzden riskleri Faz B'ye göre daha düşük).

## Sonraki adım

Bu plan onaylandıktan sonra C.3'ten başlanıp yukarıdaki sırayla Claude
Code ile uygulamaya geçilebilir. C.2'deki stok kontrolü tespiti dışında
kullanıcıdan ek bilgi beklenen bir madde yok — hepsi bağımsız
ilerleyebilir.
