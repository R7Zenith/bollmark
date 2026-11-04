# Müşteri Detay Sayfası — Araştırma ve Claude Code Promptu (2026-11-04)

## Kullanıcının isteği

Panelde müşteriye tıklayınca sadece sipariş sayfasına gidiyor. Adres, telefon,
IP ve IP konumunu gösteren, bilgilerin düzenlenebildiği bir müşteri detay
sayfası isteniyor.

## Kodda tespit edilenler

1. **Detay sayfası aslında var ama işe yaramıyor.**
   `src/app/(admin)/admin/musteriler/[id]/page.tsx` mevcut, ancak yalnızca Kalp
   Topla için yazılmış: doğrulama durumu, kuponlar, kalpler, bonus kredileri,
   onaylar ve cihaz eşleşmeleri gösteriliyor. Telefon, adres, sipariş geçmişi
   ve harcama özeti yok, düzenleme de yapılamıyor.
2. **Müşteri adına tıklamak siparişlere gidiyor.**
   `src/components/admin/customers-table.tsx`, isim linki
   `/admin/siparisler?q=<email>`. Detay sayfasına giden "Detay" linki sağ uçta,
   sadece hesabı olan müşterilerde görünüyor.
3. **Misafir müşterilerin hiç sayfası yok.** Liste, siparişlerden e-postaya göre
   gruplanıyor. Hesabı olmayanların bilgisi sadece `Order` satırlarında
   duruyor (`customerName`, `customerPhone`, `shippingAddress`, `city`,
   `district`, `postalCode`).
4. **Hesaplı müşteride düzenlenecek veri hazır:** `Customer` (`name`, `email`,
   `phone`) ve `CustomerAddress` (`label`, `name`, `phone`, `address`, `city`,
   `district`, `postalCode`, `isDefault`).
5. **Gerçek IP sistemde bilerek tutulmuyor.** `CustomerDevice` sadece tuzlanmış
   SHA-256 özetini (`ipHash`) saklıyor ve 90 gün sonra siliniyor. `Order` için
   şemada "IP SAKLANMAZ" yazıyor (Meta CAPI bağlamında). Ham IP yalnızca
   `MarketingConsentLog.ip` alanında var (pazarlama onayı ispatı için). Yani
   **geçmiş müşterilerin IP'si ve konumu geri getirilemez.** Bu ancak bundan
   sonraki siparişler ve girişler için kaydedilmeye başlanabilir.
6. **Konum için dış servis gerekmiyor.** Vercel her isteğe ücretsiz
   `x-vercel-ip-country`, `x-vercel-ip-country-region` ve `x-vercel-ip-city`
   başlıklarını ekliyor. `@vercel/functions` paketindeki `ipAddress()` ve
   `geolocation()` bunları okuyor. Bu başlıklar localhost'ta gelmez, sadece
   deploy ortamında dolar.

## Önerilen tasarım

- Müşteri adına tıklayınca detay sayfası açılsın: hesaplı müşteri için
  `/admin/musteriler/[id]`, misafir için `/admin/musteriler/misafir?email=...`.
- Detay sayfası sırası: kimlik kartı, özet kartlar, adresler, sipariş geçmişi,
  IP ve konum, ardından mevcut Kalp Topla bölümleri (kaldırılmıyor, alta iniyor).
- Düzenleme sadece hesaplı müşteride yapılabilsin: ad, telefon, e-posta ve
  adresler (ekleme, düzenleme, silme, varsayılan yapma). Misafir sayfası salt
  okunur olsun, çünkü veri siparişlerde saklanıyor ve geçmiş siparişler
  değiştirilmemeli.
- IP için ileriye dönük kayıt: sipariş anında `Order` tablosuna, giriş ve
  kayıtta `CustomerDevice` tablosuna ham IP ve Vercel konumu yazılsın.
  `CustomerDevice` zaten 90 günde temizleniyor. Siparişteki IP için 2 yıllık
  saklama süresi önerilir.
- IP ve konum bölümü ile düzenleme yetkisi sadece ADMIN rolünde açık olsun.

## KVKK notu (kod dışı, kullanıcının yapacağı)

