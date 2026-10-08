# Oturum günlüğü: 2026 Eylül, 1-14

## Excel'den toplu ürün aktarımı + Koton görsel eşleştirme (2026-09-02/03, yeni oturum)

Plan `EXCEL_URUN_AKTARIM_PLANI.md` dosyasında çıkarıldı (dükkanın checklist
excel'inden admin panelden toplu ürün/varyant aktarımı + Koton.com'dan renk
bazlı otomatik görsel/açıklama bulma). Faz A'dan F'ye kadar tek oturumda,
aradan onay beklenmeden uygulandı (kullanıcı tercihi); sadece Faz F'nin
**gerçek veritabanına ilk yazma** anında durulup soruldu, onay alındı.

1. **`xlsx` (SheetJS) paketi eklendi** - hem `.xls` hem `.xlsx` okuyor.
   `npm audit` 5 yüksek önem dereceli uyarı veriyor (SheetJS'in npm registry
   paketindeki bilinen prototype-pollution/ReDoS sorunları) - bilinçli kabul
   edildi, aynı `.xls` desteğine sahip bakımlı bir alternatif yok.
2. **`lib/excel-import.ts`**: excel satırlarını tip güvenli okuyan parser
   (`parseExcelFile` - eksik/bozuk satır olursa satır no'suyla hata biriktirir,
   tüm dosyayı reddetmez; tekrarlayan barkod da satır hatası sayılır), ÜRÜN
   KODU'na göre gruplama (`groupExcelRows`), ve asıl upsert mantığı
   (`importProductGroups` - barkod bazlı: mevcut barkod varsa sadece
   stok/fiyat güncellenir, yoksa yeni Product+ProductVariant oluşturulur;
   Renk/Beden `resolveOptionValueIds` ile çözülür).
   - **Bulunan performans sorunu**: ilk gerçek DB denemesinde satır başına
     birkaç sorgu (Renk/Beden upsert x2, vs.) içeren tek bir
     `prisma.$transaction` içinde 49 satır işlenirken Neon'un pooled
     bağlantı gecikmesiyle **P2028 transaction timeout** (30sn'de bile
     yetmedi) alındı. **Düzeltme**: Renk/Beden değer id'leri + marka id'si +
     slug'lar transaction AÇILMADAN ÖNCE (düz `prisma` ile) çözülüp bir
     cache'e alındı; transaction içinde sadece asıl product/variant
     create/update sorguları kaldı. Yeniden denemede sorunsuz çalıştı.
3. **`lib/koton-images.ts`**: barkod ile `koton.com/autocomplete/` araması
   yapıp bulunan ürün sayfasını `?format=json` ile çekiyor, `base_code`
   excel'deki ÜRÜN KODU ile karşılaştırıp doğru ürünü bulduğundan emin
   oluyor, `variants` içindeki "Renk" grubundan **excel'de gerçekten olan**
   renklerin `productimage_set` görsellerini indirip `@vercel/blob`'a
   (`koton-import/` klasörü) yeniden yüklüyor, `urun_aciklama` alanını
   Product.description olarak kaydediyor. Sadece **bu importla YENİ
   oluşturulan** ürünler için çalışır (mevcut ürünün foto/açıklaması varsa
   dokunulmaz). Ürünler arası ~900ms bekleme ile hız sınırlı, sıralı
   çalışıyor; bir üründe hata/bulunamama diğerlerini durdurmuyor.
   - Sadece o ürün grubunun **ilk satırındaki barkod** deneniyor, bulunamazsa
     gruptaki diğer barkodlar denenmiyor (bilinçli v1 sınırı, plan da
     böyleydi - ürün koduyla değil barkodla aramanın Koton'da daha güvenilir
     olduğu belirtilmişti). İyileştirme fırsatı olarak not düşülüyor.
4. **API route'ları**: `/api/admin/urunler/excel-yukle` (POST, sadece
   parse+önizleme, DB'ye dokunmaz) ve `/api/admin/urunler/excel-aktar`
   (POST, asıl upsert + ardından yeni ürünler için sıralı Koton
   zenginleştirmesi) - `getServerSession` + `role === "ADMIN"` kontrolüyle.
