# Bollmark – Faz A Uygulama Planı (Kampanya, Sepet Hatırlatma, Stok Bildirimi)

Bu dosya, `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de önerilen fazlı yol
haritasının **Faz A** (kısa vade, satışı doğrudan etkileyen) maddelerinin
uygulamaya hazır planıdır: indirim kodu/kampanya modülü, terk edilmiş sepet
hatırlatma, stok azlığı/tükendi bildirimi. Repo (schema.prisma, `src/lib`,
`src/app`, mevcut admin bileşenleri) okunarak hazırlandı; aşağıdaki şema ve
kod taslakları mevcut kod stiliyle (Türkçe yorumlar, zod validasyonu,
server-side fiyat/indirim hesaplaması, mevcut admin tablo/form
bileşenlerinin yeniden kullanımı) tutarlı olacak şekilde tasarlandı.

**Toplu ürün içe aktarma bu plandan çıkarıldı.** Faz A'nın dördüncü
maddesiydi, ama kapsamı önemli ölçüde değişti: burada tasarlanan genel
amaçlı CSV şablonu yerine, dükkanın ürünleri sisteme aktarırken zaten
kullandığı **kendi Excel formatına** göre bir eşleme yapılacak, ayrıca
ürün fotoğrafları elle/URL ile değil **internetten otomatik bulunup
eklenecek** — bu, aşağıdaki üç maddeden çok farklı bir iş (dosya format
eşleme + görsel arama/indirme otomasyonu) ve ayrı, kendi başına ele
alınacak. Kullanıcı örnek Excel dosyasını paylaştığında ayrı bir plan
olarak hazırlanacak.

**Kapsam dışı bırakılanlar (bu pakette değil):** SEO altyapısı, ürün
yorumu/wishlist, yasal sayfalar, iade/değişim (RMA), personel rolleri,
kargo/pazaryeri/e-fatura entegrasyonları — bunlar `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de
Faz B/C'de veya ayrı işler olarak zaten not edilmiş durumda.

## 0) Ortak altyapı — önce bunlar kurulmalı

Faz A'nın üç maddesi (kampanya, sepet hatırlatma, stok bildirimi) e-posta
gönderimine dayanıyor ve projede şu an **hiç e-posta gönderme altyapısı
yok**. Bu yüzden 0. adım olarak tek seferlik bir kurulum gerekiyor,
sonraki üç madde bunun üzerine oturuyor.

### 0.1 E-posta gönderimi: Resend

