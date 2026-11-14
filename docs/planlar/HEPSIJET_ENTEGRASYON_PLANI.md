# HepsiJET Kargo Entegrasyonu Planı

Tarih: 2026-11-14
Kaynak: HepsiJET "RETAIL TR Documentation" (Postman) + HepsiJET Product Management'tan gelen "Test Ortam Bilgileri" maili.
Durum: Test ortamı aşaması. HepsiJET, canlıya geçmeden önce **STD (Standart Teslimat) test gönderilerinin** iletilmesini istiyor.

> Kimlik bilgileri (kullanıcı adı / şifre / adres ID) bu dosyaya **yazılmaz**; yalnız yerel `.env`'de durur (`.gitignore`'da `.env*` var).

---

## 1. Hedef

Yurtiçi Kargo entegrasyonunun yanına ikinci kargo firması olarak HepsiJET eklenir. Admin, sipariş detayında kargo firmasını seçer (Yurtiçi / HepsiJET), "HepsiJET'e gönder" der, etiketi (PDF) yazdırır, durum otomatik takip edilir, müşteri sipariş durumunda takip linkini görür.

Mevcut Yurtiçi yapısı (`src/lib/yurtici/*`, `Shipment.provider`, `yurtici-shipment-card.tsx`, `/api/cron/yurtici-takip`) **örnek alınır, bozulmaz**.

## 2. API özeti (dokümandan)

