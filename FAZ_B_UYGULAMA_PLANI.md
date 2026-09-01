## İlerleme Durumu

- **0) Ortak altyapı TAMAMLANDI** (commit `a18f6dc`) — `src/lib/roles.ts`
  (`AdminRole`, `personelAllowedPaths`, `isPathAllowedForRole`),
  `src/lib/order-notifications.ts` (`notifyAdminNewOrder` /
  `notifyCustomerStatusChange`, henüz hiçbir yerden çağrılmıyor — B.4'te
  bağlanacak), `AdminUser.isActive` alanı (gerçek Neon DB'ye `db:push` ile
  uygulandı, mevcut 2 admin kaydı `isActive: true` olarak doğrulandı),
  `authorize()` artık pasif kullanıcıyı reddediyor, `session.user.role` /
  `token.role` tipleri `AdminRole` ile daraltıldı. `npx tsc --noEmit` ve
  `npm run build` temiz geçti.
  - **Not:** Planda "middleware.ts" diye geçen dosya bu projede yok —
    Next.js 16'da bu isim `src/proxy.ts` oldu (repo zaten bunu doğru
    kullanıyor, `guardAdmin` fonksiyonu oturum kontrolü yapıyor). B.2'de
    rol bazlı erişim kısıtlaması (`isPathAllowedForRole`) planın önerdiği
    gibi layout/requireAdmin() yerine (veya onunla birlikte) buraya
    eklenecek çünkü asıl route koruması burada.
  - **Sıradaki adım: B.4 (Otomatik E-posta Bildirimleri).** Henüz
    başlanmadı, onay bekliyor.
- Faz A (kampanya/kupon, terk edilmiş sepet hatırlatma, stok bildirimi)
  tamamlanıp canlıda doğrulandı — bkz. `FAZ_A_UYGULAMA_PLANI.md`.
- **B.3 (kargo firması API entegrasyonu) kullanıcıdan bilgi bekliyor** —
  hangi kargo firması/firmaları (Yurtiçi, Aras, MNG, PTT...) ve o firmanın
  API kullanıcı adı/şifre/entegratör kodu paylaşılmadan gerçek API çağrısı
  yazılamaz. Aşağıda bu madde için hem "şimdi yapılabilecek" (soyutlama
  katmanı + admin arayüzü) hem "bilgi gelince yapılacak" kısım ayrı
  işaretlendi — diğer dört madde bu bilgiyi beklemeden tamamlanabilir.

---

# Bollmark – Faz B Uygulama Planı (İade/Değişim, Personel Rolleri, Kargo API, Otomatik Mail, Raporlama)

Bu dosya, `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de tanımlanan **Faz B**
("orta vade, operasyonu büyütmeye hazırlar") maddelerinin uygulamaya hazır
planıdır. Repo (`prisma/schema.prisma`, `src/lib`, `src/app/(admin)`, mevcut
admin bileşenleri, Faz A'da eklenen `src/lib/mail.ts` ve kupon/stok bildirimi
akışları) okunarak hazırlandı; Faz A'da izlenen üslup korunuyor: Türkçe
yorumlar, zod validasyonu, server-side hesaplama, mevcut admin tablo/form
bileşenlerinin (`DataTable`, `Card`, `Badge`, `*-feedback.tsx`, `*-row.tsx`)
yeniden kullanımı, e-posta/yan-etkilerin asıl işlemi asla engellememesi
prensibi (`sendMail` zaten bu şekilde, `deleteBlobUrls` ve terk edilmiş sepet
kurtarma işaretlemesiyle aynı desen).

**Kapsam dışı (Faz C'de veya ayrı iş):** pazaryeri entegrasyonu, e-Fatura,
gerçek `Customer` hesap modeli + sadakat programı, bundle/ön sipariş, denetim
kaydı (audit log) — bunlar `ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md`'de zaten
Faz C olarak ayrılmış. Ürün yorumu/wishlist/SEO/yasal sayfalar da aynı
belgede "zaten planlı, ayrı iş" olarak not düşülmüş, bu pakete dahil değil.

## 0) Ortak altyapı — önce bunlar kurulmalı

Personel rolleri (B.2) ve otomatik bildirimler (B.4), aşağıdaki iki küçük
temel üzerine oturuyor; ikisi de tek seferlik.

### 0.1 Rol tanımları

`AdminUser.role` alanı şemada zaten var (`@default("ADMIN")`) ama şu ana
kadar hiçbir yerde okunmuyor/yetki kontrolü yapmıyordu. Yeni dosya
`src/lib/roles.ts` (mevcut `status.ts` kalıbıyla aynı):
```ts
export const adminRoles = ["ADMIN", "PERSONEL"] as const;
export type AdminRole = (typeof adminRoles)[number];
export const adminRoleLabel: Record<AdminRole, string> = {
  ADMIN: "Tam Yetkili",
  PERSONEL: "Sipariş Hazırlama"
};

