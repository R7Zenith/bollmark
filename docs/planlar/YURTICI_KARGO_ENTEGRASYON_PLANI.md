# Yurtiçi Kargo Entegrasyon Planı

Tarih: 2026-11-10
Durum: Faz 1–4 tamamlandı ve canlıda (kapalı modda). Yurtiçi IP onayı geldi (2026-11-10). Faz 5 tamam (2026-11-11): canlıda oluştur → sorgula → iptal döngüsü çalıştı, bkz. "Faz 5 durumu" (Bölüm 6 sonu). **CANLIDA AÇIK (2026-11-11):** Vercel Production'a `YURTICI_MODE=live`, `YURTICI_GO_USERNAME`, `YURTICI_GO_PASSWORD`, `YURTICI_PROXY_URL`, `YURTICI_SYNC=on` (hepsi sensitive) eklendi; `ignoreCommand` redeploy'u iptal ettiği için HEAD'in (`5417a2c`) temiz worktree'sinden `vercel deploy --prod` ile yayınlandı. Sıradaki: Bölüm 7 madde 4, ilk gerçek sipariş birlikte izlenir. Sabit IP kararı: Bölüm 2 (Fixie + dükkan statik IP).

Kaynak: Yurtiçi'nin gönderdiği üç doküman ("Web Servis Giden Kargo Teknik Doküman V3", "Web Servis Gelen-Giden Kargo Raporu", "Erişim Yetkilendirme Formu") ve müşteri tanım maili (10 Kasım 2026).

> **Güvenlik:** Kullanıcı adı ve şifreler bu dosyaya, koda, commit'e ve günlüğe yazılmaz. Yalnız `.env` (yerel) ve Vercel ortam değişkenlerinde durur. Bu planda yalnız değişken ADLARI geçer.

---

## 1. Yurtiçi'nin verdiği hesap (özet)

- Müşteri kodu ve çıkış birimi: Karacabey şubesi (6069), Bursa Bölge Müdürlüğü.
- Müşteri ünvanı Yurtiçi'de "OĞUZHAN LEVENTOĞLU - LEVENTOĞLU BOLLMARK" olarak kayıtlı.
- Dört web servis kullanıcısı tanımlı. Ödeme tipini API almıyor, **hangi kullanıcıyla gönderirsen o ödeme tipi olur**:

| Kullanıcı | Ödeme tipi | Bollmark'ta kullanım |
|---|---|---|
| GÖ (Normal) | Gönderici öder | **Kullanılacak.** Sitede ödeme iyzico ile peşin, kargoyu biz ödüyoruz. |
| GÖ (Tahsilatlı Teslimat) | Gönderici öder + kapıda ödeme | Şimdilik yok (sitede kapıda ödeme yok). |
| AÖ (Normal) | Alıcı öder | Kullanılmayacak. |
| AÖ (Tahsilatlı Teslimat) | Alıcı öder + kapıda ödeme | Kullanılmayacak. |

İlk sürümde yalnız **GÖ (Normal)** kullanıcısı bağlanır. Kod, ileride kapıda ödeme eklenirse ikinci kullanıcıyı da alabilecek şekilde değişkenleri ayrı tutar ama o akışı şimdi yazmaz.

---

## 2. Engel: Yurtiçi sabit IP istiyor — KARAR: karma çözüm

Dokümana göre (Teknik Doküman V3, s.4 "Erişim Bilgileri" ve s.6 "Giden Kargo Entegrasyonu Süreç") Yurtiçi web servisine **yalnız önceden bildirilen sabit IP'lerden** erişilebiliyor (test ortamı dahil). Kullanıcı adı/şifre doğru olsa bile listede olmayan IP'den gelen istek reddedilir. Ticimax'ta bu sorun görülmüyordu çünkü Ticimax'ın kendi sunucu IP'leri Yurtiçi'de önceden tanımlıydı.

Bollmark Vercel'de çalışıyor; Vercel'in çıkış IP'si sabit değil.

### Karar (2026-11-10, kullanıcı onaylı)