| İş | Metot | Yol | Not |
|---|---|---|---|
| Token | POST | `/auth/token` | Body `{username,password}` → `data.token`. TTL 60 dk. |
| Gönderi oluştur (etiketsiz) | POST | `/delivery/sendDeliveryOrder` | Sadece "OK" döner. **Önerilen.** |
| Gönderi oluştur (ZPL'li) | POST | `/delivery/sendDeliveryOrderEnhanced` | Anında ZPL döner. |
| Etiket (PDF/PNG/JPEG) | POST | `/delivery/barcodes-label?format=PDF` | Body `{ "barcodes": ["<customerDeliveryNo>"] }` |
| Etiket (ZPL) | GET/POST | `/delivery/generateZplBarcode/{barkod}/{totalParcels}` | Termal ZPL yazıcı için |
| Takip | POST | `getDeliveryTracking` (tam yol koleksiyon JSON'undan doğrulanacak) | Body `{ "deliveries": [{ "customerDeliveryNo": "..." }] }` — çoklu sorgu destekli |
| İptal/Sil | — | `/delivery/deleteDeliveryOrder/{barkod}` (metot doğrulanacak) | Yalnız kurye **toplamadan önce**. |
| Güncelleme | — | `/delivery-update` | Faz 2 |
| Adres sözlüğü | GET | `/settlement/cities`, `/settlement/city/{id}/towns`, `/settlement/town/{id}/districts` | İl/ilçe adı doğrulama |

**Ortak header'lar:** `Content-Type: application/json`, `Accept: application/json`, `X-Origin: integration`, `X-ClientId: hj-integration` (cURL örneğinde `X-Client-Id` yazıyor — ikisi de denenip çalışan sabitlenecek). Token sonrası her istekte `X-Auth-Token: <token>`.

**Base URL:** Test `https://integration-apitest.hepsijet.com` (maildeki ve cURL'deki tireli hali) · Canlı `https://integration.hepsijet.com`.

Koleksiyonun ham JSON'u (tüm açıklamalar dahil): `https://documenter.gw.postman.com/api/collections/33109546/2sA2rGwKq9?segregateAuth=true&versionTag=latest`

### 2.1 Doküman doğrulaması (2026-11-14, koleksiyon JSON'u okundu)

Koleksiyonda istek örneği neredeyse yok; bilgiler klasör açıklamalarında (S.S.S.).

**Kesinleşenler:**
- Test host'u **tireli** `integration-apitest.hepsijet.com`. Auth tablosundaki tiresiz `integrationapitest` DNS'te yok (ENOTFOUND).
- `deliveryContent[]` ve `currentXDock` **kök seviyede** (`company`, `delivery` ile kardeş), `delivery` içinde değil. `delivery.desi` string (`"1"`), `deliveryContent[].desi` sayı (`1`). `senderAddress`, `receiver`, `recipientAddress`, `recipientPerson*` `delivery` içinde.
- `serviceType` standart gönderide hiç eklenmez.
- `customerDeliveryNo` en fazla 19 karakter (K-barkod `_2` eki için 21'e yer bırakılır). `customerOrderId` en fazla 25 karakter, etikette görünür.
- Etiket: `POST /delivery/barcodes-label?format=PDF|PNG|JPEG`, body `{"barcodes":[...]}` (çoklu destekli). Etiket ölçüsü **10×8 cm** (HepsiJET ortak barkodu; 10×15 etikete yatay yerleştirilebilir). → Bölüm 7 soru 3 dokümanla yanıtlandı.
- ZPL: `GET /delivery/generateZplBarcode/{barkod}/{totalParcels}`.
- Silme: `/delivery/deleteDeliveryOrder/{barkod}`, body `{"deleteReason":"IPTAL"}`. Yanıt `{"status":"OK","message":"Gönderi başarıyla silindi"}`; zaten silinmişse `{"status":"FAIL","message":"Bu gönderi sistemimizde zaten silinmiş durumda"}`. Silinen barkod yeniden kullanılabilir (yine de `-2` eki ile göndereceğiz). Kurye okuttuktan sonra silinemez.
- Toplandıktan sonra, dağıtıma (`DELIVERING`) çıkmadan önce geri çağırma: `POST /deliveryReturn/externalRecallDeliveryOrder/{barkod}` (bu fazda yok).
- Takip body'si `{"deliveries":[{"customerDeliveryNo":"..."}]}`, POST, çoklu destekli. Kurye okutmadan önce yalnız `"status":"OK"` döner (hareket yok). İlk hareket `ACCEPTED`. Dokümanda geçen diğer kodlar yalnız `DELIVERING` ve `UNDELIVERED` (iade döngüsü, barkod değişmez); silinen gönderi "SİLİNDİ" statüsüne geçer.
- `hepsijet.com/gonderi-takibi/<no>` linki yalnız canlı gönderilerde çalışır; test gönderileri webden sorgulanamaz.
- Hata yanıt biçimi: `{"status":"FAIL","message":"..."}` (HTTP 401 hatalı kullanıcı/şifre, 423 hesap askıda).

**Dokümanda YOK (test API'den doğrulanacak):**
- `getDeliveryTracking` tam yolu.
- `deleteDeliveryOrder` HTTP metodu (POST mu DELETE mi).
- `barcodes-label` yanıt biçimi (ham PDF mi, base64'lü JSON mu).
- Tam durum kodu listesi (teslim edildi kodu dahil).
- `sendDeliveryOrder` tam yolu (yalnız Enhanced'in yolu var: `/delivery/sendDeliveryOrderEnhanced`; düz olanın `/delivery/sendDeliveryOrder` olduğu varsayılıyor).
- Header: tablo `X-ClientId`, cURL `X-Client-Id` diyor. İkisi de gönderilecek.

## 3. STD payload kuralları

- `company.name` / `company.abbreviationCode`: HepsiJET'in verdiği sabit değerler (env).
- `delivery.customerDeliveryNo`: **3 harfli firma öneki + sipariş no**, en fazla 19 karakter, benzersiz. (Önek HepsiJET'e teyit ettirilecek; mailde ayrıca verilmedi.) Aynı siparişe yeniden gönderimde sonek (`-2`) eklenir.
- `customerOrderId`: sipariş no (≤25 karakter).
- `deliveryDateOriginal`: bugünün tarihi, `YYYY-MM-DD`, **Europe/Istanbul** saatine göre.
- `totalParcels`: "1" (string). `desi`: varsayılan "1" (1–41 arası). `deliverySlotOriginal`: "0". `deliveryType`: "RETAIL". `product.productCode`: "HX_STD".
- `senderAddress`: sabit `companyAddressId` + il/ilçe/mahalle/açık adres (HepsiJET'in yazdığı haliyle, env).
- `receiver.companyCustomerId` ve `recipientAddress.companyAddressId`: **her gönderide yeni `randomUUID()`** (çapraz kargo hatasını önler).
- `phone1` zorunlu (`05xxxxxxxxx` formatı); `phone2`/`email` yoksa `""` — alan silinmez.
- `recipientAddress.district.name`: sistemde mahalle ayrı tutulmuyorsa `""` ver, mahalle zaten açık adreste.
- `recipientPerson` / `recipientPersonPhone1`: alıcı ad soyad / telefon.
- `currentXDock.abbreviationCode`: sabit (env).
- `deliveryContent[]`: her sipariş kalemi → `sku`, `description` (ürün adı + renk/beden), `desi` (1), `quantity`, `indivisibleQuantity: false`.
- Kapıda ödeme (POD) yok — kullanılmayacak.

## 4. Tasarım kararları

1. **Mod anahtarı:** `HEPSIJET_MODE = off | mock | test | live` (Yurtiçi'deki gibi; tanımsız = off → Vercel'de hiçbir şey görünmez).
2. **Veri modeli:** `Shipment` tek satır/sipariş kalır. `provider = "HEPSIJET"`, `carrier = "HepsiJET"`, `cargoKey = customerDeliveryNo` (mevcut unique alan), `trackingCode = customerDeliveryNo`, `trackingUrl = https://www.hepsijet.com/gonderi-takibi/<no>`. HepsiJET'e özel yalnız **eklemeli** alanlar: `hjStatus`, `hjStatusMessage`, `hjSentAt`, `hjCancelledAt`, `hjLastSyncAt`, `hjLastError`. Mevcut kayıtlara dokunulmaz.
3. **Token:** modül içi bellekte önbellek, 50 dk sonra veya 401'de yenile (1 kez tekrar dene).
4. **Etiket:** `sendDeliveryOrder` + `barcodes-label?format=PDF`. PDF admin'de yeni sekmede açılır, Chrome'dan Argox ile basılır (Yurtiçi'deki gibi). ZPL faz 2.
5. **Takip:** yeni cron **eklenmez** (Vercel function sayısı/storage şişmesin); mevcut `/api/cron/yurtici-takip` route'u içinde HepsiJET aktif gönderileri de toplu (tek istekte `deliveries[]`) sorgulanır. `HEPSIJET_SYNC=off` acil kapatma.
6. **Durum eşleme:** HepsiJET durum kodları (ilk okutma = `ACCEPTED`, teslim, iade vb.) dokümandaki listeye göre Bollmark `Shipment.status` / sipariş durumuna eşlenir; teslimde mevcut "kargolandı/teslim edildi" mailleri Yurtiçi akışındaki gibi tetiklenir.
7. **Test güvenliği:** mock/test modunda yalnız alıcı adı "TEST ALICI" ile başlayan siparişlerde HepsiJET butonları açılır (Yurtiçi kuralıyla aynı).
8. **Admin UI:** sipariş detayındaki kargo kartında firma seçimi (Yurtiçi | HepsiJET). `hepsijet-shipment-card.tsx`: Gönder · Etiket yazdır · Durumu yenile · İptal et (yalnız toplanmadan önce). Test modunda sarı uyarı şeridi.

## 5. Fazlar

- **Faz 1 – İstemci:** `src/lib/hepsijet/` → `config.ts`, `client.ts` (token + istek), `map.ts` (sipariş → payload, saf fonksiyon), `shipments.ts` (gönder/etiket/takip/iptal), `mock.ts`, birim testleri (`map.test.ts`, `client.test.ts`).
- **Faz 2 – DB:** `Shipment`'a hj alanları (yalnız ekleme). Canlı DB'ye uygulama **kullanıcı onayıyla**, `migrate diff` kontrolüyle.
- **Faz 3 – Admin:** kart + firma seçimi + PDF etiket route'u (`/api/admin/kargolar/hepsijet-etiket/[id]`).
- **Faz 4 – Takip:** cron entegrasyonu, durum eşleme, müşteri tarafında takip linki (`siparis-durumu`, `hesap/siparislerim`).
- **Faz 5 – Test gönderileri:** test ortamında 2–3 adet STD gönderi (TEST ALICI) oluştur → etiket PDF'ini al → takip sorgula → biri iptal. Oluşan `customerDeliveryNo`'lar ve etiket PDF'leri HepsiJET'e (Hülya Hanım) yanıt maili ile iletilir.
- **Faz 6 – Canlı:** HepsiJET canlı kullanıcı bilgilerini verince Vercel env'leri (sensitive) + `HEPSIJET_MODE=live`. Kullanıcı onayı olmadan push/deploy yok.

## 6. Env değişkenleri (yalnız yerel `.env`, değerler burada yok)

```
HEPSIJET_MODE=test
HEPSIJET_SYNC=on
HEPSIJET_USERNAME=
HEPSIJET_PASSWORD=
HEPSIJET_COMPANY_NAME=
HEPSIJET_COMPANY_CODE=
HEPSIJET_DELIVERY_PREFIX=
HEPSIJET_SENDER_ADDRESS_ID=
HEPSIJET_SENDER_CITY=
HEPSIJET_SENDER_TOWN=
HEPSIJET_SENDER_DISTRICT=
HEPSIJET_SENDER_ADDRESS_LINE=
HEPSIJET_XDOCK_CODE=
```
`.env.example`'a yalnız anahtar adları (boş) eklenir.

## 7. HepsiJET'e sorulacaklar

1. `customerDeliveryNo` başına koyacağımız 3 haneli firma kodu ne olmalı?
2. Canlı ortamda IP kısıtlaması var mı? (Varsa Yurtiçi için açılan Fixie sabit IP'si kullanılabilir.)
3. Etiket ölçüsü (barcodes-label PDF) kaç cm? 10×10 termal etikete uygun mu? (Doküman: ortak barkod 10×8 cm. PDF'in sayfa ölçüsü yine de teyit edilecek.)
4. Kurye toplama: günlük düzenli uğrama mı, gönderi oluştukça çağrı mı?

## 8. Faz durumu

| Faz | Durum | Not |
|---|---|---|
| 0 – Doküman doğrulama | Kısmen | Doküman okundu (bkz. 2.1). Test hesabı 2026-11-14'te 401 sonrası **askıya alındı (423)**; HepsiJET'ten yeniden aktivasyon + şifre teyidi istendi. Takip yolu, silme metodu, etiket yanıt biçimi, durum listesi hâlâ doğrulanmadı. |
| 1 – İstemci | Tamam (2026-11-14, commit 97ab415) | `src/lib/hepsijet/` (config, client, map, mock, shipments + 3 test dosyası). Doğrulanmamış uç noktalar `shipments.ts` başında sabit. `customerDeliveryNo` = sipariş no (zaten `BLM` ile başlıyor, önek tekrarlanmaz), yeniden gönderimde `-2`. |
| 2 – DB | Tamam (2026-11-14, canlı DB, kullanıcı onaylı) | `Shipment`a 6 nullable hj sütunu, `prisma/migrations/20261114000000_hepsijet_shipment/migration.sql`, `prisma db execute` ile; `migrate diff` boş. Ayrı geliştirme DB yok (yerel = canlı). |
| 3 – Admin | Tamam (2026-11-14, mock modda kullanıcı denedi) | Sipariş detayında Yurtiçi / HepsiJET sekmesi (`?kargo=`), `hepsijet-shipment-card.tsx`, DB katmanı `src/lib/hepsijet/orders.ts`. Etiket route'u plandaki `/api/admin/...` yerine `/admin/kargolar/hepsijet-etiket/[id]` (`/api` proxy korumasının dışında). Çift gönderim koruması iki yönlü (Yurtiçi `sendBlockReason`'a tek satır). İptal edilen HepsiJET gönderisinde `provider` boşalır. Test siparişi `BLM261114-6828` (TEST ALICI Deneme) canlı DB'de; Faz 5 sonunda silinecek. |
| 4 – Takip | Bekliyor | |
| 5 – Test gönderileri | Bekliyor | Hesap açılmadan yapılamaz. |