// PERSONEL rolünün erişebileceği tek kök yol grubu - sipariş ve kargo.
// Bunun dışındaki her /admin/* yolu sadece ADMIN'e açık.
export const personelAllowedPaths = ["/admin", "/admin/siparisler", "/admin/kargolar"];
export function isPathAllowedForRole(role: string, pathname: string): boolean {
  if (role === "ADMIN") return true;
  return personelAllowedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}
```
`AdminUser` modeline `isActive Boolean @default(true)` eklenir (personeli
silmek yerine pasifleştirmek için - sipariş geçmişinde "kim işledi" izi
tutulmuyor şu an zaten, ama ileride tutulacaksa kaydın durması gerekir).
`src/lib/auth.ts`'teki `authorize` fonksiyonu `isActive: false` olan
kullanıcıyı reddedecek şekilde güncellenir (`if (!user || !user.isActive)
return null;`), `jwt`/`session` callback'leri `role`'ü zaten taşıyor,
`AdminRole` tipiyle daraltılır.

### 0.2 Sipariş bildirim yardımcı fonksiyonu

Yeni dosya `src/lib/order-notifications.ts` — B.1 ve B.4'ün ikisi de bunu
kullanacak, tek merkezden Türkçe e-posta şablonları:
```ts
import { sendMail } from "@/lib/mail";
import { formatPrice } from "@/lib/format";
import { orderStatusLabel, type OrderStatus } from "@/lib/status";
import type { Order } from "@/generated/prisma/models";

export async function notifyAdminNewOrder(order: Order) {
  const to = process.env.ADMIN_NOTIFY_EMAIL || process.env.MAIL_FROM;
  if (!to) return;
  await sendMail({
    to,
    subject: `Yeni sipariş: ${order.orderNumber}`,
    html: `<p>${order.customerName} - ${formatPrice(order.totalCents)}</p>
           <p><a href="https://bollmark.com/admin/siparisler/${order.id}">Siparişi görüntüle</a></p>`
  });
}