| Nereden | Nasıl çıkar | Neden |
|---|---|---|
| **Canlı site (Vercel) + evdeki bilgisayar** | **Fixie** proxy üzerinden (sabit IP). Ücretsiz "Tricycle" planı: ayda 500 istek, 100 MB. Yetmezse "Commuter": 5 $/ay, 2.500 istek. | Ücretsiz, yönetilen, bakım yok. HTTPS uçtan uca tünellenir, şifre proxy'de açılmaz. |
| **Dükkan bilgisayarı** | **Doğrudan**, dükkanın TürkNet **statik IP**'sinden (proxy yok) | Dükkandaki denemeler proxy kotasını harcamaz. Fixie sorun yaşarsa yedek yol. |

Yurtiçi'ye bildirilecek Çıkış IP'leri: **dükkanın statik IP'si + Fixie'nin verdiği IP'lerin hepsi.**

Değerlendirilip elenenler: QuotaGuard (19 $/ay — Fixie ücretsizken gereksiz), Vercel Static IPs (100 $/ay, localhost'tan test edilemez), dükkan bilgisayarını canlı site için köprü yapmak (bilgisayar kapanınca/elektrik-internet kesilince kargo durur), Oracle ücretsiz sunucu (az kullanılan sunucuyu geri alıyor), Geliver gibi aracı platformlar (araya üçüncü firma girer; mevcut Yurtiçi anlaşmasıyla gereksiz).

### İstek bütçesi (Fixie ücretsiz planında kalmak için)

- Otomatik takip günde 4 kez, **tek toplu sorgu**; takip edilecek kargo yoksa Yurtiçi'ye **hiç istek atılmaz**.
- Toplu gönderimde birden çok sipariş tek `createShipment` çağrısında gider.
- "Durumu Şimdi Sorgula" butonu son sorgudan 60 sn geçmeden pasif.
- Geliştirme `mock` modda yapılır; gerçek test istekleri mümkünse dükkan bilgisayarından (proxy'siz).
- Tahmini kullanım ayda 200–300 istek. Fixie panelinden kullanım izlenir; 400'ü geçerse Commuter'a geçilir.

### Kullanıcının yapacakları (Claude Code değil)

1. **Dükkan IP kontrolü:** Dükkan bilgisayarından birkaç farklı zamanda (bir kez de modem yeniden başladıktan sonra) "IP adresim nedir" sitesine gir; çıkan IPv4 adresi TürkNet panelindeki statik IP ile hep aynı olmalı.
2. **Fixie:** usefixie.com'da hesap aç, ücretsiz planla bir uygulama oluştur (bölge seçimi sorulursa Avrupa). Panelde görünen **IP adreslerinin hepsini** ve **proxy URL'sini** al. Proxy URL'si gizlidir: yalnız `.env`'ye (evdeki bilgisayar) ve ileride Vercel'e girilir. Fixie'nin Vercel entegrasyonunu (Vercel Marketplace) **kurma**; değişkeni canlıya geçişte biz elle ekleyeceğiz.
3. **Erişim Yetkilendirme Formu'nu** doldurup satış temsilcisine gönder (Bölüm 3).
4. Yurtiçi "IP'ler tanımlandı" deyince Claude Code'a haber ver; test ortamı denemeleri (Bölüm 6) başlar.

---

## 3. Erişim Yetkilendirme Formu (doldurulacak)

| Alan | Değer |
|---|---|
| Müşteri Adı | OĞUZHAN LEVENTOĞLU - LEVENTOĞLU BOLLMARK (müşteri kodu maildeki gibi) |
| Çıkış IP | 1) Dükkanın TürkNet statik IP'si 2) Fixie panelindeki IP'lerin hepsi |
| Erişilen Kaynak | Giden Kargo Web Servisi – ShippingOrderDispatcherServices (createShipment, queryShipment, cancelShipment) — TEST ve CANLI |
| Sorumlu | Oğuzhan Leventoğlu |
| Telefon | (kullanıcı yazar) |
| E-Mail | (kullanıcı yazar) |

Form, API bilgilerini gönderen satış temsilcisine (Bursa Bölge Müdürlüğü) cevap olarak gönderilir; mailde test ortamının da aynı IP'lere açılması istenir.

---

## 4. Servis bilgileri (dokümandan)

- Protokol: **SOAP** (XML), namespace `http://yurticikargo.com.tr/ShippingOrderDispatcherServices`
- TEST: `https://testwebservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices?wsdl`
  - Ortak test kullanıcısı (dokümanda herkese açık): kullanıcı `YKTEST`, şifre `YK`, Gönderici Ödemeli.
- CANLI: `https://webservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices?wsdl`
- `userLanguage` / `wsLanguage`: `TR`

> Claude Code ilk iş olarak WSDL'yi (proxy üzerinden) indirip gerçek SOAP gövde biçimini ve operasyon adlarını oradan doğrulamalı. Dokümandaki örneklerde aynı işlem bazen `createShipment`, bazen `dispatch` diye geçiyor. Esas olan WSDL.

### 4.1 createShipment (gönderi oluştur)

Bizim için gerekli alanlar (`ShippingOrderVO`):

| Alan | Kural | Bollmark'tan |
|---|---|---|
| `cargoKey` (zorunlu, ≤20) | Bizim tekil kargo anahtarımız. Pakette barkod/yazı olarak bulunmalı, şube bunu okutur. | `orderNumber` (örn. `BLM261105-9473`, 14 karakter). Aynı sipariş iptal edilip yeniden gönderilirse sonuna `-2`, `-3`. |
| `invoiceKey` (zorunlu, ≤20, tekil) | Fatura anahtarı | `cargoKey` ile aynı |
| `receiverCustName` (zorunlu) | En az 5 karakter, en az 4 harf | `customerName` |
| `receiverAddress` (zorunlu) | 10–200 karakter. İl/ilçe ayrı gönderiliyorsa adreste tekrar yazılmaz. | `shippingAddress` |
| `cityName` / `townName` | ≤40 | `city` / `district` |
| `receiverPhone1` (zorunlu) | Alan koduyla **10 rakam**, başında 0 yok (örn. `5321234567`) | `customerPhone` → rakamları al, baştaki `90`/`0` at, 10 haneye indir; olmazsa hata ver, gönderme |
| `emailAddress` | Alıcı e-postası (Yurtiçi bilgilendirme SMS/mail atabilir) | `customerEmail` |
| `cargoCount` | Koli adedi | Varsayılan 1, admin değiştirebilir |
| `desi` / `kg` | Opsiyonel; yetki yoksa şube tartıp girer | Boş bırak (şube girer) |
| `description` | ≤255 | "Bollmark sipariş {orderNumber}" |

Dönüş: `outFlag` (0 = en az bir kayıt başarılı, 1 = hepsi hatalı, 2 = beklenmeyen hata), `jobId` (Yurtiçi talep no), satır bazında `errCode` (0 = başarılı) ve `errMessage`.

Önemli hata kodları: `60020` cargoKey zaten var (başka anahtarla tekrar dene), `82516` telefon hatalı, `82515` e-posta hatalı, `82502` adres uzunluğu, `936` beklenmeyen hata.

### 4.2 queryShipment (durum sorgula)

- Girdi: `keys` (dizi; birden çok anahtar tek çağrıda), `keyType=0` (kargo anahtarı), `addHistoricalData` (hareket geçmişi), `onlyTracking`.
- **Sınır:** Aynı sorgu 1 dakika içinde tekrarlanırsa servis hata fırlatıyor. Toplu ve seyrek sorgulanmalı.
- Dönüş (satır başına): `operationCode` / `operationStatus` / `operationMessage`, `docId` (Yurtiçi gönderi no), `trackingUrl` (selfservis takip linki), `deliveryDate`/`deliveryTime`, iade alanları (`rejectStatus`, `returnStatus`), hareketler (`invDocCargoVOArray`).

| operationStatus | Anlamı | Bollmark Shipment.status |
|---|---|---|
| `NOP` (0) | Kargo işlem görmemiş (veri gitti, paket şubeye gelmedi) | `HAZIRLANIYOR` |
| `ISR` (2) | Şube işlem yaptı, fatura henüz yok | `KARGOYA_VERILDI` |
| `IND` (1) | Teslimatta / yolda (iade isteği de bu kodla dönebilir) | `DAGITIMDA` (ilk kez görüldüğünde, `shippedAt` boşsa onu da doldur) |
| `DLV` (5) | Teslim edildi | `TESLIM_EDILDI` |
| `CNL` (3) / `ISC` (4) | İptal / önceden iptal | iptal edildi, kargo kaydı Yurtiçi'den ayrılır |
| `BI` (6) | Faturayı şube iptal etti | admin'e "dikkat" işareti |
| `rejectStatus` 0,1,2,3,9,10 | İade sürecinde | `IADE` + admin'e dikkat işareti |

### 4.3 cancelShipment (iptal)

- Girdi: `cargoKeys` (dizi).
- Yalnız şube gönderiyi düzenlemeden önce iptal olur (`CNL`). Düzenlenmiş gönderide iptal yerine **iade isteği** oluşur (`IND` döner). Admin arayüzü bu farkı açıkça göstermeli; düzenlenmiş gönderide iptal butonu "İade isteği gönder" uyarısıyla çalışmalı ya da hiç gösterilmemeli. Öneri: yalnız `NOP` durumunda göster.

### 4.4 Etiket

Yurtiçi API'si **etiket PDF'i vermiyor**. Doğru akış:

1. Biz `createShipment` ile veriyi gönderiyoruz.
2. Pakete **kendi etiketimizi** yapıştırıyoruz: üzerinde `cargoKey` barkodu (Code128) ve alıcı bilgileri olur.
3. Şube barkodu okutunca alıcı bilgileri ekranına gelir. Şube Yurtiçi'nin kendi barkodunu ve taşıma irsaliyesini basar.

Yani sitede "Kargo Etiketi Yazdır" sayfası olmalı: 10×7 cm termal, yatay (100 mm en × 70 mm boy; kullanıcının termal etiketi bu, 2026-11-10 kararı. Dükkandaki Argox OS-214 plus, Vega'nın ayarı bozulmasın diye Windows'a ikinci adla "Argox Bollmark" olarak eklendi: stok 100×70 mm, yön Dikey. Sayfa kodu `@page` boyutu vermez, etiket seçilen kağıdı doldurur; gerekirse "Etiketi 90° döndür" kutusu) ve A4'e 4'lü (normal yazıcı) seçenekleri. Etiketin içeriği: gönderici "BOLLMARK" + mağaza adresi/telefonu, alıcı ad/adres/il-ilçe/telefon, sipariş no, kargo anahtarı barkodu ve yazısı, koli adedi. Barkod sunucuda SVG olarak üretilir (küçük bir kütüphane, örn. `jsbarcode` + `xmldom` ya da saf TS Code128; bundle boyutuna dikkat).

### 4.5 Gönderici adı

API'de gönderici adı alanı yok. Yurtiçi'nin kendi irsaliyesinde gönderici olarak **Yurtiçi'deki müşteri ünvanı** çıkar ("OĞUZHAN LEVENTOĞLU - LEVENTOĞLU BOLLMARK"). Ünvanda Bollmark zaten geçiyor. Yalnız "BOLLMARK" görünsün isteniyorsa bunu Karacabey şubesinden ya da satış temsilcisinden istemek gerekir. Kodla değişmez. **Bizim etiketimizde** gönderici olarak "BOLLMARK" yazılır.

### 4.6 Gelen-Giden Kargo Raporu (getDispatchCargo)

Ayrı bir servis (`WsReportServices`, en çok 10 günlük tarih aralığı). İlk sürümde **kullanılmayacak**: `queryShipment` yeterli. Bu servis HTTP ve farklı port (8080/9090) kullanıyor, ayrıca IP izni gerekebilir. İleride toplu mutabakat gerekirse eklenir.

---

## 5. Sitede yapılacaklar

### 5.1 Ortam değişkenleri (yalnız adlar)

```
YURTICI_MODE=mock            # off | mock | test | live
YURTICI_GO_USERNAME=         # GÖ (Normal) web servis kullanıcı adı (live)
YURTICI_GO_PASSWORD=         # GÖ (Normal) web servis şifresi (live)
YURTICI_PROXY_URL=           # Fixie proxy URL'si. DOLUYSA istekler proxy'den, BOŞSA doğrudan çıkar.
                             # Dükkan bilgisayarında BOŞ (statik IP), evdeki bilgisayarda ve Vercel'de DOLU.
YURTICI_SYNC=on              # off yapılırsa cron sorgu yapmaz (acil kapatma)
```

- `test` modunda kullanıcı/şifre koddaki herkese açık `YKTEST`/`YK` olur, URL test adresidir.
- `mock` modunda hiçbir dış istek atılmaz. Sahte ama gerçekçi cevaplar döner (başarılı, hata 60020, telefon hatası, durum ilerlemesi NOP→ISR→IND→DLV). Arayüz IP onayı gelmeden yerelde tamamen denenebilir.
- `.env.example`'a adlar ve açıklamalar eklenir. Vercel'e ekleme **yalnız push zamanında, kullanıcı onayıyla**, Production ortamına yapılır.
- Proxy isteğe bağlıdır: `YURTICI_PROXY_URL` boşsa istek doğrudan gider (dükkan bilgisayarı). Admin kargo kartında küçük bir bilgi satırı hangi yoldan çıkıldığını gösterir ("Çıkış: Fixie" / "Çıkış: doğrudan"). Bağlantı hatası (IP izni yok, zaman aşımı) anlaşılır Türkçe mesajla gösterilir: "Yurtiçi bağlantıyı reddetti; bu bilgisayarın IP'si Yurtiçi'de tanımlı olmayabilir."
- Proxy yalnız Yurtiçi istekleri için kullanılır (`undici` `ProxyAgent`'ı yalnız bu fetch'e `dispatcher` olarak verilir). **Global dispatcher değiştirilmez**, iyzico/Neon/R2 istekleri proxy'den geçmez.

### 5.2 Veritabanı (yalnız eklemeli, kullanıcı onaylı)

Yerel ve canlı **aynı Neon veritabanını** kullanıyor. Şema değişikliği yalnız ekleme olur, uygulamadan önce kullanıcıya SQL/diff gösterilir ve onay alınır.

`Shipment` modeline eklenecek alanların hepsi nullable ya da varsayılanlı:

```
provider          String?    // "YURTICI" | null (elle girilen eski kayıtlar)
cargoKey          String?    @unique
ykJobId           String?
ykDocId           String?    // Yurtiçi gönderi no
ykOperationStatus String?    // NOP | ISR | IND | DLV | CNL | ISC | BI
ykOperationMessage String?
ykRejectStatus    String?
trackingUrl       String?
cargoCount        Int        @default(1)
ykSentAt          DateTime?
ykCancelledAt     DateTime?
ykLastSyncAt      DateTime?
ykLastError       String?
```

Mevcut `carrier` / `trackingCode` alanları kalır: Yurtiçi kaydında `carrier = "Yurtiçi Kargo"`, `trackingCode` = `docId` (Yurtiçi gönderi no; yoksa `cargoKey`). Böylece mevcut mailler ve sipariş durumu sayfası değişmeden çalışır.

### 5.3 Kod yapısı

- `src/lib/yurtici/config.ts`: mod, URL, kullanıcı seçimi, env okuma.
- `src/lib/yurtici/soap.ts`: XML gövdesi kurma (özel karakter kaçışı), proxy'li fetch (zaman aşımı ~15 sn), cevabı ayrıştırma. Ayrıştırma için hafif bir kütüphane (`fast-xml-parser`) ya da mevcut Vega SOAP kodunda kullanılan yöntem tercih edilir. Ağır `soap` paketi **kullanılmaz**.
- `src/lib/yurtici/client.ts`: `createShipment`, `queryShipments(keys[])`, `cancelShipment(keys[])`. Hata kodlarını Türkçe, anlaşılır mesajlara çevirir.
- `src/lib/yurtici/mock.ts`: mock cevaplar.
- `src/lib/yurtici/map.ts`: sipariş → `ShippingOrderVO` (telefon normalizasyonu, adres kırpma, ad kontrolü) ve operationStatus → Shipment.status eşlemesi.
- `src/lib/yurtici/*.test.ts`: telefon/adres normalizasyonu, durum eşlemesi, XML üretimi/ayrıştırma (dokümandaki örnek cevaplarla) testleri.
- Sunucu tarafında çalışır (Node runtime). Hiçbir şifre istemciye gitmez.

### 5.4 Admin arayüzü

**Sipariş detayı > Kargo kartı** (`/admin/siparisler/[id]`):

- Kargo kaydı Yurtiçi'ye gitmemişse ve sipariş ödenmişse: **"Yurtiçi'ye Gönder"** butonu ve koli adedi alanı (varsayılan 1). Gönderilmeden önce alıcı bilgileri gösterilir; telefon ya da adres kurala uymuyorsa buton yerine düzeltme uyarısı çıkar.
- Gönderildiyse: kargo anahtarı, Yurtiçi durumu (Türkçe), Yurtiçi gönderi no, takip linki, son sorgu zamanı ve şu butonlar: **"Etiketi Yazdır"**, **"Durumu Şimdi Sorgula"** (1 dakikalık sınıra saygılı; son sorgu 60 sn'den yeniyse pasif), **"Gönderiyi İptal Et"** (yalnız `NOP` iken, onay penceresiyle).
- Mevcut elle güncelleme formu "Elle düzenle" altında katlanmış olarak kalır (Yurtiçi dışı ya da acil durumlar için).
- Mod `mock` ya da `test` ise kartın üstünde belirgin bir **"TEST MODU – gerçek gönderi oluşmaz"** şeridi görünür.

**Kargolar sayfası** (`/admin/kargolar`):

- Yurtiçi durumu sütunu.
- Seçilen siparişleri **toplu "Yurtiçi'ye Gönder"** (tek SOAP çağrısında birden çok `ShippingOrderVO`) ve **toplu "Etiket Yazdır"** (A4'e 4'lü).

**Etiket sayfası**: `/admin/kargolar/etiket?ids=...`. Yazdırma için sade, `@media print` ayarlı bir sayfa (10×7 yatay termal ve A4-4'lü seçimi).

Her işlem denetim kaydına (audit log) yazılır.

### 5.5 Otomatik durum takibi (cron)

- Yeni cron: `/api/cron/yurtici-takip`.
- Sıklık: **günde 4 kez** (Türkiye saatiyle yaklaşık 10:00, 13:00, 16:00, 19:00; UTC'ye çevrilerek `vercel.json`'a yazılır). Neon compute kotası sıkışık olduğu için saatlik **yapılmaz**.
- Tek çağrıda, takipte olan tüm anahtarlar sorgulanır: Yurtiçi gönderisi olup durumu `DLV`/`CNL`/`ISC` olmayan ve son 30 gün içinde gönderilmiş kayıtlar. Takip edilecek kayıt yoksa DB'ye tek ucuz sorgu atılıp çıkılır.
- Durum değişince:
  - İlk kez `ISR` ya da `IND` görüldüğünde: Shipment `KARGOYA_VERILDI` (gerekirse `DAGITIMDA`), `shippedAt` dolar, sipariş `SHIPPED` olur, **"Kargoya verildi" maili** (mevcut `notifyCustomerStatusChange(order, "SHIPPED")`) **bir kez** gider. Mailde takip linki varsa Yurtiçi `trackingUrl`'i kullanılır.
  - `DLV` olduğunda: `TESLIM_EDILDI`, `deliveredAt` = Yurtiçi teslim tarih/saati, sipariş `DELIVERED`, **"Teslim edildi" maili** bir kez.
  - İade, `BI` ya da hata durumunda: siparişe `needsAttention` + açıklama yazılır. Müşteriye otomatik mail gitmez.
- Mail tekrarını önlemek için durum geçişi yalnız "önceki durum farklıysa" yapılır (idempotent).
- Cron, mevcut cron'lar gibi `CRON_SECRET` ile korunur. `YURTICI_SYNC=off` iken hiçbir şey yapmaz.

### 5.6 Müşteri tarafı

- Sipariş durumu sayfası ve Hesabım > Siparişlerim: kargo firması, Yurtiçi gönderi numarası ve **"Kargomu Takip Et"** linki (Yurtiçi selfservis `trackingUrl`). Bu alanlar yalnız gerçekten varsa gösterilir.
- Mailler (`02-kargoya-verildi`, `03-teslim-edildi`): tasarım değişmez, yalnız takip linki/numarası doğru veriyle dolar.

---

## 6. Yurtiçi'nin test süreci (dokümana göre zorunlu)

IP onayı geldikten sonra:

1. `YURTICI_MODE=test` ile yerelden bir **test gönderisi** oluşturulur (gerçek olmayan, "TEST ALICI" adıyla).
2. Dönen `cargoKey`, Yurtiçi Bilgi Sistemleri'ne mail ile bildirilir.
3. Yurtiçi test ortamında bu gönderiyi düzenler.
4. Bizim taraf `queryShipment` ile durumu çeker; arayüzde ve DB'de doğru göründüğü kontrol edilir.
5. İkinci bir test gönderisi `cancelShipment` ile iptal edilip `CNL` sonucu görülür.
6. Sonuç Yurtiçi'ye bildirilir, canlıya geçiş onayı alınır.

**Test gönderileri canlı DB'ye yazılmamalı.** Test modunda `createShipment` için sipariş kaydına dokunmayan ayrı bir admin "Yurtiçi bağlantı testi" ekranı (ya da `scripts/yurtici-test.ts` script'i) kullanılır. Gerçek siparişlerin Shipment kaydı test cargoKey'iyle kirletilmez.

---

### Faz 5 durumu – TAMAMLANDI (2026-11-11)

- **Bağlantı tamam:** Fixie IP'leri Yurtiçi'de tanımlı. Test WSDL'i Fixie'den de dükkan bilgisayarından doğrudan da indi (WSDL herkese açık olabilir; tek başına kanıt değil). **Canlı** ortamda GÖ kullanıcımızla salt-okuma `queryShipment` (var olmayan anahtar) Fixie üzerinden "Başarılı" döndü, satırda 82519 "kargo anahtarı bulunmamaktadır": canlıda kimlik + IP çalışıyor.
- **WSDL doğrulaması** (`scripts/yurtici-test.ts wsdl`, çıktı `scripts/output/yurtici-wsdl/`, git'e girmez): operasyonlar `createShipment` / `queryShipment` / `cancelShipment`, document/literal, soapAction '', iç elemanlar namespace'siz. Düzeltilen: `ShippingOrderVO`'da zorunlu `taxOfficeId`, `ttDocumentId`, `dcSelectedCredit`, `dcCreditRule` (0) şema sırasıyla eklendi; sonuç seviyesindeki `errCode`/`outResult` (kayıt dönmeyen hata) okunuyor. Cevap yapıları ayrıştırıcıyla uyumlu.
- **Engel, test ortamı kullanıcısı yok:** test ortamında GÖ kullanıcımız tanımlı değil (1625, "kayıtlı kullanıcı yok"); dokümandaki ortak `YKTEST` kullanıcısı var ama şifresi artık dokümandaki gibi değil ("kullanıcı ve parola örtüşmüyor"). Test gönderisi oluşturulamadı.
- **Kullanıcıdan beklenen:** yetki onayını gönderen temsilciye cevap maili: test ortamı kullanıcı adı/şifresi; veremezlerse "canlıda kendimize bir test gönderisi oluşturup şubeye vermeden iptal etmemiz uygun mu?".
- **Cevap gelince:**
  - Test kullanıcısı verilirse: değerler yalnız `.env`'ye; kod şu an test modunda `YKTEST`/`YK` sabit kullanıyor, bunun için `YURTICI_TEST_USERNAME` / `YURTICI_TEST_PASSWORD` env'leri eklenecek. Sonra `scripts/yurtici-test.ts olustur` (Fixie) → anahtar Yurtiçi Bilgi Sistemleri'ne → Yurtiçi işler → `sorgula`; ikinci gönderi `olustur --dogrudan` + `iptal` → CNL.
  - Canlıda test onaylanırsa: canlıda kullanıcının kendisine tek gönderi (DB'ye yazmayan script ile), Yurtiçi'de kontrol, şubeye vermeden `iptal` (NOP → CNL).
  - Sonra Bölüm 7 (Vercel env'leri kullanıcı onayıyla, `YURTICI_MODE=live`).
- **Yurtiçi cevabı (2026-11-11):** yalnız "IP'ler tanımlı" dendi, test kullanıcısı verilmedi. Kullanıcı kararıyla canlıda test + iptal yapıldı.
- **Canlı deneme (2026-11-11, `olustur/sorgula/iptal --canli`, Fixie, DB'ye yazılmadı):** `BLMTEST261111-1221` oluşturuldu (outFlag 0, jobId 7860393) → sorgu `NOP` "Kargo İşlem Görmemiş" → iptal `CNL` "Verisi İptal Edilmiştir. Kargo Çıkışı Engellendi" → tekrar sorguda 82519 (anahtar artık yok). Şubeye bir şey verilmedi, kargo bedeli yok. Gerçek ilk siparişte ISR/IND/DLV geçişleri ayrıca izlenecek (Bölüm 7 madde 4).
- `scripts/yurtici-test.ts`'e `--canli` eklendi (CANLI ortam + GÖ kullanıcısı; oluşturunca iptal komutunu hatırlatır).
- Fixie kullanımı: 2026-11-10 4 istek, 2026-11-11 4 istek.

## 7. Canlıya geçiş

1. Yurtiçi testleri onaylar.
2. Kullanıcı onayıyla Vercel Production'a env'ler eklenir: `YURTICI_MODE=live`, `YURTICI_GO_USERNAME`, `YURTICI_GO_PASSWORD`, `YURTICI_PROXY_URL` (Fixie, Vercel'de zorunlu), `YURTICI_SYNC=on`.
3. Push (kullanıcı söyleyince).
4. İlk gerçek siparişte: Yurtiçi'ye Gönder → etiketi yazdır → paketi Karacabey şubesine ver → şube barkodu okutunca durum `ISR`/`IND` olur → "kargoya verildi" maili gider. Bu tur birlikte izlenir.
5. Acil kapatma: `YURTICI_SYNC=off` otomatik takibi durdurur. `YURTICI_MODE=off` Yurtiçi butonlarını gizler ve kargo kartı eski elle düzenleme formuna döner.

---

## 8. Kapsam dışı (şimdilik)

- Kapıda ödeme (tahsilatlı teslimat) ve AÖ kullanıcıları.
- Müşteri iade kargosu için Yurtiçi iade kodu (RMA'ya bağlama). Ayrı bir iş olarak sonra planlanır.
- getDispatchCargo raporu.
- Desi/kg gönderme (şube tartıyor).

---

## 9. Fazlar ve onay noktaları

| Faz | İçerik | Onay |
|---|---|---|
| 1 | `lib/yurtici` (config, soap, client, mock, map) + testler + `.env.example` | Testler yeşil; kullanıcıya özet |
| 2 | DB alanları (eklemeli) | **SQL kullanıcıya gösterilir, onaydan sonra uygulanır** |
| 3 | Admin: sipariş kargo kartı, kargolar sayfası toplu işlemler, etiket sayfası (mock modda) | Kullanıcı localhost'ta görür ve onaylar → DEPLOY_STATUS + günlük güncellenir → yerel commit |
| 4 | Cron + durum geçişleri + müşteri sayfası/mail takip linki (mock modda ilerleme simülasyonu ile) | Localhost onayı → yerel commit |
| 5 | Test modu: WSDL doğrulama, Yurtiçi test süreci (Bölüm 6) | IP onayı geldikten sonra |
| 6 | Canlıya geçiş (Bölüm 7) | Kullanıcı "push et" demeden push yok |
