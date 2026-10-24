# Anasayfa Alt Bölüm Yenileme Planı

Tarih: 2026-10-22
Durum: uygulandı (2026-10-23), üç faz da push edildi. Mağaza fotoğrafları (`public/magaza/`) henüz konmadı; konmazsa mağaza kartı yalnız metinle görünür
Kapsam: `src/app/(site)/page.tsx` içinde **Yeni Gelenler bölümünün altındaki her şey**.
Hero ve Yeni Gelenler'e DOKUNULMAZ.
Görsel tartışma sayfası (mockup'lar): https://claude.ai/artifact/XkD95XVDNqMkBaZAEF5evR

## Neden

Yeni Gelenler'in altındaki bölümlerde 8 stok fotoğraf var: editoryal ikili, Özel Koleksiyonlarımız kartları
ve geniş lookbook. Bu fotoğraflar sitede satılan ürünler değil, ışıkları ve renkleri birbirini tutmuyor.
Telefonda yaklaşık 3–4 ekran boyunca hiç ürün görünmüyor. Ürün yüklense de bölümler hiç değişmiyor.

**İlke:** Anasayfadaki her görsel ya gerçek bir ürün fotoğrafı ya da mağazanın gerçek fotoğrafı olacak.
Bölümlerin çoğu kendini ürün verisinden dolduracak.

## Kullanıcı kararları (2026-10-22)

1. Yeni sıralama onaylandı.
2. Kategori bölümünde hem yuvarlak şerit hem 2×2 kutular olacak.
3. Kombini Tamamla bölümü yapılacak.
4. Siteden alınan ürün **yalnızca Karacabey mağazasında** değiştirilebilir. Bu bilgi sitede yazılabilir.
5. Bütçe eşikleri 490 / 990 / 1.490 TL olacak, çünkü mağazanın fiyatları bu kalıpta.
6. Mağaza fotoğraflarını kullanıcı çekip verecek. Instagram kareleri hesaptan otomatik çekilecek.

## Yeni sıralama

| # | Bölüm | Kaynak | Faz |
|---|---|---|---|
| – | Hero + Yeni Gelenler | (dokunulmuyor) | – |
| 1 | Kayan güven bandı | metin + aktif kampanya | 1 |
| 2 | Kategori şeridi (yuvarlak) + Kadın/Erkek/Çocuk/… kutuları | ürün verisi | 1 |
| 3 | Çok Satanlar (sıra numaralı) | ürün verisi (mevcut) | 1 |
| 4 | Kombini Tamamla | admin'den seçilen kombin | 2 |
| 5 | Bütçene Göre | ürün verisi + katalog fiyat filtresi | 1 |
| 6 | Kampanya bandı / Sezonun Renkleri | kampanya + renk verisi | 1 |
| 7 | Karacabey mağazası + Instagram | mağaza fotoğrafları + Instagram API | 1 (mağaza), 3 (Instagram otomatik) |
| 8 | SSS | mevcut + değişim sorusu | 1 |

Kaldırılanlar: editoryal ikili, Özel Koleksiyonlarımız (stok fotoğraflı 5 kart), geniş lookbook.

## Faz 1 – Otomatik bölümler

### 1. Kayan güven bandı
- Yeni Gelenler'in hemen altında tam genişlikte, ince, siyah zeminli, yavaş kayan bir şerit.
- `prefers-reduced-motion` açıksa animasyon olmaz.
- Metinler: "1.500 TL üzeri ücretsiz kargo" (eşik `SHIPPING_THRESHOLD_CENTS`'ten okunur, elle yazılmaz),
  "14 gün içinde iade", "iyzico ile güvenli ödeme", "Karacabey mağazamızda değişim".
- Aktif otomatik kampanya varsa (`campaignPercent > 0`) en başa "Sezon fırsatı: %X'e varan indirim" eklenir.

### 2. Kategori şeridi + cinsiyet kutuları
- Başlık: "Ne arıyorsun?"
- **Yuvarlak şerit:** yatayda kayar, telefonda kaydırma çubuğu görünmez. Yayında ürünü olan aktif alt
  kategorilerden en çok ürünü olan ~8 tanesi gösterilir; sıralama `sortOrder`'a göredir.
  - Görsel önceliği: kategorinin `imageUrl`'i doluysa o kullanılır. Değilse o kategorideki en yeni, yayında
    ve görselli ürünün ilk görseli kullanılır.
- **Kutular:** Kadın, Erkek, Çocuk, Ayakkabı, Aksesuar. Üst köşede ürün sayısı yazar; bugünkü sayım
  mantığı ve `ALWAYS_SHOWN_COLLECTIONS` kuralı korunur.
  - Görsel önceliği: Ayakkabı/Aksesuar kategorilerinin `imageUrl`'i doluysa o kullanılır. Değilse o
    gruptaki en yeni, görselli ürün (mümkünse `isFeatured` olan) kullanılır.
  - Telefonda kutular 2 sütun olur. Kart sayısı tekse son kart tam genişlik alır. Masaüstünde hepsi tek satırdadır.
- `public/anasayfa/koleksiyon-*.jpg` ve `editoryal-*.jpg` stok dosyaları silinir; `KAYNAKLAR.md` güncellenir.

### 3. Çok Satanlar
- Sekme ve ürün seçim mantığı aynen kalır.
- Her kartın sol üst köşesine büyük, italik serif (`font-accent`) sıra numarası 1, 2, 3… eklenir.
- Bölüm sayfada kategori şeridinin hemen altına taşınır.

### 5. Bütçene Göre
- Başlık: "Bütçene göre". Dört tipografik kutu, fotoğraf kullanılmaz:
  - ₺490 ve altı → `/urunler?fiyat-max=490`
  - ₺990 ve altı → `/urunler?fiyat-max=990`
  - ₺1.490 ve altı → `/urunler?fiyat-max=1490`
  - İndirimdekiler → `/urunler?indirimli=1`
- Her kutuda canlı ürün sayısı yazar. Sayım katalog filtresiyle aynı kuralı kullanır (renk başına kart).
  Sayısı 0 olan kutu gizlenir.
- Eşikler tek bir sabit dizide durur, ileride kolayca değiştirilebilir.

### 6. Kampanya bandı / Sezonun Renkleri (lookbook'un yerine)
- Aktif otomatik kampanya varsa siyah zeminde büyük yazı gösterilir: "%X'e varan indirim". Oran bugünkü
  `campaignPercent` hesabından gelir.
  - Oranı en yüksek kampanyanın `expiresAt`'i doluysa gün, saat ve dakika olarak geri sayım görünür.
    Geri sayım istemci bileşenidir; süre dolunca kendini gizler.
  - Buton "İndirimleri gör" yazar ve `/urunler?indirimli=1` adresine gider.
- Kampanya yoksa aynı yerde "Sezonun renkleri" görünür: güncel sezon ürünlerinde en çok kartı olan
  6 renk (renk adı + hex). Her renk `/urunler?renk=<ad>` adresine gider. Hex'i olmayan renk atlanır.
- `public/anasayfa/lookbook-genis.jpg` silinir.

### 7. Karacabey mağazası (Faz 1 kısmı)
- Bugünkü `FaqAndStore` içindeki mağaza kartı ayrı bir bölüm olur. Başlık: "Karacabey'de bir mağaza".
- Mağaza fotoğrafları `public/magaza/` klasöründe durur (1 geniş + 2–3 küçük). Fotoğraf yoksa yalnız
  metin kartı görünür; boş kutu ya da stok fotoğraf gösterilmez.
- Metin: adres, telefon/e-posta, "Siteden aldığınız ürünleri Karacabey mağazamızda değiştirebilirsiniz.",
  "Yol tarifi" ve "İletişim" butonları.
- Instagram ızgarası bu bölümün altına taşınır. Faz 3'e kadar bugünkü elle eklenen dosya mantığı çalışır.

### 8. SSS
- Yeni soru eklenir: "Ürünü mağazada değiştirebilir miyim?" Cevap: siteden alınan ürünler yalnızca
  Karacabey mağazamızda değiştirilebilir.
- Bu soru FAQ JSON-LD'ye de eklenir.

## Faz 2 – Kombini Tamamla

- Mevcut `Bundle` modeli genişletilir; yeni bir indirim sistemi yazılmaz:
  - `imageUrl` (kombin fotoğrafı, R2'ye yüklenir)
  - `showOnHome` (Boolean)
  - `homeSortOrder` (Int)
  - `hotspots` (Json: `[{ productId, x, y }]`, x ve y fotoğrafın yüzdesi)
- Admin `/admin/bundle-kampanyalari` ekranına şunlar eklenir:
  - fotoğraf yükleme
  - "Anasayfada göster" seçeneği
  - fotoğrafa tıklayarak her ürünün noktasını yerleştirme
- Anasayfa bölümü:
  - Solda (telefonda üstte) 4:5 fotoğraf ve üzerinde "+" noktaları. Noktaya dokununca ürün adı ve fiyatı
    görünür, tıklayınca ürüne gidilir.
  - Yanında ürün listesi: küçük görsel, ad, fiyat.
  - Altta buton: "Kombini sepete ekle · %X indirim". Buton her ürünün varsayılan/stoktaki ilk varyantını
    ekler; bedeni seçilmesi gereken ürün varsa ürün sayfasına yönlendirir. Mevcut sepet ekleme mantığı
    incelenip ona uygun yapılır.
- İndirim zaten `resolveBundleDiscount` ile sepette hesaplanıyor, ekstra iş yok.
- Anasayfada gösterilecek aktif kombin yoksa ya da kombindeki bir ürün yayında değilse bölüm gizlenir.
- Birden fazla kombin seçilmişse yatay kaydırmalı gösterilir.

## Faz 3 – Instagram'dan otomatik kare çekme

**Kullanıcının bir kez yapması gerekenler:**
1. Instagram hesabı (koton.karacabey) **profesyonel hesap** (İşletme veya İçerik Üreticisi) olmalı.
2. developers.facebook.com'da bir uygulama açılmalı ve "Instagram API with Instagram Login" ürünü eklenmeli.
3. Kendi hesabı uygulamaya eklenip panelden erişim anahtarı (token) üretilmeli. Kendi hesabı olduğu için
   uygulama incelemesi (App Review) gerekmez.
4. Token admin panele yapıştırılmalı. Dosyaya ya da sohbete YAZILMAZ.

**Kod:**
- Token veritabanında şifreli saklanır (`lib/payment/crypto.ts` deseni). Uzun ömürlü token 60 gün geçerlidir;
  her çalışmada token 24 saatten eskiyse `refresh_access_token` ile yenilenir.
- Günde 1 kez çalışan iş:
  - `graph.instagram.com/me/media` ile son paylaşımları alır: `id, media_type, media_url, thumbnail_url,
    permalink, caption, timestamp`. Videolarda kapak görseli (`thumbnail_url`) kullanılır.
  - Son 6 görseli R2'ye kopyalar. Instagram'ın görsel adresleri zamanla geçersiz olduğu için doğrudan kullanılmaz.
  - Kayıtları veritabanına yazar ve anasayfayı tazeler.
- Vercel planının cron limiti kontrol edilir. Yeni cron eklenemiyorsa iş mevcut günlük cron'a bağlanır.
- Izgara her kareyi kendi Instagram paylaşımına bağlar; alt metin paylaşım açıklamasının ilk cümlesidir.
- Token yoksa ya da API hata verirse son başarılı kareler gösterilir; hiç kare yoksa bölüm gizlenir.
  Bugünkü elle dosya koyma yolu yedek olarak kalır.
- Admin Ayarlar'da Instagram durumu görünür: bağlı mı, son çekim zamanı, token bitiş tarihi.

## Genel kurallar

- Telefon görünümü önceliklidir. Her bölüm önce 390px genişlikte kontrol edilir.
- Görsel dil mevcut temayla aynı kalır: monokrom renkler, Poppins, italik vurgu için Cormorant,
  hap butonlar, `pb-section` ritmi. Yeni renk ya da font eklenmez.
- Tüm veri sorguları sayfanın mevcut tek `Promise.all`'una eklenir; ardışık await kullanılmaz.
  `revalidate = 3600` korunur.
- Hiçbir bölüm uydurma rakam ya da sahte görsel göstermez. Veri yoksa bölüm gizlenir.