5. **`/admin/urunler/excel-yukle` sayfası**: dosya yükle -> önizleme
   (ürün/varyant/stok özeti, kategori seçimi - tüm gruba tek seferde
   uygulanıyor, opsiyonel) -> "İçe Aktar" -> sonuç raporu (kaç ürün/varyant
   eklendi-güncellendi, hangi üründe Koton'da görsel bulunup bulunmadığı).
   Ürünler listesine "Excel'den Yükle" butonu eklendi.
6. **Faz F - gerçek Neon veritabanında uçtan uca test** (kullanıcı onayıyla):
   - İlk çalıştırma: örnek `KOTON11052026CHECKLIST.xls` (49 satır, 6 ürün
     kodu) -> 6 ürün + 49 varyant oluşturuldu; 6 üründen 4'ü Koton'da
     bulunup görsel+açıklama otomatik eklendi (toplam 37 görsel), 2'si
     bulunamayıp görselsiz DRAFT kaldı (beklenen yedek davranış).
   - Aynı dosya tekrar yüklendi (idempotency testi): 0 yeni kayıt, sadece
     6 üründe/49 varyantta stok/fiyat güncellendi, mevcut Koton açıklaması/
     görselleri **dokunulmadan** kaldı - plandaki "tekrar yüklenirse
     stok/fiyat güncellenir, foto/açıklama zaten varsa dokunulmaz" kuralı
     doğrulandı.
   - Commit'lendi, push edildi (`923f95c`) - Vercel otomatik deploy
     tetikledi.

### Ardından bulunan 2 hata (kullanıcı canlıda denedi, bu oturumda düzeltildi)

**Hata 1 - Türkçe karakterli ürünlere tıklayınca "sayfa yok" hatası**:
Bu projedeki Next.js sürümü, dinamik rota segmentlerini (`/urunler/[slug]`)
**otomatik decode etmiyor** - standart Next.js'in aksine. Tarayıcı
`düğmeli` gibi bir kelimeyi `%C3%BC%C4%9F...` şeklinde kodluyor, sunucu
bunu çözmeden `params.slug` olarak veritabanında arıyor, bulamayıp
`notFound()`'a düşüyordu. Sadece Türkçe karakter içeren slug'larda
görünüyordu (`bollmark-oversize-mont` gibi düz İngilizce slug'lı eski
üründe sorun yoktu - ilk testte gerçek Next dev sunucusunu (kullanıcının
zaten çalışan `npm run dev` süreci, port 3000) `curl`/`fetch` ile,
önizleme şifresi cookie'siyle (`PREVIEW_PASSWORD`) test edip
`console.log` ile `params.slug`'ın ham (`%XX` kodlu) geldiği doğrulandı.
**Düzeltme**: `src/app/(site)/urunler/[slug]/page.tsx`'te hem
`generateMetadata` hem `ProductPage` içinde `decodeURIComponent(rawSlug)`
uygulandı (try/catch ile, bozuk bir dizi gelirse ham değere düşer).
Commit + push (`6849777`).

**Hata 2 - Katalog/anasayfa/favoriler/ilgili-ürünlerde varsayılan foto**:
Sadece renk bazlı galerisi (`ProductOptionImage` - Koton'dan gelen) olan,
genel `Product.images`'ı boş olan ürünler; katalog (`/urunler`), anasayfa
öne çıkanlar, favorilerim ve ürün detayındaki "Benzer Ürünler" bölümlerinde
hep sabit unsplash placeholder fotoğrafı gösteriyordu (bu bölümler sadece
`Product.images`'a bakıyordu). **Düzeltme**: `lib/catalog.ts`'e ortak
`firstImageUrl()` yardımcı fonksiyonu eklendi (genel görsel yoksa renk
galerisinden ilk fotoğrafa düşer), `getPublishedProducts`/`getRelatedProducts`
sorgularına `optionImages` include edildi, 5 dosyadaki (`urunler/page.tsx`,
`(site)/page.tsx`, `urunler/[slug]/page.tsx`, `hesap/favorilerim/page.tsx`,
admin `urunler/page.tsx` liste thumbnail'i) ilgili yerler bu fonksiyona
geçirildi. Gerçek sitede (`/urunler`, `/`) `curl`/`fetch` ile Koton görsel
URL'lerinin artık HTML'de geçtiği doğrulandı. Commit + push (`b1464d0`).

**Not**: Her iki hata da az önce eklenen Excel/Koton özelliğinden kaynaklı
DEĞİL - siteye Türkçe karakterli slug'lı veya sadece renk-galerili (genel
görseli boş) ilk ürünler bu importla eklendiği için daha önce hiç tetiklenmemiş,
gizli kalmış genel site hatalarıydı. Yeni ürün eklenen her yerde tekrar
karşılaşılabilir.

## Varyant özellikleri (Beden/Renk) sıralama düzeltmesi (2026-09-07, yeni oturum)

Admin panelinde varyant özellikleri sayfasındaki (`ayarlar/varyant-ozellikleri`)
yukarı/aşağı ok düğmeleri bazı değerlerde hiçbir şey yapmıyor gibi görünüyordu,
ayrıca ürün sayfasındaki beden butonları küçükten büyüğe değil rastgele/ekleniş
sırasına göre geliyordu. Kök neden ve düzeltme üç parçalıydı:

1. **Admin ok düğmeleri neden çalışmıyordu**: `src/lib/variant-attributes.ts`
   içindeki `resolveOptionValueIds` - ürün oluşturma/düzenlemede serbest metin
   (ör. Beden kutusu) alanından yeni bir değer geldiğinde bunu
   `VariantAttributeValue.upsert()` ile veritabanına yazıyordu, ama `create`
   bloğunda `position` hiç set edilmiyordu (varsayılan `0`'da kalıyordu).
   Aynı `attributeId` altında birden çok değer `position: 0` ile girince,
   admin sayfasındaki yer değiştirme (swap) mantığı görsel olarak "hiçbir şey
   olmuyor" gibi görünüyordu. **Düzeltme**: admin sayfasındaki `createValue`
   server action'ıyla aynı desen uygulandı - yeni değer oluşturulmadan önce o
   `attributeId` için mevcut en yüksek `position` bulunup `+1` ile atanıyor.
2. **Ön yüzde bedenler neden sıralı gelmiyordu**: `src/components/product-viewer.tsx`
   içindeki `sizes`/`colors` listeleri `variants.map(v => v.size)` ile ham
   (variant ekleniş) sırasıyla oluşturuluyordu, `VariantAttributeValue.position`
   hiç kullanılmıyordu (sorgu zaten position'ı çekiyordu, sadece kullanılmıyordu).
   **Düzeltme**: `src/lib/variant-attributes.ts`'e `optionPosition()` yardımcı
   fonksiyonu eklendi, `urunler/[slug]/page.tsx` bunu `ProductViewer`'a
   `sizePosition`/`colorPosition` olarak geçiriyor, `product-viewer.tsx`'teki
   yeni `orderedOptionValues()` fonksiyonu benzersiz değerleri bu position'a
   göre (küçükten büyüğe) sıralıyor - hem Beden hem Renk için aynı mantık.
3. **Bozuk mevcut veri**: Veritabanında halihazırda birçok
   `VariantAttributeValue` satırı `position: 0` ile duruyordu. Yeni bir
   script yazıldı: `scripts/backfill-variant-value-positions.ts` - her
   `attributeId` için değerleri doğal sıraya koyuyor (sayısal bedenler
   küçükten büyüğe, harfli bedenler XXS→5XL bilinen bir sıra tablosuna göre
   - "3XL" gibi rakam+XL yazımları da XXXL ile eşleniyor -, geri kalanlar
   alfabetik/sona ekleniyor) ve her değere `1`'den başlayan sıralı yeni bir
   `position` atıyor. Script `npx tsx scripts/backfill-variant-value-positions.ts`
   ile canlı Neon veritabanına karşı çalıştırıldı: **2 özellik (Beden, Renk)
   tarandı, 31 değer güncellendi**. (Script `dotenv/config` import ediyor -
   `.env`'deki `DATABASE_URL`'i okuyabilmesi için gerekli, `prisma/seed.ts`'teki
   aynı desenle.)

**Test edildi**: `npm run build` hatasız tamamlandı (TypeScript temiz,
`.next` klasörü bu oturumda bozuk/yarım bir `routes.d.ts` içerdiği için önce
silinip yeniden build edildi). Backfill sonrası DB'den okunan `position`
değerleri doğrulandı (Beden: 34:1…48:8, XS:9…3XL:15 doğru sırada). Gerçek bir
ürünün (`Regular Fit Klasik Yaka Pamuklu Kısa Kollu Gömlek`) varyant verisiyle
test edilip `position` değerlerinin S<M<L<XL<XXL<3XL sırasına karşılık geldiği
doğrulandı - `product-viewer.tsx` artık beden butonlarını bu sırayla gösterecek.

## "Yeni Sipariş" rozeti (2026-09-08, yeni oturum)

Admin panelinde henüz görüntülenmemiş siparişleri ayırt etmek için yeşil
"YENİ SİPARİŞ" rozeti eklendi.

1. `Order` modeline `viewedAt DateTime?` (nullable) alanı eklendi
   (`prisma/schema.prisma`). **Önemli bulgu**: bu projede Prisma Migrate hiç
   kullanılmamış - `prisma/migrations` klasörü hiç yok, `package.json`'da
   sadece `db:push` scripti var. `npx prisma migrate dev` bu yüzden "drift
   detected" diyip **veritabanının tamamen sıfırlanmasını (`migrate reset`,
   tüm veri kaybı)** istedi - bu çalıştırılmadı, bunun yerine her zamanki
   `npx prisma db push` ile aynı (ek, nullable) kolon veri kaybı olmadan
   canlı Neon veritabanına uygulandı. Ardından `npx prisma generate` ile
   client yeniden üretildi (üretilmeden önce `viewedAt` alanı Prisma
   Client'ta tanınmıyordu, script hata verdi).
2. Sipariş detay sayfası (`siparisler/[id]/page.tsx`) açıldığında `viewedAt`
   null ise sayfa render edilmeden önce `new Date()` ile işaretleniyor
   (sadece null ise, tekrar tekrar yazmıyor).
3. Sipariş listesi sorgusu ve `OrderRow` tipi (`orders-table.tsx`)
   `viewedAt` alanını taşıyor; "Sipariş No" kolonunun yanında
   `viewedAt === null` olan satırlar için mevcut `Badge` (`tone="green"`)
   ile "YENİ SİPARİŞ" rozeti gösteriliyor. Aynı rozet dashboard'daki
   "Son Siparişler" kartında da (`admin/page.tsx`) gösteriliyor.
4. Tek seferlik `scripts/test-siparis-olustur.ts` yazılıp çalıştırıldı -
   `viewedAt: null` olan, gerçekçi verilerle (Ayşe Yılmaz, adres, telefon,
   1 sipariş kalemi, `PENDING_PAYMENT`) bir test siparişi (`BLM260908-1362`)
   canlı Neon veritabanına eklendi - rozetin görülebilmesi için kasıtlı
   olarak silinmedi.

**Test edildi**: `npm run build` hatasız tamamlandı (TypeScript temiz, 61
route başarıyla oluşturuldu, `/` ve `/urunler` hâlâ statik).

## Kodsuz otomatik kampanya + Değer alanı (%/TL) netleştirmesi (2026-09-09, geçmiş oturumda kodu yazılmış, bu oturumda loglandı)

Bu bölüm, `KAMPANYA_OTOMATIK_PLANI.md` planına göre önceki oturumda (commit
`ae1fb1a` + `f27efe6`) zaten kodlanmış ama bu dosyaya hiç işlenmemiş işi
belgeler.

1. **Veri modeli** (`prisma/schema.prisma`): `Coupon.code` zorunlu
   `String @unique`'ten nullable `String? @unique`'e çevrildi (Postgres
   nullable unique alanda birden fazla `NULL`'a izin verir, çakışma
   olmaz), `name String?` alanı eklendi. Kod girilen kampanyalarda `name`
   opsiyonel kalıyor; kodsuz (otomatik) kampanyalarda listede ve site
   tarafında gösterilecek görünen ad olarak zorunlu. Amaç: admin'in kod
   girmeden, sadece kategori/marka bazlı, sepete/ürüne otomatik uygulanan
   bir kampanya oluşturabilmesi (örn. "Ayakkabılarda %20 İndirim" - müşteri
   hiçbir şey yazmıyor).
2. **İndirim motoru** (`src/lib/coupons.ts`):
   - Ortak `checkCouponEligibility` (aktiflik/tarih/kullanım limiti/min.
     sepet tutarı) ve `computeCouponDiscount` (kategori/marka kısıtına
     uyan satırlar üzerinden indirim hesabı) yardımcıları çıkarılıp hem
     `validateCoupon` (tek kod) hem yeni `resolveBestDiscount` (tüm
     otomatik kampanyalar) tarafından paylaşılıyor - kod tekrarı önlendi.
   - `resolveBestDiscount(tx, enteredCode, lines)`: `code: null` olan tüm
     uygun otomatik kampanyaları çekip **satır bazlı** değerlendiriyor -
     her sepet satırına (ürüne) en yüksek indirimi veren TEK otomatik
     kampanya atanıyor (`bestPerLine` map'i), böylece aynı ürüne iki
     otomatik kampanya üst üste binmiyor. Satır bazlı sonuçlar toplanıp
     rozet/isim için en çok toplam indirim sağlayan kampanya seçiliyor.
     Girilen kod varsa `validateCoupon` ile onun toplamı hesaplanıp
     otomatik toplamla karşılaştırılıyor - **hangisi daha yüksekse o
     kazanıyor, eşitlikte kod kazanıyor** (müşteri bilerek kod girmiş).
     İkisi asla karışık uygulanmıyor, tek sonuç dönüyor
     (`{ couponId, discountCents, freeShipping, appliedName, codeMessage }`).
   - `getApplicableAutomaticDiscountForProduct` / `matchAutomaticDiscount`:
     ürün kartları için ayrı sorgu atmadan, aktif kodsuz `PERCENT`
     kampanyaları tek seferde çekip (`getActiveAutomaticPercentCampaigns`)
     bellekte ürünün kategori/marka'sıyla eşleştiriyor (yalnızca `PERCENT`
     - `FIXED`/`FREE_SHIPPING` ürün bazında rozet için uygun değil).
3. **Admin formu**:
   - `src/components/admin/coupon-identity-field.tsx` (yeni): "Kampanya
     Türü" için "Kupon Kodlu" / "Otomatik (kod gerekmez)" segmented
     control - Otomatik seçilince kod input'u `disabled` olup yerine
     `name` zorunlu hale geliyor, kategori/marka ikisi de boşsa "tüm
     sitede geçerli olur" uyarısı gösteriliyor.
   - `src/components/admin/coupon-value-field.tsx` (yeni): Tip
     (`PERCENT`/`FIXED`/`FREE_SHIPPING`) `<select>`'i `useState` ile
     izleniyor, Değer input'unun sağında canlı `%`/`₺` badge'i
     gösteriliyor; `FREE_SHIPPING` seçiliyken input `disabled` +
     `opacity-50`, placeholder `—`. Statik "(% veya TL)" etiketi
     kaldırılıp sade "Değer" yapıldı. `kampanyalar/page.tsx`'teki "Yeni
     Kupon" formu server component olduğu için bu iki alan ayrı client
     bileşenlere çıkarıldı; input `name` attribute'ları (`code`/`name`/
     `type`/`value`) değişmediği için server action'ın `FormData` okuması
     etkilenmedi. `coupon-row.tsx` (düzenleme formu) aynı mantığı zaten
     `"use client"` olduğu için doğrudan içeriyor.
4. **Entegrasyon noktaları**:
   - `src/app/(site)/api/kuponlar/dogrula/route.ts`: artık boş kod da
     kabul ediyor (`code: z.string()`, boş string geçerli) ve her zaman
     `resolveBestDiscount` çağırıyor - kod girilmese bile sepete uyan
     otomatik kampanya varsa sonuçta görünüyor.
   - `src/components/coupon-field.tsx`: `applyCode` yerine
     `checkDiscount(code, isExplicitApply)` - sepet her değiştiğinde
     (kod girilmemiş olsa bile) boş kodla sorgu atılıp otomatik kampanya
     yakalanıyor; kullanıcı ayrıca kod girip "Uygula" derse iki sonuç
     karşılaştırılıp otomatik kampanya kazanırsa "Zaten `<ad>` indirimi
     uygulanıyor, bu kod daha düşük bir indirim sağlıyor" mesajı
     gösteriliyor.
   - `src/app/(site)/api/orders/route.ts`: `validateCoupon` yerine
     `resolveBestDiscount(tx, data.couponCode ?? null, resolvedLines)`
     kullanılıyor (kod girilmiş olsun olmasın) - kazanan kampanyanın
     `usedCount`'u aynı `$transaction` içinde artırılıyor (yarış
     durumunda son kullanım hakkının iki müşteri tarafından eş zamanlı
     tüketilip limitin aşılmasını önlemek için, kupon sistemindeki
     mevcut pattern'le aynı).
   - `src/lib/audit-actions.ts`: `KAMPANYA_OTOMATIK_OLUSTURULDU` action'ı
     eklendi ("Otomatik Kampanya Oluşturuldu" etiketiyle), işlem geçmişi
     sayfası mevcut pattern sayesinde otomatik yakalıyor.
   - `src/components/product-card.tsx`, `src/app/(site)/page.tsx`,
     `src/app/(site)/urunler/page.tsx`, `src/app/(site)/urunler/[slug]/page.tsx`,
     `src/components/product-viewer.tsx`: ana sayfa/ürünler listesi/ürün
     detayındaki `ProductCard`'lara (ve ürün detay görüntüleyicisine)
     `getApplicableAutomaticDiscountForProduct`/`matchAutomaticDiscount`
     ile hesaplanan otomatik indirim yüzdesi bağlandı - ürün kategori/
     marka kısıtına giren aktif bir otomatik `PERCENT` kampanyası varsa
     rozet + indirimli fiyat gösteriliyor.

**Test edildi**: `npm run build` bu oturumda tekrar çalıştırılıp hatasız
tamamlandığı doğrulandı (TypeScript temiz).

## Admin paneli mobil görünüm düzeltmesi (2026-09-09, yeni oturum)

Kullanıcı admin panelinin telefonda ekrana oturmadığını (yatay taşma) ve
sidebar'ın ekranı kapladığını bildirdi. Kök neden analizi ve kapsam
`MOBIL_GORUNUM_PLANI.md` dosyasında çıkarıldı (bu commit ile repoya
eklendi): admin panelindeki hiçbir bileşen Tailwind responsive
breakpoint'i (`sm:`/`md:`/`lg:`) kullanmıyordu, panel tamamen tek bir
masaüstü genişliği varsayımıyla yazılmıştı. Plan 4 faza bölünüp sırayla
uygulandı, her faz ayrı commit'lendi:

1. **Faz 1 - İskelet (`7a7a711`)**: `layout.tsx` server component olduğu
   için mobil menü state'ini tutamıyordu; yeni bir client wrapper
   (`src/components/admin/admin-shell.tsx`) eklenip Sidebar + Topbar bunun
   içine alındı, `isMobileNavOpen` state'i burada tutulup ikisine prop
   olarak geçiriliyor. `sidebar.tsx` mobilde (`< md`, 768px altı) varsayılan
   ekran dışında (`fixed` + `-translate-x-full`), `md:` üzerinde eskisi gibi
   `static`/görünür; açıkken arkada `bg-black/40` backdrop var, tıklanınca
   veya route değişince (`usePathname`) otomatik kapanıyor. `topbar.tsx`'e
   sadece mobilde görünen (`md:hidden`) hamburger butonu eklendi; `main`
   içerik boşluğu `px-4 py-4 md:px-8 md:py-8` yapıldı.
2. **Faz 2 - Topbar (`c6a8501`)**: Arama kutusu mobilde `hidden md:block`,
   yerine tıklanınca tam genişlikte açılan bir arama overlay'i (aynı arama
   mantığı, farklı mobil görünüm) eklendi. Kullanıcı menüsü butonunun
   dokunma alanı min 40px'e çıkarıldı.
3. **Faz 3 - Tablolar (`1b4d35f`)**: `data-table.tsx`'teki `DataTableColumn`
   tipine `hideOnMobile?: boolean` eklendi, bu `true` olan kolonlar mobilde
   `hidden md:table-cell` ile gizleniyor ("Sütunlar" panelinden yine
   açılabiliyor). 8 tablo dosyasında (orders/products/customers/returns/
   shipments/reviews/audit-log/top-products) ikincil kolonlara (tarih,
   kargo durumu, e-posta, ürün kodu, takip kodu, puan, hedef, kâr marjı)
   bu bayrak verildi. Tablo wrapper'ına mobilde yatay kaydırılabilir
   olduğunu belli eden hafif bir kenar gölgesi eklendi.
4. **Faz 4 - Filtreler ve formlar (`4c4d494`)**: Siparişler filtre
   panelindeki sabit `w-72` açılır panel `w-[calc(100vw-2rem)] max-w-72
   md:w-72` ile ekran genişliğine sığacak hale getirildi (plandaki diğer 7
   filtre dosyası incelendiğinde kod tabanının daha önceki bir oturumda
   sadeleştirildiği, artık bu `absolute`/`w-72` panel kalıbını taşımadıkları
   görüldü - `FilterBar` zaten `flex-wrap` kullandığı için ek değişikliğe
   gerek kalmadı). `grid-cols-2`/`grid-cols-3` kullanan tüm form alanları
   (ürün yeni/düzenle, ayarlar, personel, kampanyalar, kupon ve bundle
   formları, excel import önizlemesi - 12 dosya) `grid-cols-1
   md:`/`sm:grid-cols-N` olacak şekilde mobilde tek kolona düşürüldü.
   `variant-editor.tsx`/`product-images-field.tsx`/`tags-field.tsx`
   incelendi, zaten esnek/tablo tabanlı oldukları için değişiklik
   gerekmedi.
5. **Ek düzeltme (`726da67`)**: Gerçek tarayıcı testinde (bkz. aşağı)
   siparişler sayfasındaki durum sekmeleri satırının (Tümü/Ödenmedi/Açık/
   Kapatıldı) 375px'te sarmadığı için body seviyesinde yatay taşmaya yol
   açtığı bulundu; `orders-tabs.tsx`'e `overflow-x-auto` +
   `flex-shrink-0` eklenerek mobilde yatay kaydırılabilir hale getirildi.

**Test edildi**: Her fazdan sonra `npx tsc --noEmit` ile tip kontrolü
yapıldı, Faz 4 sonunda ayrıca tam bir `npm run build` çalıştırılıp
hatasız tamamlandığı doğrulandı. Ardından proje kök `package.json`'ına
dokunmadan geçici bir scratchpad dizininde Playwright kurulup, yerel dev
sunucusu gerçek admin oturumuyla (`.env`'deki `ADMIN_EMAIL`/
`ADMIN_PASSWORD`) headless Chrome ile sürüldü: Panel, Siparişler,
Ürünler, Ürün Ekle, Kampanyalar, Personel, Ayarlar sayfaları 375px ve
768px genişliklerde kontrol edildi - 375px'te hiçbir sayfada body
seviyesinde yatay scrollbar yok (`document.documentElement.scrollWidth
<= clientWidth`), hamburger menü backdrop'lu açılıp kapanıyor, mobil
arama overlay'i ve filtre paneli ekrana sığıyor; 768px'te hamburger
görünmüyor ve sidebar her zaman açık - masaüstü görünüm değişmedi. Bu
testte bulunan siparişler sekme taşması yukarıdaki 5. maddeyle
düzeltildi ve tekrar doğrulandı. Değişiklikler push edildi.

## Ürünler sayfası buton küçültme (2026-09-09, aynı oturum)

Ürünler sayfasındaki (`/admin/urunler`) "Excel'den Yükle" ve "Yeni Ürün"
(boş durumda "İlk Ürününü Ekle") butonları mobilde orantısız büyük
görünüyordu.

- `src/components/admin/button.tsx`'teki `ButtonSize` tipine yeni bir
  responsive seçenek eklendi: `"sm-md"` - mobilde `sm` boyutunda
  (`px-3 py-1.5 text-xs gap-1.5`), `md:` breakpoint'inde `md` boyutuna
  büyüyor (`md:px-4 md:py-2 md:text-sm md:gap-2`). Mevcut `sm`/`md`
  davranışı değişmedi; sadece bileşenin taban `className`'indeki sabit
  `gap-2` kaldırılıp `sm`/`md` class'larına taşındı (yeni `sm-md`
  seçeneğiyle çakışmaması için, görsel sonuç aynı kaldı).
- `src/app/(admin)/admin/urunler/page.tsx`'teki hem üst header'daki hem
  boş durumdaki iki `Button` çiftine `size="sm-md"` verildi, buton
  satırının container `gap-3`'ü `gap-2 md:gap-3` yapıldı. Başka hiçbir
  buton değiştirilmedi.
- `npx tsc --noEmit` ve `npm run build` hatasız tamamlandı. Playwright
  ile (geçici scratchpad kurulumu) 375px ve 800px genişliklerde
  `/admin/urunler` kontrol edildi: 375px'te body seviyesinde yatay
  taşma yok (`scrollWidth === clientWidth`), butonlar küçük ve orantılı;
  800px'te (`md:` breakpoint aktif) butonlar eski normal boyutuna
  dönüyor.
- Değişiklikler commit'lenip push edildi.

## Kategori tekrarını kaldırma + kategori listesinde aç/kapa (2026-09-09, aynı oturum)

İki bağımsız değişiklik yapıldı: Kadın/Erkek kategori ağacındaki isim
tekrarlarının kaldırılması (veri) ve admin kategori listesine
aç/kapa (collapse) desteği eklenmesi (UI).

1. **Kadın/Erkek kategori birleştirme** (`scripts/merge-kadin-erkek-kategoriler.ts`,
   commit `50e0547`): Kadın ve Erkek üst kategorileri altında aynı isimli
   9 alt kategori çifti (Tişört, Gömlek, Pantolon, Kot Pantolon,
   Sweatshirt, Hırka, Ceket, Mont & Kaban, Eşofman) tek kategoride
   birleştirildi (daha çok ürünü olan/eşitse önce oluşturulan kanonik
   kabul edildi; ürün/kod eşlemesi/kupon kayıtları taşındı, diğeri
   silindi). Eşi olmayan 20 alt kategori üst seviyeye taşındı, slug'ları
   sadeleştirildi. Boş kalan Kadın/Erkek üst kategorileri silindi.
   Aksesuar grubuna dokunulmadı. Cinsiyet ayrımı artık `Product.gender`
   alanıyla yapılıyor, kategori sadece ürün tipini temsil ediyor.
   Kategori sayısı 54 -> 43.
2. **Önceden var olan tekrarlı üst kategoriler** (`scripts/merge-tekrarli-ust-kategoriler.ts`,
   commit `7cd6453`): DB'de (bu seed'den önce, 0 ürünlü) zaten var olan
   tekil Tişört/Elbise/Gömlek/Bluz üst kategorileri, madde 1'den çıkan
   aynı isimli kategorilerle çakışıyordu. Genel bir "üst seviyede aynı
   isimli çiftleri birleştir" betiği yazılıp çalıştırıldı, kategori
   sayısı 43 -> 39. **Bulunan hata**: ilk çalıştırmada kanonik
   kategorinin yeni slug'ı hesaplanmadan önce kendi eski slug'ı ile
   birleşecek kategorinin slug'ı "kullanılan slug" kümesinden
   çıkarılmamıştı - bu yüzden "Tişört" ve "Gömlek" gereksiz "-2" son eki
   almıştı (`tisort-2`, `gomlek-2`). Elle düzeltildi (doğru `tisort`/
   `gomlek` slug'larına geri alındı), her iki betikte de sıralama
   düzeltilip tekrar çalıştırılarak idempotent olduğu doğrulandı.
3. **Kategori listesinde aç/kapa** (`category-manager.tsx`,
   `category-row.tsx`, commit `133d532`): Alt kategorisi olan satırların
   başına chevron ikonu eklendi, tıklanınca o kategorinin altındaki tüm
   satırlar client-side gizlenip gösteriliyor (sunucuya istek atmadan).
   Aç/kapa durumu `localStorage`'da kategori id'sine göre saklanıyor,
   sayfa yenilendiğinde geri yükleniyor. Arama kutusuna yazıldığında
   collapse durumu geçici olarak yok sayılıyor, eşleşen satırların
   ebeveyn zinciri her zaman görünür kalıyor. Sürükle-bırak sıralama
   sadece görünen (expand edilmiş) satırlar arasında çalışmaya devam
   ediyor.

**Test edildi**: `npx tsc --noEmit` temiz. Geçici scratchpad dizininde
Playwright kurulup gerçek admin oturumuyla (`.env`'deki `ADMIN_EMAIL`/
`ADMIN_PASSWORD`) `/admin/kategoriler` sayfası sürüldü: birleştirme
sonrası liste tekrarsız (39 satır, her isim tek), Aksesuar'ın chevron'ına
tıklanınca 8 alt kategorisi gizleniyor/gösteriliyor, sayfa yenilendiğinde
kapalı durum korunuyor, arama sırasında (kapalı Aksesuar altındaki
"Çanta" aranınca) ebeveyn zinciri collapse'a rağmen görünüyor. Üç commit
de push edildi.

## Storefront header'a mega-menu eklendi (2026-09-09, aynı oturum)

Storefront üst menüsü sadece 3 sabit link'ten (Tüm Ürünler, kırık "Dış
Giyim", Hikayemiz) Koton/LC Waikiki tarzı bir mega-menu'ye çevrildi.

1. **Cinsiyet filtresi** (`src/lib/catalog.ts`): `getCatalogEntries` ve
   `getPublishedProducts`'a opsiyonel `genderLabel` parametresi eklendi
   (Prisma `where`'e `gender` koşulu). `src/app/(site)/urunler/page.tsx`
   `cinsiyet` query param'ını okuyup buna geçiriyor, başlık/metadata
   kategori+cinsiyet kombinasyonuna göre uyarlanıyor.
2. **Mega-menu verisi** (`src/lib/site-nav.ts`, yeni dosya):
   `getMegaMenuData()` (react.cache) - Kadın/Erkek için en az bir
   PUBLISHED+o cinsiyette ürünü olan aktif kategorileri, Aksesuar için
   `parentId`'si Aksesuar olan aktif alt kategorileri paralel (`Promise.all`)
   çekiyor. `src/app/(site)/layout.tsx` bunu çağırıp `SiteHeader`'a prop
   geçiyor.
3. **`src/components/site-header.tsx` yeniden yazıldı**: masaüstünde
   Kadın/Erkek/Aksesuar sekmeleri hover/click ile açılan mega-menu paneli
   gösteriyor (aktif kategori/cinsiyet linkte vurgulu), mobilde hamburger
   ikonuyla açılan, akordeonlu, body-scroll-kilitli tam ekran off-canvas
   menüye geçildi. Kırık "Dış Giyim" linki tamamen kaldırıldı.
4. **Bulunan ve düzeltilen 2 gerçek hata** (özellik testi sırasında,
   kod öncesinden beri vardı):
   - Next.js 16'da `page.tsx`'in `searchParams` prop'u artık bir
     `Promise` - `urunler/page.tsx`'in sayfa bileşeni bunu (sadece
     `generateMetadata` değil) await etmiyordu, bu da **önceden var olan
     `kategori` filtresini de** sessizce çalışmaz hale getiriyordu.
     Await edilecek şekilde düzeltildi.
   - Header'daki `backdrop-blur` (`backdrop-filter`) CSS'te `position:
     fixed` elemanlar için containing block oluşturuyor - mobil
     off-canvas menü bu yüzden tam ekran değil header yüksekliğiyle
     kırpılıyordu. `createPortal` ile `document.body`'ye taşınarak
     düzeltildi.
5. **Kullanıcı bulgusu - mega-menu paneli çok dar, yazı taşıyor + sekme
   isimleri (Kadın/Erkek/Aksesuar) küçük harf kalıyor**: panel `absolute
   ... w-full`, `w-full`'ü küçük sekme `<div>`'ine göre hesaplıyordu
   (containing block hatası) - panel header'ın doğrudan altına, header
   genişliğinde konumlandırılacak şekilde yeniden yapılandırıldı (açık
   sekme state'i `SiteHeader`'a taşındı, `onMouseLeave` header'a bağlandı).
   `<button>` elemanları tarayıcı varsayılanında `text-transform`'u miras
   almadığı için `uppercase` class'ı doğrudan butonlara eklendi.
6. **Veri düzeltmesi**: DB'de gender alanı dolu (4 Kadın + 4 Erkek)
   PUBLISHED 8 ürünün `categoryId`'si `null`'dı, bu yüzden mega-menu
   Kadın/Erkek panelleri boş geliyordu (kod doğruydu, veri eksikti).
   Ürün adlarına bakılarak (script ile, kullanıcı onayıyla) kategoriler
   atandı: 4 Gömlek ürünü -> Gömlek, Kadın Yelek -> Yelek, Kadın El
   Çantası -> Çanta (Aksesuar altı), 2 Kadın Pantolon -> Pantolon.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasız. Zaten
çalışan bir `npm run dev` sunucusu (port 3000, önizleme şifresi
`.env`'deki `PREVIEW_PASSWORD` ile `?preview=` cookie'si alınarak)
kullanıldı, scratchpad'e kurulan Playwright ile 1280px ve 375px'te
gerçek Neon veritabanına karşı doğrulandı: Kadın (`cinsiyet=Kadın` ->
4 ürün) ve Erkek (7 katalog girişi) filtreleri doğru çalışıyor, Aksesuar
paneli 8 kategoriyi tam genişlikte gösteriyor ve tıklanan kategori
`?kategori=...&cinsiyet=...`'e gidip aktif linki vurguluyor, eski "Dış
Giyim"/`outerwear` linki hiçbir yerde yok, mobilde hamburger + akordeon +
body-scroll-kilidi + kapatma çalışıyor, yatay taşma yok
(`scrollWidth <= clientWidth`), konsol/sayfa hatası yok. Commit
(`79e1d0c`) GitHub'a push edildi - Vercel git bağlantısı sayesinde
otomatik deploy tetiklendi.

**Kullanıcı geri bildirimi 1** (aynı oturum): mega-menu paneli çok dar,
yazı taşıyor + sekme isimleri küçük harf kalıyor. Yukarıdaki 5. maddede
anlatılan düzeltmelerle giderildi, önceki commit'e `amend` edildi
(`79e1d0c`).

**Kullanıcı geri bildirimi 2** (aynı oturum): Kadın/Erkek/Aksesuar üst
sekmeleri tıklanınca hiçbir yere gitmiyordu (sadece hover ile panel
açılıyordu). `site-header.tsx`'te sekmeler `<button>`'dan `Link`'e
çevrildi - hover hâlâ paneli açıyor, tıklama Kadın/Erkek için
`/urunler?cinsiyet=...`'e, Aksesuar için `/urunler?kategori=aksesuar`'a
yönlendiriyor. Bu sırada yeni bir hata bulundu: Aksesuar'ın kendisine
hiç ürün bağlı değil (hepsi Çanta/Ayakkabı gibi alt kategorilerde),
bu yüzden `/urunler?kategori=aksesuar` her zaman 0 sonuç dönüyordu -
tıpkı eski "Dış Giyim" linki gibi ölü bir link olacaktı. `catalog.ts`'teki
kategori filtresi genelleştirildi: artık slug'ı birebir eşleşen kategori
VEYA o kategoriyi `parent` olarak gösteren bir alt kategori eşleşiyor
(`OR: [{ slug }, { parent: { slug } }]`) - bu, gelecekte eklenecek başka
üst/alt kategori çiftleri için de genel olarak doğru davranış. Playwright
ile doğrulandı: Kadın/Erkek tıklaması doğru sayfaya gidip doğru ürün
sayısını gösteriyor, Aksesuar tıklaması artık 1 ürün (Çanta'ya atanan
ürün) gösteriyor, hover davranışı bozulmadı. `npx tsc --noEmit` ve
`npm run build` hatasız. Commit (`869a5d0`) GitHub'a push edildi.

**Kullanıcı geri bildirimi 3** (aynı oturum): mobil menüde Kadın/Erkek/
Aksesuar başlıklarına tıklanınca da bir yere gitmiyordu (sadece
akordeonu açıp kapatıyordu, üst sekmelerdeki gibi bir link değildi).
`MobileAccordionSection` yeniden düzenlendi: başlık metni artık ayrı bir
`Link` (tıklayınca Kadın/Erkek için `/urunler?cinsiyet=...`'e, Aksesuar
için `/urunler?kategori=aksesuar`'a gidiyor, bir önceki maddedeki
üst/alt kategori genellemesi sayesinde Aksesuar burada da 0 sonuç
dönmüyor), ok ikonu ise ayrı bir `<button>` olarak sadece alt kategori
listesini aç/kapa yapıyor. Playwright ile 375px'te doğrulandı: başlığa
tıklama doğru URL'e gidiyor, ok ikonuna tıklama akordeonu açıp alt
kategori linkleri (`?kategori=...&cinsiyet=...`) doğru çalışıyor, görsel
düzen bozulmadı (ekran görüntüsüyle kontrol edildi). `npx tsc --noEmit`
ve `npm run build` hatasız. Commit (`399f77f`) GitHub'a push edildi.

## Excel aktarimi - Koton gorsel arama takilmasi + urun bazinda "yeniden ara" (2026-09-09, ayni oturum)

Plan `EXCEL_KOTON_GORSEL_ARAMA_TAKILIYOR_PLANI.md` dosyasinda cikarildi ve
uygulandi. Kullanici, `KOTON11052026CHECKLIST.xls` (68 urun) ile Excel
aktariminin Faz 2'sinde (Koton gorsel arama) "3. Sonuc" ekranina hic
ulasmadigini, aktarimdan sonra takili kaldigini bildirdi.

1. **Kok neden**: `src/lib/koton-images.ts`'teki uc dis `fetch` cagrisinda
   (`fetchAutocompleteUrl`, `fetchKotonProductData`, `reuploadImageToBlob`)
   hic zaman asimi yoktu - koton.com yanit vermezse (engelleme, sezon
   bitmis urun, ag sorunu) her istek Vercel'in `gorsel-getir` route'undaki
   30sn'lik `maxDuration`'a kadar askida kalabiliyordu; 68 urunle bu
   toplamda onlarca dakikaya cikip "donmus" gibi gorunuyordu.
2. **Zaman asimi eklendi**: `koton-images.ts`'e `fetchWithTimeout` yardimci
   fonksiyonu (8sn, `AbortController`) eklendi, uc `fetch` cagrisi da buna
   cevrildi. `excel-import-wizard.tsx`'teki `/gorsel-getir` cagrisina da
   ayrica 12sn'lik istemci tarafli zaman asimi eklendi.
3. **Teshis icin loglama eklendi**: autocomplete HTTP hatasi ve
   `base_code` uyusmazligi durumlarinda `console.error` (Vercel fonksiyon
   loglarina duser, bir sonraki denemede gercek nedeni - engelleme mi,
   sezon bitmis urun mu - netlestirmek icin).
4. **"Gorselleri atla ve bitir" butonu** eklendi (Faz 2 ilerleme
   cubugunun altinda, sadece `progress.phase === "gorseller"` iken
   gorunur) - admin isterse gorsel aramayi yarida kesip direkt sonuc
   ekranina gecebiliyor (kalan urunler `found:false` ile isaretleniyor).
5. **Sonuc ekranina link eklendi**: Koton'da bulunamayan urun varsa,
   daha once eklenmis `/admin/urunler?fotograf=yok` filtresine giden bir
   link gosteriliyor.
6. **Urun bazinda "Fotograflari yeniden ara" butonu** (yeni ozellik):
   yeni route `src/app/api/admin/urunler/[id]/gorsel-yenile/route.ts`
   (POST, admin oturum kontrollu) urunun DB'deki kod/barkod/renk
   verilerinden bir `KotonEnrichmentTarget` kurup mevcut `enrichOne`'i tek
   urun icin cagiriyor - yeni bir arama mantigi yazilmadi, Excel
   aktarimindaki mekanizma yeniden kullanildi.
   `src/components/admin/products-table.tsx`'in "actions" kolonuna,
   fotografi olmayan satirlarda "Duzenle" linkinin yanina bu butonu
   ekleyen `RefreshCw`/`Loader2` ikonlu, satir bazli yukleme durumu
   (`Set<string>`) tutan bir buton eklendi.
   - **Karar**: `enrichOne`'a opsiyonel `overwriteDescription` parametresi
     eklendi (varsayilan `true`, Excel aktarimindaki mevcut davranis
     korundu). Urun bazli "yeniden ara" butonu bunu `false` geciriyor -
     bu buton muhtemelen zaten gozden gecirilmis, elle duzenlenmis bir
     urune karsi calistirilacagi icin Koton'dan gelen aciklamanin uzerine
     otomatik yazilmamasi daha guvenli bir varsayilan olarak secildi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz (yeni
route derleme ciktisinda gorunuyor). `npm run lint` bu ortamda
(Windows, ESLint 9 flat-config) projeden bagimsiz, onceden var olan bir
hata veriyor (`Invalid project directory provided` / `next lint`
komutunda; dogrudan `npx eslint` de "Converting circular structure to
JSON" hatasi veriyor - React eklentisi flat-config'te dairesel referans
olusturuyor) - bu oturumdaki degisikliklerle ilgisi yok, calistirilamadi.
**Gercek Koton davranisi (engelleme/sezon bitmis/baska) bir sonraki
canli Excel denemesinde Vercel loglarina bakilarak dogrulanmali** -
bu oturumda gercek bir Excel dosyasiyla canliya karsi test yapilmadi,
sadece kod incelemesi + tip/derleme kontrolu yapildi.

## Koton gorsel eslesmesi - renk etiketi buyuk/kucuk harf uyumsuzlugu (2026-09-10, yeni oturum)

Kullanici, Koton'da stogu bitmis urunlerin fotograflarinin cekilemedigini
bildirdi ve bir hipotez onerdi: `fetchAutocompleteUrl`'un stokta olmayan
urunleri hic dondurmedigi, bunun yerine `koton.com/list/` arama sonuclari
uc noktasinin denenmesi gerektigi. Bu hipotez `curl` ile canli Koton
API'sine karsi dogrudan test edilerek **yanlislandi**:

- Gercekten stogu 0 olan, coktan beri OOS kalmis urunler (orn. Koton
  kodu `6WKB40009TW`, `5WKB40048TW`) autocomplete uc noktasinda sorunsuz
  bulundu, urun sayfasi JSON'unda tum renk secenekleri (OOS olanlar dahil)
  ve gorselleri eksiksiz geliyordu - **autocomplete stok durumuna gore
  filtrelemiyor**.
- `koton.com/list/?search_text=...&format=json` uc noktasi gercekten
  var ve JSON donduruyor (hipotezin bu kismi dogru), ama bazi gercek
  kodlarda (orn. `6SAK40004UK`) autocomplete'in buldugunu bulamadi -
  yani **`/list/` autocomplete'ten daha az guvenilir**, ondan sonraki bir
  fallback olarak eklemek gercek bir sorunu cozmezdi.
- Bu yuzden PR'da onerilen `/list/` fallback'i **uygulanmadi** - mevcut
  kanitlar boyle bir fallback'in gercek bir vakayi kurtaracagini
  gostermedi ve gereksiz karmasiklik/ek istek yuku eklerdi.

**Gercek kok neden, canli DB'deki fotografsiz 2 gercek urun uzerinden
bulundu** (`optionImages: none`'a gore sorgulandi):

1. **`6SAK30097AA` (Kadın Çizgili Ahşap Saplı Tote Çanta) - dogrulanan
   gercek hata**: Koton'da urun autocomplete ile sorunsuz bulunuyor,
   sayfa JSON'unda renk etiketi `"LACİVERT ÇİZGİLİ"` (tamamen buyuk
   harf) olarak geliyor. Ama bizim DB'de (Excel'den gelen) renk etiketi
   `"Lacivert Çizgili"` (Title Case) olarak kayitli. `findKotonProductData`
   -> `colorImageUrls` Map'i tam string eslesmesi bekliyordu, bu yuzden
   `enrichOne` sessizce `found: true, imagesAdded: 0` donduruyordu (kullanici
   acisindan "bulunamadi" ile ayni sonuc: fotograf eklenmiyor).
   - **Duzeltme** (`src/lib/koton-images.ts`): yeni `normalizeColorLabel()`
     yardimcisi eklendi - `label.trim().toLocaleUpperCase("tr-TR")` (Turkce
     "i"/"İ" karakterlerinin dogru buyutulmesi icin `tr-TR` locale'i
     kullaniliyor). Hem `fetchKotonProductData`'nin Map'e yazarken hem
     `enrichOne`'in Map'ten okurken kullandigi anahtar bu fonksiyondan
     geciriliyor. Ayrica `imagesAdded === 0` oldugunda (sayfa bulundu ama
     hicbir renk eslesmedi) beklenen/gelen renk listelerini karsilastiran
     bir `console.error` teshis logu eklendi.
   - **Canli DB'ye karsi gercek dogrulama yapildi**: `enrichOne` bu urun
     icin dogrudan calistirildi (gecici bir script ile, commit'lenmedi),
     duzeltmeden once `imagesAdded: 0` verirken duzeltmeden sonra
     **`imagesAdded: 3`** donup Vercel Blob'a gercekten 3 gorsel yuklendigi
     ve `ProductOptionImage` kayitlarinin olustugu dogrulandi. Bu urun artik
     canli DB'de fotografli.
2. **`6SAK40062PW` (Viskon Kumaş Bağlama Detaylı Cepli Pileli Geniş Paça
   Palazzo Pantolon, renk "BEJ") - baslangicta "cozulemedi" denildi,
   kullanicinin verdigi dogrudan link ile ikinci bir gercek hata daha
   bulunup duzeltildi**: Bu kod autocomplete'te, `/list/`'te ve Google'da
   hicbir sonuc vermiyor (urun Koton'un arama indeksinden tamamen
   dusmus), ANCAK kullanici urune koton.com uzerinde "stokta yok" olarak
   isaretli ama tiklaninca acilan bir sonuc karti uzerinden ulasip
   dogrudan URL'ini verdi (`https://www.koton.com/viskon-kumas-baglama-detayli-cepli-pileli-genis-paca-palazzo-pantolon-ekru-4096215/`).
   Bu URL'i `?format=json` ile dogrudan cekince **ikinci, bagimsiz bir kok
   neden** ortaya cikti: `data.product.base_code` beklenen kodla dogru
   eslesiyor (`in_stock: false, stock: 0`), AMA `data.variants` dizisi
   **tamamen bos** donuyor - Koton, bir urunun renk secici (Renk varyant
   grubu) olusturmasi icin en az 2 farkli renk secenegi olmasini bekliyor
   gibi gorunuyor; bu urunun tek rengi (Bej/Ekru) oldugu ve/veya tum
   stogu tukendigi icin `variants: []` donuyor. `fetchKotonProductData`
   gorselleri SADECE `data.variants` icindeki Renk grubundan okuyordu,
   bu yuzden `colorImageUrls` Map'i bos kaliyor, `enrichOne` yine sessizce
   `imagesAdded: 0` donduruyordu - oysa gercek gorseller `data.product.
   productimage_set`'te (renkten bagimsiz, urune dogrudan bagli) 7 adet
   olarak duruyordu.
   - **Duzeltme** (`src/lib/koton-images.ts`): `KotonProductData`'ya yeni
     bir `fallbackImageUrls: string[]` alani eklendi (`data.product.
     productimage_set`'ten dolduruluyor). `enrichOne` icinde, Koton'dan
     hic renk grubu gelmediginde (`colorImageUrls.size === 0`) VE hedef
     urunun DB'de de tek rengi oldugunda (`targetColors.length === 1`) -
     birden fazla renk beklenirken yanlislikla tek renge ait gorselleri
     hepsine uygulamamak icin bilincli olarak bu kosula baglandi - bu
     yedek kullanilip o tek renge tum gorseller ekleniyor.
   - **Canli DB'ye karsi gercek dogrulama yapildi**: `fetchKotonProductData`
     gecici olarak export edilip (test sonrasi geri alindi) yukaridaki
     gercek URL ile bu urun icin calistirildi: `colorImageUrls size: 0`,
     `fallbackImageUrls: 7` dogru tespit edildi, 6 gorsel (MAX_IMAGES_
     PER_COLOR siniri) gercekten Vercel Blob'a yuklenip `ProductOptionImage`
     kayitlari olusturuldu. Bu urun de artik canli DB'de fotografli.
   - **Bilinen sinir**: bu duzeltme sadece "sayfaya zaten ulasilabiliyor
     ama gorseller variants disinda" durumunu cozer. Koton'un arama
     indeksinden tamamen dusmus urunler (bu urun gibi) otomatik/toplu
     Excel akisinda hala **bulunamaz** - cunku onlara giden URL'i hicbir
     arama uc noktasi vermiyor, sadece kullanicinin elle bulup verdigi
     dogrudan linkle erisilebiliyor. Bunun icin asagidaki "Gorsel
     linkiyle ekle" butonu eklendi.

## "Görsel linkiyle ekle" butonu (2026-09-10, aynı oturum)

Yukarıdaki bilinen sınırı çözmek için: Koton'un arama indeksinden tamamen
düşmüş ürünlerde otomatik arama (ne "yeniden ara" ne de yeni eklenen
`/list/` benzeri hiçbir uç nokta) sonuç vermiyor, ama admin koton.com'da
ürünü elle bulup görselin URL'ini (sağ tık -> "Görsel adresini kopyala")
alabiliyor. Kullanıcı bunu bir Koton **sayfa** linki değil, doğrudan
**görsel** linki olarak eklemek istedi (sayfa parse etmeye gerek yok,
daha basit ve genel amaçlı: Koton dışı bir görsel kaynağı için de işe
yarar).

1. **`src/lib/koton-images.ts`**: daha önce modül içi (private) olan
   `reuploadImageToBlob` fonksiyonu `export` edildi ve ikinci bir opsiyonel
   `folder` parametresi eklendi (varsayılan `"koton-import"`, manuel
   akış `"manuel-gorsel"` kullanıyor) - Koton içe aktarımıyla aynı
   "kendi Blob'umuza indirip yeniden yükle" mantığı tekrar kullanıldı,
   kod tekrarı yok.
2. **Yeni route** `src/app/api/admin/urunler/[id]/gorsel-ekle/route.ts`
   (POST, admin oturum kontrollü, `gorsel-yenile` route'uyla aynı desen):
   body'de `urls: string[]` alıyor (max 10, tekilleştiriliyor, `http(s)://`
   ile başlamayan URL varsa 400 döner), her birini `reuploadImageToBlob`
   ile indirip yükler, başarılı olanları ürünün **genel** `images`
   (renkten bağımsız `ProductImage` tablosu - `ProductOptionImage` değil,
   çünkü admin panelindeki "Fotoğraf Yok" göstergesi zaten
   `images[0] ?? optionImages[0]` sırasıyla kontrol ediyor ve genel
   `images` her ürün için renk sayısından bağımsız çalışıyor) listesine,
   mevcut `position`'lardan sonrasına ekliyor. Hiçbiri indirilemezse
   `added: 0` ile hata toast'ı gösterilecek şekilde dönüyor.
3. **`src/components/admin/products-table.tsx`**: "Fotoğrafları yeniden
   ara" butonunun yanına (sadece fotoğrafı olmayan satırlarda görünür,
   aynı kural) yeni bir "Görsel linkiyle ekle" butonu eklendi. Tıklanınca
   `window.prompt` ile bir veya birden fazla (virgül/satır ile ayrılmış)
   URL isteniyor, yeni route'a POST ediliyor, sonucu Toast ile gösterip
   `router.refresh()` ile listeyi tazeliyor. Basit tutmak için ayrı bir
   modal bileşeni yazılmadı - projede zaten `window.confirm` kullanan
   `delete-product-form.tsx` ile aynı "hızlı ve düşük karmaşıklık" deseni
   izlendi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasız (yeni route
derleme çıktısında görünüyor). Uçtan uca, gerçek bir Koton görsel URL'i
ile (`reuploadImageToBlob` + `prisma.productImage.create`) canlı Neon
DB'sine karşı doğrulandı - indirme, Blob'a yeniden yükleme ve DB kaydı
oluşturma başarıyla çalıştı; test kaydı doğrulama sonrası temizlendi
(gerçek ürün verisine kalıcı bir değişiklik bırakılmadı). HTTP katmanı
(oturum kontrolü, `window.prompt` akışı) tarayıcıda elle test edilmedi -
kod aynı, zaten çalışan `gorsel-yenile` route'uyla birebir aynı oturum/
yetki deseninden kopyalandı.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz (ayrica
bu oturumda, pull ile gelen `Order.deletedAt` sema degisikligi sonrasi
`npx prisma generate` calistirilmadigi icin once alakasiz ~40 tip hatasi
goruldu - `prisma generate` calistirilinca duzeldi, koddaki degisiklikle
ilgisi yoktu). Her iki gercek urun de (`6SAK30097AA` ve `6SAK40062PW`)
canli Neon DB'sinde artik fotografli - gecici test scriptleriyle uctan
uca dogrulanip scriptler commit'lenmeden silindi. Degisiklik commit'lendi
(`d15bfdb` + bu ikinci duzeltme icin ek bir commit), henuz push
edilmedi (kullanici onayi bekleniyor).

## Kullanici geri bildirimi - "Görsel linkiyle ekle" yanlis tasarlanmis + urun duzenleme sayfasinda gorsel silme SaveBar'i tetiklemiyor (2026-09-10, ayni oturum)

Bir onceki bolumde eklenen "Görsel linkiyle ekle" butonu push edildikten
sonra kullanici iki sorun bildirdi:

1. **Buton yanlis anlasilmis tasarlanmisti**: kullanici aslinda bir Koton
   **urun sayfasi** linki verip gorsellerin otomatik cekilmesini
   istiyordu ("ben ürünün linkini verecektim o kendisi görselleri
   otomatik ekleyecekti"), ama buton dogrudan **gorsel** URL'i istiyordu
   (bir onceki oturumda kullanicinin kendi ifadesiyle "görsel linki"
   tasarlanmisti - geriye donuk bakildiginda bu talebin yanlis
   yorumlandigi ortaya cikti).
   - **Duzeltme**: `src/lib/koton-images.ts` yeniden duzenlendi - `enrichOne`
     icindeki (arama sonrasi) renk eslestirme + gorsel indirme/yukleme
     mantigi ortak bir `applyKotonProductData()` yardimcisina cikarildi.
     Yeni `enrichFromUrl(target, productUrl, options)` eklendi - arama
     adimini (`findKotonProductData`) tamamen atlayip dogrudan verilen
     URL'i `fetchKotonProductData` ile okuyor, ayni renk eslestirme/
     yukleme mantigini kullaniyor.
   - `src/app/api/admin/urunler/[id]/gorsel-ekle/route.ts` yeniden
     yazildi: artik `{ url: string }` (tek bir Koton urun sayfasi linki)
     aliyor, `koton.com` domain kontrolu yapiyor, urunun renk
     varyantlarini (`gorsel-yenile` route'uyla ayni sekilde) DB'den
     cikarip `enrichFromUrl` cagiriyor. Eski "birden fazla ham gorsel
     URL'i" tasarimi (`urls: string[]`, `prisma.productImage.createMany`)
     tamamen kaldirildi.
   - `products-table.tsx`: buton etiketi "Koton linkiyle ekle" oldu,
     `window.prompt` metni artik urun sayfasi linki istiyor, sonuc
     mesajlari `gorsel-yenile` butonuyla ayni ("Sayfa bulundu ama..." /
     "Bu linkten ürün verisi alınamadı...").
   - **Dogrulama**: canli veriyi kirletmemek icin gecici, tek kullanimlik
     bir test urunu olusturulup (gercek "Lacivert Çizgili" renk degerine
     referans vererek) `enrichFromUrl` gercek bir Koton URL'iyle
     calistirildi - `found: true, imagesAdded: 3` dogru sonucu verdi,
     test urunu sonra silindi (cascade ile option image'lari da gitti).
2. **Urun duzenleme sayfasinda gorsel silme, "Kaydedilmemiş
   değişiklikler var" cubugunu tetiklemiyordu**: kullanici bir gorseli
   cop kutusu ikonuyla siliyor, gorsel ekrandan kayboluyor, ama
   `SaveBar` gorunmedigi icin "Kaydet"e basmadan sayfa yenilenirse
   silme islemi hic gerceklesmemis gibi geri geliyordu.
   - **Kok neden**: `SaveBar` (`src/components/admin/save-bar.tsx`)
     formun native `"input"`/`"change"` DOM olaylarini dinliyor. Metin
     kutusuna yazmak (SKU, fiyat, gorsel URL/alt input'lari) bu
     olaylari gercekten tetikliyor, ama "Görseli sil" / "Görsel Ekle" /
     "Yukarı-Aşağı taşı" gibi butonlar sadece React state'ini
     guncelliyor - React, kontrollu bir input'un `value`'sunu
     programatik olarak degistirdiginde native bir DOM olayi
     **tetiklemiyor**. Bu yuzden butonla yapilan HER degisiklik
     (varyant satiri silme/ekleme, renk gorseli silme/ekleme/siralama,
     genel urun gorseli silme/ekleme/siralama, toplu %indirim/stok
     islemleri) SaveBar tarafindan fark edilmiyordu - sadece bu
     oturumda rastlanti eseri bulunan "gorsel silme" degil, ayni
     kok nedene sahip daha genis bir sorun.
   - **Duzeltme**: yeni `src/components/admin/use-dirty-signal.ts` hook'u
     eklendi - `useDirtySignal(value)` bir ref donduruyor, bu ref bir
     gizli `<input>`'a baglaniyor; `value` degistiginde (ilk render haric)
     o input uzerinde `dispatchEvent(new Event("input", { bubbles: true }))`
     ile bubbling bir native olay tetikliyor, bu da `SaveBar`'in form
     dinleyicisine ulasiyor. Bu hook `product-images-field.tsx`'teki
     (genel urun gorselleri) ve `variant-editor.tsx`'teki **iki** gizli
     input'a (varyantlar JSON'u + renk gorselleri JSON'u) baglandi -
     boylece butonla yapilan TUM degisiklikler artik SaveBar'i
     tetikliyor.
   - **Dogrulama**: tarayicida elle/Playwright ile test edilemedi -
     yerel `.env`'deki `ADMIN_PASSWORD` hala eski placeholder
     (`guclu-bir-sifre-belirleyin`, bkz. 2026-08-28 notu), gercek admin
     sifresi bu makinede yok, bu yuzden admin oturumu acilamadi. Sadece
     `npx tsc --noEmit` ve `npm run build` ile dogrulandi (ikisi de
     hatasiz). Mekanizma (kontrollu input + programatik degisiklikte
     manuel event dispatch) standart, dusuk riskli bir React deseni -
     ama **kullanicinin bir sonraki oturumda gercek tarayicida
     dogrulamasi onerilir** (bir gorsel/varyant silip SaveBar'in
     gorunup gorunmedigine bakarak).

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz. Koton
linki degisikligi gercek (gecici) veriyle dogrulandi (yukarida). SaveBar
degisikligi sadece derleme seviyesinde dogrulandi, tarayici testi
yapilamadi (admin sifresi bu makinede yok).

## Yerel .env'deki gercek admin sifresi + DuckDuckGo web arama yedegi (2026-09-10, ayni oturum)

1. **Yerel `.env` guncellendi**: kullanici gercek admin sifresini verdi
   (deger burada gizli tutuluyor, `.env` dosyasindan okunabilir).
   `ADMIN_PASSWORD` bu degerle guncellendi. DB'ye
   karsi kontrol edilince bu sifrenin `admin@bollmark.com` (eski
   `.env`'deki placeholder-seeded hesap) ile degil, `ozilevent@gmail.com`
   ile eslestigi dogrulandi (`bcrypt.compare` ile) - bu yuzden
   `ADMIN_EMAIL` de `ozilevent@gmail.com` olarak guncellendi. Bu deger
   `.env`'de oldugu icin GitHub'a gitmiyor (`.gitignore`'da) - sadece bu
   makinede.
   - Bu sifre sayesinde yukaridaki SaveBar duzeltmesi artik gercekten
     **tarayicida** (Playwright, gecici scratchpad kurulumu) dogrulandi:
     bir urun duzenleme sayfasinda "Görseli sil" ikonuna tiklandi,
     SaveBar oncesi 0 -> sonrasi 1 olarak goruldu (dogru calisiyor).

2. **Kullanici geri bildirimi**: "Koton linkiyle ekle" butonu hala elle
   mudahale gerektiriyordu - kullanici, Claude'un konusma icinde Koton
   urun sayfasini WebSearch ile kolayca bulabildigini fark edip "bu
   linki kendisi arayip bulamaz mi, basit bir is" dedi. Google'in resmi
   arama API'si ucretli/kotali oldugu icin dogrudan kullanilmadi, onun
   yerine **DuckDuckGo'nun anahtar gerektirmeyen HTML arama uc noktasi**
   (`https://html.duckduckgo.com/html/?q=...`) kullanildi - `curl` ile
   `site:koton.com 6SAK40062PW` araninca **ilk sonuc** doğru urun
   sayfasiydi (dogrulandi).
   - **`src/lib/koton-images.ts`**: yeni `fetchWebSearchUrl(query)`
     fonksiyonu eklendi - DuckDuckGo HTML sonuclarini `cheerio` ile
     (proje zaten `description-html.ts`'te kullaniyor, yeni bagimlilik
     eklenmedi) parse edip `a.result__a` linklerinin `uddg` parametresini
     (DuckDuckGo'nun yonlendirme sarmalayicisi) cozup ilk `koton.com`
     sonucunu donduruyor.
   - `findKotonProductData` icine **ucuncu bir deneme** olarak eklendi:
     barkod ve urun kodu ile autocomplete ikisi de basarisiz olursa,
     `site:koton.com <urun kodu>` ile DuckDuckGo aranip bulunan URL
     `fetchKotonProductData` ile deneniyor. Bu, hem `enrichOne` (Excel
     ice aktarimi + "Fotoğrafları yeniden ara" butonu) hem de yeni
     eklenen `enrichFromUrl` yolunu etkiliyor - yani **artik cogu
     durumda "Koton linkiyle ekle" butonuna hic gerek kalmiyor**, buton
     sadece DuckDuckGo'nun da bulamadigi nadir durumlar icin bir yedek
     olarak duruyor.
   - **Canli dogrulama**: gecici bir test urunuyle (`6SAK40062PW` -
     otomatik aramanin (autocomplete) hicbir sekilde bulamadigi, sadece
     manuel URL ile cozulebilen bilinen ornek) `enrichOne` **hicbir
     manuel URL verilmeden** calistirildi - `found: true, imagesAdded: 6,
     descriptionUpdated: true` sonucunu verdi, log'da "web araması ile
     bulundu" goruldu. Test urunu sonra silindi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz. Hem
DuckDuckGo yedegi (gecici test urunuyle, tamamen otomatik) hem SaveBar
duzeltmesi (gercek admin oturumuyla Playwright, tarayicida) canli/gercek
kosullarda dogrulandi.

## Kullanici geri bildirimi - DuckDuckGo yedegi canlida calismiyor (2026-09-10, ayni oturum)

Kullanici canlida `6SAK40062PW` icin "Fotoğrafları yeniden ara" butonunu
tekrar denedi (deploy'un kesin bittigi bir zamanda), yine "Koton'da
bulunamadı" hatasi aldi - oysa yukaridaki DuckDuckGo yedegi yerel
makinede ayni urunle dogru calismisti.

- Kullanicidan bir Vercel API token istendi (ilk paylasilan token
  gecersizdi - "User not found" - ikinci token calisti), `vercel logs`
  ile canli fonksiyon loglari kontrol edildi. Ilgili istek net gorundu:
  `POST .../gorsel-yenile` -> `Koton eşleşmesi (6SAK40062PW): bulunamadı`
  - hicbir ara hata (`autocomplete başarısız`, `DuckDuckGo araması
  başarısız oldu`) loglanmamisti, yani her iki istek de HTTP 200 donmus
  ama sonuc bulunamamisti.
- **Kok neden (yuksek guvenle)**: DuckDuckGo'nun HTML arama uc noktasi,
  Vercel'in sunucu (veri merkezi) IP'lerinden gelen istekleri otomatik/
  bot trafigi olarak tespit edip normal sonuc sayfasi yerine bos/
  engellenmis bir sayfa donduruyor gibi gorunuyor (hata firlatmiyor,
  sadece organik sonuc yok) - bu, bulut saglayicilarindan arama motoru
  scraping'inde çok yaygin bilinen bir sorun. Yerel gelistirme
  makinesinden (normal/ev IP'si) calisirken sorunsuz calismasi bunu
  gizlemisti.
- **Karar**: DuckDuckGo denemesi koddan **cikarilmadi** (zararsiz - basarisiz
  olursa sessizce bir sonraki adima/`bulunamadi` sonucuna dusuyor, bazi
  durumlarda/IP'lerde hala ise yarayabilir), ama artik guvenilir bir
  cozum olarak sunulmuyor. **`Koton linkiyle ekle` butonu (elle link
  yapistirma) bu tur "otomatik aramanin bulamadigi" urunler icin asil
  guvenilir yol olarak kaldi.**
- Vercel token'i sadece bu tanilama icin kullanildi, hicbir yere
  kaydedilmedi/commitlenmedi.

## DuckDuckGo -> Google Custom Search API'ye gecis (2026-09-10, ayni oturum, tamamlanmadi)

Kullanici "bunu Google'da aratip bulamaz mi" dedi - once resmi bir arama
API'sinin (anahtar/ucret gerektirdigi icin ilk basta tercih edilmemisti)
DuckDuckGo'nun Vercel'i engelleme sorununu cozecegi dusunuldu. Kullanici
kendi Google hesabinda **Google Custom Search API** kurulumunu yapti
(Programmable Search Engine + Cloud Console API key + Custom Search API
enable + billing baglandi - hepsi dogrulandi, adim adim ekran
goruntuleriyle kontrol edildi).

- **Kod tarafi tamamlandi**: `src/lib/koton-images.ts`'teki DuckDuckGo
  scraping fonksiyonu (`fetchWebSearchUrl`, `cheerio` bagimliligi dahil)
  tamamen **kaldirildi** - kanitlanmis sekilde Vercel'den calismadigi
  icin tutmanin bir degeri yoktu. Yerine `fetchGoogleCseUrl(query)`
  eklendi: `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` ortam degiskenlerini
  okuyup `googleapis.com/customsearch/v1` uzerinden sorgu atiyor, ilk
  `koton.com` sonucunu donduruyor. Bu iki degisken tanimsizsa adim
  sessizce atlaniyor (ozellik kapali kalir, hata vermez) - yerel `.env`
  ve `.env.example`'a eklendi. `npx tsc --noEmit` ve `npm run build`
  hatasiz.
- **Canli test edilemedi**: Google API'si kullanicinin hesabinda saatler
  gecmesine ragmen surekli `403 "This project does not have the access
  to Custom Search JSON API"` hatasi verdi - kontrol listesindeki HER
  adim dogrulandi (API Library'de "Enable" yapildi, key "Custom Search
  API"ye kisitlandi - ayni projede oldugu "Select API restrictions"
  dropdown'inin sadece o projede etkin API'leri listelemesiyle
  dogrulandi -, billing hesabi projeye bagli oldugu Billing sayfasindan
  dogrulandi, `cx` gecerli oldugu `cse.google.com/cse.js?cx=...`
  widget'inin 200 donup calismasiyla dogrulandi). Bu kontrollerin hepsi
  gecmesine ragmen API surekli reddetti - bu, Google Cloud'un Custom
  Search API'ye ozel, taze/yeni etkinlestirilen projelerde bazen saatler
  surebilen bilinen bir arka uc gecikme sorunu gibi gorunuyor (bizim
  kurulumumuzda bir hata bulunamadi).
- **Karar (ilk hali)**: Kullanici daha fazla vakit kaybetmek istemedi,
  Google tarafi su an icin birakildi. Kod commit'lenip push edildi (env
  degiskenleri tanimsiz oldugu icin Vercel'de bu adim sessizce devre
  disi - mevcut davranisi bozmuyor).

### Kesin neden bulundu: Google bu API'yi yeni musterilere kapatmis (artik denemeye gerek yok)

Kullanici, Google'in kendi destek forumunda ayni hatayi yasayan baska
birine verilen resmi cevabi buldu: **Custom Search JSON API artik yeni
musterilere kapali** ("closed to new customers", dokumantasyonda acikca
yaziyor). Mevcut/eski musterilerin 1 Ocak 2027'ye kadar alternatif bir
cozume (Google'in onerdigi **Vertex AI Search** - cok daha karmasik,
kurumsal, muhtemelen ucretli bir urun) gecmesi bekleniyor; yeni
hesaplar/organizasyonlar (bizimki gibi) bu API'ye **hicbir zaman**
erisemiyor.

- Bu, oncesinde varsayilan "propagation gecikmesi" teorisini **yanlisliyor** -
  sorun gecici degil, kalici bir kisitlama. Kontrol listesindeki (enable,
  billing, key kisitlamasi, cx) her adimin dogru olmasinin hicbir onemi
  yoktu - hesap turu yuzunden API zaten erisilemezdi.
- **Kesin karar**: Google Custom Search yolu **tamamen terk edildi**.
  Vertex AI Search'e gecmek bu kucuk ozellik icin orantisiz karmasik/
  maliyetli bulundu, denenmedi. Koddaki `fetchGoogleCseUrl` fonksiyonu
  (bkz. `src/lib/koton-images.ts`) env degiskenleri hic tanimlanmayacagi
  icin kalici olarak devre disi kalacak (zararsiz, silinmesi gerekmiyor -
  ama ileride bu urune tekrar bakilirsa bu notun okunmasi onerilir, aksi
  halde ayni cikmaza tekrar zaman harcanabilir).
  **`Koton linkiyle ekle` butonu (elle link yapistirma), otomatik aramanin
  bulamadigi urunler icin kalici/tek cozum olarak kaldi.**

## Gorsel sikistirma ve Blob kota temizligi (bu oturum)

Bkz. `GORSEL_SIKISTIRMA_VE_BLOB_LIMIT_PLANI.md`. Vercel Blob Hobby plan
kotasi (1GB depolama) hizla doluyordu; dort fazli plan uygulandi.

### Faz 1 - Yeni yuklemelerde sikistirma (tamamlandi)

`sharp` `package.json`'a dogrudan bagimlilik olarak eklendi (onceden
sadece Next.js'in transitive bagimliligiydi). Yeni `src/lib/image-compress.ts`
paylasimli `compressImage()` fonksiyonu: genislik max 1600px (orantili
kucultur, kucukse buyutmez), WebP'e cevirir, kalite ~78. Hem
`src/app/api/admin/upload/route.ts` (admin panel PC yuklemesi, 5MB/tip
kontrolunden SONRA uygulaniyor) hem `src/lib/koton-images.ts` ->
`reuploadImageToBlob()` (Excel aktariminda Koton'dan cekilen gorseller)
bu fonksiyonu kullanacak sekilde guncellendi. Fonksiyon seviyesinde test
edildi: `public/logo.png` (28.310 bytes) sikistirilinca 17.856 bytes
WebP cikti (canli admin panelden gercek buyuk bir foto yukleyip
karsilastirma yapilamadi - bu oturumda tarayici/UI erisimi yoktu, kod
incelemesi + fonksiyon testi + `tsc`/`build` ile dogrulandi).

### Faz 2 - Toplu silme bug'i (tamamlandi)

`src/app/api/admin/urunler/bulk/route.ts`'deki DELETE aksiyonu artik
`deleteMany`'den ONCE silinecek urunlerin `images`/`optionImages`
url'lerini okuyor, silme basarili olduktan sonra `deleteBlobUrls()` ile
Blob'dan da siliyor (tekli silmedeki `admin/urunler/[id]/page.tsx` ->
`deleteProduct` ile ayni desen). Canli admin panelden birkac test urunu
toplu silip Blob dashboard'unda dogrulama yapilamadi (UI/tarayici
erisimi yok) - kod incelemesi + `tsc`/`build` ile dogrulandi.

### Faz 3 - Yetim Blob temizligi (TAMAMLANDI)

`scripts/temizle-yetim-blob.ts` yazildi (varsayilan dry-run, `--execute`
ile gercek silme). Dry-run: 148 blob, 45 referansli, **103 yetim
(~275 MB)**. Kullanici onayladi, `--execute` calistirildi:

- **103 dosya silindi, 274.99 MB bosaldi.**

### Faz 4 - Mevcut gorselleri geriye donuk sikistirma (TAMAMLANDI)

`scripts/sikistir-mevcut-gorseller.ts` yazildi (varsayilan dry-run,
`--execute` + opsiyonel `--limit=N` ile gercek islem, 20'serli grup +
300ms bekleme, hata veren gorsel atlanip loglanir, script durmaz).
Dry-run: 45 referansli gorsel, ~116 MB, tahmini sikistirma sonrasi
~17.4 MB. Kullanici onayladi, tum 45 gorselle `--execute` calistirildi:

- **45/45 gorsel basariyla sikistirildi, 0 basarisiz.** Her gorsel
  indirilip sharp ile (max 1600px, WebP kalite ~78) islendi, yeni Blob
  path'ine yuklendi, ilgili DB satirindaki url alani guncellendi, eski
  (sikistirilmamis) dosya silindi.
- Dogrulama: script tekrar dry-run modunda calistirildi -> "islenecek
  gorsel: 0, zaten islenmis (.webp): 45" (hepsi artik WebP). Yetim Blob
  scripti de tekrar calistirildi -> "toplam blob: 45, referansli: 45,
  yetim: 0" (hicbir eski/yetim dosya kalmadi, DB url'leri dogru
  guncellenmis).

### Genel

`npx tsc --noEmit` ve `npm run build` her iki fazdan sonra da hatasiz
gecti. `.env`'de olmayip `.env.local`'de duran `BLOB_READ_WRITE_TOKEN`
yuzunden her iki yeni script de standart `import "dotenv/config"`e ek
olarak `.env.local`'i de aciyor (diger scriptlerden farkli, cunku onlar
Blob'a degil sadece DB'ye erisiyor).

**Toplam kazanc bu oturumda**: Blob deposundan ~275 MB yetim dosya
silindi, kalan ~116 MB'lik kullanilan gorseller ~17 MB civarina indi -
Hobby plandaki 1GB kotadan toplamda yaklasik 370+ MB yer acildi. Yeni
yuklemeler de (Faz 1) artik otomatik sikistiriliyor, kota bir daha bu
hizla dolmayacak.

## Urunler listesi - Aksiyonlar kolonu ikon butonlara cevrildi (bu oturum)

`URUNLER_LISTESI_AKSIYON_BUTONLARI_PLANI.md`'deki plan uygulandi:

- `src/components/admin/icon-button.tsx` (yeni): ortak `IconButton`
  (buton) ve `IconLinkButton` (link, `disabled` durumunda `<span>`'e
  duser) bilesenleri eklendi - `h-8 w-8`/`h-9 w-9`, `title`+`aria-label`
  zorunlu, `border-admin-border`, hover'da `admin-accent`.
- `src/components/admin/products-table.tsx`: "Aksiyonlar" kolonu artik
  5 ikon buton: **Duzenle** (`Pencil`), **Fiyat Guncelle** (`Tag`),
  **Fotograflari Yeniden Ara** (`RefreshCw`/`Loader2`, sadece
  `imageUrl` yoksa), **Koton Linkiyle Ekle** (`Link2`, sadece
  `imageUrl` yoksa), **Urunu Gor** (`ExternalLink`, yeni sekmede
  `/urunler/{slug}`, `status !== "PUBLISHED"` ise pasif +
  "Urun yayinda degil, sitede gorunmez" tooltip'i). Fiyat Guncelle
  popup/prompt KULLANMIYOR: "Fiyat" kolonunun kendi hucresi
  `editingPriceId` state'iyle inline `<input>`'a donusuyor, yaninda
  Check (kaydet) ve X (vazgec) ikon butonlari cikiyor, Enter/Escape
  destekleniyor, kaydederken `Loader2` spinner + input/butonlar
  disabled, hata varsa (`<=0` veya sayi degil) kirmizi border + "Gecerli
  bir fiyat girin" mesaji gosteriyor.
- `src/app/api/admin/urunler/bulk/route.ts`: `SET_PRICE` action'i
  eklendi (`priceCents` say 0'dan buyukse `updateMany`, degilse 400).
- `src/app/(admin)/admin/urunler/page.tsx` ve `arsiv/page.tsx`:
  `ProductRow`'a `slug` alani eklendi ("Urunu Gor" linki icin), her iki
  sayfadaki `rows` map'ine `slug: p.slug` eklendi.
- Mevcut gorsel arama/ekleme network mantigi (`handleGorselYenile`,
  `handleGorselEkle`) ve toast/`router.refresh()` davranisi degismedi,
  sadece gorunum ikon-butona cevrildi.
- Dogrulama: `npx tsc --noEmit`, `npm run lint`, `npm run build` ucu de
  hatasiz gecti. Canli admin panelden tarayici testi bu oturumda
  yapilamadi (UI/tarayici erisimi yok) - kod incelemesi + tip/lint/build
  kontrolleriyle dogrulandi.

## Vega SanalMagaza "panelapi" entegrasyonu (2026-09-10, yeni oturum) - YARIM KALDI

Detayli bulgular, denenen/basarisiz olan seyler, guncel mimari ve
**sıradaki somut adım** icin **`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`**
dosyasinin en ustundeki "GÜNCEL DURUM" bolumune bakin - bu oturuma
kaldigi yerden devam etmek icin ilk okunmasi gereken dosya budur.

Ozet: Vega ↔ Bollmark baglantisi (giris + kategori listesi cekme) HTTP
seviyesinde calisiyor (Cloudflare Worker koprusu `vega-bridge-worker/` +
`/api/vega/panelapi/...` route'u + yeni `VegaSession` tablosu - hepsi
deploy edildi, canli test edildi). Ama Vega'nin "Kategori Secimi"
penceresi hala bos kaliyor (cok sayida format denendi, hicbiri
calismadi) ve bu, urun yukleme akisini tamamen engelliyor.

## Vega - Ticimax taklidi SOAP entegrasyonu - CALISIYOR (2026-09-11)

Uctan uca calisan akis (canli dogrulandi): (1) Vega'nin "Urun Yonetimi /
TiciMax -> Listele" ekraninda 9 yayindaki Bollmark urunu, tum varyantlari
(barkod, stok kodu, adet, fiyat, kategori) ile listelendi. (2) Kullanici
barkod eslestirmesini yapti. (3) Vega'dan stok gonderildiginde **sitedeki
stoklar gercekten guncelleniyor** (`VaryasyonGuncelle` uc noktasi).

**Artik stok konusunda kaynak Vega'dir** - gonderdigi deger sitedeki stogun
uzerine yazilir (sadece barkodu eslestirilmis varyantlar icin).

Detayli bulgular ve siradaki adimlar icin
**`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`** dosyasinin EN USTUNDEKI
"CALISIYOR (2026-09-11)" bolumune bakin.

Ozet mimari: Vega -> Cloudflare Worker koprusu (`vega-bridge-worker/`) ->
`https://bollmark.com/Servis/UrunServis.svc` -> Neon. Vega'da Site Tipi =
TiciMax, Site Adi = `bollmark-vega-bridge.ozilevent.workers.dev`, Web Servis
Kodu = `/admin/ayarlar` sayfasindaki "Uye Kodu" degeri (deger burada
yazilmiyor, panelden okunabilir).

**Onemli**: Vega, Vercel'e (bollmark.com) DOGRUDAN baglanamiyor - eski SOAP
istemcisi ile TLS uyumsuzlugu suphesi; istek sessizce kayboluyor ve Vercel
loglarinda hic gorunmuyor. Cloudflare Worker koprusu bu yuzden zorunlu.

## Vega - Ticimax taklidi SOAP entegrasyonu (2026-09-10 gece) - ILK KURULUM

Vega destege ulasilamadigi icin (kullanici bildirdi) yon degistirildi:
Vega'nin "Site Tipi" ayarinda hazir bulunan **Ticimax** platformunun
GERCEK, dokumante (SOAP/WCF) protokolu taklit edilmeye baslandi - tahmine
dayali JSON yerine artik gercek bir semaya dayaniyor. Detaylar, canli
yakalanan gercek Vega SOAP istegi, ve siradaki somut adim icin
**`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`** dosyasinin EN USTUNDEKI
"GÜNCEL DURUM ... Ticimax taklidi yaklaşımı" bolumune bakin.

Bu oturumda kodlanan/deploy edilen (kisa ozet):
- `prisma/schema.prisma`: `Category.vegaId` (int, Ticimax'in beklediği
  tamsayi kategori ID'si icin) ve `VegaIntegration.ticimaxUyeKodu`
  (duz metin) eklendi, Neon'a `db push` ile uygulandi.
- Yeni route: `src/app/api/vega-tcmx/Servis/[service]/route.ts` -
  `UrunServis.svc`nin `SelectKategori` metodunu gercek Ticimax SOAP
  seklinde cevaplıyor (namespace tahmini, canli testte dogrulanacak).
- Admin panel (`/admin/ayarlar`): yeni "Ticimax Taklidi (SOAP)" karti,
  `ticimaxUyeKodu` alani.
- **Henuz yapilmadi**: kullanicinin panelden Uye Kodu girip Vega'da
  Site Tipi=Ticimax, Site Adi=`https://bollmark.com/api/vega-tcmx` ile
  canli "Kategori Secimi" testi + Vercel loglarindan sonucun okunmasi.

## Stoğu biten ürünleri kartlarda işaretleme (2026-09-11, yeni oturum)

Plan `STOGU_BITEN_URUNLER_ISARETLEME_PLANI.md` dosyasinda cikarilip
tamamen uygulandi: ana sayfa ("Öne Çıkanlar") ve `/urunler` listelemesinde
stoğu tamamen bitmiş ürün/renk kartlari artik soluk bir cam katmani +
"Stokta Yok" rozetiyle isaretleniyor, kart yine tiklanabilir kaliyor.

- `src/lib/catalog.ts`: `isOutOfStock(variants)` yardimci fonksiyonu
  eklendi (`variants.every(v => v.stock <= 0)`). `getPublishedProducts()`
  artik `variants: { select: { stock: true } }` de cekiyor (once hic
  cekmiyordu). `CatalogEntry` tipine `outOfStock: boolean` eklendi;
  `getCatalogEntries()` tek renkli/varyantsiz urunlerde tum varyantlara,
  cok renkli urunlerde SADECE o renge ait varyantlara bakarak hesapliyor
  (bir rengin stoğu bitince sadece o renk kartı soluklaşıyor).
- `src/components/product-card.tsx`: `ProductCardData.outOfStock?: boolean`
  eklendi; doluysa gorselin uzerine `backdrop-blur` + yari saydam beyaz
  katman ve "Stokta Yok" rozeti bindiriliyor (kalp butonundan once, link
  hala tiklanabilir - `pointer-events-none` kullanilmadi).
- `src/app/(site)/page.tsx` ve `src/app/(site)/urunler/page.tsx`:
  `ProductCard`'a `outOfStock` degeri geciliyor.
- **Dogrulama**: `npm run lint` ve `npx tsc --noEmit` calistirildi -
  degisen 4 dosyada hic yeni hata/uyari yok (mevcut lint hatalari
  `cart.tsx`/`wishlist.tsx`/`use-bundle-discount.ts` ve olusturulmus
  Prisma dosyalarinda, `tsc` hatalari ise `Servis/[service]/route.ts` +
  `admin/ayarlar/page.tsx`'te `vegaId`/`ticimaxUyeKodu` alanlari icin -
  hepsi bu degisiklikten once de vardi, once cekilen Vega-Ticimax
  calismasindan kalma, `npx prisma generate` calistirilmadigi icin olusan
  tip hatalari, bu isin kapsami disinda dokunulmadi).
- `npm run dev` ile canli Neon veritabanina karsi `curl` + `bm_preview`
  cookie'siyle test edildi: hem `/` hem `/urunler` 200 donuyor, ikisinde
  de DB'de zaten stoğu 0 olan bir urun/renk oldugu icin "Stokta Yok"
  rozeti gercek veriyle goruldu (yapay test verisi eklenmedi, mevcut veri
  yeterliydi). Kartin `<Link>` icinde kaldigi, rozetin gorselin uzerinde
  dogru konumda render edildigi HTML'den dogrulandi.
- Kapsam disi birakildi (plan boyle diyordu): urun detay sayfasi
  (`urunler/[slug]` + `product-viewer.tsx`) ve rozetin tasarim detaylari.

## Favicon duzeltmesi (bu oturum)

`FAVICON_DUZELTME_PLANI.md` planina gore uygulandi: sekmede favicon
gorunmuyordu cunku `public/`'ta ayri bir ikon dosyasi yoktu ve 3 kok
layout'ta (`(site)`, `(admin)`, `(gate)`) `metadata.icons` tanimli degildi.

- `public/logo.png` (bollmark yazi logosu) icinden ilk "b" harfi Node.js
  `sharp` ile piksel/alfa analiziyle kirpildi (bbox: x 0-158, y 48-272),
  etrafina ~%20 padding birakilarak kare canvas'a oturtuldu. 16x16 ve
  32x32 kucuk boyutlarda okunabilirligi goz kontroluyle dogrulandi.
- Uretilen dosyalar `public/` altina eklendi: `icon.png` (48x48, seffaf),
  `favicon.ico` (16/32/48 coklu boyut, PNG-embedded ICO container elle
  olusturuldu - `png-to-ico` gibi ek paket kurulmadi), `apple-icon.png`
  (180x180, beyaz arka plan - iOS seffafligi siyaha cevirdigi icin),
  `icon-512.png` (512x512, seffaf, PWA/manifest icin).
- `src/lib/site-metadata.ts` eklendi: `siteIcons` sabiti (`icon` +
  `apple` alanlarini tanimliyor), 3 layout'ta da import edilip
  `metadata.icons` alanina verildi (`(gate)/layout.tsx`'te daha once hic
  `metadata` export'u yoktu, o da eklendi).
- **Dogrulama**: `npx prisma generate` calistirildi (build'i bloke eden,
  bu isle ilgisiz onceden var olan `vegaId`/`ticimaxUyeKodu` tip hatalari
  bunun icin cozuldu), sonra `npm run build` hatasiz tamamlandi. Zaten
  calismakta olan `npm run dev` (port 3000) uzerinden `curl` ile `/`,
  `/hesap/giris` (gate) ve `/admin` (login'e yonleniyor, admin layout)
  sayfalarinin HTML `<head>`'inde `icon.png`/`favicon.ico`/`apple-icon.png`
  link etiketlerinin dogru geldigi dogrulandi.
- Commit atilmadi/push edilmedi, kullanicinin onayi bekleniyor.

## Release temasi header/mega-menu analizi - sadece analiz, kod degisikligi YOK (2026-09-12)

Kullanici istegiyle release-main.myshopify.com'un mega-menu ve mobil
menusu Playwright ile DOM/computed style seviyesinde incelendi, mevcut
`src/components/site-header.tsx` ile karsilastirildi. Bulgular
`RELEASE_TEMA_BIREBIR_UYUM_PLANI.md` dosyasinin "1. Header - mega menu
davranisi" bolumune islendi (onceki "mevcut yapi zaten yakin" notu
yanlisti, duzeltildi). Ozet: masaustu mega menude "Featured/Categories"
sabit grup basliklari + panelin net %50/%50 sol-sag (link/gorsel)
bolunmesi eksik; mobilde ise Bollmark'taki yerinde-acilan accordion
yerine Release'de gercek cok seviyeli "drill-down" (geri oku ile panel
degisimi) kullaniliyor - bu, henuz hic ele alinmamis ayri bir fark.
Bu oturumda **kod degisikligi yapilmadi**, sadece analiz ve plan
guncellemesi; uygulama bir sonraki promptta yapilacak.

## Header masaustu mega-menu Release olcumlerine gore yeniden yazildi (2026-09-12, ayni oturum devami)

Bir onceki "sadece analiz" adiminda cikan RELEASE_TEMA_BIREBIR_UYUM_PLANI.md
1.1/1.4 bulgulari, `src/components/site-header.tsx`'teki `GenderPanel` ve
`AksesuarPanel`'e uygulandi (SADECE masaustu, mobil `MobileMenu`'ye
dokunulmadi - ayri promptla gelecek):

- `chunkColumns` (sayiya gore N sutuna bolme) kaldirildi, yerine 2 sabit
  grup: "Öne Çıkanlar" (sadece "Tüm Ürünler" - katalogda gercek bir
  yeni/cok-satan sort parametresi olmadigi icin uydurma param eklenmedi,
  `urunler/page.tsx` + `catalog.ts` kontrol edildi) ve "Kategoriler".
- Grup basligi/alt link tipografisi Release'den olculen degerlere cekildi
  (14px/600/normal-case baslik, 14px/400/UPPERCASE/-0.56px tracking link),
  yeni `.nav-underline` hover sinifi `globals.css`'e eklendi.
- Panel ici `grid-cols-2` ile net %50/%50 sol-sag bolundu; sagda `imageUrl`'i
  olan kategorilerden en fazla 2 (Aksesuar'da 1) promosyon karti - hic
  gorsel yoksa sag yari hic render edilmiyor (sahte placeholder EKLENMEDI).
- `npx tsc --noEmit` ve `npm run build` hatasiz. Localde (`npm run dev`,
  onceden calisan bir surec zaten port 3000'de bulundu, yeniden
  baslatilmadi) Playwright ile 1280/1600px genisliklerde Kadin/Erkek/
  Aksesuar sekmelerine hover yapilip ekran goruntusu alindi - grup
  basliklari ("Öne Çıkanlar"/"Kategoriler") dogru gorunuyor. Mevcut Neon
  verisinde hicbir kategoride `imageUrl` dolu olmadigi icin sag yaridaki
  promosyon gorseli bu ortamda hic gorunmuyor - bu kodun degil, veri
  eksikliginin sonucu (kod dogru sekilde sag yariyi hic render etmiyor).
- **Commit atilmadi/push edilmedi - kullanicinin onayi bekleniyor.**

## Mobil menu gercek drill-down'a cevrildi (2026-09-12, ayni oturum devami)

Adim 1b: `src/components/site-header.tsx`'teki `MobileAccordionSection`
(yerinde acilan accordion) kaldirildi, RELEASE_TEMA_BIREBIR_UYUM_PLANI.md
1.2'de olculen gercek Release davranisina (cok seviyeli "drill-down", geri
oku ile bir onceki ekrana donme) gore yeniden yazildi:

- Tek seviyeli `openSection` state'i yerine bir panel yigini
  (`screenStack: MobileScreen[]`) - drill-in `push`, geri oku `pop`, menu
  kapaninca yigin `["root"]`'a sifirlaniyor.
- Yeni `MobileDrillScreen` bileseni: kategori listesi + varsa masaustundeki
  `PromoCard` ile ayni promosyon karti/kartlari (2 sutunlu grid).
- Cekmece artik `w-[85%] rounded-l-2xl` degil, Release'deki gibi tam ekran/
  kosesiz (`inset-0 w-full`).
- `npx tsc --noEmit` + `npm run build` hatasiz. Playwright ile 375px'de:
  hamburger -> tam ekran acilis, "Kadin"a dokununca (accordion DEGIL) yeni
  ekrana gecis, geri okuyla koke donus, kapanip tekrar acilinca koke
  sifirlanma, body `overflow:hidden` kilidi - hepsi DOGRULANDI.
- **Commit atildi, push edilmedi - kullanicinin onayi bekleniyor.**

## Menu genisligi duzeltmesi - max-width kaldirildi (2026-09-12, ayni oturum devami)

Kullanici "Release'in menusu saga sola genis yayilmis, bizimki iceri
sikistirilmis" dedi - hakliydi. Plan dosyasinin 1.1 bolumunde "panel tam
viewport genisliginde, 36px yan bosluk" diye olculmustu ama Adim 1a
uygulanirken eski `mx-auto max-w-7xl px-6` sarmalayicisi korunmustu, yani
1600px ekranda icerik 1280px'e sikisip her yanda ~184px bos alan kaliyordu.

Release yeniden olculdu (1280/1440/1600/1920 genisliklerinde): header ve
panel icin `max-width` HIC YOK, tek sinir sabit 36px yan dolgu; icerik her
genislikte tam ortadan %50/%50 bolunuyor, iki yari arasinda 0px bosluk var,
sol yaridaki iki sutun (yari-12)/2 genisliginde.

Uygulanan degisiklikler (`src/components/site-header.tsx`):
- Header satiri: `mx-auto grid max-w-7xl ... px-6` -> `grid w-full ... px-6
  xl:px-9` (masaustunde 36px, xl altinda mevcut 24px korundu).
- Panel ici: `mx-auto grid max-w-7xl gap-10 px-6 py-10` -> `grid grid-cols-2
  px-9 py-8` (iki yari arasi bosluk kaldirildi, dikey dolgu 40->32px).
- Sol yaridaki sutun arasi `gap-x-8` (32px) -> `gap-x-3` (12px, olculen deger).
- Promosyon gorseli olmasa bile sol yari %50'de sabit kaliyor (onceden tum
  genislige yayiliyordu; gorsel eklendiginde duzen kaymasin diye).

**Dogrulama**: Playwright ile Bollmark'in ve Release'in ayni koordinatlari
karsilastirildi. 1280px ve 1600px'te nav ilk ogesi, "Öne Çıkanlar"/"Featured"
ve "Kategoriler"/"Categories" x konumlari, sag yarinin baslangici, sag kenar
bitisi ve panel dolgusu - HEPSINDE fark 0.0px (tam eslesme). `npx tsc
--noEmit` ve `npm run build` hatasiz.

**Commit atildi, push edilmedi - kullanicinin onayi bekleniyor.**

## Vercel build hatasi: SiteHeader Suspense'e alindi (2026-09-13)

Kategori sayfasi banner'i, katalog toolbar butonlari, urun detay sag panel
(font boyutlari/ticker/buton duzeni/renk paleti) duzeltmeleri push edildikten
sonra kullanici "deploy olmadi" dedi, Vercel dashboard'dan build log'u
paylasti: `npm run build` adiminda `/hesap/adreslerim` statik sayfa
uretiminde `useSearchParams() should be wrapped in a suspense boundary`
hatasiyla **build tamamen duruyordu** (`Export encountered an error...
exiting the build`).

- **Kok neden**: `src/components/site-header.tsx`'teki `SiteHeader`
  (banner/saydam header kontrolu icin `useSearchParams()` kullaniyor,
  ayni oturumda eklendi) kok layout'ta (`src/app/(site)/layout.tsx`) bir
  `Suspense` siniri olmadan render ediliyordu. Next.js 16 statik sayfa
  uretiminde bu durumu build hatasina ceviriyor. Bu bilesen TUM `(site)`
  route grubu sayfalarinin paylastigi layout'ta oldugu icin sorun
  aslinda tek `/hesap/adreslerim`'e ozel degildi - build, hatayi ilk
  rastladigi sayfada (67 sayfadan 33.'sunde) durup cikiyordu, digerleri
  hic denenmemisti.
- **Duzeltme**: `(site)/layout.tsx`'te `<SiteHeader menuData={menuData} />`
  bir `<Suspense fallback={<div className="h-[72px]" />}>` ile sarildi.
- **Dogrulama**: yerel `.next` klasoru temizlenip `npm run build`
  calistirildi - 67/67 sayfa hatasiz uretildi, `/hesap/adreslerim` artik
  dogru sekilde `ƒ` (dinamik) olarak isaretleniyor.
- Commit atildi (`c72da90`), push edildi - Vercel git baglantisi
  sayesinde otomatik deploy tetiklendi.

## Urun detay sayfasi yazi boyutu kok nedeni: rem/px taban karisikligi (2026-09-12)

Kullanici release-main.myshopify.com/products/top-8 ile Bollmark'in urun
detay sayfasini yan yana karsilastirdi, yazilarin punto olarak tutmadigini
bildirdi. Tarayicida gercek `getComputedStyle` olcumuyle kok neden bulundu
(bkz. `FONT_BOYUTU_KOK_NEDEN_PLANI.md`): **Release'in kok (`html`)
font-size'i 10px, Bollmark'inki Tailwind varsayilani 16px.** Onceki
oturumlarda (Adim 3/6) Release'in CSS'inden okunan `rem` degerleri
(`2.1rem`, `1.4rem` vb.) doğru okunmustu ama Bollmark'a rem olarak aynen
yazilinca, farkli taban yuzunden ~1.6 kat (16/10) daha buyuk render
oluyorlardi (olculdu: h1 33.6px/olmasi gereken 21px, fiyat 22.4px/14px,
accordion basligi 25.6px/16px).

**Secilen cozum (Seçenek B, dar kapsamli)**: Kok font-size'i site genelinde
degistirmek yerine (bu, tum storefront'u - header/katalog/sepet/checkout -
etkiler ve kapsam disiydi), `src/components/product-viewer.tsx` icindeki
`text-[Xrem]` / `tracking-[Xrem]` / `rounded-[Xrem]` / `gap-[Xrem]`
yazimlari Release'in gercek piksel karsiligina (deger × 10) cevrildi:
- h1 baslik: `text-[2.1rem] tracking-[-0.04em]` -> `text-[21px]
  tracking-[-0.84px]`
- Fiyat (2 yer): `text-[1.4rem]` -> `text-[14px]`
- Accordion basliklari (2 yer): `text-[1.6rem] tracking-[-0.04em]` ->
  `text-[16px] tracking-[-0.64px]`
- Beden/renk kutucugu harf araligi (2 yer): `tracking-[0.1rem]` ->
  `tracking-[1px]`
- Indirim rozeti: `rounded-[0.4rem]` -> `rounded-[4px]`
- Guven izgarasi karti: `rounded-[1.4rem]` -> `rounded-[14px]`
- Galeri/guven izgarasi bosluk (2 yer): `gap-[0.8rem]` -> `gap-[8px]`
- Urun aciklamasi: font-size hic belirtilmemisti (Tailwind varsayilani
  16px'e duşuyordu, Release'de 14px) - `text-sm` eklendi.

**Kalici kural**: Bundan sonra Release'in CSS'inden okunan HER rem degeri,
Bollmark'a yazilirken × 10 yapilip **px olarak** yazilmali - rem asla aynen
kopyalanmamali (kok font-size'lar farkli). Onceki adimlarda (header/mega
menu olcumleri) bu kural uygulanmis miydi ayrica gozden gecirilmeli, bu
oturumda sadece urun detay sayfasi duzeltildi.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz (67 sayfa).
Playwright ile yerel dev sunucuda urun sayfasi acilip `getComputedStyle`
ile olculdu: h1 = 21px, fiyat = 14px (dogrulandi - Release'in gercek
degerleriyle birebir). 1600px ve 390px ekran goruntuleri alindi, yatay
tasma yok, genel gorunum bozulmadi.

**Commit atildi (`d5f3364`), push edildi.**

## Urun detay sayfasi galeri/bilgi paneli arasi bosluk (2026-09-12)

`URUN_GORSELLERI_GENISLIK_ANALIZI.md`'de tarayicida `getBoundingClientRect()`
ile Release ve Bollmark 1600px'te karsilastirildi: galeri oraninin (0.75),
gorsel arasi bosluk (8px) ve toplam 60/40 bolunmenin zaten dogru oldugu,
tek farkin galeri ile bilgi paneli arasindaki yatay bosluk oldugu bulundu -
Release'de 32px (5 esit sutunlu grid'in tek sutun-arasi boslugu), Bollmark'ta
`gap-x-11` (44px, Tailwind spacing skalasi).

**Duzeltme**: `product-viewer.tsx`'teki `grid gap-x-11 gap-y-12
md:grid-cols-[60fr_40fr]` -> `grid gap-x-8 gap-y-12 md:grid-cols-[60fr_40fr]`
(`gap-x-8` = 2rem = 32px, kok font-size'dan etkilenmeyen hazir bir Tailwind
sinifi). `gap-y-12` degismedi (sadece mobil alt alta dizilimde kullaniliyor).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz (67 sayfa).
Playwright ile 1600px'te olculdu: galeri 888.6px, bilgi paneli 592.4px,
aradaki bosluk tam 32px (956.59 - 924.59) - Release'in olcumune (895/586/32)
cok yakin. 1280px ve 390px'te `scrollWidth === clientWidth` dogrulandi,
yatay tasma yok.

**Commit atildi, push edildi.**

## Genis ekranda galeri fotograflari kucuk kaliyordu - yuzdesel bolunme -> minmax (2026-09-12, ayni oturum devami)

Yukaridaki bosluk duzeltmesinden sonra kullanici "hala esitlenmedi, Release'in
fotograflari daha genis yer kapliyor" dedi. Onceki analiz sadece **1600px'te**
olcmustu (895/586 - 888/592, neredeyse esit), sorun sadece **genis ekranlarda
(1800px+)** ortaya cikiyordu.

**Onemli teknik not**: Release'in galerisi CSS `fr` ile degil, sayfa
yuklenirken JS ile hesaplanan px degerleriyle calisiyor (Shopify temasinin
kendi grid/swiper mantigi) - tarayici penceresini sadece yeniden
boyutlandirmak (resize) bu degerleri guncellemiyor, **sayfanin o genislikte
yeniden yuklenmesi (reload) gerekiyor**. Ilk denemede resize yapip eski/bayat
degerleri okumak yanlis sonuca goturmustu; bu kez her genislikte sayfa
yeniden yuklenerek olculdu.

**Gercek olcum** (her genislikte reload ile):

| Viewport | Release galeri | Release bilgi paneli | Bollmark galeri (once) | Bollmark bilgi paneli (once) |
|---|---|---|---|---|
| 1600px | 895px | 586px | 888px | 592px |
| 1920px | 1211px | 590px | 1081px | 720px |

Release'in bilgi paneli ~586-590px civarinda neredeyse sabit kaliyor, ekstra
genisligin tamami galeriye gidiyor. Bollmark'in `md:grid-cols-[60fr_40fr]`
(yuzdesel) bolunmesi ise her iki tarafi da orantili buyutuyor - 1920px'te
bilgi paneli 720px'e sisiyor, galeri buna bagli olarak Release'den %11 dar
kaliyor (1081px).

**Duzeltme**: `src/components/product-viewer.tsx` satir 291:
`grid gap-x-8 gap-y-12 md:grid-cols-[60fr_40fr]` ->
`grid gap-x-8 gap-y-12 md:grid-cols-[1fr_minmax(320px,590px)]`. Bilgi paneli
320px (alt sinir, dar masaustunde metin sikismasin) ile 590px (ust sinir,
Release'in olculen sabit genisligi) arasinda tutuluyor, galeri sutunu (`1fr`)
kalan tum alani aliyor.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Playwright ile
`/urunler/trousers` sayfasi her genislikte reload edilerek
`getBoundingClientRect()` ile olculdu:

| Viewport | Galeri | Bilgi paneli | Not |
|---|---|---|---|
| 1024px | 339px | 590px | tasma yok |
| 1280px | 571px | 590px | tasma yok |
| 1600px | 891px | 590px | Release: 895/586 - cok yakin |
| 1920px | 1211px | 590px | Release: 1211/590 - birebir |
| 390px | - | - | `scrollWidth === clientWidth` (375=375), tasma yok |

Bilgi paneli 1920px'te de 590px'te sabit kaldi (buyumedi), tum ekstra
genislik galeriye gitti - Release'in davranisiyla birebir eslesti.

**Commit onerilir, ama kullanicinin onayi olmadan push edilmeyecek.**

## Mobil katalog karti ve urun galerisi sorunlari (2026-09-14)

`MOBIL_KATALOG_KARTI_VE_URUN_GALERISI_SORUNLARI_PLANI.md` uygulandi.

**Adim 0 (senkron kontrolu)**: Plan, bu bilgisayarin yerel `product-card.tsx`
dosyasinda "Son N Adet" rozetinin hic bulunmadigindan ve yerel/canli kodun
birebir ayni olmayabilecegiden supheleniyordu. Once `git pull` calistirildi:
yerel `main`, `origin/main`'in 1 commit gerisindeydi (fast-forward, push
edilmemis yerel degisiklik yoktu). Pull sonrasi `product-card.tsx` GERCEKTEN
"Son N Adet" rozetini ve `%X Indirim` rozetini iceriyordu - yani sorunun kaynagi
sadece senkron eksikligiymis, ek bir merge/conflict riski cikmadi.

**Kok neden ve duzeltmeler** (`src/components/product-card.tsx`):
- Rozetler (`indirim` + `Son N Adet`) yan yana `flex-wrap` yerine dikey
  `flex-col` dizildi, dar ekranda (< `sm`) daha kucuk padding/font
  (`px-1.5 py-1 text-[9px]`, `sm:` ustunde eski boyuta donuyor) - kalp
  butonuyla çakışma ve görselin kapanmasi azaltildi.
- Indirim rozetinin rengi `bg-[rgb(239,45,45)]` (ozel, tutarsiz bir kirmizi)
  yerine `bg-sale` (`#c0392b`, urun detay sayfasindaki ayni rozetle ayni token)
  yapildi.
- "+" hizli sepete ekle butonu mobilde `h-8 w-8` (32px), `md:h-9 md:w-9`
  (36px) - eskiden mobilde de `md:opacity-0` sadece masaustu hover'i icin
  oldugundan taban `opacity-100` ile her zaman buyuk gorunuyordu. Ikon boyutu
  `size` prop'u yerine `className="h-3.5 w-3.5 md:h-4 md:w-4"` ile responsive
  yapildi.
- Baslik (`h3`) `line-clamp-2 min-h-[30px]` aldi, renk etiketi (`colorLabel`)
  artik hep render ediliyor (yoksa `invisible` + ` ` bosluk) - boylece
  komsu kartlarda baslik/renk etiketi satir sayisi degisse de fiyat satiri
  ayni yukseklikte kaliyor.

**Urun detay sayfasi mobil galerisi** (`src/components/product-viewer.tsx`):
Mobil `md:hidden` blogu ve thumbnail seridi zaten production'da/yerelde
mevcuttu; ana gorsele swipe (parmak kaydirma) ekli degildi. Eklenenler:
- `md:hidden` sarmalayicisina ve thumbnail seridine `min-w-0` (flex/grid
  blowout guvenlik payi).
- Ana gorsele native `touchstart`/`touchend` tabanli basit bir swipe handler
  (harici kutuphane yok, ~15 satir): yatay hareket 40px'i gecerse aktif
  gorseli degistiriyor, `wasSwipe` ref'i ile swipe sonrasi tarayicinin
  sentezledigi "click" olayinin lightbox'i yanlislikla acmasi engellendi.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz (67 sayfa).
Yerel `npm run dev` + Playwright (`preview=onizleme2026!` cookie'siyle
`/yapim-asamasinda` gate'i asilarak) ile:
- Mobil (390px) `/urunler`: rozetler kuculdu, kalp butonuyla cakismiyor, "+"
  butonu 32px, fiyat satirlari ayni satirdaki kartlarda birebir hizali
  (`getBoundingClientRect().top` ölçümü: 648/648 ve 983/983).
- Masaustu (1440px) `/urunler`: 4 kartin fiyat satiri hepsi 852px'te,
  rozetler eski (buyuk) boyutunda, "+" butonu hover disinda gizli - bu
  degisiklikler masaustunu etkilemedi.
- Urun detay sayfasi (`beli-lastikli-baglamali-genis-paca-pantolon`, 6
  gorsel), 390px: sayfa yatayda tasmiyor (`scrollWidth === clientWidth`),
  sentetik `touchstart`/`touchend` ile ana gorseli degistirdi ve lightbox
  yanlislikla acilmadi (guard dogrulandi).

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Ayni plana sonradan eklenen 4a/4b maddeleri (2026-09-14, ayni gun devami)

Yukaridaki galeri swipe isinden sonra plan dosyasina kullanicinin yeni ekran
goruntusuyle dogruladigi iki ek madde eklenmisti (4a, 4b) - bunlar da
uygulandi.

**4a - aktif kucuk resmin cercevesi (ring) sadece sagda/solda gorunuyordu**:
Kok neden koddaki analizle dogrulandi: kucuk resim seridinin sarmalayicisi
(`overflow-x-auto`) sadece yatay eksende tasmaya izin veriyordu, CSS kurali
geregi digger eksen de otomatik olarak kirpiyordu - aktif kucuk resmin
`ring-1 ring-ink ring-offset-1` cercevesi (kutu disina tasan ince golge)
dikeyde kirpiliyordu. Duzeltme: `src/components/product-viewer.tsx`'teki
serit konteynerine `py-1` eklendi (`mt-3 flex min-w-0 gap-2 overflow-x-auto
py-1`) - Playwright ile `getComputedStyle` uzerinden `paddingTop`/
`paddingBottom` degerlerinin `4px` oldugu ve ekran goruntusunde cercevenin
4 kenarda da esit gorundugu dogrulandi.

**4b - ana gorsele parmagi gercek zamanli takip eden (iPhone/Instagram tarzi)
swipe**: Onceki basit `touchstart`/`touchend` (anlik index degistirme)
kullanicinin istedigi deneyimi karsilamiyordu. `product-viewer.tsx`'e
eklenenler:
- Aktif gorselin onceki/kendisi/sonraki 3 kopyasi yan yana bir `flex`
  seridinde (`translateX(calc(-100% + surukleme_px))`) render ediliyor -
  galeri dongusel oldugu icin (prev/next `% galleryImages.length` ile
  hesaplaniyor) bir "kenar" yok, rubber-band gerekmedi.
  - `touchmove`: `dragOffsetPx` state'i (gorsel transform icin) VE
    `dragOffsetRef` (senkron okuma icin) ayni anda guncelleniyor -
    `touchend`'in ayni senkron olay dizisi icinde React'in henuz render'a
    yansitmadigi bayat bir state okumasi riskini (`dragOffsetPx` kapanmasi)
    onlemek icin esik hesabi ref'ten yapiliyor.
  - `touchend`: surukleme mesafesi konteyner genisliginin %20'sini asarsa
    once serit tamamen (`±width`) kaydiriliyor (`transition` acik, 250ms),
    250ms sonra `setTimeout` ile aktif index degisip offset gecissiz
    (`isDragging=true` -> hemen `false`) sifirlaniyor - boylece yeni gorsel
    "zaten oradaymis" gibi kesintisiz merkeze oturuyor. Esik asilmazsa
    sadece `transition` acik sekilde 0'a geri donuluyor (rubber-band geri
    sicramasi).
  - Aktif kucuk resmin gorunur alanda kalmasi icin yeni bir `useEffect`,
    `activeImage` degisince ilgili thumbnail'i `scrollIntoView` ile
    kaydiriyor.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel
`npm run dev` + Playwright (`hasTouch`/`isMobile` context, sentetik
`Touch`/`TouchEvent` dispatch'leri) ile:
- Esigi asan bir surukleme (3 `touchmove` adimi, ~140px) aktif gorseli
  gercekten degistirdi (`img src` once/sonra farkli) ve lightbox
  ACILMADI (`wasSwipe` guard'i hala calisiyor).
- Aktif kucuk resim vurgusu (`ring-1`) dogru indexe (1) gecti.
- Esigin ALTINDA kucuk bir surukleme (~20px, konteyner genisliginin
  %20'sinden az) aktif gorseli DEGISTIRMEDI, transform olcumu
  (`matrix(1,0,0,1,-358,0)`) seridin tam merkeze (`-100%`, konteyner
  genisligi 358px) geri sicradigini dogruladi.
- Ekran goruntusunde aktif kucuk resmin siyah cercevesinin artik 4 kenarda
  da esit gorundugu teyit edildi.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Plana sonradan eklenen 4a/4b/4d maddeleri - kutuphane gerektirmeyen kisim (2026-09-14, ayni gun devami)

Kullanici plana yeni ekran goruntuleriyle dogruladigi ek maddeler eklemisti - bunlardan **yeni npm
paketi gerektirmeyenler** uygulandi, kutuphane onerilen 4c (Embla Carousel) ve 4d'nin lightbox kutuphane
degisikligi (yet-another-react-lightbox) kismi plan'in kendi notu geregi ("yeni bagimlilik eklemeden once
onay al") kullaniciya soruldu, henuz uygulanmadi.

**4a (guncellenmis) - kucuk resim cercevesi (ring) hem dikeyde hem YATAYDA kirpiliyordu**: Onceki oturumda
sadece `py-1` eklenmisti, kullanici ikinci ekran goruntusuyle ilk/son kucuk resmin ring'inin yanlarda da
kirpildigini gosterdi (konteynerin scroll alani ilk/son ogeye tam yapisik basliyor, `gap-2` sadece ogeler
ARASI bosluk birakiyor). Duzeltme: `py-1` -> `p-1` (hem dikey hem yatay ic bosluk).

**4b - kucuk resimlerde fotografin kafasi/ayagi kirpiliyordu**: Kok neden `aspect-square` (kare) kutu +
dikey (3:4) urun fotograflari + `object-cover` kombinasyonuydu. Once release-main.myshopify.com/products/
top-8'in KENDI kucuk resimleri Playwright ile olculdu (varsayim degil): tam **64x85.33px, oran 0.750 =
3:4, object-fit: cover** - yani Release de ayni w-16 (64px) genislikte ama KARE degil 3:4 oranli kutu
kullaniyor. `src/components/product-viewer.tsx`'teki kucuk resim kutusu `aspect-square` -> `aspect-[3/4]`
yapildi (genislik `w-16` ayni kaldi, plan'in "gerekirse w-14'e daralt" notu geregi yoktu - 64x85.33
zaten Release'le birebir eslesiyor).

**4d (kismen) - lightbox'ta ok butonlari tiklanamiyordu + kucuk kaliyordu**: Kod incelemesiyle kok neden
dogrulandi - gorsel kutusu (`relative h-full max-h-[85vh] w-full max-w-3xl`) DOM'da ok butonlarindan
SONRA geliyor, hicbirinde `z-index` yoktu, gorsel kutusu ekranin cogunu kapladigi icin buton alanlarinin
UZERINE binip tiklamalari yutuyordu. Duzeltme: kapat + sol/sag ok butonlarina `z-10` eklendi. Ayrica
mobilde dis bosluk `p-4` -> `p-2 sm:p-4`, `max-w-3xl` -> `max-w-full md:max-w-3xl` yapilarak kullanilabilir
alan buyutuldu (zoomlu halde pan/kaydirma eksikligi ise 4d'nin kutuphane onerisiyle cozulecek, henuz
yapilmadi - asagiya bkz).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel `npm run dev` + Playwright (390px,
`preview=onizleme2026!`) ile:
- Kucuk resim seridi konteyner padding'i 4 kenarda da `4px` (`p-1`).
- Kucuk resim kutusu tam `64 x 85.33px` (oran `0.750`) - Release'in olcumuyle birebir.
- Lightbox acildi, "Sonraki gorsel" ok butonuna tiklandi, sayac `1/5` -> `2/5` degisti (ok butonu artik
  gercekten calisiyor), gorsel kutusu genisligi `374px` (390px viewport - 2*8px `p-2` = 374, oncesine
  gore daha genis).

**Kullaniciya soruldu, henuz karar bekleniyor / uygulanmadi**: Plan, 4c (ana galeri kaydirmasini
`embla-carousel-react`'e tasima) ve 4d'nin geri kalani (lightbox'i `yet-another-react-lightbox` + Zoom +
Thumbnails eklentileriyle degistirme) icin iki yeni npm bagimliligi ekliyor - plan'in kendi notu geregi
("Not - yeni bagimlilik eklemeden once onay al") bu ikisi kuruluma gecilmeden once kullaniciya soruldu.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## 4c - Ana galeri kaydirmasi Embla Carousel'e tasindi (2026-09-14, ayni gun devami)

Kullaniciya soruldu, sadece **Embla Carousel** (galeri swipe) icin onay verildi -
`yet-another-react-lightbox` (4d'nin kutuphane kismi) istenmedi, o kisim
uygulanmadi.

**Kurulum**: `npm install embla-carousel-react@8.6.0` (5 yuksek seviyeli
guvenlik uyarisi projede onceden var, bu paketten kaynaklanmiyor).

**Degisiklik** (`src/components/product-viewer.tsx`): Onceki elle yazilmis
`touchstart`/`touchmove`/`touchend` + manuel 3'lu (onceki/aktif/sonraki)
serit/translateX mantiginin TAMAMI silindi, yerine Embla'nin resmi
"Thumbnail Sync" deseni geldi:
- Ana gorsel icin `useEmblaCarousel({ loop: true })`, kucuk resim seridi
  icin `useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true })` -
  iki ayri Embla instance'i.
- Ana carousel'in `select` olayi aktif index'i gunceller ve kucuk resim
  carousel'ini o indexe `scrollTo` ile senkronlar; kucuk resme tiklamak
  ana carousel'i `scrollTo` ile o indexe kaydirir (resmi ornekten uyarlandi).
- Renk degisince (`galleryImages` degisince) her iki carousel de anlik
  (`scrollTo(0, true)`) basa donuyor.
- Tiklayip lightbox acma: onceki elle yazilan "wasSwipe" ref hilesinin
  yerini Embla'nin KENDI ic mekanizmasi aldi - kod incelemesiyle dogrulandi
  (`embla-carousel.esm.js` satir ~302-393): Embla, gercek bir surukleme
  sonrasi (esik asilirsa) rootNode'a yakalama (capture) asamasinda eklenen
  bir `click` listener'i ile `stopPropagation()` + `preventDefault()`
  cagirarak native click'i DAHA REACT'e ULASMADAN bastiriyor - ayri bir
  guard yazmaya gerek kalmadi.
- `md:hidden` mobil bloğun GORSEL tasarimi (boyutlar, ring, 4a/4b'deki
  duzeltmeler, boşluklar) AYNEN korundu, sadece kaydirma/senkron mantigi
  Embla'ya devredildi.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel
`npm run dev` + Playwright ile (390px):
- Sayfa yatayda tasmiyor (`scrollWidth === clientWidth`).
- Gercek fare suruklemesi (`page.mouse.down/move/up`, Embla mouse ve touch
  olaylarini ayni mantikla dinliyor) aktif gorseli VE kucuk resim vurgusunu
  degistirdi, lightbox YANLISLIKLA ACILMADI.
- Suruklemeden SONRA yapilan ayri, duz bir tiklama lightbox'i DOGRU sekilde
  actı (ilk denemede test viewport koordinati yanlis secildigi icin false-
  negative alindi - `loop: true` oldugunda Embla DOM'daki ilk slaydi CSS
  transform'la yer degistirebiliyor, gercek sorun degil, test hatasiydi;
  duzeltilince dogrulandi).
- Bir kucuk resme tiklamak ana carousel'i dogru indexe kaydirdi.
- **Gercek touch (CDP `touchscreen.tap`, iPhone 13 cihaz emulasyonu) ile**
  de tek dokunus lightbox'i dogru actı.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## 4d - Lightbox `yet-another-react-lightbox` + Zoom eklentisine tasindi (2026-09-14, ayni gun devami)

Kullanici acikca "yet another react kullan zoomlayinca kaydirmak icin" dedi - plan'in 4d maddesindeki iki
secenekten (Embla + react-zoom-pan-pinch hibrit VEYA Yet Another React Lightbox) ikincisi secildi.

**Kurulum**: `npm install yet-another-react-lightbox@3.32.2`.

**Degisiklik** (`src/components/product-viewer.tsx`): Elle yazilmis lightbox'in TAMAMI (sabit overlay div,
X/ok butonlari, klavye (Escape/ArrowLeft/ArrowRight) `useEffect`'i, `body.style.overflow` kilidi, sabit
`scale(2)` + tiklanan noktaya `transform-origin` zoom mantigi, `zoomed`/`zoomOrigin` state'leri) silindi,
yerine tek bir `<Lightbox open={...} plugins={[Zoom]} .../>` geldi:
- `open`/`close`/`index` prop'lari mevcut `lightboxIndex` state'ine bagli - acilis noktasi (mobil ana
  gorsele veya masaustu 2 sutunlu grid'e tiklama) DEGISMEDI.
- `on.view` callback'i: lightbox icinde gezinilince (ok/swipe/pinch-zoom sonrasi) hem `activeImage`
  state'ini hem alttaki Embla ana galerisini VE kucuk resim seridini (`emblaMainApi.scrollTo`,
  `emblaThumbApi.scrollTo`) senkron tutuyor - lightbox kapaninca kullanici en son baktigi fotografi
  ana galeride de gormeye devam ediyor.
- `zoom={{ maxZoomPixelRatio: 3, doubleTapDelay: 300, doubleClickDelay: 300 }}` - pinch-to-zoom (dokunmatik
  dahil), cift tiklama/dokunma ile zoom, zoomluyken PARMAKLA GEZINME (pan) VE zoomluyken bile sonraki/
  onceki fotografa GECIS hepsi kutuphanenin kendi ic mantigiyla geliyor - elle kod yazilmadi.
- `styles`: arka plan `rgba(17,17,17,0.95)` (siteninkiyle ayni `ink` tonu, oncekiyle ayni gorunum), buton
  rengi cream - sitenin siyah/cream paletine uydurmak icin.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel `npm run dev` + Playwright (iPhone 13
cihaz emulasyonu + masaustu 1440px) ile:
- Mobilde gercek touch (`touchscreen.tap`) ile lightbox acildi (`.yarl__root` DOM'da).
- Zoom-in/zoom-out toolbar butonlarina tiklandi, ekran goruntusuyle gercek pinch-zoom benzeri buyutme
  (kumas dokusunun yakinlastigi) GORSEL OLARAK dogrulandi (DOM `transform` stili farkli bir ic sarmalayicida
  oldugu icin `getComputedStyle` degil ekran goruntusu kullanildi).
- Zoomluyken fare suruklemesiyle (pan) goruntunun kaydigi ekran goruntusuyle dogrulandi (bel/kalca
  bolgesi -> kol/cep bolgesine kaydi).
- Masaustunde (1440px) 2 sutunlu galeri gorseline tiklayinca lightbox ayni sekilde acildi, sayfa yatayda
  tasmadi.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Lightbox'ta navigasyon (sonraki/onceki) hicbir sekilde calismiyordu - kritik hata duzeltmesi (2026-09-14, ayni gun devami)

Kullanici "zoomlu haldeyken kaydırınca sürekli aynı fotoğrafta takılı kalıyor sonrakine geçmiyor"
bildirdi.

**Kok neden (test edilerek dogrulandi, tahmin degil):** `<Lightbox index={lightboxIndex ?? 0} .../>`
`index` prop'u KONTROLLU (controlled) veriliyordu, ama `on.view` callback'i (kullanici lightbox icinde
gezindiginde tetiklenen olay) sadece `activeImage`'i ve Embla instance'larini guncelliyordu,
`lightboxIndex` state'ini HIC guncellemiyordu. Sonuc: kullanici ok butonuna/klavyeye/swipe'a basip
YARL kendi icinde bir sonraki gorsele gecse bile, bir sonraki render'da `index={lightboxIndex ?? 0}`
hala ESKI degeri tasidigi icin YARL kontrollu bilesen olarak eski indekse "geri senkronlaniyordu" -
kullaniciya "aynı fotografta takili kaliyor" gibi gorunuyordu. Bu, ZOOM'a ozel bir hata degildi - Playwright
ile test edilince ZOOM OLMADAN da (`Next` butonu, gercek touch swipe) ayni sekilde bozuk oldugu
dogrulandi; kullanici bunu zoom'la denerken fark etmis.

**Duzeltme**: `on.view` callback'ine `setLightboxIndex(index)` eklendi (`src/components/
product-viewer.tsx`) - artik YARL'in kendi ic navigasyon state'i ile bizim kontrollu `index` prop'umuz
senkron.

**Ayrica arastirildi ve dogrulandi (kutuphane siniri, hata degil)**: Zoom eklentisinin pan (surukleme)
mantigi kaynak kodundan okundu (`plugins/zoom/index.js` satir ~330-332) - `offsetX`,
`Math.min(..., maxOffsetX)` ile SERT sekilde kenarda kilitleniyor, siniri astiktan sonra swipe'a
"devretme" (handoff) mantigi YOK - yani zoomluyken PARMAKLA suruklemek/kaydirmak hicbir zaman sonraki
fotografa gecirmeyecek (bu, kutuphanenin v3 stabil surumunde tasarim geregi boyle, "pinchZoomV4"
deneysel bayragi da bunu degistirmiyor, sadece pinch olcekleme formulunu degistiriyor). Zoomluyken
sonraki/onceki fotografa gecis SADECE ok butonlari/klavye ile calisiyor (yukaridaki duzeltmeyle bu da
artik dogru calisiyor).

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel `npm run dev` + Playwright (iPhone 13
emulasyonu, CDP `Input.dispatchTouchEvent` ile GERCEK touch swipe - mouse simulasyonu degil) ile:
- Zoom YOKKEN: Next butonu VE gercek touch swipe artik gorseli DEGISTIRIYOR (once her ikisi de sabit
  kaliyordu).
- Zoom in yapilip Next butonuna basildiginda: gorsel DEGISIYOR (once sabit kaliyordu - kullanicinin
  bildirdigi senaryo).
- Zoomluyken gercek touch swipe: hala gorseli degistirmiyor (kutuphane siniri, yukarida aciklandi) -
  kullaniciya bu net sekilde bildirildi, isterse ozel bir "pan sinirinda swipe'a devret" ozelligi ayrica
  gelistirilebilir (ek is, henuz istenmedi).
- Lightbox kapatilinca en son bakilan gorsel hem ana galeri (Embla) hem kucuk resim seridinde dogru
  senkron kaliyor.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Lightbox ok butonlari beyaz zeminde gorunmuyordu (2026-09-14, ayni gun devami)

Kullanici, zoomluyken beyaz/acik renkli bir urun fotografinda sol/sag ok butonlarinin (cream renkli,
`#fffdf9`) arka planla neredeyse ayni renk oldugu icin gorunmez hale geldigini bildirdi.

**Duzeltme** (`src/components/product-viewer.tsx`): YARL'in `styles` prop'una `navigationPrev` ve
`navigationNext` anahtarlari eklendi - SADECE sol/sag navigasyon butonlarina (zoom in/out/kapat butonlarina
degil) koyu, yari saydam (`rgba(17,17,17,0.55)`) dairesel (`borderRadius: 9999px`) bir arka plan verildi.
Boylece ok her zaman (fotograf beyaz da olsa, koyu da olsa) okunakli kaliyor.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz. Yerel `npm run dev` + Playwright ile
zoom yapilip beyaz/krem renkli bir tisortun uzerine odaklanildi, ekran goruntusuyle ok butonlarinin artik
koyu daire icinde net gorundugu dogrulandi.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Lansman sayaci her deploy'da sifirlaniyordu - duzeltildi (2026-09-14, ayni gun devami)

Kullanici, "yapim asamasinda" (Cok Yakinda) sayfasindaki geri sayimin her deploy'da basa (30 gun) sardigini
bildirdi. Onceden `FONT_BOYUTU_KOK_NEDEN_PLANI.md` benzeri bir arastirma dosyasi (`LANSMAN_SAYACI_DEPLOY_SIFIRLAMA_PLANI.md`)
kok nedeni tespit etmisti.

**Kok neden**: `src/app/(gate)/yapim-asamasinda/page.tsx` icindeki `DEFAULT_LAUNCH_DATE`, `NEXT_PUBLIC_LAUNCH_DATE`
ortam degiskeni tanimsizken `new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)` ile HAREKETLI (her build aninda
degisen) bir varsayilana dusuyordu. Bu degisken hicbir yerde (.env, .env.local, muhtemelen Vercel) tanimli
degildi, bu yuzden her deploy'da (build zamaninda) sayfa yeniden derlenirken farkli bir tarih uretiliyor ve
sayac deploy anina gore sifirlaniyordu.

**Duzeltme**:
1. `src/app/(gate)/yapim-asamasinda/page.tsx`: `DEFAULT_LAUNCH_DATE` artik SABIT bir ISO tarih string'i
   (`"2026-10-14T00:00:00"`, kullaniciyla teyit edildi) - `NEXT_PUBLIC_LAUNCH_DATE` eksik olsa bile artik her
   build ayni sonucu uretiyor, sayac deploy'dan etkilenmiyor.
2. Yerel `.env.local` dosyasi olusturuldu, `NEXT_PUBLIC_LAUNCH_DATE="2026-10-14T00:00:00"` eklendi
   (`.gitignore`'da, repoya gitmiyor).
3. `.env.example`'da zaten ayni deger (`NEXT_PUBLIC_LAUNCH_DATE="2026-10-14T00:00:00"`) tanimliydi, dokunulmadi.

**Kullanicinin yapmasi gereken (Claude tarafindan yapilamaz)**: Vercel proje ayarlarinda
(**Settings -> Environment Variables**) `NEXT_PUBLIC_LAUNCH_DATE` degiskeni **hem Production hem Preview**
ortamlarina `2026-10-14T00:00:00` degeriyle eklenmeli:
1. https://vercel.com/bollmark/bollmark/settings/environment-variables adresine git (ya da proje ->
   Settings -> Environment Variables).
2. "Add New" ile Key: `NEXT_PUBLIC_LAUNCH_DATE`, Value: `2026-10-14T00:00:00`, Environments: Production +
   Preview isaretli olarak ekle.
3. Kaydettikten sonra bir **Redeploy** tetiklenmeli (env degisikligi mevcut deployment'a otomatik yansimaz) -
   Deployments sekmesinden en son deployment'in "..." menusunden "Redeploy" secilebilir.
4. Env var eklenmese bile artik kod SABIT tarihe dustugu icin sayac tutarli kalacak (yanlis olsa da her
   deploy'da sabit) - ama gercek lansman tarihinin dogru yansimasi icin env var eklenmesi onerilir.

**Dogrulama**: `npx tsc --noEmit` ve `npm run build` hatasiz tamamlandi, `/yapim-asamasinda` hala statik (`○`).

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Mobil katalog gorsel bosluklari - Koton karsilastirmasi (2026-09-14, ayni gun devami)

Kullanici, mobilde `/urunler` sayfasindaki urun fotograflarinin Koton'un mobil sitesine kiyasla kucuk
gorundugunu bildirdi (Koton ekran goruntusu paylasildi): orada gorseller ekran kenarina neredeyse yapisik ve
iki sutun arasinda sadece ince bir cizgi kadar bosluk var. Kok neden onceden
`MOBIL_KATALOG_GORSEL_BOSLUK_PLANI.md` dosyasinda tespit edilmisti.

**Kok neden**: `src/app/(site)/urunler/page.tsx` icindeki sayfa konteynerinde mobilde `px-4` (16px) kenar
bosluğu var (hem basliga hem grid'e uygulaniyor), grid ise `grid-cols-2 gap-4` (16px kart arasi bosluk
mobilde) kullaniyordu - Koton'da bu bosluklar neredeyse sifir.

**Duzeltme**: Sadece urun grid'i (baslik/toolbar metninin kenar bosluguna dokunmadan) mobilde negatif margin
ile ust konteynerin `px-4`'unu iptal edip kenara yapistirildi, sutunlar arasi bosluk daraltildi:

```tsx
<div className="mt-8 -mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:mx-0 md:grid-cols-4 md:gap-6">
```

- `-mx-4` mobilde ust konteynerin `px-4`'unu iptal ediyor, gorseller ekran kenarina yapisiyor.
- `gap-x-0.5` (2px) sutunlar arasi bosluğu Koton'daki ince cizgiye yaklastiriyor.
- `gap-y-3` (12px) satirlar arasi bosluğu ayri tutuyor - kart metni (baslik/fiyat) bir alt satirdaki gorsele
  yapismasin diye yatay bosluktan belirgin sekilde fazla.
- `md:mx-0 md:grid-cols-4 md:gap-6` ile masaustu davranisi birebir korundu.

**Dogrulama**:
- `npx tsc --noEmit` ve `npm run build` hatasiz tamamlandi.
- Playwright ile yerel `npm run dev` uzerinde `?preview=` sifresiyle (PREVIEW_PASSWORD, "yapim asamasinda"
  gate'ini asmak icin) 390px ve 1600px genislikte ekran goruntusu alindi:
  - 390px: gorseller kenara yapisik, sutunlar arasi bosluk ince, kart basligi/fiyati okunabilir kaldi,
    alt satirdaki gorsele yapismadi. `document.documentElement.scrollWidth === clientWidth` (390) - yatay
    tasma yok.
  - 1600px: grid eskisi gibi 4 sutun + ~24px bosluk, degismedi. `scrollWidth === clientWidth` (1600).

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

## Mobil katalog - baslik/fiyat kenara cok yaslaniyordu, takip duzeltmesi (2026-09-14, ayni gun devami)

Bir onceki degisiklik (`-mx-4 gap-x-0.5 gap-y-3`, yukaridaki "Mobil katalog gorsel bosluklari" bolumu)
gorselleri dogru bicimde kenara yapistirdi, ama negatif margin tum grid hucresini (gorsel + altindaki
baslik/fiyat metnini) birlikte kaydirdigindan urun basligi ve fiyati da ekranin tam kenarina/aradaki dar
sutun bosluguna yapisti - kullanici yeni bir ekran goruntusuyle bunun rahatsiz edici durdugunu bildirdi.
Kok neden ve cozum onceden `MOBIL_KATALOG_METIN_BOSLUGU_DUZELTME_PLANI.md` dosyasinda tespit edilmisti.

**Duzeltme**: `src/components/product-card.tsx` icinde gorsel `div`'inden sonra gelen uc metin blogunun
(baslik satiri, renk etiketi, fiyat satiri) her birine mobilde `px-2` (8px) yatay ic bosluk, masaustunde
`md:px-0` (degisiklik yok) eklendi. Gorsel `div`'ine (rozetler, kalp butonu, hizli sepete ekle butonu dahil)
ve `urunler/page.tsx`'teki grid satirina dokunulmadi.

**Dogrulama**:
- `npx tsc --noEmit` ve `npm run build` hatasiz tamamlandi.
- Playwright ile yerel `npm run dev` uzerinde (onizleme sifresiyle gate asilarak) 390px ve 1600px genislikte
  ekran goruntusu alindi:
  - 390px: gorseller hala kenara yapisik, baslik/fiyat metni artik ekran kenarina/komsu karttaki metne
    degmiyor, kisa ve uzun urun isimlerinde okunabilir kaldi.
  - 1600px: hicbir gorsel degisiklik yok (metin zaten gorselle hizali kaliyor, masaustunde `gap-6` yeterli).

## Urun karti - baslik ile fiyat arasi bosluk fazlaydi (2026-09-14, ayni gun devami)

Kullanici ekran goruntusuyle, urun kartinda basligin altindaki renk etiketi ve fiyat satiri arasinda
gereginden fazla bosluk oldugunu bildirdi. Kok neden ve cozum onceden
`URUN_KARTI_BASLIK_FIYAT_BOSLUGU_PLANI.md` dosyasinda tespit edilmisti.

**Duzeltme**: `src/components/product-card.tsx` icinde SADECE iki saf margin degeri kucultuldu, hizalama
icin kullanilan `min-h-[30px]` (baslik) ve `min-h-[15px]` (renk etiketi) degerlerine dokunulmadi:
- Renk etiketi `<p>`: `mt-1` -> `mt-0.5`.
- Fiyat satirinin sarmalayici `<div>`'i: `mt-2` -> `mt-1`.

Bu degisiklik responsive degil (tek deger), hem masaustunu hem mobili ayni sekilde etkiliyor.

**Dogrulama**:
- `npx tsc --noEmit` ve `npm run build` hatasiz tamamlandi.
- Playwright ile canli ekran goruntusu/hizalama olcumu bu oturumda ALINAMADI: `playwright` MCP sunucusu
  baglanti zaman asimina ugradi (CONNECT_TIMEOUT). Degisiklik sadece iki `mt-*` degerini kucultuyor,
  hizalamayi saglayan `min-h` degerlerine dokunmuyor; yine de bir sonraki oturumda Playwright
  calisiyorken 375-390px ve 1280px genislikte tek satirlik/iki satirlik baslikli urunlerin fiyat
  satirlarinin hizali kaldigi `getBoundingClientRect()` ile dogrulanmali.

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

**Commit onerilir, kullanicinin onayi olmadan push edilmeyecek.**