**Karar:** [Resend](https://resend.com) kullanılacak. Gerekçe: Vercel ile
sorunsuz çalışıyor (serverless/edge fonksiyonlarda ekstra SMTP bağlantı
sorunu yaşatmıyor), ücretsiz planı (ayda 3.000 e-posta/gün 100) küçük bir
mağaza için fazlasıyla yeterli, kurulumu tek bir API anahtarıyla ve `npm
install resend` ile birkaç dakika sürüyor. Alternatifi (Nodemailer + Gmail
SMTP) küçük hacimde çalışsa da Gmail'in gönderim limitleri ve spam'e düşme
riski nedeniyle önerilmiyor.

**Yapılacaklar:**
1. resend.com üzerinde ücretsiz hesap açılır, `bollmark.com` domaini
   doğrulanır (DNS'e birkaç TXT/CNAME kaydı eklenir — domain zaten Natro
   üzerinde, bu adım için Natro DNS paneline birkaç dakikalık bir işlem
   gerekecek). Domain doğrulanana kadar test amaçlı Resend'in kendi
   `onboarding@resend.dev` gönderen adresiyle de çalışılabilir.
2. `npm install resend`
3. `.env` / `.env.local` / Vercel ortam değişkenlerine eklenir:
   ```
   RESEND_API_KEY="re_xxx"
   MAIL_FROM="Bollmark <siparis@bollmark.com>"
   ```
4. `src/lib/mail.ts` — tek merkezi gönderim fonksiyonu:
   ```ts
   import { Resend } from "resend";

   const resend = new Resend(process.env.RESEND_API_KEY);

   export async function sendMail(params: { to: string; subject: string; html: string }) {
     try {
       await resend.emails.send({
         from: process.env.MAIL_FROM ?? "Bollmark <onboarding@resend.dev>",
         to: params.to,
         subject: params.subject,
         html: params.html
       });
     } catch (error) {
       // E-posta gönderimi başarısız olsa bile asıl işlemi (sipariş, stok
       // güncelleme vb.) ASLA engellememeli - hata sadece loglanır.
       console.error("E-posta gönderilemedi (yoksayıldı):", error);
     }
   }
   ```
   Bu fonksiyon aşağıdaki üç maddenin tamamında (kupon onay maili gerekmiyor
   ama sepet hatırlatma ve stok bildirimi maillerinde) tek noktadan
   kullanılır — `deleteBlobUrls` fonksiyonundaki "temizlik asıl işlemi
   engellememeli" prensibiyle birebir aynı yaklaşım.

### 0.2 Zamanlanmış görevler: Vercel Cron

Sepet hatırlatma e-postalarının "checkout yarım kaldıktan 1 saat sonra"
gibi bir gecikmeyle gönderilmesi gerekiyor; bunun için bir zamanlayıcı
lazım. **Karar:** Vercel Cron Jobs (proje zaten Vercel'de barındığı için
ek bir servise gerek yok, ücretsiz planda günde sınırlı sayıda cron
job çalıştırılabiliyor — bizim ihtiyacımız günde birkaç kez tetiklenen
tek bir job, bu limitin fazlasıyla içinde).

`vercel.json` (proje kökünde yoksa oluşturulur):
```json
{
  "crons": [
    { "path": "/api/cron/sepet-hatirlatma", "schedule": "0 * * * *" }
  ]
}
```
(Her saat başı çalışır.) Cron endpoint'i, Vercel'in otomatik eklediği
`Authorization: Bearer $CRON_SECRET` header'ı ile korunur:
```
CRON_SECRET="rastgele-uzun-bir-metin"
```
env değişkenine eklenir, route içinde `request.headers.get("authorization")
!== \`Bearer ${process.env.CRON_SECRET}\`` kontrolüyle yetkisiz çağrılar
reddedilir (aşağıda A.2'de detaylandırıldı).

---

## A.1) İndirim Kodu / Kampanya Modülü

### Kapsam (v1)
Kupon kodu ile: yüzde indirim, sabit tutar indirim, ücretsiz kargo.
Kategori/marka bazlı otomatik kampanyalar ve "X al Y öde" gibi daha
karmaşık kurallar bu pakette **yok** — bunlar `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de
zaten "kampanya motorunun ilk basit sürümü" olarak işaretlenmişti; v1
sonrası genişletilebilir bir temel atıyoruz (`type` alanı ileride yeni
değerler alabilir).

### Şema
```prisma
model Coupon {
  id            String    @id @default(cuid())
  code          String    @unique   // hep büyük harfe normalize edilip saklanır (örn. "HOSGELDIN10")
  type          String              // "PERCENT" | "FIXED" | "FREE_SHIPPING"
  value         Int       @default(0) // PERCENT: 1-100 arası, FIXED: kuruş, FREE_SHIPPING: kullanılmaz (0)
  minOrderCents Int       @default(0) // bu tutarın altındaki sepetlerde geçersiz
  usageLimit    Int?                 // toplam kullanım sınırı - null = sınırsız
  usedCount     Int       @default(0)
  startsAt      DateTime?
  expiresAt     DateTime?
  isActive      Boolean   @default(true)
  orders        Order[]
  createdAt     DateTime  @default(now())
}
```
`Order` modeline eklenecek alanlar:
```prisma
model Order {
  // ...mevcut alanlar...
  couponId      String?
  coupon        Coupon?  @relation(fields: [couponId], references: [id])
  discountCents Int      @default(0)
}
```
Hepsi opsiyonel/varsayılanlı eklenir, mevcut siparişler etkilenmez.

### Kritik kural: indirim ASLA istemciden gelen değerle hesaplanmaz
`src/app/(site)/api/orders/route.ts` zaten fiyatı istemciden değil
veritabanından yeniden okuyor (yorum satırında bu bilinçli bir karar
olarak açıklanmış); aynı prensip kupon için de uygulanacak: istemci sadece
kupon **kodunu** gönderir, indirim tutarı her zaman sunucuda kod →
`Coupon` kaydı → kurallar (aktif mi, tarih aralığında mı, `minOrderCents`
sağlanıyor mu, `usageLimit` doldu mu) kontrol edilip yeniden hesaplanır.

**Önizleme endpoint'i** (sepet sayfasında "Uygula" butonuna anlık geri
bildirim vermek için, ama nihai/bağlayıcı olan değil):
`POST /api/kuponlar/dogrula` → `{ code, subtotalCents }` alır,
`{ valid: true, discountCents, message }` veya `{ valid: false, message }`
döner. Bu route indirimi **uygulamaz**, sadece hesaplayıp gösterir.

**Nihai hesaplama:** `orders/route.ts` içindeki `orderSchema`'ya opsiyonel
`couponCode: z.string().optional()` eklenir. Sipariş oluşturulmadan hemen
önce, kod verilmişse aynı doğrulama tekrar yapılır (yarış durumunu —
aynı anda iki müşterinin son kullanım hakkını tüketmesini — önlemek için
`prisma.$transaction` içinde `usedCount` artırımıyla birlikte atomik
yapılır):
```ts
const result = await prisma.$transaction(async (tx) => {
  let discountCents = 0;
  let couponId: string | null = null;
  if (data.couponCode) {
    const coupon = await tx.coupon.findUnique({ where: { code: data.couponCode.toUpperCase() } });
    const invalid =
      !coupon ||
      !coupon.isActive ||
      (coupon.expiresAt && coupon.expiresAt < new Date()) ||
      (coupon.startsAt && coupon.startsAt > new Date()) ||
      (coupon.usageLimit != null && coupon.usedCount >= coupon.usageLimit) ||
      subtotalCents < coupon.minOrderCents;
    if (invalid) {
      throw new CouponInvalidError();
    }
    discountCents =
      coupon.type === "PERCENT" ? Math.round((subtotalCents * coupon.value) / 100) :
      coupon.type === "FIXED" ? Math.min(coupon.value, subtotalCents) : 0;
    couponId = coupon.id;
    await tx.coupon.update({ where: { id: coupon.id }, data: { usedCount: { increment: 1 } } });
  }
  const freeShipping = /* kupon tipi FREE_SHIPPING ise */ true;
  const shippingCents = freeShipping ? 0 : (subtotalCents - discountCents >= 100000 ? 0 : 4900);
  const totalCents = subtotalCents - discountCents + shippingCents;
  return tx.order.create({ data: { /* ... discountCents, couponId ... */ } });
});
```
(Kod taslağı özet amaçlıdır, uygulama sırasında `CouponInvalidError` için
uygun bir hata/response akışı yazılacak — kupon geçersizse sipariş
oluşturulmaz, 400 döner, sepet sayfasında kullanıcıya gösterilir.)

**Not — kargo eşiği tutarlılığı:** Şu an "10.000₺ üzeri ücretsiz kargo"
eşiği hem `odeme/page.tsx` (client, sadece gösterim için) hem
`orders/route.ts` (server, gerçek hesap) içinde **ayrı ayrı** hardcode
edilmiş durumda. Kupon eklenirken bu iki yer de güncellenecek; orta
vadede bu eşiğin `StoreSettings` tablosuna taşınıp tek yerden
yönetilmesi (zaten `defaultShippingCents` alanı orada duruyor ama şu an
hiç kullanılmıyor) ayrı bir küçük iyileştirme olarak önerilir — Faz A'ya
dahil değil ama not düşülüyor.

### Admin panel
Yeni sayfa: `/admin/kampanyalar` — mevcut `/admin/markalar` sayfasıyla
(liste + satır düzenleme + `brand-feedback.tsx` tarzı bir
`coupon-feedback.tsx`) neredeyse birebir aynı desende: kod, tip, değer,
min. sepet tutarı, kullanım limiti/sayısı, başlangıç/bitiş tarihi, aktif
anahtarı. `components/admin/coupon-row.tsx` (mevcut `category-row.tsx`
kalıbı), `components/admin/coupons-table.tsx`.
`components/admin/sidebar.tsx`'e yeni öğe: `{ href: "/admin/kampanyalar",
label: "Kampanyalar", icon: Percent }` (Ürünler ile Siparişler arasına,
"Markalar"dan sonra).

### Mağaza tarafı
`lib/cart.tsx`'e `couponCode` alanı eklenir (context'te tutulur, sepet
sayfasında "İndirim kodu" input + "Uygula" → `/api/kuponlar/dogrula`
çağrısı, sonucu (indirim tutarı/hata mesajı) sepet ve ödeme özetinde
gösterilir. `odeme/page.tsx`'teki `handleSubmit` payload'una
`couponCode` eklenir. Sipariş başarıyla oluşunca `clear()` çağrısı
kupon kodunu da temizler.

---

## A.2) Terk Edilmiş Sepet Hatırlatma

### Mimari kısıt — önce bu netleşmeli
Şu an sepet tamamen istemci tarafında `localStorage`'da tutuluyor
(`lib/cart.tsx`), sunucu bunun varlığından habersiz. Müşterinin e-posta
adresi de yalnızca **checkout formunu gönderdiği** anda sunucuya ulaşıyor
— ve form gönderildiği an zaten sipariş oluşuyor (`PENDING_PAYMENT`).
Yani şu an sistemde "e-postasını biliyoruz ama siparişi tamamlamadı"
durumu **oluşamıyor**: ya hiç e-posta yok (sepete ürün koyup hiç
checkout'a gelmemiş), ya da sipariş zaten oluşmuş.

Bu yüzden gerçek bir "sepet terk etme" hatırlatması için **checkout
formunda e-posta girildiği an** (form gönderilmeden önce) bunu
yakalayan bir mekanizma eklemek gerekiyor. v1 kapsamı budur; sepete ürün
koyup checkout sayfasına hiç gelmeyen ziyaretçileri hedeflemek (örn.
sepet sayfasında ayrı bir "e-posta ile sepetini kaydet" alanı veya
çıkış-niyeti pop-up'ı) daha invaziv bir UX değişikliği gerektirdiği için
**Faz B'ye bırakılıyor** — aşağıda "sonraki adım" olarak not edildi.

### Şema
```prisma
model AbandonedCart {
  id          String    @id @default(cuid())
  email       String
  linesJson   String    // CartLine[] JSON anlık görüntüsü (ürün adı, beden, renk, adet, fiyat)
  totalCents  Int
  recoveredAt DateTime? // aynı e-postayla sipariş tamamlanınca işaretlenir
  remindedAt  DateTime? // hatırlatma e-postası gönderilince işaretlenir
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@index([email])
}
```

### Akış
1. **Yakalama:** `odeme/page.tsx`'teki e-posta input'una `onBlur`
   olayı eklenir (kullanıcı alana yazıp başka bir alana geçtiğinde) —
   e-posta geçerli görünüyorsa (basit regex) ve sepet doluysa
   `POST /api/sepet-kaydet` çağrılır: `{ email, lines, totalCents }`.
   Route, aynı `email` için açık (recoveredAt=null) bir kayıt varsa
   günceller, yoksa yeni `AbandonedCart` oluşturur (upsert). Bu istek
   "kaydediliyor" göstergesi olmadan arka planda (fire-and-forget)
   yapılır, kullanıcı akışını hiçbir şekilde yavaşlatmaz veya
   engellemez — hata olursa sessizce yutulur.
2. **Kurtarma:** Sipariş başarıyla oluşunca (`orders/route.ts`
   POST 201 sonrası, aynı transaction'ın dışında, best-effort) o
   `customerEmail` için açık `AbandonedCart` kayıtları
   `recoveredAt: new Date()` ile işaretlenir — artık hatırlatma
   gönderilmeyecek.
3. **Hatırlatma (cron):** `GET /api/cron/sepet-hatirlatma` (Vercel Cron,
   saatte bir tetiklenir, `Authorization: Bearer $CRON_SECRET` ile
   korunur) şu koşullardaki kayıtları bulur: `recoveredAt IS NULL AND
   remindedAt IS NULL AND createdAt <= now() - 1 saat`. Her biri için
   Resend ile "Sepetinizde ürünler sizi bekliyor" e-postası gönderilir
   (ürün adları + toplam tutar + `bollmark.com/sepet` linki içerir),
   `remindedAt` işaretlenir. Aynı sorguda `createdAt <= now() - 30 gün`
   olan ve hâlâ `recoveredAt IS NULL` kayıtlar (artık anlamsız,
   kurtarılamayacak eski veri) opsiyonel olarak temizlenebilir — v1'de
   basit tutmak için bu temizlik dahil edilmiyor, gerekirse ileride
   ayrı bir bakım job'ı eklenir.
4. **KVKK/e-posta izni notu:** Kullanıcı checkout formunda e-postasını
   "sipariş vermek için" giriyor, bu bilgiyi "sepet hatırlatma"
   amacıyla kullanmak Türkiye'de ticari elektronik ileti mevzuatı
   açısından gri bir alan olabilir (bu tür bir hatırlatma genelde
   "işlemsel" sayılır ama kesin sınır durumdan duruma değişir) — kesin
   uyumluluk için bir hukuk danışmanına sormanızı öneririm; pratikte
   checkout formuna küçük bir not ("Ödemenizi tamamlamazsanız
   sepetinizi hatırlatmak için size e-posta gönderebiliriz") eklemek
   makul bir şeffaflık adımı olur.

---

## A.3) Stok Azlığı / Tükendi Göstergesi ve "Haber Ver" Bildirimi

### Şema
```prisma
model StockAlert {
  id         String         @id @default(cuid())
  variantId  String
  variant    ProductVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
  email      String
  notifiedAt DateTime?
  createdAt  DateTime       @default(now())

  @@unique([variantId, email])
}
```
`ProductVariant` modeline `stockAlerts StockAlert[]` ilişkisi eklenir.

### Mağaza tarafı
- Ürün detay sayfasında (`urunler/[slug]/page.tsx`, varyant seçici
  `product-viewer.tsx` içinde) seçili varyantın `stock === 0` olduğu
  durumda "Sepete Ekle" butonu yerine "Stokta Yok" + küçük bir e-posta
  formu ("Stok gelince haber ver") gösterilir → `POST
  /api/stok-bildirimi` `{ variantId, email }`, `StockAlert` upsert
  edilir (aynı kişi aynı varyant için tekrar kayıt olursa hata değil,
  sessizce günceller).
- `stock` düşük ama `> 0` olduğunda (eşik: `stock <= 3`, sabit bir sayı
  olarak koda yazılır — ileride `StoreSettings`'e taşınabilir) "Son {n}
  adet" uyarısı gösterilir. Bu, e-posta gerektirmeyen salt UI bir
  değişikliktir.

### Admin tarafı — tetikleme
Ürün/varyant güncelleme admin route'unda (`urunler/[id]/page.tsx`
altındaki server action veya karşılık gelen API), bir varyantın
`stock` değeri **0'dan pozitif bir sayıya** geçtiğinde
(`önceki.stock === 0 && yeni.stock > 0`) o varyant için `notifiedAt IS
NULL` olan tüm `StockAlert` kayıtlarına Resend ile "Beklediğiniz ürün
tekrar stokta" e-postası gönderilir, sonra `notifiedAt` işaretlenir.
Bu mantık `src/lib/stock-alerts.ts` içinde `notifyRestockedVariant(variantId,
previousStock, newStock)` adında tek bir yardımcı fonksiyon olarak
yazılır ve ürün kaydetme akışının kullandığı yerden (muhtemelen
`urunler/[id]/page.tsx`'teki güncelleme server action'ı) çağrılır — bu,
`applyShipmentUpdate` fonksiyonunun `lib/shipment.ts`'de paylaşılan
mantık olarak tutulmasıyla aynı desendir.

---

## A.4) Toplu Ürün İçe Aktarma — bu plandan çıkarıldı, ayrı ele alınacak

Kullanıcının dükkanda ürünleri sisteme aktarırken zaten kullandığı bir
Excel formatı var; içe aktarma bu formata göre eşlenecek (genel amaçlı
bir CSV şablonu tasarlamak yerine) ve ürün fotoğrafları otomatik olarak
internetten bulunup eklenecek. Bu ikisi (mevcut Excel'e uyum + otomatik
görsel bulma) hem veri eşleme hem görsel arama/indirme/doğrulama
açısından yukarıdaki üç maddeden bağımsız, kendi başına bir tasarım
gerektiriyor — kullanıcı örnek Excel dosyasını paylaşınca ayrı bir
`*_PLANI.md` olarak hazırlanacak. Aşağıdaki uygulama sırası ve test
listesi buna göre güncellendi (üç maddeye indirildi).

---

## Yeni bağımlılıklar ve ortam değişkenleri (özet)

**`npm install resend`** — tek yeni paket.

`.env.example`'a eklenecek satırlar:
```
# Resend (e-posta gönderimi: sepet hatırlatma, stok bildirimi)
RESEND_API_KEY=""
MAIL_FROM="Bollmark <onboarding@resend.dev>"

# Vercel Cron'un /api/cron/* rotalarını çağırırken kullandığı gizli anahtar
CRON_SECRET=""
```

## Şema değişikliklerinin tek migration'da toplanması

Yukarıdaki üç yeni model (`Coupon`, `AbandonedCart`, `StockAlert`) ve
`Order`'a eklenen iki alan (`couponId`, `discountCents`), Ürün Bilgisi
Paketi'nde izlenen yöntemle aynı şekilde tek bir `prisma db push` /
migration adımında birlikte uygulanır — hepsi opsiyonel/varsayılanlı
olduğu için mevcut veriye zarar vermez.

## Önerilen uygulama sırası (Faz A içi alt sıralama)

Üç madde birbirinden bağımsız çalışabilir durumda tasarlandı (hiçbiri
bir diğerinin şemasına muhtaç değil), yalnızca **0. adım (Resend kurulumu)
hepsinden önce bitmiş olmalı**. Önerilen sıra:

1. **0) Ortak altyapı** — Resend hesabı + `lib/mail.ts` + Vercel Cron
   iskeleti. (Yarım-bir günlük iş.)
2. **A.3) Stok bildirimi** — küçük, tek modelli, admin tarafında tek bir
   tetikleme noktası var; en hızlı biten iş.
3. **A.1) Kampanya/indirim kodu** — en çok yeni yüzey alanına sahip
   (yeni admin sayfası + sepet/ödeme akışı değişikliği), dikkatli test
   gerektirir (indirim/kargo/toplam hesaplamalarının hepsi doğru
   uyuşmalı).
4. **A.2) Terk edilmiş sepet hatırlatma** — en çok mimari karar
   içerdiği ve gerçek etkisini görmek için diğerlerinin (özellikle
   kampanya, "hatırlatma + indirim kodu" birleşince dönüşüm daha da
   artar) tamamlanmış olması faydalı olduğu için son sırada.

İsterseniz bu sırayı değiştirebiliriz (örn. önce en yüksek işlevsel
etkiye sahip A.1'den başlamak da savunulabilir) — yukarıdaki sıralama
"en az riskle en hızlı ilerleme" mantığıyla önerildi.

## Test / doğrulama listesi (her madde için)

- **A.1:** Geçerli/süresi geçmiş/henüz başlamamış/limiti dolmuş/min.
  tutarı sağlamayan kupon senaryolarının hepsi server tarafında
  reddediliyor mu; aynı kuponun iki sekmede aynı anda kullanılması
  `usedCount`'u doğru artırıyor mu (limit aşımı yaşanmıyor mu); kupon
  uygulanan siparişte `discountCents` + `shippingCents` + `totalCents`
  toplamı tutarlı mı.
- **A.2:** E-posta girilip form terk edildiğinde kayıt oluşuyor mu;
  aynı e-postayla sipariş tamamlanınca `recoveredAt` işaretleniyor ve
  cron artık o kayda dokunmuyor mu; cron endpoint'i `CRON_SECRET`
  olmadan çağrıldığında reddediyor mu.
- **A.3:** Stok 0→pozitif geçişinde bekleyen tüm kayıtlara mail gidip
  `notifiedAt` işaretleniyor mu; aynı varyant tekrar 0'a düşüp tekrar
  pozitife çıktığında (önceden bildirim almış birine tekrar mail gitmemesi
  gerekiyorsa) davranış netleştirilmeli — v1 önerisi: `notifiedAt`
  dolmuş kayıt bir daha tetiklenmez (kullanıcı isterse ürün sayfasından
  tekrar "haber ver" kaydı oluşturabilir).

## Sonraki adım

Bu plan onaylandıktan sonra 0. adımdan (Resend hesabı + `lib/mail.ts`)
başlanıp yukarıdaki sırayla Claude Code ile uygulamaya geçilebilir; her
madde kendi başına test edilip bir sonrakine geçilmesi öneriliyor (üçünü
birden tek seferde yazıp sona test etmek yerine). Toplu ürün içe aktarma
(mevcut Excel formatına göre eşleme + otomatik görsel bulma) ayrı bir
konu olarak, kullanıcı örnek Excel dosyasını paylaştığında ele alınacak.

**Faz B'ye not düşülenler (bu paket kapsamı dışı, ileride):** gerçek
"sepete ürün koyup checkout'a hiç gelmeyen" ziyaretçileri hedefleyen bir
sepet-kaydetme UX'i (A.2'nin genişletilmiş hali); indirim/kargo eşiğinin
`StoreSettings`'e taşınması.
