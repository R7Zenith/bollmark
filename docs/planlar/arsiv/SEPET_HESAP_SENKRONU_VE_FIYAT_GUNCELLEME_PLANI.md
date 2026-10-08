# Sepet: Hesaba Kayıt (Cihazlar Arası) ve Güncel Fiyat — Araştırma ve Claude Code Promptu

## Tespit edilen iki sorun ve kök nedenleri

### Sorun 1 — Sepet başka yerden girince boş görünüyor

`src/lib/cart.tsx` içindeki `CartProvider` sepeti **yalnızca tarayıcının
`localStorage`'ında** (`bollmark-cart`) tutuyor. Sunucuda müşteri hesabına
bağlı bir sepet tablosu yok (`Customer` modelinde sepet ilişkisi yok;
`AbandonedCart` sadece "ödeme sayfasında e-postayı yazan kişiye hatırlatma
maili" için anlık görüntü tutuyor, sepetin kaynağı değil). Yani sepet cihaza/
tarayıcıya bağlı; başka tarayıcıdan, telefondan ya da gizli sekmeden girince
localStorage boş olduğu için sepet boş görünüyor. Giriş yapmak sepeti
etkilemiyor.

Favoriler için bu sorun zaten çözülmüş: `src/lib/wishlist.tsx` giriş yapmış
kullanıcıda DB'yi (`WishlistItem`), yapmamışta localStorage'ı kaynak alıyor ve
giriş anında tek seferlik birleştirme (`/api/favoriler/senkronize`) yapıyor.
Sepet için de **aynı desen** uygulanabilir.

### Sorun 2 — Admin'de fiyat değişince sepette eski fiyat kalıyor

`CartLine` (cart.tsx) ürün eklendiği anki `priceCents` ve `compareAtCents`
değerlerini **kopyalayıp** localStorage'a yazıyor. Sonrasında hiçbir yerde bu
değerler sunucuyla karşılaştırılmıyor: `/sepet` sayfası, sepet çekmecesi ve
`/odeme` özeti hep localStorage'daki eski fiyatı gösteriyor.

Kritik bulgu: `src/app/(site)/api/orders/route.ts` fiyatı **zaten DB'den yeniden
hesaplıyor** (yorumda da yazıyor: "Fiyat hiçbir zaman istemciden gelen değer
üzerinden hesaplanmaz"). Yani müşteri ekranda eski fiyatı görüyor ama sipariş/
ödeme yeni fiyat üzerinden oluşuyor. Bu, ödeme sayfasında gösterilen tutarla
iyzico'ya giden tutarın **farklı olabilmesi** demek — güven ve yasal (gösterilen
fiyat = tahsil edilen fiyat) açısından düzeltilmesi gereken bir durum. Ayrıca
indirim hesapları (`useBundleDiscount`, kupon) da eski satır fiyatlarına
bakıyor olabilir.

## Önerilen çözüm

### A) Sepeti hesaba kaydet (giriş yapmış kullanıcı için)

- Yeni tablo `CustomerCart`: `customerId @unique`, `linesJson` (yalnızca
  `productId`, `variantId`, `quantity` — **fiyat/isim/görsel TUTULMAZ**, onlar
  her zaman güncel DB'den okunur), `couponCode?`, `updatedAt`. İlişki:
  `Customer` silinirse sepet de silinsin (`onDelete: Cascade`).
- Yeni API `/api/sepet`:
  - `GET` → oturumdaki müşterinin sepetini döner (satırlar güncel fiyat/stok
    bilgisiyle zenginleştirilmiş halde).
  - `PUT` → sepetin tamamını (id + adet + kupon kodu) yazar (son yazan kazanır,
    basit ve güvenilir).
  - Giriş yoksa 401.
- `CartProvider` (cart.tsx) `wishlist.tsx` desenine geçer:
  - Misafir: localStorage kaynak (bugünkü davranış aynen kalır).
  - Giriş yapılınca **tek seferlik birleştirme**: localStorage'daki satırlar +
    DB'deki satırlar aynı `variantId`'de adetleri toplanarak birleşir (stok
    üstüne çıkmaz), sonuç DB'ye yazılır, localStorage temizlenir.
  - Girişliyken her değişiklik (ekle/çıkar/adet/kupon) kısa gecikmeyle
    (debounce ~500 ms) `PUT /api/sepet` ile kaydedilir; ilk yükleme ve sekme
    tekrar odaklanınca (`visibilitychange`/`focus`) `GET /api/sepet` ile
    yenilenir — böylece telefonda eklenen ürün bilgisayarda da görünür.
  - Çıkış yapınca ekrandaki sepet state'i temizlenir (ortak bilgisayarda bir
    sonraki kişiye önceki müşterinin sepeti görünmesin); sepet DB'de durur,
    tekrar girişte geri gelir.
  - Ödeme doğrulanınca (`ClearCartOnMount`) DB'deki sepet de temizlenir.

### B) Sepet fiyatlarını her zaman güncel tut

- Yeni API `POST /api/sepet/dogrula` (giriş gerekmez, misafir de kullanır):
  gövde `{ lines: [{productId, variantId, quantity}] }`; her satır için
  `effectivePrice` / `effectiveCompareAt` (`src/lib/variant.ts`) ile **güncel**
  fiyat, stok durumu, ürün adı, görsel ve "hâlâ yayında mı" bilgisini döner.
  `Cache-Control: no-store`, sayfa/route önbelleğe alınmamalı.
- `CartProvider` bu endpoint'i: ilk yüklemede, sekme tekrar odaklanınca,
  çekmece açılınca, `/sepet` ve `/odeme` sayfaları açılınca çağırıp
  `lines` içindeki `priceCents`/`compareAtCents`/`name`/`image`'i günceller.
  `totalCents`, bundle indirimi ve kupon hesapları otomatik olarak yeni
  fiyata göre yeniden çalışır.
- Fiyat değiştiyse kullanıcıya görünür bir uyarı: "X ürününün fiyatı
  güncellendi (eski: … → yeni: …)". Ürün yayından kalktıysa/stok bittiyse
  satır uyarıyla işaretlenir ve "Ödemeye Geç" engellenir ya da satır
  kaldırılır.
- Ödeme adımında ek güvence: `/api/orders` isteğine istemcinin gördüğü birim
  fiyatlar (`expectedPriceCents`) da gönderilir. Sunucu DB fiyatıyla
  uyuşmazlık görürse **sipariş oluşturmadan** `409 { code: "PRICE_CHANGED" }`
  döner; istemci sepeti günceller ve "Fiyatlar güncellendi, lütfen tekrar
  kontrol edin" der. Böylece müşteri hiçbir zaman gördüğünden farklı bir
  tutarla ödemeye yönlendirilmez. (Sunucudaki fiyatı DB'den hesaplama davranışı
  aynen kalır.)

### C) Kontrol edilecek yan nokta

Admin'de fiyat kaydedilince `src/lib/revalidate-catalog.ts` çağrılıyor mu?
Ürün sayfası/katalog önbelleği eski fiyat gösteriyorsa müşteri "yeni fiyat"
ile "sepet fiyatı" arasında yine de tutarsızlık görebilir. Claude Code bunu
doğrulasın; eksikse fiyat güncelleme aksiyonuna ekleyin.

## Claude Code'a verilecek prompt

```
Bollmark storefront'unda sepetle ilgili iki sorunu düzelteceğiz. Önce
CLAUDE.md / AGENTS.md / karpathy-guidelines.md ve yüklü skill'leri oku ve
kullan. Sonra SEPET_HESAP_SENKRONU_VE_FIYAT_GUNCELLEME_PLANI.md dosyasını oku
(kök nedenler ve tasarım orada).

SORUN 1: Sepet sadece localStorage'da (src/lib/cart.tsx) — müşteri başka
tarayıcı/cihazdan girince sepet boş görünüyor. Favoriler (src/lib/wishlist.tsx)
aynı problemi DB + giriş anında senkronizasyonla çözmüş; sepeti de aynı
desenle çöz.

SORUN 2: Ürün sepetteyken admin panelinden fiyat değişince /sepet, sepet
çekmecesi ve /odeme eski fiyatı gösteriyor, çünkü CartLine ürün eklendiği
andaki priceCents/compareAtCents'i localStorage'a kopyalıyor ve bir daha
sunucuyla karşılaştırmıyor. Üstelik src/app/(site)/api/orders/route.ts fiyatı
DB'den yeniden hesapladığı için müşteri eski fiyatı görüp yeni fiyata
sipariş/ödeme oluşturabiliyor. Bu kabul edilemez: gösterilen fiyat = tahsil
edilen fiyat olmalı.

### 1. Veritabanı
prisma/schema.prisma'ya `CustomerCart` modeli ekle: customerId (@unique,
Customer'a ilişki, onDelete: Cascade), linesJson (String: sadece productId,
variantId, quantity dizisi — fiyat/isim/görsel ASLA saklama), couponCode
(String?), updatedAt. Customer modeline ters ilişkiyi ekle. Migrasyonu
projedeki mevcut yöntemle (prisma/migrations klasörüne ve DEPLOY_STATUS.md'deki
önceki şema değişikliklerine bak, aynı yöntemi kullan) hazırla; production DB'ye
uygulama adımını DEPLOY_STATUS.md'ye açıkça yaz.

### 2. API'ler
- `src/app/(site)/api/sepet/route.ts`: GET (oturumdaki müşterinin sepetini
  getir; satırları güncel fiyat/stok bilgisiyle zenginleştir) ve PUT (sepetin
  tamamını yaz; zod ile doğrula, adet üst sınırı koy, en fazla ~50 satır).
  Oturum yoksa 401. Kimlik için favoriler route'larındaki
  getServerSession(customerAuthOptions) desenini kullan.
- `src/app/(site)/api/sepet/dogrula/route.ts`: POST, giriş gerekmez. Gövde
  `{ lines: [{productId, variantId, quantity}] }`. Her satır için
  src/lib/variant.ts'teki effectivePrice/effectiveCompareAt ile GÜNCEL fiyatı,
  stok durumunu, ürün adını, görseli ve ürünün hâlâ PUBLISHED olup olmadığını
  dön. Yanıt önbelleğe alınmasın (Cache-Control: no-store / dynamic).

### 3. CartProvider (src/lib/cart.tsx)
- Misafir: bugünkü localStorage davranışı aynen kalsın.
- Giriş yapılınca (useSession status === "authenticated") tek seferlik
  birleştirme: localStorage satırları + DB satırları aynı variantId'de adetler
  toplanarak birleşsin (stok üstüne çıkmasın), sonuç DB'ye yazılsın,
  localStorage temizlensin. wishlist.tsx'teki syncedRef desenini örnek al.
- Girişliyken lines/couponCode değişince ~500 ms debounce ile PUT /api/sepet.
  İlk yüklemede ve sekme tekrar odaklanınca (visibilitychange/focus) GET ile
  yenile ki başka cihazdaki değişiklik görünsün.
- Çıkış yapılınca ekrandaki sepet state'i temizlensin (DB'deki sepete dokunma).
- clear() (ödeme sonrası ClearCartOnMount) girişli kullanıcıda DB sepetini de
  boşaltsın.
- Fiyat tazeleme: ilk yüklemede, sekme odaklanınca, çekmece açılınca ve
  /sepet ile /odeme sayfaları açılınca POST /api/sepet/dogrula çağırıp
  lines içindeki priceCents, compareAtCents, name, image alanlarını güncelle
  (totalCents, bundle ve kupon hesapları otomatik yeni fiyata göre çalışmalı —
  useBundleDiscount ve CouponField'ın da güncel satırları kullandığını
  doğrula). Değişen fiyat için CartProvider'da bir `priceNotices` listesi
  tut ve /sepet, çekmece ve /odeme'de kullanıcıya görünür şekilde göster:
  "X ürününün fiyatı güncellendi: eski → yeni" (kapatılabilir). Yayından kalkan
  veya stoğu biten satırı uyarıyla işaretle; bu durumda "Ödemeye Geç" butonu
  engellensin ya da satır otomatik kaldırılıp bildirilsin (bunlardan sana daha
  uygun olanı seç, seçimini DEPLOY_STATUS notunda belirt).
- Yarış/döngü olmasın: doğrulama sonucu state'i güncellerken gereksiz PUT
  tetikleme sonsuz döngüsüne dikkat et (fiyat/isim alanları DB'ye yazılmıyor,
  sadece id+adet yazılıyor; bu yüzden tazeleme PUT tetiklememeli).

### 4. Ödeme adımı (src/app/(site)/odeme/checkout-form.tsx + api/orders/route.ts)
- checkout-form, /api/orders isteğine her satır için ekranda gösterdiği birim
  fiyatı (`expectedPriceCents`) da göndersin. Sunucu tarafındaki zod şemasına
  bunu opsiyonel ekle (eski istemcileri bozma).
- orders/route.ts, resolvedLines'ı DB'den hesapladıktan sonra
  expectedPriceCents gönderilmiş ve DB fiyatından farklıysa sipariş
  OLUŞTURMADAN `409 { code: "PRICE_CHANGED", error: "..." }` dönsün. İstemci
  bu durumda /api/sepet/dogrula ile sepeti tazeleyip "Fiyatlar güncellendi,
  lütfen tekrar kontrol edin" göstersin. Sunucunun fiyatı DB'den hesaplama
  davranışı aynen kalsın.
- Gönderme anında da (handleSubmit başında) bir kez tazeleme yap; fiyat
  değiştiyse formu göndermeden kullanıcıya göster.

### 5. Yan kontrol
Admin'de ürün/varyant fiyatı kaydedilirken src/lib/revalidate-catalog.ts
çağrılıyor mu bak. Çağrılmıyorsa ürün sayfası/katalog önbelleği eski fiyatı
gösterebilir — eksikse fiyat güncelleme aksiyonlarına ekle. Bulduğunu ve
yaptığını raporla.

### 6. Test
1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli. Varsa mevcut unit
   testleri çalıştır.
2. Geçici scratchpad dizininde Playwright ile (yerel dev sunucu) şu senaryoları
   doğrula:
   - Misafir: ürünü sepete ekle → localStorage'da satır var, davranış eskisi
     gibi.
   - Giriş yap: misafir sepeti DB'ye birleşti mi; yeni bir tarayıcı bağlamı
     (farklı context, boş localStorage) ile aynı hesaba gir → sepet dolu geliyor
     mu. Bir bağlamda adet değiştir, diğerinde sekme odağı/yenileme sonrası
     yansıyor mu. Çıkış yapınca sepet ekranda temizleniyor mu, tekrar girişte
     geri geliyor mu.
   - Fiyat: ürünü sepete ekle; admin tarafında (Prisma script veya admin UI)
     ürün fiyatını değiştir; sepet sayfasını/çekmeceyi/odeme sayfasını
     yenile → yeni fiyat ve "fiyat güncellendi" uyarısı görünüyor mu,
     toplam ve indirimler yeni fiyata göre mi. Ödeme formunu göndermeden hemen
     önce fiyat değiştirilirse 409 PRICE_CHANGED akışı çalışıyor mu (sipariş
     oluşmadan uyarı).
   - Ödeme tamamlanınca (sandbox) DB sepeti de temizleniyor mu.
   Test verisini (değiştirdiğin fiyatı, oluşan test siparişlerini) geri al/
   temizle; production DB'ye dokunma.
3. Bulguları ve önce/sonra ekran görüntülerini özetle.

Her iş bitince DEPLOY_STATUS.md'ye ne yapıldığını, hangi dosyaların
değiştiğini ve production'a alırken yapılması gereken adımları (özellikle
prisma migrasyonu) not düş. Commit'i mesajıyla birlikte öner ama benim
onayım olmadan push etme.
```
