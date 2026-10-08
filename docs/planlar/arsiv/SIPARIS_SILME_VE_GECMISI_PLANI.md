# Sipariş Silme + Silinen Siparişler Geçmişi — Araştırma ve Claude Code Promptu

## İstek

Admin panelinde siparişleri silebilme özelliği + silinen siparişleri geçmişe
dönük gösteren ayrı bir ekrana giden buton.

## Kod incelemesi (mevcut durum)

- `prisma/schema.prisma` → `Order` modelinde silme/soft-delete ile ilgili
  hiçbir alan yok. `OrderItem.onDelete: Cascade` ve `Shipment.onDelete: Cascade`
  Order'a bağlı — yani **gerçek (hard) silme** yapılırsa sipariş kalemleri ve
  kargo kaydı da geri dönüşsüz silinir; `ReturnRequest` ve
  `LoyaltyTransaction` ise cascade tanımlı değil (silinince yetim kayıt
  kalır ya da FK hatası verir). Muhasebe/rapor bütünlüğü ve "geri getirme"
  isteğiniz için bu **hard delete'i uygunsuz** kılıyor.
- `src/app/(admin)/admin/siparisler/page.tsx` — liste sayfası, `buildOrdersWhere`
  (`src/lib/order-query.ts`) ile filtreleniyor, `OrdersTable`
  (`src/components/admin/orders-table.tsx`) toplu işlem (bulk action) zaten
  destekliyor (şu an: Ödendi/Hazırlanıyor işaretle, İptal Et).
- `src/app/api/admin/siparisler/bulk/route.ts` — `ids` + `action: "SET_STATUS"`
  alan tek bir toplu işlem endpoint'i. Yeni action'lar (`DELETE`, `RESTORE`)
  buraya eklenmeye uygun, örüntü zaten var.
- `src/lib/audit-log.ts` + `src/lib/audit-actions.ts` — kritik işlemler
  loglanıyor (`ORDER_STATUS_CHANGED` vb.). Silme/geri yükleme de aynı sisteme
  eklenmeli.
- Sidebar (`src/components/admin/sidebar.tsx`) "Satış & Lojistik" grubunda
  Siparişler/İadeler/Kargolar var — "Silinen Siparişler" için ayrı bir kalıcı
  menü maddesi yerine, tıpkı "Dışa Aktar" gibi **Siparişler sayfasının
  başlığına bir buton** eklemek istediğiniz şeyle birebir örtüşüyor.
- Siparişleri farklı yerlerden sorgulayan başka ekranlar da var (dashboard
  özet kartları, raporlar, müşteri sipariş geçmişi, misafir sipariş sorgulama,
  admin arama, CSV dışa aktarma). Silinen bir sipariş bunların hiçbirinde
  görünmemeli — aşağıdaki promptta bunu tarayıp düzeltmesi de isteniyor.

## Önerilen yaklaşım: soft delete (deletedAt)

Gerçek silme yerine `Order.deletedAt` (+ kimin sildiğini tutan
`deletedByEmail`) alanı eklenir:

- **Sil** → `deletedAt = şimdi`, `deletedByEmail = oturum e-postası`. Sipariş
  normal listeden kaybolur ama veri kaybı olmaz.
- **Silinen Siparişler** sayfası → `deletedAt` dolu olan kayıtları listeler,
  her satırda **Geri Yükle** butonu (`deletedAt = null`).
- Bu; kalemleri, kargo kaydını, iade taleplerini, sadakat puanı geçmişini,
  kupon kullanım sayacını hiç bozmadan hem "silme" hem "geçmişe dönük görme"
  isteğinizi karşılıyor ve geri alınabilir olduğu için hard delete'ten çok
  daha güvenli.

## Claude Code'a verilecek prompt