export async function notifyCustomerStatusChange(order: Order, status: OrderStatus) {
  // Her durum için mail atmak gürültü yaratır - sadece müşterinin bilmesi
  // gereken 3 kritik geçiş için gönderilir.
  const notifiableStatuses: OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];
  if (!notifiableStatuses.includes(status)) return;
  await sendMail({
    to: order.customerEmail,
    subject: `Siparişiniz ${orderStatusLabel[status]} - ${order.orderNumber}`,
    html: `<p>Merhaba ${order.customerName}, ${order.orderNumber} numaralı siparişinizin durumu
           "${orderStatusLabel[status]}" olarak güncellendi.</p>`
  });
}
```
`sendMail` zaten hatayı yutup logluyor (Faz A deploy düzeltmesinden sonra),
bu yüzden burada ayrı bir try/catch gerekmiyor - çağıran taraf sadece
`await` edip unutabilir, ama best-effort/asıl-işlemi-engellememe prensibini
netleştirmek için çağrı noktalarında `.catch(() => {})` ile fire-and-forget
yapılacak (aşağıda B.4'te detaylandırıldı).

Şema değişikliği (0.1 + B.1 + B.3 aşağıda) tek migration'da toplanır, Faz
A'da izlenen yöntemle aynı: `prisma db push`, opsiyonel/varsayılanlı alanlar,
mevcut veri etkilenmez.

---

## B.4) Otomatik E-posta Bildirimleri

En küçük ve en hızlı biten madde, 0.2'deki yardımcı fonksiyonları kullanır -
önce bu yapılırsa sonraki maddelerde (B.1'de iade durum değişikliği maili
gibi) aynı deseni tekrar tekrar açıklamak yerine "B.4'teki gibi" denebilir.

1. **Yeni sipariş → size:** `src/app/(site)/api/orders/route.ts` içinde,
   sipariş başarıyla oluşturulduktan sonra (mevcut terk edilmiş sepet
   kurtarma işaretlemesinin hemen yanına, aynı best-effort desende):
   ```ts
   notifyAdminNewOrder(order).catch((e) => console.error("Yeni siparis maili basarisiz:", e));
   ```
   Alıcı adresi: yeni env değişkeni `ADMIN_NOTIFY_EMAIL` (yoksa `MAIL_FROM`'a
   düşer). `.env.example`'a eklenir.
2. **Durum değişince → müşteriye:** üç çağrı noktası var, hepsi aynı
   `notifyCustomerStatusChange` fonksiyonunu fire-and-forget çağıracak:
   - `src/app/(admin)/admin/siparisler/[id]/page.tsx` → `setOrderStatus`
     server action (tekil durum değişikliği).
   - `src/app/api/admin/siparisler/bulk/route.ts` → toplu durum değişikliği
     (`SET_STATUS` action) - her sipariş için döngüde çağrılır.
   - `src/lib/shipment.ts` → `applyShipmentUpdate` içinde, `status ===
     "KARGOYA_VERILDI"` olduğunda ilişkili `order`'ı çekip `SHIPPED` bildirimi
     (kargo durumu ile sipariş durumu farklı state machine'ler olduğu için
     burada ayrıca tetiklenmesi gerekiyor - `Order.status` otomatik
     `SHIPPED`'e geçmiyor, admin ayrıca "Kargola" butonuna basmadıysa bile
     kargo durumunu güncelleyebiliyor).
3. **Test:** Gerçek Neon DB'ye karşı bir sipariş oluşturulup `ADMIN_NOTIFY_EMAIL`
   ortam değişkeni geçiciyken (yerelde `.env`) admin mailinin gittiği,
   ardından durumu `PAID`/`SHIPPED`/`DELIVERED` yapınca müşteri mailinin
   gittiği Resend dashboard'undan (veya konsol logundan, anahtar yoksa)
   doğrulanır; `PREPARING`/`CANCELLED` gibi bildirim listesinde olmayan
   durumlarda mail GİTMEDİĞİ de doğrulanır (gürültü kontrolü).

---

## B.2) Personel Hesapları + Rol Yetkilendirme

### Şema
0.1'de tanımlanan `isActive` alanı dışında yeni model gerekmiyor —
`AdminUser.role` zaten var, sadece artık gerçekten okunacak.

### Admin panel — personel yönetimi
Yeni sayfa `/admin/personel`, sadece `role === "ADMIN"` erişebilir (aşağıdaki
erişim kontrolü bunu zaten kapsıyor). Desen `/admin/markalar`/`/admin/kampanyalar`
ile aynı: liste + satır düzenleme + ekleme formu.
- `components/admin/personel-row.tsx`: ad, e-posta, rol (`<select>`,
  `adminRoleLabel`'dan), aktif/pasif toggle, "Şifre Sıfırla" (yeni geçici
  şifre üretip gösterir - personel ilk girişte `/admin/ayarlar`'dan kendi
  şifresini değiştirebilir, bu akış zaten var).
- Yeni personel ekleme formu: ad, e-posta, rol, geçici şifre (admin belirler
  veya "Şifre Oluştur" butonuyla rastgele üretilir, ekranda bir kerelik
  gösterilir - `bcrypt.hash` ile saklanır, `db/seed.ts`'teki mantıkla aynı).
- Kendi kendini pasifleştirme/silme engellenir (oturum açan admin, kendi
  kaydında rol/aktiflik değiştiremez - sunucu tarafında `session.user.email
  === hedefKullanici.email` kontrolü).
- Sidebar'a yeni öğe: `{ href: "/admin/personel", label: "Personel", icon:
  Users2 }` — sadece `role === "ADMIN"` iken render edilir (bkz. aşağıdaki
  erişim kontrolü, sidebar zaten client component ve session'ı okuyabilir
  ya da server'dan prop olarak `role` geçirilir - ikinci yol tercih edilir,
  `layout.tsx` zaten session'ı okuyor).

### Erişim kontrolü (kritik kısım)
Şu an `src/app/(admin)/layout.tsx` sadece "oturum var mı" kontrolü yapıyor,
role'e bakmıyor. İki katmanlı kontrol eklenir:
1. **`src/app/(admin)/layout.tsx`**: session'dan `role`'ü okuyup
   `Sidebar`'a prop olarak geçer (sidebar `PERSONEL` iken sadece "Panel",
   "Siparişler", "Kargolar" öğelerini render eder - `personelAllowedPaths`
   ile aynı liste, `sidebar.tsx`'e `role` prop'u eklenir).
2. **Her korumalı sayfa (ürünler, kategoriler, markalar, kampanyalar,
   müşteriler, ayarlar, personel, raporlar)**: sayfa başında
   ```ts
   const session = await getServerSession(authOptions);
   if (session?.user?.role !== "ADMIN") redirect("/admin");
   ```
   Bu tekrar eden bloğu azaltmak için `src/lib/require-admin.ts` yardımcı
   fonksiyonu yazılır: `await requireAdmin()` → session yoksa `/admin/login`'e,
   rol `ADMIN` değilse `/admin`'e yönlendirir, varsa session'ı döner. Var
   olan tüm admin-only sayfalara (ürünler, kategoriler, markalar,
   kampanyalar, müşteriler, ayarlar) bu satır eklenir - bu, mevcut sayfaların
   tek satırlık, düşük riskli bir değişikliği, davranışlarını bozmaz (zaten
   sadece `ADMIN` rolü var olan tek kullanıcı).

### Test
- `PERSONEL` rolüyle giriş yapıp `/admin/urunler` (veya başka korumalı bir
  yol) direkt URL ile denendiğinde `/admin`'e yönlendirildiği; sidebar'da
  o öğelerin hiç görünmediği.
- `ADMIN` rolüyle her şeye erişimin değişmediği (regresyon).
- Yeni personel oluşturma → o hesapla giriş → sadece izinli sayfaları görme.
- Personel pasifleştirilince o hesapla giriş denemesinin reddedilmesi.
- Bir adminin kendi hesabını pasifleştirme/rol düşürme denemesinin
  reddedilmesi.

---

## B.5) Gelişmiş Raporlama Sayfası

### Şema
Kâr marjı hesaplanabilmesi için ürünlerin maliyeti hiç tutulmuyor -
`Product`'a opsiyonel `costCents Int?` eklenir (varyant bazlı maliyet farkı
şimdilik kapsam dışı - v1 basit tutuluyor, `ProductVariant.priceCents` gibi
opsiyonel bir varyant-override eklenmiyor). Admin ürün düzenleme formuna
("Fiyat" alanının yanına) opsiyonel "Maliyet (TL)" input'u eklenir - boş
bırakılan ürünlerde raporda kâr marjı "-" gösterilir, hesaplamayı bozmaz.

### Sayfa: `/admin/raporlar`
`requireAdmin()` ile korunur (sadece `ADMIN`). Üstte admin dashboard'daki
(`admin/page.tsx`) tarih aralığı deseniyle tutarlı bir filtre: "Son 7/30/90
gün" `<select>` (URL query param `gun`, server component `searchParams`'tan
okur - `kargolar-filters.tsx` deseniyle aynı).

1. **En çok satan ürün/varyant**: `prisma.orderItem.groupBy({ by:
   ["productId"], where: { order: { status: { in: REVENUE_STATUSES },
   createdAt: { gte: baslangic } } }, _sum: { quantity: true, totalCents:
   true }, orderBy: { _sum: { quantity: "desc" } }, take: 10 })` — ürün
   adlarını almak için ikinci bir `product.findMany` join'i (Prisma
   groupBy relation include desteklemiyor). Tablo: ürün adı, satılan adet,
   ciro. `REVENUE_STATUSES` sabiti `admin/page.tsx`'ten `src/lib/orders.ts`
   gibi paylaşılan bir yere taşınır (şu an dashboard dosyasında local sabit
   - iki yerde aynı listeyi elle senkron tutmak riskli, tek yerden
   paylaşılması Faz A'daki kargo eşiği tekilleştirmesiyle aynı prensip).
2. **Kâr marjı**: aynı gruplama, `Product.costCents` join edilip
   `(totalCents - costCents * quantity) / totalCents` ile ürün bazlı marj
   yüzdesi - `costCents` null olan ürünlerde "-" gösterilir, toplam marj
   hesaplamasına dahil edilmez (kısmi veriyle yanlış toplam göstermemek
   için toplam satırın altında "N üründe maliyet girilmemiş" notu).
3. **Kategori/marka kırılımı**: `orderItem.groupBy` `productId` sonrası
   `product.category`/`product.brand` ile client tarafında (ürün sayısı
   küçük bir mağaza için elde toplanabilir boyutta) veya `raw SQL` yerine
   iki aşamalı agregasyon (önce productId bazlı grupla, sonra JS'te
   `categoryId`/`brandId`'ye göre topla) - şemadaki `Category`/`Brand`
   ilişkisi `Product` üzerinden dolaylı olduğu için Prisma tek sorguda
   gruplayamıyor, bu iki aşamalı yaklaşım mevcut kod tabanındaki
   (`variant-attributes.ts` gibi) "veritabanında karmaşık gruplama yerine
   uygulamada işleme" tercihiyle tutarlı.
4. **Görselleştirme**: mevcut `orders-chart.tsx` (`recharts`) deseninde yeni
   `top-products-chart.tsx` (yatay bar chart) - aynı renk/tooltip stilini
   kullanır, yeni bir bağımlılık gerekmez (recharts zaten `package.json`'da).

### Test
Gerçek Neon DB'ye karşı bilinen ürün/miktarlarla birkaç sipariş oluşturulup
raporun doğru toplamları/sıralamayı verdiği doğrulanır; `costCents` girilmiş
ve girilmemiş ürün karışık bir sette marj hesaplamasının doğru
davrandığı (girilmemiş olan "-" ve toplam nottan düşülüyor) ayrıca test
edilir.

---

## B.1) İade / Değişim (RMA) Süreci

### Mimari not — müşteri hesabı yok
Bollmark'ta müşteri girişi/hesabı yok (sipariş sipariş numarası + e-posta ile
takip ediliyor, `Customer` modeli Faz C'de). Bu yüzden iade talebi de aynı
doğrulamayla açılacak: müşteri sipariş numarası + e-posta girer, sistem
`Order`'ı bulup doğrular (ikisi de eşleşmezse "bulunamadı" - bilgi sızdırmaz).

### Şema
```prisma
model ReturnRequest {
  id             String    @id @default(cuid())
  orderId        String
  order          Order     @relation(fields: [orderId], references: [id])
  type           String    // "IADE" | "DEGISIM"
  reason         String
  itemsJson      String    // [{orderItemId, quantity}] - AbandonedCart.linesJson ile ayni "anlik goruntu" deseni
  status         String    @default("TALEP_EDILDI")
  customerNote   String?
  adminNote      String?
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
}
```
`Order` modeline `returnRequests ReturnRequest[]` ilişkisi eklenir.
Durumlar `src/lib/status.ts`'e eklenir (mevcut `orderStatuses`/`shipmentStatuses`
deseniyle aynı):
```ts
export const returnStatuses = ["TALEP_EDILDI", "ONAYLANDI", "REDDEDILDI", "KARGODA", "TAMAMLANDI"] as const;
```

### Müşteri tarafı
Yeni sayfa `/siparis-durumu` (mağaza layout'u altında, `(site)` route
grubu) — sipariş no + e-posta formu, eşleşirse siparişin özetini
(`urunler`, durum, kargo takip kodu varsa) ve varsa geçmiş iade
taleplerini gösterir, "İade/Değişim Talebi Oluştur" formu: talep tipi,
hangi ürün(ler) (checkbox, `OrderItem` listesinden), sebep (`<select>`:
"Beden uymadı", "Ürün hasarlı geldi", "Farklı ürün istiyorum", "Diğer"),
opsiyonel not. `POST /api/iade-talebi` → `{ orderNumber, email, ... }`,
sunucu tarafında sipariş+e-posta eşleşmesi tekrar doğrulanır (client'tan
gelen `orderId`'ye güvenilmez - kupon/fiyat hesaplamasındaki "istemciden
gelen değere güvenme" prensibiyle aynı). Sadece `DELIVERED` durumundaki
siparişler için iade açılabilir (kural: teslim edilmemiş bir sipariş için
iade anlamsız - `PENDING_PAYMENT`/`PAID`/`PREPARING`/`SHIPPED` durumunda
"İptal" zaten var, ayrı akış). Aynı sipariş+ürün için açık (durumu
`TAMAMLANDI`/`REDDEDILDI` olmayan) bir talep varsa tekrar açılmaz.

### Admin panel
Yeni sayfa `/admin/iadeler` — `/admin/kargolar` ile aynı desen (liste +
durum filtresi + satır güncelleme). `components/admin/return-row.tsx`:
sipariş no, müşteri, tip, sebep, durum (`<select>`, durum değiştikçe
`notifyCustomerStatusChange` benzeri bir `notifyReturnStatusChange`
fonksiyonu B.4'teki `order-notifications.ts`'e eklenir - "İade talebiniz
onaylandı/reddedildi/tamamlandı" maili müşteriye gider), admin notu.
`ONAYLANDI` durumuna geçince opsiyonel: ilgili `OrderItem`lerin miktarı
kadar stok geri eklenir mi (v1'de **hayır** - stok iadesi elle, ürün fiziksel
olarak kontrol edilmeden otomatik stok arttırmak riskli; admin isterse ürün
sayfasından elle stok günceller, bu not planda açıkça belirtiliyor ki
"otomatik stok iadesi unutuldu" sanılmasın).
Sidebar'a yeni öğe: `{ href: "/admin/iadeler", label: "İadeler", icon:
RotateCcw }` (Siparişler ile Kargolar arasına). `PERSONEL` rolü bu sayfaya
erişemez (B.2'deki `personelAllowedPaths` listesine dahil değil - iade
kararı personelin değil, yönetimin yetkisi olarak tasarlandı; kullanıcı
isterse bu sınırı sonradan değiştirebiliriz).

### Test
- Teslim edilmemiş bir sipariş için iade talebi denemesinin reddedilmesi.
- Yanlış e-posta ile sipariş no eşleşmesinin "bulunamadı" dönmesi (bilgi
  sızdırmaması - "sipariş var ama e-posta yanlış" gibi bir ayrım
  yapılmamalı).
- Admin panelinde durum değiştirince müşteriye doğru mailin gitmesi.
- Aynı ürün için açık talep varken ikinci bir talep açma denemesinin
  engellenmesi.

---

## B.3) Kargo Firması API Entegrasyonu — kısmen bilgi bekliyor

### Şimdi yapılabilecek: soyutlama katmanı + admin arayüzü
`Shipment` modeline `labelUrl String?` eklenir (etiket PDF'i varsa Vercel
Blob'a yüklenip linki burada tutulur - `src/lib/blob.ts` zaten var, aynı
yükleme deseni). Yeni dizin `src/lib/carriers/`:
```ts
// src/lib/carriers/types.ts
export interface CarrierAdapter {
  name: string; // "Yurtici", "Aras", "MNG" ...
  createShipment(input: { order: Order; }): Promise<{ trackingCode: string; labelUrl?: string }>;
  trackShipment(trackingCode: string): Promise<{ status: string }>;
}

