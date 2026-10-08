# Claude Code Promptu: Kodsuz Otomatik Kampanya + Değer Alanı Netleştirme

Bollmark e-ticaret admin panelindeki "Kampanyalar" (`/admin/kampanyalar`) ekranında iki sorunu çöz:

## Sorun 1: Kampanya oluşturmak için kupon kodu zorunlu

Şu an `Coupon` modelinde `code String @unique` zorunlu ve admin formunda `required`. Bu yüzden "sadece ayakkabılarda %20 indirim" veya "erkek ürünlerinde %10 indirim" gibi, müşterinin hiçbir kod girmeden sitede otomatik göreceği bir kampanya oluşturulamıyor — her kampanya bir kupon kodu ister.

İstenen: Admin, kod girmeden de bir kampanya oluşturabilsin. Bu tip kampanyalar sepete/ürüne otomatik uygulansın, müşteri hiçbir şey yazmasın.

### Veri modeli
- `prisma/schema.prisma` → `Coupon.code`'u `String? @unique` yap (nullable unique — Postgres'te birden fazla NULL'a izin verir, çakışma olmaz).
- `Coupon`'a `name String?` ekle: kodsuz kampanyalarda listede ve site tarafında gösterilecek görünen ad (örn. "Ayakkabılarda %20 İndirim"). Kod girilen kampanyalarda opsiyonel kalsın (kod zaten tanımlayıcı).
- Migration oluştur (`npx prisma migrate dev`), mevcut kayıtlar etkilenmesin (hepsinde `code` zaten dolu).

### Admin formu (`src/app/(admin)/admin/kampanyalar/page.tsx`, `src/components/admin/coupon-row.tsx`)
- Yeni Kupon formuna ve düzenleme formuna bir "Kampanya Türü" seçimi ekle: **"Kupon Kodlu"** / **"Otomatik (kod gerekmez)"** (radio veya segmented control).
  - "Kupon Kodlu" seçiliyken: mevcut davranış aynı, `code` zorunlu.
  - "Otomatik" seçiliyken: kod inputu gizlensin/disable olsun, yerine `name` inputu zorunlu olsun (placeholder: "Ayakkabılarda %20 İndirim"). Kategori/marka seçimi zaten var — otomatik kampanyalarda bunları öne çıkar (ikisi de boşsa "tüm sitede indirim" anlamına geldiğini formda küçük bir uyarı metniyle belirt, çünkü riskli bir ayar).
- `readCouponFields` içinde: form türüne göre `code`'u ya string ya `null` olarak oku; `code` null ise `name` zorunlu olsun (yoksa `hata=ad-gerekli` redirect).
- `createCoupon`/`updateCoupon` server action'larında validasyonu buna göre güncelle.
- Kampanya listesinde (`CouponRow`) kod yerine: kod varsa mevcut mono-font kod rozeti, kod yoksa `name` ile birlikte bir "Otomatik" rozeti (Badge tone farklı bir renk, örn. mor/yeşil) göster.

### İndirim hesaplama (`src/lib/coupons.ts`)
- Yeni bir fonksiyon ekle, örn. `resolveBestDiscount(tx, enteredCode: string | null, lines: CouponLine[])`:
  1. `code == null` olan, `isActive`, tarih aralığı ve `usageLimit` şartlarını sağlayan tüm kampanyaları çek.
  2. Her biri için (mevcut `validateCoupon` içindeki kategori/marka eşleştirme + indirim hesaplama mantığını paylaşan ortak bir yardımcı fonksiyona çıkar — kod tekrarını önle) o kampanyanın sepete uygulanacak `discountCents`'ini hesapla.
  3. Sepetteki **her ürün satırı için** en yüksek indirimi veren tek otomatik kampanyayı seç (satır bazlı "en avantajlı kampanya kazanır" mantığı — aynı ürüne iki otomatik kampanya üst üste binmesin). Bunu basitçe yapmak için: tüm uygun otomatik kampanyaları satır bazında değerlendir, her satıra en yüksek indirimi veren kampanyayı ata, sonra toplamı al.
  4. Eğer `enteredCode` doluysa, mevcut `validateCoupon` ile onun da toplam `discountCents`'ini hesapla.
  5. Otomatik kampanyaların toplamı ile girilen kuponun toplamını karşılaştır, **hangisi daha yüksek indirim veriyorsa onu uygula** (ikisi karışık uygulanmasın — kazanan tek sonuç kullanılsın). Eşitlikte kuponu tercih et (müşteri bilerek kod girmiş).
  6. Dönüş tipi `validateCoupon`'a benzer olsun: `{ couponId: string | null; discountCents; freeShipping; appliedName: string | null }` (`appliedName`: rozet için — kupon kodu ise `code`, otomatik ise `name`).
- Kazanan otomatik kampanyanın `usedCount`'unu da (kuponlarda olduğu gibi) sipariş tamamlanınca `$transaction` içinde artır — aynı race-condition korumasını (`orders/route.ts`'teki mevcut pattern) otomatik kampanyalar için de uygula.

