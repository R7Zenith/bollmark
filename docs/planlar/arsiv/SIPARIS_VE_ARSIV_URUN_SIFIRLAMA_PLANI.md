# Arşivdeki Ürünleri Silme + Siparişleri Sıfırlama — Analiz ve Plan

## Neden ürünler silinmiyor?

Arşiv sayfasında (`/admin/urunler/arsiv`) ürünleri seçip "Sil" dediğinde
`/api/admin/urunler/bulk` (`route.ts`) çağrılıyor ve orada gerçekten
kalıcı silme yapılıyor (`prisma.product.deleteMany`) — bu tarafta kod
değişikliği gerekmiyor. Ama şema şöyle:

- `Product → ProductImage / ProductVariant / ProductOptionImage / WishlistItem / ProductReview`
  ilişkilerinin hepsi `onDelete: Cascade` — bunlar sorun çıkarmaz.
- `Product → OrderItem` ilişkisinde **cascade yok** (`OrderItem.product`
  sade `@relation(fields: [productId], references: [id])`). Yani bir ürün
  herhangi bir siparişte (geçmişte de olsa, o sipariş "silinmiş" görünse
  bile — mevcut sipariş silme soft-delete, `OrderItem` satırı hâlâ duruyor)
  en az bir kez geçtiyse, veritabanı bu ürünü silmene izin vermiyor ve API
  409 ile "mevcut siparişlere bağlı olduğu için silinemedi" hatası
  döndürüyor.

Yani arşivdeki ürünleri tek tek/toplu silmeye çalıştığında aldığın hata bu.
Çözüm ürün silme kodunu değiştirmek değil — önce o ürünleri referans eden
sipariş kalemlerini ortadan kaldırmak (yani siparişleri gerçekten/kalıcı
olarak silmek).

## Siparişler için mevcut durum

`SIPARIS_SILME_VE_GECMISI_PLANI.md` ile bilerek **soft delete**
(`Order.deletedAt`) yapılmıştı ki yanlışlıkla silinen bir sipariş geri
getirilebilsin. Ama soft delete `OrderItem` satırlarını silmiyor, sadece
siparişi listelerden gizliyor — bu yüzden soft-delete tek başına ürün
silme sorununu çözmüyor.

Senin "siparişleri de sil, sıfırlayalım" isteğin ve arşivdeki ürünleri
serbestçe silebilmek istemen bir araya gelince, ihtiyaç şu: **siparişleri
(ve bağlı kayıtları) veritabanından kalıcı olarak temizleyen, tek seferlik
bir "sıfırlama" işlemi.** Bunu admin panelde kalıcı bir buton olarak değil
(yanlışlıkla tıklanıp geri dönüşsüz veri kaybına yol açmasın diye), Claude
Code ile bir kerelik çalıştırılan bir script olarak yapmayı öneriyorum —
repodaki `scripts/` klasöründe zaten böyle tek seferlik script'ler var
(örn. `test-siparis-olustur.ts`, `backup-before-variant-v2.ts`).

## Kalıcı silme sırasında dikkat edilmesi gerekenler (Claude Code için)

Sipariş modelinin etrafındaki ilişkiler:
- `OrderItem.order` → `onDelete: Cascade` (Order silinince otomatik silinir) ✅
- `Shipment.order` → `onDelete: Cascade` (Order silinince otomatik silinir) ✅
- `ReturnRequest.order` → **cascade YOK**. Order silinmeden önce o
  siparişlere ait `ReturnRequest` kayıtları elle silinmeli, yoksa Order
  silme de aynı 409/constraint hatasına takılır.
- `LoyaltyTransaction.orderId` → gerçek bir foreign key ilişkisi değil
  (düz `String?` alan), bu yüzden constraint hatası vermez ama Order
  silinince `orderId` alanı artık var olmayan bir kaydı işaret eder
  ("sahipsiz" kalır). Bu geçmiş puan hareketlerini bozmadığı için sorun
  değil, silmeye gerek yok.
- `Coupon.usedCount` sipariş silinince otomatik düşmüyor. İstersen script
  bunu da sıfırlayabilir (aşağıda opsiyonel adım olarak var) — istemezsen
  atlanabilir.

## Önerilen adımlar

1. **Güvenlik için önce yedek al.** Script, siparişleri silmeden önce
   `Order`, `OrderItem`, `Shipment`, `ReturnRequest` tablolarının tamamını
   JSON olarak `backups/` klasörüne yazsın (repoda zaten
   `backup-before-variant-v2.ts` ile aynı desen var). Bir şey ters
   giderse elle geri yüklenebilir.
2. **Tüm `ReturnRequest` kayıtlarını sil.**
3. **Tüm `Order` kayıtlarını sil** (bu otomatik olarak tüm `OrderItem` ve
   `Shipment` kayıtlarını da temizler).