// src/lib/carriers/manual.ts - gercek API baglanana kadar varsayilan
export const manualCarrier: CarrierAdapter = {
  name: "Elle Takip",
  async createShipment() { throw new Error("Bu firma icin API entegrasyonu yok - takip kodunu elle girin."); },
  async trackShipment() { throw new Error("Bu firma icin API entegrasyonu yok."); }
};
```
Kargo kartındaki (sipariş detay + `/admin/kargolar`) mevcut "Kargo Firması"
serbest metin input'u bir `<select>` olur (sabit liste: Yurtiçi, Aras, MNG,
PTT, Sürat, Diğer), seçime göre `carriers/index.ts`'teki `getCarrierAdapter(name)`
ilgili adaptörü (varsa) veya `manualCarrier`'ı döner. Gerçek API'si
tanımlanmamış firmalarda davranış **bugünkünden farksız kalır** (elle
takip kodu girme) - yani bu kısım şimdiden, kargo firması bilgisi
gelmeden de commit'lenip push'lanabilir, hiçbir mevcut akışı bozmaz.

### Bilgi gelince yapılacak
Kullanıcı hangi kargo firmasını/firmalarını kullandığını ve o firmanın API
erişimini (çoğu Türk kargo firması entegratör/bayi API'si kullanır - firma
adı + API kullanıcı adı/şifresi veya entegratör kodu) paylaştığında:
1. `src/lib/carriers/<firma>.ts` — o firmanın gerçek REST/SOAP çağrısını
   yapan adaptör (`CarrierAdapter` arayüzünü uygular).
2. Sipariş detay sayfasındaki Kargo kartına "Kargo Oluştur / Etiket Al"
   butonu eklenir - tıklanınca seçili adaptörün `createShipment`'ı çağrılır,
   dönen `trackingCode`/`labelUrl` `Shipment`'a otomatik yazılır, durum
   `KARGOYA_VERILDI` olur (B.4'teki müşteri bildirimini de tetikler).
3. Env değişkenleri: `<FIRMA>_API_USER`, `<FIRMA>_API_PASS` vb. (firmaya
   özel, paylaşılan bilgiye göre netleşir).
4. Opsiyonel: `GET /api/cron/kargo-durum-senkron` - Vercel Hobby plan
   kısıtı (günde 1 cron, Faz A deploy düzeltmesinde netleşti) yüzünden bu
   da günde bir kez tüm aktif kargoların `trackShipment` ile durumunu
   çekip senkronlar; birden fazla cron job'a ihtiyaç varsa (sepet
   hatırlatma + kargo senkron) Hobby planda **tek** cron job daha
   eklenebilir mi kontrol edilmeli (Vercel Hobby'de proje başına cron
   job sayısı da sınırlı olabilir - uygulama öncesi Vercel'in güncel
   limitleri kontrol edilmeli).

**Kullanıcıya soru:** Hangi kargo firmasını/firmalarını kullanıyorsunuz ve
o firmanın API/entegratör erişim bilgileri var mı? Bu bilgi gelmeden
Claude Code B.3'ün sadece "şimdi yapılabilecek" kısmını uygulayabilir.

---

## Yeni bağımlılıklar ve ortam değişkenleri (özet)

Yeni npm paketi gerekmiyor (recharts, resend, bcryptjs zaten var). Kargo
firması adaptörü (B.3) gerçek API'ye bağlanınca o firmanın SDK'sı/HTTP
istemcisi gerekebilir, netleşince eklenir.

`.env.example`'a eklenecek satır:
```
# Yeni siparis bildirimi hangi adrese gitsin (bos ise MAIL_FROM kullanilir)
ADMIN_NOTIFY_EMAIL=""
```

## Şema değişikliklerinin tek migration'da toplanması

Yeni model (`ReturnRequest`), `AdminUser.isActive`, `Product.costCents`,
`Shipment.labelUrl` — hepsi opsiyonel/varsayılanlı, tek `prisma db push`
adımında birlikte uygulanır, mevcut veriye zarar vermez.

## Önerilen uygulama sırası

1. **0) Ortak altyapı** — `roles.ts`, `AdminUser.isActive`,
   `order-notifications.ts`. (Küçük, hepsinin temeli.)
2. **B.4) Otomatik e-posta bildirimleri** — en hızlı biten, 0.2'yi hemen
   kullanıma sokar.
3. **B.2) Personel hesapları + rol yetkilendirme** — erişim kontrolü
   sonraki maddelerden (özellikle B.1 iadeler) önce netleşmeli.
4. **B.5) Gelişmiş raporlama** — bağımsız, salt-okunur, düşük risk.
5. **B.1) İade/Değişim (RMA)** — en çok yeni yüzey alanı (yeni müşteri
   sayfası + admin sayfası + mail entegrasyonu), B.2 ve B.4'ün üzerine
   oturuyor.
6. **B.3) Kargo API** — "şimdi yapılabilecek" kısım bu sırada herhangi bir
   yere eklenebilir (bağımsız); gerçek firma entegrasyonu kullanıcıdan
   bilgi gelince ayrı bir oturumda tamamlanır.

Her madde kendi başına gerçek Neon DB'ye karşı test edilip commit'lenir,
Faz A'da izlenen yöntemle aynı (hepsini tek seferde yazıp sona test etmek
yerine).

## Test / doğrulama listesi (madde bazlı özet)

Yukarıda her maddenin kendi "Test" bölümü var; ek olarak tüm Faz B
tamamlandığında bir regresyon geçişi: `npx tsc --noEmit`, `npm run build`,
ve mevcut Faz A akışlarının (kupon, sepet hatırlatma, stok bildirimi) rol
kontrolü eklendikten sonra hâlâ `ADMIN` için sorunsuz çalıştığının
doğrulanması.

## Sonraki adım

Bu plan onaylandıktan sonra 0. adımdan başlanıp yukarıdaki sırayla Claude
Code ile uygulamaya geçilebilir. B.3'ün kargo firması bilgisi netleşene
kadar diğer beş madde (0 dahil) bağımsız ilerleyebilir.