Ham IP kişisel veridir. Kaydetmeye başlamadan önce sitedeki Gizlilik ve KVKK
Aydınlatma Metni'ne (panel, Yasal Sayfalar) bir madde eklenmeli. Örnek madde:
"Sipariş ve üyelik işlemlerinde, dolandırıcılığın önlenmesi ve yasal
yükümlülükler için IP adresiniz ve bundan türetilen yaklaşık konum (il/ülke)
kaydedilir; sipariş IP'leri 2 yıl, giriş kayıtları 90 gün saklanır."
Avukat değilim, metnin son hali için hukuki destek almanız iyi olur.

## Claude Code'a verilecek prompt

```
Bollmark admin panelinde gerçek bir müşteri detay sayfası yapacağız. Önce
projedeki skill'leri kontrol et, uygun olanları kullan.

## Mevcut durum (incelendi)
- src/components/admin/customers-table.tsx: müşteri adına tıklayınca
  /admin/siparisler?q=<email> sayfasına gidiyor. "Detay" linki sadece hesaplı
  müşterilerde, sağ uçta.
- src/app/(admin)/admin/musteriler/[id]/page.tsx var ama sadece Kalp Topla
  verisi gösteriyor (kuponlar, kalpler, bonus kredileri, onaylar, cihaz
  eşleşmeleri). Telefon, adres, sipariş geçmişi yok, düzenleme yok.
- Misafir müşterilerin (Customer kaydı olmayan, sadece Order'dan gelen) hiç
  detay sayfası yok.
- Ham IP hiçbir yerde tutulmuyor: CustomerDevice sadece ipHash (90 gün),
  Order'da IP yok. Geçmiş kayıtların IP'si geri getirilemez, bundan sonrası
  için kayda başlayacağız.

## 1. Liste: isme tıklayınca detay sayfası açılsın
customers-table.tsx:
- İsim linki: hesaplı müşteride (row.id varsa) /admin/musteriler/{id},
  misafirde /admin/musteriler/misafir?email={encodeURIComponent(email)}.
- Sağdaki "Detay" linkini kaldır (isim zaten detaya gidiyor). Puan düzeltme
  bileşeni (CustomerPointsAdjust) yerinde kalsın.
- Detay sayfasında "Siparişlerini gör" linki olsun
  (/admin/siparisler?q=<email>), eski davranış oradan erişilebilir kalsın.

## 2. Hesaplı müşteri detay sayfası (/admin/musteriler/[id])
Sayfayı yeniden düzenle. Mevcut Kalp Topla kartlarını (Doğrulama, Kuponlar,
Kalpler, Bonus kredileri, Onaylar, Cihaz eşleşmeleri) ve actions.ts içindeki
kupon iptal/uzatma action'larını SİLME. Onları sayfanın en altına, "Kalp
Topla" başlığı altında topla. Üst kısım şöyle olsun:

a) Başlık + kimlik kartı: ad, e-posta, telefon (yoksa "Kayıtlı değil"),
   "Hesaplı" rozeti, kayıt tarihi, sadakat puanı, e-posta doğrulama durumu.
   Sağ üstte "Düzenle" butonu.
b) Özet kartları (mevcut StatCard bileşeni): sipariş sayısı, toplam harcama,
   ortalama sepet tutarı, son sipariş tarihi. Hesap: deletedAt: null olan
   siparişler, customerId = id VEYA customerEmail = müşterinin e-postası
   (müşteri hesap açmadan önce misafir olarak verdiği siparişler de sayılsın).
   Müşteri listesindeki toplam harcama hesabıyla aynı mantığı kullan, iki
   sayfada sayılar tutarsız çıkmasın.
c) Adresler kartı:
   - Kayıtlı adresler (CustomerAddress): etiket, alıcı adı, telefon, açık
     adres, ilçe/il, posta kodu, "Varsayılan" rozeti.
   - Altında "Siparişlerde kullanılan adresler": müşterinin siparişlerindeki
     shippingAddress+district+city+postalCode birleşimlerinden tekrarsız liste,
     her biri kaç siparişte ve en son ne zaman kullanıldığı ile. Kayıtlı bir
     adresle birebir aynıysa tekrar gösterme.
d) Sipariş geçmişi kartı: sipariş no (sipariş detayına link), tarih, durum
   rozeti (siparişler sayfasındaki durum etiketleri/rozetleriyle aynı),
   ödeme durumu, tutar, teslimat ili. En yeni üstte, en fazla 50 satır,
   fazlası için "Tümünü gör" linki.
e) IP ve konum kartı (sadece ADMIN rolü görsün, bkz. madde 5):
   - Son sipariş IP'si + konumu (il, bölge, ülke) + tarih.
   - Son giriş/kayıt IP'si + konumu + tarih (CustomerDevice'tan).
   - Altında son 20 kayıt (sipariş ve giriş karışık, tarihe göre): tür
     (Sipariş/Giriş/Kayıt), IP, konum, tarih. Aynı IP birden fazla görünüyorsa
     sayısıyla grupla.
   - Kayıt yoksa: "Bu müşteri için IP kaydı yok. IP kaydı <özelliğin yayına
     girdiği tarih> itibarıyla tutuluyor." (Tarihi sabit yazma, en eski
     kayıttan ya da bir sabitten türet, hangisi temizse.)
   - Konum boşsa (localhost ya da Vercel başlığı gelmemişse) "Konum bilgisi
     yok" yaz.

## 3. Düzenleme (sadece hesaplı müşteri, sadece ADMIN)
"Düzenle" butonu bir form açsın (aynı sayfada modal ya da
/admin/musteriler/[id]/duzenle, projedeki mevcut admin form desenine hangisi
uyuyorsa). Server action'lar actions.ts'e eklensin, hepsi requireAdmin ile.

- Ad, telefon, e-posta düzenlenebilsin.
  - E-posta: trim + küçük harf, format kontrolü, başka bir Customer'da varsa
    "Bu e-posta başka bir hesapta kayıtlı" hatası. Formda uyarı: "E-posta
    değişirse müşteri bundan sonra yeni e-postasıyla giriş yapar."
    E-posta değişirse emailVerifiedAt null yapılmasın; sadece admin
    değiştirdiği için doğrulanmış kabul edilsin mi yoksa sıfırlansın mı,
    kodda emailVerifiedAt'in nerede kullanıldığına (Kalp Topla) bak ve bana
    öner, karar vermeden uygulama.
  - Telefon: mevcut checkout/hesap formundaki telefon doğrulama/normalize
    fonksiyonu varsa onu kullan, yenisini yazma.
  - passwordHash'e kesinlikle dokunma.
- Adresler: ekle, düzenle, sil, "Varsayılan yap". Varsayılan yapılınca aynı
  müşterinin diğer adreslerinde isDefault=false olsun (transaction içinde).
  İl/ilçe alanı için checkout'ta kullanılan il/ilçe seçim bileşeni ve verisi
  varsa onu yeniden kullan.
- Geçmiş siparişlerdeki ad/telefon/adres bilgilerine DOKUNMA (sipariş anındaki
  kayıt olarak kalmalı). Formda küçük bir not: "Değişiklikler geçmiş
  siparişleri etkilemez."
- Her değişiklik audit log'a yazılsın: lib/audit-actions.ts'e
  CUSTOMER_UPDATED, CUSTOMER_ADDRESS_CREATED, CUSTOMER_ADDRESS_UPDATED,
  CUSTOMER_ADDRESS_DELETED ekle. Detayda hangi alanın eskiden neye
  değiştiği olsun (şifre gibi hassas alan yok zaten).
- İşlem sonrası mevcut ?sonuc= desenindeki gibi başarı/hata mesajı göster.

## 4. Misafir müşteri sayfası (/admin/musteriler/misafir?email=...)
- Yeni sayfa: src/app/(admin)/admin/musteriler/misafir/page.tsx. (Statik
  "misafir" segmenti [id]'den önce eşleşir; yine de çakışma olmadığını test et.)
- E-posta ile deletedAt: null siparişleri çek. Siparişi yoksa notFound().
- Bu e-postayla bir Customer hesabı varsa misafir sayfası yerine
  /admin/musteriler/{id}'ye yönlendir.
- Gösterilecekler: en son siparişteki ad ve telefon (farklı siparişlerde
  farklı ad/telefon kullanılmışsa hepsini tekrarsız listele), "Misafir"
  rozeti, aynı özet kartları, siparişlerde kullanılan adresler, sipariş
  geçmişi, IP ve konum kartı (sadece sipariş IP'leri).
- Salt okunur. Üstte açıklama: "Misafir müşterinin bilgileri siparişlerinde
  saklanır. Teslimat bilgisini değiştirmek için ilgili siparişi açın."
- Hesaplı ve misafir sayfası aynı kartları kullansın: ortak bileşenleri
  src/components/admin/customer-detail/ altına çıkar, kod tekrarlanmasın.

## 5. IP ve konum kaydı (bundan sonrası için)
Paket: @vercel/functions (yoksa ekle). ipAddress(request) ve
geolocation(request) kullan. Header'a doğrudan erişilen yerlerde (server
action vb.) next/headers ile x-real-ip, yoksa x-forwarded-for'un ilk değeri;
x-vercel-ip-city decodeURIComponent ile çözülsün. Bunu tek bir yardımcıya
topla: src/lib/client-ip.ts → getClientIpInfo(): { ip, city, region, country }.
Localhost'ta hepsi null dönebilir, hata vermesin.

Migration (eklemeli, mevcut veri bozulmaz):
- Order: clientIp String?, ipCity String?, ipRegion String?, ipCountry String?
- CustomerDevice: ip String?, ipCity String?, ipRegion String?, ipCountry String?

Yazma noktaları:
- Sipariş oluşturan route (orders route'u, $transaction içinde Order
  create edilen yer): yeni alanları doldur. Mevcut kupon/stok/ödeme
  akışına başka hiçbir şekilde dokunma.
- CustomerDevice'ın yazıldığı yerler (kayıt ve giriş, ipHash'in hesaplandığı
  yer): ipHash'i olduğu gibi bırak, yanına ham ip ve konumu da yaz.
- Order şemasındaki "IP SAKLANMAZ" yorumunu güncelle: bu not Meta CAPI
  bağlamı için doğru kalmalı (CAPI'ye IP gönderilmiyor), ama artık Order'da
  ayrı bir clientIp alanı olduğunu belirt.

Saklama süresi:
- CustomerDevice zaten 90 günde silinen bir temizlikle çalışıyor; o temizliği
  bul, yeni alanlar da onunla gidiyor, ek iş yok, sadece doğrula.
- Order IP alanları için: aynı temizlik işine (cron/route), createdAt'i 2
  yıldan eski siparişlerde clientIp/ipCity/ipRegion/ipCountry'yi null'layan
  bir adım ekle. Böyle bir cron yoksa ekleme, bana söyle.

## 6. Yetki
- lib/roles.ts ve requireAdmin'e bak. Müşteri detayını PERSONEL görebiliyorsa
  görebilsin, ama IP ve konum kartı ile tüm düzenleme butonları/action'ları
  sadece ADMIN'de görünsün ve çalışsın (sunucu tarafında da kontrol et,
  sadece butonu gizlemek yetmez).

## 7. Mobil
Yeni kartlar mobilde (375px) taşmasın: tablolar overflow-x-auto, kimlik kartı
ve özet kartları sm: altında tek sütun. Mevcut admin mobil desenine uy.

## 8. Test
1. npx prisma migrate dev ile migration, ardından npx tsc --noEmit,
   npm run lint, npm run build hatasız geçsin.
2. Localhost'ta kontrol:
   - Listeden hesaplı ve misafir müşteri adına tıkla, doğru sayfalar açılıyor mu.
   - Hesaplı müşteride ad/telefon/e-posta düzenle, başka hesabın e-postasını
     girince hata veriyor mu, adres ekle/düzenle/sil/varsayılan yap.
   - Düzenleme sonrası eski siparişlerin bilgileri değişmemiş mi.
   - Audit log (İşlem Geçmişi) sayfasında yeni kayıtlar görünüyor mu.
   - Localhost'tan test siparişi ver: Order.clientIp dolu mu (::1 ya da
     127.0.0.1 olabilir), konum boş ve sayfada "Konum bilgisi yok" yazıyor mu.
   - PERSONEL rolüyle girince IP kartı ve düzenleme görünmüyor mu, action'ı
     doğrudan çağırınca reddediliyor mu.
   - 375px genişlikte yatay taşma yok mu.
3. Bulguları, ekran görüntülerini ve emailVerifiedAt önerini özetle.

## Çalışma kuralları
- Değişiklikleri önce localhost'ta göreceğim. Ben onaylamadan commit atma.
- Onay verip "yerel commit at" dediğimde: önce deploy status dosyasını bu
  işle güncelle, sonra yerel commit at. Ben söylemeden push etme.
```
