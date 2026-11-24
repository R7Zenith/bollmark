# Meta katalog akışı: sezon etiketi (custom_label_1) raporu

Tarih: 2026-11-24. Kaynak: localhost `/feed/meta.xml` çıktısı (canlıyla aynı Neon veritabanı) ve veritabanından salt okuma.

## Sezon veritabanında nerede tutuluyor

- **`Season` tablosu**: `id`, `name` (tekil, panelde görünen ad), `rank` (katalog sıralaması), `isCurrent`. Admin panelindeki "Sezonlar" ekranı bu tabloyu yönetir.
- **`Product.seasonId`**: ürün düzeyinde, boş bırakılabilir tek bir yabancı anahtar (`Product.season` ilişkisi). Varyantlarda (`ProductVariant`) sezon alanı yok.
- Sonuç: bir ürünün **en fazla bir** sezonu olabilir. Birden fazla sezon atanamaz, bu yüzden " | " ile birleştirme hiç devreye girmez.
- Tanımlı sezonlar (tüm durumlardaki ürün sayısıyla): `2026 Yaz` (172), `2027 Kış` (333) ve ayrıca **`HER SEZON` (4)**. Üçüncü sezon brifte geçmiyordu ama panelde tanımlı; akışa adıyla aynen çıkıyor.

## Akışta ne değişti

- `src/lib/merchant-feed.ts`: Meta formatında her `<item>`'a `<g:custom_label_1>` eklendi. Değer ürünün sezon adı; sezonu yoksa `sezonsuz`. Aynı `item_group_id`'nin tüm varyantları aynı değeri alır (değer ürün düzeyinden gelir).
- Mevcut alanların hiçbiri değişmedi. `custom_label_0` kullanılmadı. Google akışı (`/feed/google.xml`) değişmedi.
- Akış XML ayrıştırıcıyla doğrulandı (geçerli). Türkçe karakterler UTF-8 olarak çıkıyor (ör. `2027 Kış`).

## custom_label_1 değerlerine göre sayılar

Akış yalnız yayındaki (PUBLISHED), görseli ve varyantı olan ürünleri içerir: 509 ürün kodu, 2.401 varyant. Kontrol: veritabanındaki 509 yayındaki ürünün hepsi akışta, ürün kodları tekil.

| custom_label_1 | Ürün kodu | Varyant | Stokta varyantı olan ürün kodu | Stokta varyant |
|---|---:|---:|---:|---:|
| 2027 Kış | 330 | 1.507 | 329 | 1.245 |
| 2026 Yaz | 157 | 714 | 152 | 357 |
| sezonsuz | 18 | 171 | 18 | 141 |
| HER SEZON | 4 | 9 | 4 | 9 |
| **Toplam** | **509** | **2.401** | **503** | **1.752** |

## Birden fazla sezona atanmış ürünler

Yok. Şema buna izin vermiyor (`Product.seasonId` tek değer).

## "2026 Yaz" sezonundaki ürünler (157)

product_type'a göre sıralı. "Stokta varyant" = stok > 0 olan varyant sayısı. Listede parfüm, gömlek, pantolon gibi yazlık olmayan ürünler de var; gerekirse panelden sezonları değiştirilebilir.

