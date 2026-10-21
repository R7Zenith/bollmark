# Çocuk Menüsü, Kız/Erkek Çocuk Ayrımı ve Beden Adı Düzeltme Planı

Durum: devam ediyor — Adım 1–3 bitti (2026-10-21), Adım 4 sürüyor
Tarih: 2026-10-21

## Sorun

1. Siteye çocuk ürünleri eklendi ama üst menüde (masaüstü mega menü + mobil menü)
   çocuk bölümü yok. Menü yalnız Kadın / Erkek / Aksesuar.
2. Çocuk ürünleri Kız Çocuk / Erkek Çocuk diye ayrılmıyor. Excel aktarımı KOD4
   `KIDS/COCUK` değerini tek bir `"Çocuk"` cinsiyetine eşliyor
   (`src/lib/excel-import.ts` GENDER_MAP).
3. Çocuk beden değerleri Excel'den geldiği gibi açıldı: `5-6`, `6-7`, `7-8`, `910`,
   `112`, `134`. Doğrusu: `5-6 Yaş`, `6-7 Yaş`, `7-8 Yaş`, `9-10 Yaş`,
   `11-12 Yaş`, `13-14 Yaş`.
4. Admin → Ayarlar → Varyant Özellikleri sayfasında bir değerin **adını
   değiştirme** yok (yalnız ekle / sil / sırala / renk kodu).

## Koddaki mevcut durum (inceleme 2026-10-21)

- `Product.gender` serbest metin (`String?`). Seçenekler `src/lib/product-options.ts`
  `GENDER_OPTIONS = ["Kadın","Erkek","Unisex","Çocuk"]`.
- Katalog adresleri `src/lib/catalog-url.ts` `GENDER_SLUGS` ile üretiliyor;
  `/cocuk` rotası zaten var (`app/(site)/[cinsiyet]/page.tsx`) ama menüde linki yok.
- Menü verisi `src/lib/site-nav.ts` `getMegaMenuData()` → `{ kadin, erkek, aksesuar }`;
  menü bileşeni `src/components/site-header.tsx` (`tabs`, `GenderPanel`,
  `AksesuarPanel`, mobil `MobileScreen`). Promosyon kartları `src/lib/mega-menu-cards.ts`.
- Beden tablosu verisinde `"Kız Çocuk"` ve `"Erkek Çocuk"` anahtarları zaten var
  (`src/lib/size-guide-data.ts`) — yani bu ayrım projede zaten öngörülmüş.
- Beden/renk değerleri `VariantAttributeValue` tablosunda; varyantlar
  `ProductVariantOption` ile, renk galerileri `ProductOptionImage` ile bu değerlere bağlı.
  Değer adını değiştirmek bütün ürünlerde tek seferde düzelir.
- Yerel ve canlı **aynı Neon veritabanını** kullanıyor: veri değişiklikleri
  (cinsiyet ayırma, beden adı değişikliği) localhost'ta yapıldığı anda canlıda da görünür.

## Kararlar (öneri)

### A. Cinsiyet değerleri
- Yeni değerler: `Kız Çocuk` → slug `kiz-cocuk`, `Erkek Çocuk` → slug `erkek-cocuk`.
- `Çocuk` (slug `cocuk`) kalır ama anlamı "tüm çocuk" üst koleksiyonu olur:
  `/cocuk` sayfası `Kız Çocuk` + `Erkek Çocuk` + (varsa) ayrıştırılamamış `Çocuk`
  ürünlerini birlikte listeler. Bunun için katalog sorgusunda tek cinsiyet yerine
  cinsiyet grubu desteği gerekir (örn. `GENDER_GROUPS = { Çocuk: ["Kız Çocuk","Erkek Çocuk","Çocuk"] }`
  ve `gender: { in: [...] }`).
- `GENDER_OPTIONS`: `Kadın, Erkek, Unisex, Kız Çocuk, Erkek Çocuk, Çocuk (unisex)`.
  Ürün formu, toplu düzenleme, kupon cinsiyet alanları, admin ürün filtresi bu listeden beslenir.