### Entegrasyon noktaları
- `src/app/(site)/api/kuponlar/dogrula/route.ts`: sadece elle girilen kodu değil, `resolveBestDiscount` çağırıp otomatik kampanyayla karşılaştırılmış nihai sonucu dönsün (kullanıcı kod girmese bile bu endpoint'i sepet/ödeme sayfası, sepet otomatik kampanya var mı diye kontrol etmek için kod alanı boş çağırabilir).
- `src/app/(site)/sepet/page.tsx` ve `src/app/(site)/odeme/page.tsx`: sayfa render'ında `resolveBestDiscount(tx, null, lines)` çağırıp otomatik kampanya varsa satırlarda/sepet özetinde bir rozet göster (örn. "Ayakkabılarda %20 indirim uygulandı"). `src/components/coupon-field.tsx`: kullanıcı ayrıca kod girip "uygula" derse, iki sonucu karşılaştırıp kazananı göster; otomatik kampanyadan daha düşük bir kod girilirse kullanıcıya nazikçe bunu belirt (örn. "Zaten %20 kampanya indirimi uygulanıyor, bu kod daha düşük bir indirim sağlıyor").
- `src/app/(site)/api/orders/route.ts`: sipariş oluştururken de `resolveBestDiscount` kullanılsın (kod girilmiş olsun olmasın), `discountCents` ve `couponId` (null olabilir — otomatik kampanya kupon FK'sine bağlanamayacağı için `Order.couponId` alanının nullable kalması gerekiyor, zaten öyle; otomatik kampanya için de aynı `couponId` FK'si kullanılabilir çünkü artık `Coupon` kaydı var, sadece `code` null).
- Ürün listeleme/detay (`src/components/product-card.tsx`, `src/app/(site)/urunler/[slug]/page.tsx`): eğer bir ürün aktif bir otomatik kampanyanın kategori/marka kısıtına giriyorsa, üstünde küçük bir "%20 indirim" rozeti ve varsa indirimli fiyat gösterilsin (üstü çizili eski fiyat + yeni fiyat). Bunun için otomatik kampanyaları ürün sorgusuyla birlikte çekip eşleştiren bir yardımcı fonksiyon yaz (`lib/coupons.ts` içine, örn. `getApplicableAutomaticDiscountForProduct`).

### Audit log
`lib/audit-actions.ts`'e yeni bir action ekle (örn. `KAMPANYA_OTOMATIK_OLUSTURULDU` / mevcut coupon action'ları varsa onlara ek not) — mevcut pattern neyse onu takip et, işlem geçmişi sayfası otomatik yakalayacak.

## Sorun 2: "Değer" kutusunda % mi TL mi belirsiz

Hem yeni kampanya formunda (`kampanyalar/page.tsx`) hem düzenleme formunda (`coupon-row.tsx`) "Değer (% veya TL)" etiketi sabit metin — Tip (`PERCENT`/`FIXED`/`FREE_SHIPPING`) seçimine göre değişmiyor, admin hangi birimi girdiğini inputun üstünden anlayamıyor.

İstenen: Değer inputunun yanında/içinde, seçili Tip'e göre **canlı güncellenen** bir birim göstergesi olsun:
- `PERCENT` seçiliyken input yanında `%` sembolü/badge görünsün.
- `FIXED` seçiliyken `₺` sembolü/badge görünsün.
- `FREE_SHIPPING` seçiliyken değer inputu tamamen disable olsun (değer kullanılmıyor), placeholder "—" göster.

Uygulama:
- `coupon-row.tsx` zaten `"use client"` — Tip `<select>`'i için `useState` ekle, seçili değere göre değer inputunun yanına (örn. inputun içine sağa yaslı absolute-positioned bir `<span>` ya da input-group şeklinde bitişik bir prefix/suffix kutusu) `%` veya `₺` göster, `FREE_SHIPPING`'de inputu `disabled` yap ve `opacity-50` gibi bir stil ver.
- `kampanyalar/page.tsx`'teki "Yeni Kupon" formu server component — bunun için Tip + Değer alanlarını küçük bir `"use client"` alt bileşene çıkar (örn. `src/components/admin/coupon-value-field.tsx`, `type` ve `value` name'li iki input'u saran, aynı canlı sembol mantığını içeren bir bileşen), formun geri kalanı server action ile aynı şekilde çalışmaya devam etsin (input `name` attribute'ları değişmediği için `FormData` okuması etkilenmez).
- Statik "(% veya TL)" etiketini kaldır, sade "Değer" yap — birim artık inputun kendisinde görünüyor.

## Genel
- Mevcut admin tasarım sistemini kullan (`Card`, `Badge`, mevcut `inputClass`/`labelClass` pattern'leri).
- Türkçe değişken/route isimlendirme convention'ını koru (proje genelinde Türkçe route/alan adları kullanılıyor).
- Migration'ı çalıştır, build'i (`npm run build`) doğrula, sonra commit/push et.