| Ürün kodu | Ürün adı | product_type | Stokta varyant |
|---|---|---|---:|
| 6SAM60001AA | Erkek Parfüm Sierra Redwood 100 ML | Erkek > Aksesuar > Parfüm | 0 |
| 6SAM60020AA | Erkek Parfüm Coastal Line Woods 100 ML | Erkek > Aksesuar > Parfüm | 1 |
| 6SAM60021AA | Erkek Parfüm Coastal Line Aromatic 100 ML | Erkek > Aksesuar > Parfüm | 1 |
| 6SAM60012HW | Regular Fit Klasik Yaka Pamuklu Kısa Kollu Gömlek | Erkek > Gömlek | 10 |
| 6SAM60013HW | Pamuklu Klasik Yaka Regular Fit Kısa Kollu Gömlek | Erkek > Gömlek | 1 |
| 6SAM60022HW | Regular Fit Düğmeli Yaka Uzun Kollu Keten Gömlek | Erkek > Gömlek | 4 |
| 6SAM60044HW | Regular Fit Kısa Kollu Dokulu Klasik Yaka Gömlek | Erkek > Gömlek | 3 |
| 6SAM60122HW | Regular Fit Kısa Kollu Devrik Yaka Pamuklu Çizgili Gömlek | Erkek > Gömlek | 3 |
| 6SAM60139HW | Regular Fit Düğmeli Klasik Yaka Uzun Kollu Keten Gömlek | Erkek > Gömlek | 2 |
| 6SAM40275ND | Pamuklu Cepli Beli Bağcıklı Bol Oversize Jogger Jean Pantolon | Erkek > Kot Pantolon | 0 |
| MARTIN 831-02 | Martin Fit Jean Pantolon | Erkek > Kot Pantolon | 6 |
| MARTIN 831-03 | Düz Paça Normal Bel Jean Pantolon - Martin Fit | Erkek > Kot Pantolon | 5 |
| 6SAM40003HW | Regular Fit Beli Lastikli Düğmeli Düz Paça Keten Karışımlı Chino Pantolon | Erkek > Pantolon | 5 |
| 6SAM40005HW | Viskon Cep Detaylı Duble Paça Beli Bağcıklı Pantolon | Erkek > Pantolon | 6 |
| 6SAM40079HW | Viskon Karışımlı Cepli Slim Fit Kumaş Pantolon | Erkek > Pantolon | 6 |
| 6SAM40082HW | Regular Fit Viskon Karışımlı Cepli Beli Bağcıklı Kumaş Pantolon | Erkek > Pantolon | 2 |
| 6SAM10005MK | Regular Fit Kısa Kollu Bisiklet Yaka Basic Pamuklu Tişört | Erkek > Tişört | 1 |
| 6SAM10007MK | Regular Fit Kısa Kollu Dokulu Polo Yaka Tişört | Erkek > Tişört | 3 |
| 6SAM10024NK | Rahat Kesim Kısa Kollu Baskılı Polo Yaka Spor Tişört | Erkek > Tişört | 3 |
| 6SAM10025NK | Rahat Kesim Reglan Kısa Kollu Bisiklet Yaka Spor Tişört | Erkek > Tişört | 5 |
| 6SAM10045MK | Regular Fit Bisiklet Yaka Kısa Kollu Pamuklu Arkası Baskılı Tişört | Erkek > Tişört | 2 |
| 6SAM10064MK | Regular Fit Kısa Kollu Bisiklet Yaka Pamuklu Baskılı Tişört | Erkek > Tişört | 5 |
| 6SAM10066MK | Pamuklu Kısa Kollu Bisiklet Yaka Baskılı Slim Fit Tişört | Erkek > Tişört | 1 |
| 6SAM10083NK | Kısa Kollu Bisiklet Yaka Rahat Kalıp Baskılı Spor Tişört | Erkek > Tişört | 3 |
| 6SAM10092NK | Regular Fit Bisiklet Yaka Kısa Kollu Basic Spor Tişört | Erkek > Tişört | 7 |
| 6SAM10093MK | Pamuklu Kısa Kollu Pike Kumaş Çizgi Detaylı Slim Fit Polo Yaka Tişört | Erkek > Tişört | 2 |
| 6SAM10118NK | Rahat Kalıp Kısa Reglan Kollu Bisiklet Yaka Baskılı Spor Tişört | Erkek > Tişört | 3 |
| 6SAM10274MK | Pamuklu Regular Fit Kısa Kollu Baskılı Bisiklet Yaka Tişört | Erkek > Tişört | 2 |
| 6SAM10280MK | Regular Fit Kısa Kollu Bisiklet Yaka Pamuklu Kontrast Detaylı Baskılı Tişört | Erkek > Tişört | 3 |
| 6SAM10285MK | Bisiklet Yaka Viskon Karışımlı Kısa Kollu Basic Slim Fit Tişört | Erkek > Tişört | 3 |
| 6SAM10293MK | Pamuklu Kısa Kollu Pike Kumaş Düğmeli Polo Yaka Slim Fit Tişört | Erkek > Tişört | 1 |
| 6SAM10425MK | Bisiklet Yaka Rahat Kalıp Viskon Karışımlı Tok Scuba Kumaş Kısa Kollu Tişört | Erkek > Tişört | 1 |
| 6SAM10458MK | Pamuklu Regular Fit Kısa Kollu Renk Kontrastlı Polo Yaka Tişört | Erkek > Tişört | 2 |
| 6SAM10462MK | Viskon Karışımlı Kısa Kollu Regular Fit Polo Yaka Tişört | Erkek > Tişört | 1 |
| 6SAM10476MK | Regular Fit Viskon Karışımlı Kısa Kollu Bisiklet Yaka Basic Tişört | Erkek > Tişört | 5 |
| 6SAM40010NW | Bermuda Pamuklu Cepli Beli Bağcıklı Müslin Şort | Erkek > Şort | 3 |
| 6SAM40038ND | Pamuklu Normal Bel Cepli Slim Fit Jean Şort | Erkek > Şort | 2 |
| 6SAM40055NK | Viskon Karışımlı Cepli Bermuda Beli Bağcıklı Spor Şort | Erkek > Şort | 2 |
| 6SAM40061NK | Pamuklu Rahat Kalıp Cepli Beli Lastikli Spor Şort | Erkek > Şort | 4 |
| 6SAM40078NK | Rahat Kalıp Pamuklu Cepli Beli Bağcıklı Spor Şort | Erkek > Şort | 2 |
| 6SAM40089NK | Straight Fit Cepli Bermuda Beli Bağcıklı Spor Şort | Erkek > Şort | 3 |
| 6SAM40126NK | Straight Fit Beli Bağcıklı Baskılı Spor Şort | Erkek > Şort | 3 |
| 6SAM40128HW | Düğmeli Bağcıklı Pamuk Keten Karışımlı Yazlık Şort | Erkek > Şort | 6 |
| 6SAM40387ND | Normal Bel Pamuklu Bermuda Straight Fit Jean Şort | Erkek > Şort | 6 |
| 6SAM40390ND | Straight Fit Pamuklu Cepli Beli Bağcıklı Jean Şort | Erkek > Şort | 7 |
| 6SAK60061AA | Kadın Parfüm Matcha Bloom 100 ML | Kadın > Aksesuar > Parfüm | 1 |
| 6SAK70001AA | Yuvarlak Sedef Görünümlü Taşlı İnce Bilezik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70012AA | Boncuklu İp ve Zincir 4'lü Bileklik Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70039AA | Kadın Taş Detaylı 9'lu Küpe Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70067AA | Kadın Taş Detaylı Kare Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70071AA | Kadın Sallantılı İncili Çiçek Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70111AA | Kadın Taş Detaylı Charmlı Çelik 8'li Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70131AA | Kadın Taş Detaylı 6'lı Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 2 |
| 6SAK70133AA | Kadın Taş Detaylı Burgu 7'li Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 3 |
| 6SAK70140AA | Kadın Taş Detaylı 7'li Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 3 |
| 6SAK70153AA | Kadın 6'lı Çelik Küpe Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70165AA | Kadın Çok Renkli Taş Detaylı Charmlı Kolye | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70171AA | Kadın Sallantılı Zincir Bileklik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70174AA | Kadın Taş Detaylı Bileklik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70214AA | Kadın Lastikli Saç Tokası | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70228AA | Kadın Yonca Detaylı Bileklik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70231AA | Kadın Metal Charm Detaylı İnce Zincir Bileklik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70233AA | Kadın Taş Detaylı 4'lü Bileklik Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70240AA | Kadın Çiçek Detaylı Zincir Bileklik | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70289AA | Kadın Taş Detaylı Charmlı Sallantılı Halka Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70293AA | Kadın Çok Renkli Boncuklu Sallantılı Yıldız Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70298AA | Kadın Çiçek Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70314AA | Kadın Çok Renkli Sallantılı Meyve Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70318AA | Kadın Çiçekli Büyük Boy Damla Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70333AA | Kadın Sallantılı Çiçek Küpe | Kadın > Aksesuar > Takı & Bijuteri | 0 |
| 6SAK70351AA | Kadın Boncuk Detaylı Deniz Yıldızı Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70383AA | Kadın Çelik Karışımlı Sallantılı Büyük Boy Hasır Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70423AA | Kadın Boncuklu Kolye | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70466AA | Kadın Çok Renkli Kiraz Charmlı İnci Kolye | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70467AA | Kadın Çok Renkli Boncuklu Yıldız Charmlı Kolye | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70471AA | Kadın Çelik Karışımlı Taş Detaylı 5'lı Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 2 |
| 6SAK70492AA | Kadın Çok Renkli Taşlı 5'li Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 2 |
| 6SAK70512AA | Kadın 20'li Lastik Toka Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70564AA | Kadın Çelik Karışımlı Taş Detaylı Charmlı Kolye | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70565AA | Kadın 4'lü İnci Boncuk Detaylı Bileklik Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70593AA | Kadın Fiyonklu Saç Tokası | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK70783AA | Kadın Çok Renkli Boncuklu Halka Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70460AA | Kadın Sallantılı Küpe Çok Renkli Taş Detaylı | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70560AA | Kadın Çelik Karışımlı Taş Detaylı Burgu 8'li Küpe Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70757AA | Kadın Zincir Bileklik Taş Detaylı Sallantılı | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70759AA | Kadın 2'li Zincir Bileklik Seti İnci Boncuk Detaylı | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70788AA | Kadın Çelik Halka Küpe Sarmal | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70800AA | Kadın Çelik Karışımlı İnci Detaylı Soyut Küpe | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70825AA | Kadın Taşlı Heart Charm Detaylı 7'li Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6WAK70835AA | Kadın 10'lu Yüzük Seti | Kadın > Aksesuar > Takı & Bijuteri | 1 |
| 6SAK30097AA | Kadın Çizgili Ahşap Saplı Tote Çanta | Kadın > Aksesuar > Çanta | 0 |
| 6SAK30099AA | Kadın Çizgili Saplı Askılı Hasır El Çantası | Kadın > Aksesuar > Çanta | 1 |
| 6SAK60068PW | Bağlamalı Fiyonk Detaylı Kısa Kollu Dokulu Peplum Bluz | Kadın > Bluz | 1 |
| 6SAK60319PW | Bisiklet Yaka Kısa Balon Kollu Saten Bluz | Kadın > Bluz | 3 |
| 6SAK60342PW | Viskon Kumaş Bağlama Detaylı V Yaka Kısa Kollu Çizgili Crop Balon Bluz | Kadın > Bluz | 2 |
| 6SAK50056UW | Regular Fit Uzun Kollu Crop Blazer Ceket | Kadın > Ceket | 2 |
| 6SAK80011UW | Kemer Detaylı Kloş Kruvaze Yaka Kolsuz Keten Karışımlı Midi Elbise | Kadın > Elbise | 4 |
| 6SAK80016EW | Bol Kalıp V Yaka Cepli Ayarlanabilir Askılı Modal Midi Elbise | Kadın > Elbise | 1 |
| 6SAK80019UW | Aerobin Kumaş Kısa Yarasa Kollu Kemerli Kruvaze Midi Saten Elbise | Kadın > Elbise | 3 |
| 6SAK80029PW | Keten Görünümlü Kalp Yaka Düğmeli İp Askılı Midi Elbise | Kadın > Elbise | 4 |
| 6SAK80070FW | Koton X Sibil Çetinkaya - Tek Omuz Kolsuz Puantiyeli Saten Mini Balon Elbise | Kadın > Elbise | 3 |
| 6SAK80132EW | Modal Cupro Kumaş Kısa Kollu Düğmeli Kemerli Gömlek Elbise | Kadın > Elbise | 4 |
| 6SAK80191PW | Keten Karışımlı Slim Fit Drapeli Yuvarlak Yaka Metal Aksesuarlı Kolsuz Mini Elbise | Kadın > Elbise | 1 |
| 6SAK80210UW | Şifon Kolsuz Kemerli Midi Puantiyeli Pileli Gömlek Elbise | Kadın > Elbise | 2 |
| 6SAK80216EW | Viskon Askılı Gipe Detaylı Kare Yaka Puantiyeli Elbise | Kadın > Elbise | 5 |
| 6SAL80014IW | Kolsuz Bağlamalı Yaka Volanlı Çizgili Kloş Mini Askılı Elbise | Kadın > Elbise | 4 |
| 6SAL80052IW | U Yaka Bağlama Detaylı Volanlı Kolsuz Mini Keten Karışımlı Elbise | Kadın > Elbise | 2 |
| 6SAL80178IW | Kolsuz Slim Fit Fiyonk Detaylı Halter Yaka Mini Balon Elbise | Kadın > Elbise | 1 |
| 6SAL80228IW | A Kesim Keten Karışımlı Kalp Yaka Kolsuz Uzun Elbise | Kadın > Elbise | 5 |
| 6SAK70174EW | Viskon Salda Kumaş Belden Oturtmalı Fiyonklu Çiçekli Midi Kloş Etek | Kadın > Etek | 1 |
| 6SAK70210EW | Viskon Salda Kumaş Bağlama Detaylı Belden Oturmalı Çizgili Midi Etek | Kadın > Etek | 1 |
| 6SAK70223PW | Viskon Karışımlı Bağlamalı Kemerli Cepli Çizgili Midi Etek | Kadın > Etek | 3 |
| 6SAK60002EW | Regular Fit Düğmeli Viskon Kısa Kollu Gömlek | Kadın > Gömlek | 3 |
| 6SAK60165EW | Viskon Kumaş Klasik Yaka Bağlama Detaylı Kısa Kollu Oversize Gömlek | Kadın > Gömlek | 2 |
| 6SAK60178EW | Viskon Salda Kumaş Regular Fit Klasik Yaka Kısa Kollu Gömlek | Kadın > Gömlek | 3 |
| 6SAK60282UW | Uzun Kollu Klasik Yaka Pamuklu Çizgili Oversize Gömlek | Kadın > Gömlek | 6 |
| 6SAK60293PW | Kontrast Detaylı Uzun Kollu Crop Çizgili Oversize Gömlek | Kadın > Gömlek | 1 |
| 6SAK60306PW | Regular Fit Uzun Kollu Kaçık Yaka Modal Kumaş Gömlek | Kadın > Gömlek | 2 |
| 6SAL40072MW | Normal Bel Dar Kalıp Cepli Düğmeli Kısa İspanyol Paça Puantiyeli Pantolon - Kick Flare Jeans | Kadın > Kot Pantolon | 2 |
| 6SAL40301MD | Taş Detaylı Düz Paça Normal Bel Pamuklu Baggy Denim Pantolon - Baggy Jeans | Kadın > Kot Pantolon | 4 |
| VIOLA 9473 | Palazzo Jean Pantolon | Kadın > Kot Pantolon | 4 |
| 6SAK00001MM | Biyeli Kontrast Detaylı İpli Bikini Altı | Kadın > Mayo & Bikini | 3 |
| 6SAK00037MM | Aksesuar Detaylı Yüksek Bel Bikini Altı | Kadın > Mayo & Bikini | 4 |
| 6SAK00154MM | Kroşe Detaylı Bikini Altı | Kadın > Mayo & Bikini | 2 |
| 6SAK00171MM | Yan Bağlamalı İpli Çizgili Bikini Alt | Kadın > Mayo & Bikini | 2 |
| 6SAK00172MM | Yanları Bağlamalı İpli Kroşe Detaylı Dokulu Bikini Altı | Kadın > Mayo & Bikini | 2 |
| 6SAK10005MM | Çıkarılabilir Askı Detaylı Straplez Bandeau Bikini Üstü | Kadın > Mayo & Bikini | 1 |
| 6SAK10033MM | Aksesuarlı Çapraz Askılı Bikini Üstü | Kadın > Mayo & Bikini | 2 |
| 6SAK10172MM | Kroşe Detaylı Üçgen Bikini Üst | Kadın > Mayo & Bikini | 3 |
| 6SAK10194MM | Boyundan Bağlamalı Çizgili Üçgen Bikini Üst | Kadın > Mayo & Bikini | 3 |
| 6SAK10196MM | Önden Bağlama Detaylı Dokulu Kroşe Detaylı Bikini Üstü | Kadın > Mayo & Bikini | 1 |
| 6SAK20008MM | U Yaka İnce Askılı Mayo | Kadın > Mayo & Bikini | 3 |
| 6SAK20023MM | U Yaka Kalın Askılı Kroşe Detaylı Mayo | Kadın > Mayo & Bikini | 3 |
| 6SAK20047MM | U Yaka İnce Askılı Mayo | Kadın > Mayo & Bikini | 3 |
| 6SAK20079MM | Boyundan Bağlamalı Zebra Desenli Halter Yaka Mayo | Kadın > Mayo & Bikini | 3 |
| 6SAK20088MM | Halka Detaylı Derin V Yaka Askılı Mayo | Kadın > Mayo & Bikini | 2 |
| 6SAK20098MM | Boncuk Detaylı Tek Omuz Çizgili Mayo | Kadın > Mayo & Bikini | 2 |
| 6SAK20099MM | İnce Askılı Mayo | Kadın > Mayo & Bikini | 4 |
| 6SAK40062PW | Viskon Kumaş Bağlama Detaylı Cepli Pileli Geniş Paça Palazzo Pantolon | Kadın > Pantolon | 5 |
| 6SAK40147EW | Cepli Kemerli Çizgili Geniş Paça Kumaş Pantolon | Kadın > Pantolon | 1 |
| 6SAK40148EW | Viskon Salda Kumaş Cepli Geniş Paça Desenli Pantolon | Kadın > Pantolon | 3 |
| 6SAK40203PW | Modal Kumaş Beli Lastikli Cepli Düz Geniş Paça Pantolon | Kadın > Pantolon | 2 |
| 6SAK40240PW | Beli Lastikli Bağlamalı Geniş Paça Pantolon | Kadın > Pantolon | 1 |
| 6SAK40386UW | TROUSERS | Kadın > Pantolon | 0 |
| 6SAL40080IW | Cepli Kemer Detaylı Viskon Karışımlı Geniş Paça Pantolon | Kadın > Pantolon | 3 |
| 6SAK50072EK | Regular Fit Kısa Kollu Bisiklet Yaka Pamuklu Deniz Kabuğu Baskılı Tişört | Kadın > Tişört | 1 |
| 6SAL10529IK | Slim Fit Kısa Kollu Bisiklet Yaka Baskılı Tişört | Kadın > Tişört | 2 |
| 6SAL10890IK | Slim Fit Pamuklu Kısa Kollu Bisiklet Yaka Çiçek Baskılı Tişört | Kadın > Tişört | 1 |
| 6SAL10934IK | Pamuklu Taş Detaylı Bisiklet Yaka Kısa Kollu Limon Baskılı Tişört | Kadın > Tişört | 4 |
| 6SAK20056UW | Metal Aksesuarlı Oversize Kruvaze Yelek | Kadın > Yelek | 1 |
| 6SAK20123UW | Keten Karışımlı Cep Detaylı Bisiklet Yaka Kolsuz Düğmeli Uzun Yelek | Kadın > Yelek | 2 |
| 6SAK30003PW | Önden Bağlamalı Fiyonk Detaylı Yuvarlak Yaka Viskon Crop Yelek | Kadın > Yelek | 2 |
| 6SAK40008UW | Cepli Yüksek Bel Pileli Keten Karışımlı Bermuda Şort | Kadın > Şort | 2 |
| 6SAK40046UW | Cepli Yüksek Bel Keten Karışımlı Bermuda Şort | Kadın > Şort | 3 |
| 6SAL40005MD | Pamuklu Yüksek Bel Slim Fit Duble Paça Mini Denim Şort | Kadın > Şort | 1 |
| 6SAL40244MD | Pamuklu Cepli Düğmeli Istakoz Nakış Detaylı Mini Denim Şort | Kadın > Şort | 2 |
| 6SAL40246MD | Pamuklu Yüksek Bel Taş Detaylı Mini Denim Şort | Kadın > Şort | 1 |