```
Bollmark admin panelinde siparişleri "silme" özelliği ekleyeceğiz. Gerçek
(hard) silme YAPMA — Order'a bağlı OrderItem/Shipment cascade silinir,
ReturnRequest/LoyaltyTransaction gibi ilişkili kayıtlar da bozulur ve geri
dönüşü olmaz. Bunun yerine soft delete uygula:

### 1. Şema

`prisma/schema.prisma` → `Order` modeline ekle:
- `deletedAt DateTime?`
- `deletedByEmail String?` (siparişi kim sildiyse admin/personel e-postası)
- `@@index([deletedAt])`

Migration oluştur (`npx prisma migrate dev` ya da projenin kullandığı akış
neyse onunla).

### 2. Silme + geri yükleme API'si

`src/app/api/admin/siparisler/bulk/route.ts`'e mevcut `SET_STATUS` action'ının
yanına iki yeni action ekle (aynı `ids: string[]` gövdesini kullanarak):

- `DELETE`: seçili siparişlerde `deletedAt = new Date()`,
  `deletedByEmail = session.user?.email ?? "bilinmiyor"` set et. Zaten silinmiş
  (deletedAt dolu) siparişleri sessizce atla. Her biri için
  `logAudit({ action: "ORDER_DELETED", targetType: "Order", targetId, detail: "Sipariş silindi" })`
  çağır (audit-log.ts'deki mevcut örüntüyle aynı).
- `RESTORE`: seçili siparişlerde `deletedAt = null`, `deletedByEmail = null`
  set et, `logAudit({ action: "ORDER_RESTORED", ... })` çağır.

`src/lib/audit-actions.ts`'teki `auditActions` dizisine `"ORDER_DELETED"` ve
`"ORDER_RESTORED"` ekle, `auditActionLabel`'a da karşılıklarını ekle (örn.
"Sipariş Silindi", "Sipariş Geri Yüklendi") — İşlem Geçmişi sayfası bunları
otomatik yakalayacak.

### 3. Normal sipariş sorgularından silinenleri hariç tut

`src/lib/order-query.ts` → `buildOrdersWhere` fonksiyonunun döndürdüğü where
objesine varsayılan olarak `deletedAt: null` ekle (silinen siparişler sayfası
kendi ayrı sorgusunu yazacağı için ayrıca dokunmasın, sadece normal liste/
rozet sorguları etkilensin).

Sonra projede `prisma.order.findMany`, `prisma.order.count`,
`prisma.order.groupBy`, `prisma.order.aggregate`, `prisma.order.findFirst`,
`prisma.order.findUnique` çağıran TÜM dosyaları grep ile bul (en azından şu
adaylara bak, başka yerler de olabilir):
- `src/app/(admin)/admin/page.tsx` (dashboard özet kartları)
- `src/lib/order-stats.ts` (siparişler sayfası özet kartları)
- `src/app/(admin)/admin/raporlar/page.tsx`
- `src/app/(admin)/admin/musteriler/page.tsx` ve varsa müşteri detay sayfası
- `src/app/(site)/hesap/siparislerim/page.tsx` (müşterinin kendi sipariş
  geçmişi — silinen sipariş müşteriye KESİNLİKLE görünmemeli)
- `src/app/(site)/siparis-durumu/page.tsx` (misafir sipariş sorgulama —
  silinen sipariş "bulunamadı" davranışına düşmeli)
- `src/app/api/admin/search/route.ts` (admin genel arama)
- `src/app/api/admin/siparisler/disa-aktar/route.ts` (CSV dışa aktarma)
- Sipariş detay sayfası `src/app/(admin)/admin/siparisler/[id]/page.tsx`
  (silinmiş bir siparişin detay linkine biri elle girerse ne olacağına karar
  ver — ya "bulunamadı" göster ya da salt-okunur + "Bu sipariş silindi, geri
  yükleyin" uyarısı göster; ikincisi daha kullanışlı olur, tercih senin)

Her birinde ilgili sorguya `deletedAt: null` (veya AND koşulu) ekle — sadece
gerçekten "aktif" siparişleri etkilemesi gereken yerlere; bir sipariş silinse
bile geçmiş sadakat puanı / kupon kullanım sayacı gibi muhasebesel kayıtlara
DOKUNMA, onlar zaten değişmiyor.

### 4. Silinen Siparişler sayfası

Yeni sayfa: `src/app/(admin)/admin/silinen-siparisler/page.tsx`. Mevcut
siparişler sayfasıyla aynı bileşenleri (`DataTable`, `EmptyState`, `Badge`)
kullanarak, `deletedAt: { not: null }` olan siparişleri listele:
- Kolonlar: Sipariş No, Müşteri, Tutar, Silinme Tarihi (`deletedAt`), Silen
  (`deletedByEmail`), ve satır başına "Geri Yükle" butonu.
- Basit arama (sipariş no / müşteri adı) yeterli, mevcut siparişler
  sayfasındaki tüm filtre/sekme/özet kart karmaşasına gerek yok.
- Toplu "Geri Yükle" bulk action'ı da olsun (mevcut `OrdersTable`'daki bulk
  action örüntüsünü, `/api/admin/siparisler/bulk` `RESTORE` action'ını
  çağıracak şekilde uyarla — ister yeni bir `DeletedOrdersTable` bileşeni yaz,
  ister mevcut `OrdersTable`'ı genişlet, hangisi daha az tekrar
  gerektiriyorsa onu tercih et).
- Boş durumda `EmptyState` ile "Silinmiş sipariş yok" göster.

`src/lib/roles.ts`'teki `personelAllowedPaths` listesine bak — bu sayfayı ADMIN
rolüyle mi sınırlayacağız yoksa PERSONEL de mi görebilecek, mevcut
`/admin/siparisler` iznine göre karar ver (muhtemelen aynı izinle gitmesi
tutarlı olur, ama silme hassas bir işlem olduğu için istersen SADECE ADMIN
görsün diye ayrı tut — bana sorman gerekmiyor, en mantıklısını seç ve
sonunda özetle).

### 5. Siparişler sayfasına buton + silme aksiyonu

`src/app/(admin)/admin/siparisler/page.tsx` başlığındaki buton grubuna
(şu an "Dışa Aktar" var), yanına bir "Silinen Siparişler" linki/butonu ekle
(`/admin/silinen-siparisler`e giden, aynı stil).

`src/components/admin/orders-table.tsx`'teki `bulkActions` fonksiyonuna
"Sil" adında `variant: "danger"` bir toplu işlem ekle — tıklanınca (varsa
projede kullanılan bir onay/confirm deseni, yoksa basit
`window.confirm("Seçili siparişleri silmek istediğinize emin misiniz?")`)
onay alıp `/api/admin/siparisler/bulk` `DELETE` action'ını çağırsın, başarılı
olursa toast göster ve `router.refresh()` yap (mevcut `handleStatusChange`
fonksiyonundaki örüntüyle aynı).

Sipariş detay sayfasına (`src/app/(admin)/admin/siparisler/[id]/page.tsx`)
da tekil "Sil" butonu ekle (aynı `DELETE` action'ını `ids: [order.id]` ile
çağırarak, başarılı olunca `/admin/siparisler`e yönlendir).

### 6. Bitirince

- `npx tsc --noEmit` ve varsa lint ile derleme hatası kalmadığını doğrula.
- Bana git diff özetini ve hangi dosyaların değiştiğini/eklendiğini listele,
  commit mesajı öner ama benim onayım olmadan push etme.
- Kısaca özetle: silinen siparişler sayfasına hangi rol(ler) erişebiliyor,
  silinmiş bir siparişin detay sayfasına girilince ne oluyor.
```