4. Script `--confirm` gibi bir bayrak olmadan çalıştırılırsa sadece
   "kaç sipariş/iade talebi silinecek" diye özet gösterip **hiçbir şeyi
   silmeden çıksın** (dry-run varsayılan) — yanlışlıkla çalıştırılınca
   veri kaybı olmasın.
5. Script bitince konsola özet bassın: kaç sipariş, kaç sipariş kalemi,
   kaç kargo kaydı, kaç iade talebi silindi.
6. Script'i çalıştırdıktan sonra (siparişler temizlendiğine göre) artık
   **arşiv sayfasından ürünleri normal şekilde seçip "Sil" diyebilirsin**
   — o taraf zaten çalışıyor, ek bir adım gerekmiyor.
7. (Opsiyonel, istersen ayrıca söyle) `Coupon.usedCount` alanlarını da 0'a
   çekmek istersen script'e ayrı bir `--reset-coupons` bayrağı ekletebiliriz.

## Claude Code'a verilecek prompt

Aşağıdaki promptu olduğu gibi Claude Code'a yapıştırabilirsin:

---

Bollmark projesinde tek seferlik bir "siparişleri sıfırla" script'i
yazmanı istiyorum: `scripts/reset-siparisler.ts`.

Amaç: Tüm siparişleri (ve bağlı kayıtları) veritabanından kalıcı olarak
silmek, böylece arşivdeki ürünler artık siparişlere bağlı olmadığı için
admin panelden normal şekilde silinebilsin (şu an `Product → OrderItem`
ilişkisinde cascade olmadığı için, herhangi bir siparişte geçen bir ürünü
silmeye çalışınca `/api/admin/urunler/bulk` 409 hatası veriyor — bunun
kök nedeni bu).

Gereksinimler:

1. Script varsayılan olarak **dry-run** çalışsın: sadece kaç `Order`, kaç
   `OrderItem`, kaç `Shipment`, kaç `ReturnRequest` kaydı silineceğini
   sayıp konsola yazsın, hiçbir şeyi silmesin. Gerçekten silmek için
   script'in `--confirm` argümanıyla çalıştırılması gereksin
   (`npx tsx scripts/reset-siparisler.ts --confirm`).
2. `--confirm` verildiğinde, silmeden ÖNCE mevcut `Order` (ilişkili
   `items` ve `shipment` dahil) ve `ReturnRequest` tablolarının tamamını
   JSON olarak `backups/siparisler-YYYY-MM-DD-HHmmss.json` dosyasına
   yazsın (`backup-before-variant-v2.ts`'deki yedekleme deseniyle aynı
   yaklaşımı kullan, `backups/` klasörü yoksa oluştur).
3. Sonra şu sırayla kalıcı silme yapsın (transaction içinde):
   - Önce tüm `ReturnRequest` kayıtlarını sil (Order'a cascade
     bağlı değil, önce bunlar gitmeli).
   - Sonra tüm `Order` kayıtlarını sil — bu otomatik olarak cascade ile
     tüm `OrderItem` ve `Shipment` kayıtlarını da temizleyecek (şemada
     zaten `onDelete: Cascade` var, ekstra kod gerekmiyor).
   - `LoyaltyTransaction` kayıtlarına DOKUNMA (orderId gerçek bir foreign
     key değil, silinen siparişe ait geçmiş puan kayıtları veri
     bütünlüğünü bozmadan kalabilir).
4. İşlem bitince konsola özet bas: silinen sipariş/kalem/kargo/iade sayısı
   ve yedek dosyasının yolu.
5. Script'i çalıştırmadan önce bana ne yapacağını kısaca özetle, veritabanı
   bağlantısının doğru (prod/gerçek DB'ye mi bağlanıyor, `.env`'de hangi
   `DATABASE_URL` kullanılıyor) olduğunu teyit et — commit/push yapmadan
   önce onayımı iste.
6. Script'i local'de önce dry-run modda çalıştırıp bana sonucu göster,
   ben onay verince `--confirm` ile gerçek silmeyi sen çalıştır.
7. İşlem bittikten sonra ben admin panelde `/admin/urunler/arsiv`
   sayfasından arşivdeki ürünleri elle seçip sileceğim (o taraf zaten
   çalışıyor, kod değişikliği gerekmiyor) — bunu sen yapma, sadece
   siparişleri temizleyen script üzerinde çalış.

Migration gerekmiyor, sadece yeni bir script dosyası. Bitirince git
diff'i özetle, commit mesajı öner ama benim onayım olmadan push etme.

---

## Sıradaki adım

Bu prompt Claude Code'a verildikten ve script dry-run + gerçek çalıştırma
ile doğrulandıktan sonra: arşivdeki ürünleri panelden elle sil, sonucu
bana bildir, ben de proje takibindeki (`admin-panel-gelistirmeleri.md`)
ilgili notu güncelleyeyim.