## "sezonsuz" kalan ürünler (18)

Bunlara panelden sezon atanacak.

| Ürün kodu | Ürün adı | Marka | product_type | Stokta varyant |
|---|---|---|---|---:|
| SA14LE120 | ZEKKO Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 9 |
| SA15LE177 | OLEKS Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 14 |
| SA16LE148 | FUN Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 9 |
| SA16LE171 | DELGADO Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 11 |
| SA16LE172 | DAWNEY Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 12 |
| SA24RE013 | ZEX Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 7 |
| SA25LE041 | OBINA Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 7 |
| SA26LE047 | FESKA Erkek Spor Ayakkabı | Slazenger | Erkek > Aksesuar > Ayakkabı | 10 |
| 6SAM60019AA | Erkek Parfüm Coastal Line Fresh 100 ML | KOTON | Erkek > Aksesuar > Parfüm | 1 |
| SA16RG010 | GENESIS Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 10 |
| SA16RG012 | SORIA Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 14 |
| SA16RG026 | EMEKA Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 7 |
| SA16RK001 | FOREIGN G Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 13 |
| SA24RK003 | ZEX Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 8 |
| SA25LK039 | INDIA Spor Ayakkabı | Slazenger | Kadın > Aksesuar > Ayakkabı | 3 |
| SX16CE005 | JARA 3 lü Çorap | Slazenger | Unisex > Aksesuar > Çorap | 1 |
| SX16CK006 | JESTER 3 lü Çorap | Slazenger | Unisex > Aksesuar > Çorap | 3 |
| SX16CK007 | JOYRIDE 3 lü Çorap | Slazenger | Unisex > Aksesuar > Çorap | 2 |