- Google Merchant feed (`src/lib/merchant-feed.ts`): Kız Çocuk → `gender=female`,
  Erkek Çocuk → `gender=male`, Çocuk → `unisex`; üçünde de `age_group=kids`.
- Sitemap, SEO başlık/açıklama metinleri (`seo.ts`, `catalogMetadata`) yeni
  cinsiyetleri doğru Türkçe yazmalı ("Kız Çocuk Giyim" vb.).

### B. Mevcut çocuk ürünlerini ayırma (tek seferlik script)
`scripts/cocuk-cinsiyet-ayir.ts`, iki modlu:
- **Kuru çalıştırma (varsayılan):** `gender = "Çocuk"` olan tüm ürünleri listeler,
  her biri için önerilen cinsiyeti ve gerekçesini yazar:
  1. Ürün adında "Kız" geçiyorsa → Kız Çocuk; "Erkek" geçiyorsa → Erkek Çocuk.
  2. Değilse ürün koduna bak (Koton kodlarında çocuk ürünleri için kız/erkek harf
     kalıbı olabilir, örn. `KG`/`KB`); kalıbı veriye bakarak doğrula, varsayma.
  3. Hiçbiri tutmazsa → "BELİRSİZ" (Çocuk olarak kalır, kullanıcı admin'den seçer).
- **`--uygula`:** yalnız kullanıcı listeyi onayladıktan sonra çalışır, audit log yazar,
  `revalidateCatalog` tetiklenmesi için not düşer.

### C. Menü
- Masaüstü üst menü: `Kadın · Erkek · Çocuk · Aksesuar`.
- Çocuk mega paneli: iki sütun — **Kız Çocuk** ve **Erkek Çocuk** başlıkları altında
  o cinsiyette yayında ürünü olan kategoriler (`/kiz-cocuk/<kategori>`,
  `/erkek-cocuk/<kategori>`), her sütunun altında "Tümünü gör" linki; panelde
  "Tüm Çocuk" (`/cocuk`) linki.
- Promosyon görsel kartı başlangıçta yok (kart yoksa sağ panel zaten gizleniyor);
  `MEGA_MENU_CARDS`'a `cocuk` anahtarı açılır, görseller sonra eklenir.
- Mobil menü: kökte "Çocuk" satırı → açılan ekranda Kız Çocuk / Erkek Çocuk
  bölümleri ve kategorileri.
- Çocuk sekmesi yalnız yayında en az bir çocuk ürünü varsa görünür.
- Aktif menü vurgusu (`parseCatalogPath`) `/kiz-cocuk/...`, `/erkek-cocuk/...`,
  `/cocuk` adreslerinde Çocuk sekmesini işaretler.

### D. Varyant değeri yeniden adlandırma (admin)
Ayarlar → Varyant Özellikleri'nde her değerin satırına **Düzenle** (kalem) butonu:
- Satır içi metin kutusu → Kaydet / Vazgeç.
- Yeni ad aynı özellikte başka bir değerle çakışmıyorsa: sadece `value` güncellenir.
- Çakışıyorsa: "Bu adda bir değer zaten var, ikisini birleştirelim mi?" onayı →
  birleştirme transaction'ı: eski değerin `ProductVariantOption` ve
  `ProductOptionImage` bağlantıları mevcut değere taşınır (aynı varyantta ikisi
  birden varsa `@@unique([variantId, valueId])` çakışmasını atlayarak), eski değer silinir.
- Audit log kaydı, `revalidatePath` + `revalidateCatalog()`.
- SKU'lara dokunulmaz (SKU sabit kimlik; eski beden adını içermesi sorun değil).
- Vega/Ticimax servisi (`src/app/Servis`) beden adını stok eşleştirmede kullanıyorsa
  ad değişikliğinin entegrasyonu bozmadığı doğrulanır (barkod/SKU ile eşleşiyorsa sorun yok).

Bu özellik gelince beden düzeltmesini kullanıcı panelden kendisi yapar:
`5-6 → 5-6 Yaş`, `6-7 → 6-7 Yaş`, `7-8 → 7-8 Yaş`, `910 → 9-10 Yaş`,
`112 → 11-12 Yaş`, `134 → 13-14 Yaş`, sonra yukarı/aşağı oklarla küçükten büyüğe sıralar.

### E. Excel aktarımında kalıcı düzeltme
Yeni çocuk Excel'i yüklendiğinde aynı hatalı bedenler tekrar oluşmasın diye
`excel-import.ts`'de beden normalizasyonu — **yalnız çocuk cinsiyetli satırlarda**
(yetişkin bedenleri `38`, `40`, `3032` gibi değerler etkilenmesin):
- `5-6`, `5-6Y`, `5-6 yaş` → `5-6 Yaş`
- Tire olmadan bitişik yazılmış ardışık sayılar: rakamları `a` ve `a+1` olacak
  şekilde ikiye böl → `56 → 5-6 Yaş`, `910 → 9-10 Yaş`, `112 → 11-12 Yaş`,
  `134 → 13-14 Yaş`. Ardışık bölünemeyen değer olduğu gibi kalır ve önizlemede uyarı verir.
- Zaten `... Yaş` olanlara dokunulmaz.
- Excel'de KOD4 sadece `KIDS` diyorsa kız/erkek ayrımı B maddesindeki aynı tahmin
  fonksiyonuyla (ürün adı → ürün kodu) yapılır; tahmin edilemezse `Çocuk` kalır ve
  aktarım önizlemesinde "cinsiyeti belirsiz" uyarısı görünür.
- Birim testleri: beden normalizasyonu ve cinsiyet tahmini için (`*.test.ts`, mevcut test düzeni).

## Uygulama sırası

1. Kod taraması: `gender`, `GENDER_OPTIONS`, `GENDER_SLUGS`, `"Çocuk"` geçen her yer.
2. D (varyant değeri yeniden adlandırma) — tek başına işe yarar, ilk bu.
3. A + C (cinsiyet değerleri, katalog grubu, menü).
4. B kuru çalıştırma → kullanıcıya liste → onay → `--uygula`.
5. E (Excel normalizasyonu + testler).
6. Localhost'ta kullanıcı kontrolü; her onaylanan adımdan sonra DEPLOY_STATUS/günlük
   güncellemesi + yerel commit; push yalnız kullanıcı söyleyince.

## Dikkat

- Ortak veritabanı: B `--uygula` ve beden adı değişikliği canlıda anında görünür.
  Kod canlıya çıkmadan cinsiyetler `Kız Çocuk/Erkek Çocuk`'a çevrilirse canlıdaki
  eski `/cocuk` sayfası bu ürünleri göstermez (şu an menüde zaten yok, etkisi küçük).
  Tercihen B `--uygula` push'tan hemen önce ya da hemen sonra çalıştırılır.
- Değer silme yerine yeniden adlandırma kullanılmalı: silmek varyant bağlantılarını koparır.

## Doğrulama

- `/cocuk`, `/kiz-cocuk`, `/erkek-cocuk` ve bir kategori alt sayfası doğru ürünleri listeliyor.
- Masaüstü ve mobil menüde Çocuk sekmesi ve iki sütun görünüyor; aktif vurgu doğru.
- Ürün detayında beden seçenekleri `5-6 Yaş ... 13-14 Yaş` sırasıyla görünüyor;
  sepete ekleme ve stok doğru varyantı buluyor.
- Varyant Özellikleri'nde yeniden adlandırma ve birleştirme çalışıyor, kullanım sayısı korunuyor.
- Örnek bir çocuk Excel satırıyla önizleme doğru beden/cinsiyet gösteriyor.
- `npm run lint`, typecheck ve testler geçiyor.
