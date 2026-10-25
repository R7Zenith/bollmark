# Vega Sipariş Aktarımı Planı

Durum: devam ediyor. Faz 0-3 canlıda (2026-10-26); test siparişi Vega listesine düştü. Kalan: stok ayırma doğrulaması (5(d)), ilk gerçek müşteri siparişi, Vega'dan gelen diğer durumlar

Bu oturumda kod, şema ve veritabanı değişikliği yapılmadı. Vercel logları
yalnız okundu.

---

## 1. Özet ve önerilen yaklaşım

**Hedef:** Sitede ödemesi onaylanan sipariş Vega'ya "Ticimax siparişi" olarak
düşsün, Vega stoğu ayırsın, fatura Vega'da bu siparişten kesilsin.

**Önerilen yol:** Vega'ya bugün ürün ve stok için verdiğimiz Ticimax taklidini
(`src/app/Servis/[service]/route.ts`) aynı dosyada, aynı tarzda
`SiparisServis.svc` metotlarıyla genişletmek:

- `SelectSiparis`: ödemesi onaylı, henüz aktarılmamış siparişleri Ticimax
  `WebSiparis` biçiminde döner.
- `SetSiparisAktarildi` / `SetSiparisAktarildiIptal`: Vega siparişi aldığını
  bildirince siparişe "aktarıldı" damgası vurulur (ya da kaldırılır).
- Gerekirse `SelectSiparisUrun` / `SelectSiparisOdeme` (Vega bunları ayrı
  çağırıyorsa).

**Ama önce bir engel var (en önemli bulgu):** Vega'nın 2 dakikada bir attığı
sipariş isteği **son 14 günde siteye hiç ulaşmamış** (kanıt 2. bölümde).
Yani "metot boş dönüyor" değil, istek Vercel'e hiç gelmiyor. Bu yüzden ilk iş
(Faz 0) isteği yakalamak: nereye, hangi yolla, hangi gövdeyle geliyor.
Gövdeyi görmeden `WebSiparis` cevabını yazmak tahmin olur.

**Stok koruması:** Asıl ayırma Vega'da. Sitede yalnızca kısa bekleme aralığı
için küçük bir düzeltme yeterli: Vega'dan stok geldiğinde, Vega'nın henüz
almadığı ödenmiş siparişlerin adetleri düşülerek yazılır (5. bölüm).

**Şema:** İki alan öneriliyor (`Order.vegaId`, `Order.vegaTransferredAt`),
onay bekliyor. Şemasız alternatif de var (6. bölüm).

---

## 2. Vega'nın beklediği metotlar (kanıtlarıyla)

### 2.1 Bugün siteye gerçekten ne geliyor (Vercel logları, salt okuma)

`npx vercel logs requests --since 14d` (2026-10-11 → 2026-10-25):

| Yöntem | Yol | Durum | User-Agent | Adet |
|---|---|---|---|---|
| POST | `/Servis/UrunServis.svc` | 200 | Embarcadero SOAP 1.4 | 572 |
| herhangi | `*Siparis*` | — | — | **0** |
| GET | `/Servis/*` | — | — | **0** |

Runtime loglarında (`[vega-tcmx]`) yalnız şu metotlar var: `VaryasyonGuncelle`
(528), `SelectUrun` (33), `SelectUrunCount` (11). **"desteklenmeyen metot"
kaydı hiç yok.** Route desteklenmeyen her POST metodunu gövdesiyle logladığı
için, sipariş isteği POST olarak gelseydi görünürdü.

Sonuç: Vega'nın sipariş isteği Vercel'e ulaşmıyor. Olası nedenler:

1. İstek Cloudflare Worker'a geliyor ama yolu `/Servis/` ya da
   `/api/vega/panelapi/` ile başlamıyor; Worker bu durumda kendisi **404**
   dönüyor ve Vercel'e iletmiyor (`vega-bridge-worker/worker.js`,
   `ALLOWED_PREFIXES`).
2. Vega sipariş isteğini başka bir adrese atıyor (ör. Site Adı'nın başına
   `www.` ekliyor ya da doğrudan `bollmark.com`'a gidip TLS'te düşüyor; bu
   sorun 2026-09'da ürün tarafında yaşanmıştı).
3. Vega'da Ticimax siparişleri için ayrı bir ayar kapalı, gördüğün "2 dakikada
   bir sipariş istiyor" bir ekran sayacı ama istek atılmıyor.

Not: Arşivdeki `VEGA_PANELAPI_BULGULARI_VE_PLAN.md`, 2026-09-11'de Vega'nın
`SiparisServis.svc`'ye **gövdesiz GET** attığını yazıyor. Bu, Delphi SOAP
istemcisinin önce WSDL'i (`?wsdl`) çekmesi olabilir. Route yalnız `POST`
tanımladığı için GET Next.js'te 405 alır. Ancak 405 de Vercel istek
kayıtlarında görünürdü; 14 günde hiç yok. Yani o GET'ler de artık siteye
gelmiyor.

Cloudflare Worker loglarına bu oturumda erişilemedi (`wrangler` girişi yok,
token istenmedi).

**Güncelleme (2026-10-25, aynı oturum):** Kullanıcı, Vega'da sipariş
bölümünün **kapalı olduğunu** ve inceleme sırasında açtığını bildirdi; 3.
neden doğrulandı, 14 günlük boşluk bununla açıklanıyor. Açıldıktan sonra
20:20 UTC'de son 2 saatin istek kayıtlarına bakıldı: `/Servis/*` ya da
Embarcadero istemcisinden **yine istek yok**; son 40 dakikadaki tüm bot dışı
istekler de tarandı, Vega izi yok. Yani istek ya henüz başlamadı ya da
Worker'da 404 ile kalıyor (1. neden). Faz 0 loglaması hâlâ gerekli.

### 2.1.0 ÇÖZÜLDÜ (2026-10-25 gece): istek yakalandı

**Neden ulaşmıyordu:** Vega sipariş isteğinde Site Adı'nın başına gerçekten
**`www.`** ekliyor (ürün/stok isteklerinde eklemiyor). workers.dev sertifikası
`www.bollmark-vega-bridge.ozilevent.workers.dev`'i kapsamadığı için TLS el
sıkışması düşüyordu (curl ile doğrulandı: DNS çözülüyor, TLS hata 35).

**Çözüm (uygulandı, kullanıcı onayıyla):** Worker'a iki özel alan adı
bağlandı: `vega.bollmark.com` ve `www.vega.bollmark.com` (`wrangler.toml`
`routes`, `workers_dev = true` korundu). Vega'da Site Adı =
`vega.bollmark.com`. Stok/ürün `vega.bollmark.com`'a, sipariş
`www.vega.bollmark.com`'a gidiyor; ikisi de Worker → `bollmark.com/Servis/...`.
Not: yeni ad sertifika kayıtlarından öğrenilip botlarca taranıyor (`.env`,
`.git` vb.); Worker yalnız `/Servis/` ve `/api/vega/panelapi/` iletiyor,
gerisi 404. `/Servis/` her metotta `UyeKodu` doğruluyor.

**Yakalanan gerçek istek** (Worker + Vercel runtime logu, 20:40:56 UTC):

```
POST https://www.vega.bollmark.com/Servis/SiparisServis.svc
SOAPAction: http://tempuri.org/ISiparisServis/SelectSiparis
User-Agent: Embarcadero SOAP 1.4
```

İki farklı gövde geliyor (filtre alanları `xmlns="http://schemas.datacontract.org/2004/07/"`,
UrunServis ile aynı namespace):

1. **Sipariş çekme** ("Sipariş Güncelleme", 2 dk):
   `SiparisTarihiBas = 2022-08-01T00:00:11Z` (Vega'daki "Entegrasyon
   Başlangıcı"), **`EntegrasyonAktarildi = -1`** (hepsi), `OdemeDurumu = -1`,
   `OdemeTipi = -1`, `SiparisDurumu = -1`, `SiparisID = 0`, `UyeID = 0`;
   sayfalama `BaslangicIndex = 0`, `KayitSayisi = 100`, `SiralamaDegeri = ID`,
   `SiralamaYonu = ASC`.
2. **Durum çekme** ("Durum Güncelleme", 2 dk): aynı alanlar, ama
   `SiparisTarihiBas` yerine **`DurumTarihiBas = <şu an>`**. Değer
   `2026-10-25T23:40:55Z`: sonunda `Z` olmasına rağmen **yerel saat**
   (İstanbul; UTC 20:40:55). Uygulamada `Z` yok sayılıp İstanbul saati
   olarak okunmalı.

**Sonuçlar (planı değiştiren):**

- Vega "aktarılmayanlar" filtresi **kullanmıyor** (`-1`); her seferinde
  başlangıç tarihinden bu yana tüm siparişleri ID sırasıyla 100'lük
  sayfalarla istiyor. Çift kaydı Vega'nın kendisi `ID` ile önlüyor olmalı.
  Bizim tarafta **sabit ve kalıcı `ID`** şart; "aktarıldı" bayrağına göre
  filtrelemek yanlış olur.
- `SetSiparisAktarildi` henüz gelmedi (sipariş dönmediği için normal); gelip
  gelmeyeceği Faz 2'de görülecek. Stok koruması ona bağlanmamalı (5(b)
  güncellendi).
- İptal/durum değişikliği Vega'ya **`DurumTarihiBas`** sorgusuyla gidiyor:
  bu tarihten sonra durumu değişen siparişler `Durum = 8 (Iptal)` vb. ile
  dönerse Vega'nın siparişi iptal edip stoğu bırakması beklenir (kullanıcı:
  "Vega'da iptal edilince stok siteye geri geliyordu"). Sitede `Order.updatedAt`
  bu filtre için kullanılabilir (fazla kayıt dönmesi zararsız).
- Şu an site her iki sorguya "desteklenmeyen metot" SOAP Fault'u (500)
  dönüyor; Vega sessizce yutuyor. Faz 1 bunu geçerli boş listeye çevirir.

### 2.1.1 Vega sipariş ekranı (kullanıcı ekran görüntüsü, 2026-10-25)

VegaSanalMağaza v9.9.0.6, sol menüde "Tümü" ve "TiciMax" sekmeleri, liste boş.

- **Liste sütunları** (Vega'nın siparişten okuduğu alanlar, 3. bölümle
  eşleşir): Seç, Site Adresi, Vega, Fiş, Sipariş Durumu, **Sipariş Id**,
  Sipariş Tarihi, **Sipariş No**, No, **Fatura Tip**, **Alıcı İli**,
  **Alıcı İlçesi**, Müşteri Kodu, **Adı**, **Soyadı**, Firma, **Genel Toplam**,
  **E-Posta**, **Ödeme Durumu**, Site Adı, Kargo Firması, **Ödeme Tipi**,
  **Ödeme Tarihi**, Fatura No, F. İsmi, F. Adresi.
  Buna göre `UyeAdi`/`UyeSoyadi` (ya da `AdiSoyadi`) ayrı ayrı dolu olmalı,
  ödeme durumu ve tarihi (`Odemeler`) boş bırakılmamalı.
- **Üst butonlar:** "Sipariş Güncelle" (elle sipariş çekme, büyük olasılıkla
  `SelectSiparis`) ve "Stok Güncelle"; altlarında yeşil şerit (otomatik
  çalışma göstergesi olabilir). Sayaçlar: Paketlenecekler, Yeni Mesaj,
  Bekleyen Sipariş, Kargo Bekleyen, Sipariş Tutarı.
- **Filtre çubuğu:** "Sipariş Durumu → Filtrele: Hepsi" ve
  "**Güncelle: Onaylandı ✓**". İkincisi, seçili siparişlerin durumunu siteye
  geri yazan bir toplu işlem gibi duruyor → Vega **`SetSiparisDurum`**
  çağırabilir. Bu metot da Faz 1'de en azından loglanmalı, Faz 2'de
  karar verilmeli (sitede durumu ilerletmek mi, yok saymak mı).
- Sağda "Sipariş Fişi" ve "Kargo Fişi": Vega içi çıktılar, siteye istek
  atması beklenmiyor.

### 2.2 İsteği yakalamak için gereken (Faz 0, eklenmedi)

En az kodlu yol, iki küçük geçici loglama:

1. **Worker:** `worker.js`'te 404 dönmeden önce tek satır
   `console.log(request.method, url.pathname, url.search, request.headers.get("soapaction"))`.
   Cloudflare panelinde Workers → bollmark-vega-bridge → Logs ekranında
   görünür (ya da `npx wrangler tail`). Worker'ı deploy etmek için Cloudflare
   girişi gerekiyor (kullanıcı).
2. **Route:** `route.ts`'e `GET` export'u: yalnız yolu, sorgu dizesini ve
   SOAPAction'ı loglayıp şimdilik 405/boş dönsün.

Bu ikisiyle bir mağaza günü sonunda isteğin yolu, yöntemi ve (POST ise)
gövdesi elimizde olur. Gövdeden `WebSiparisFiltre` alanları ve
DataContract namespace'i okunur (ürün tarafında da böyle bulunmuştu).

Alternatif (koda dokunmadan): Vega'da Site Adı'nı geçici olarak bir
webhook.site adresine çevirip 2–3 dakika beklemek. Bu sırada stok senkronu
da oraya gider; kısa tutulmalı ve hemen geri alınmalı.

### 2.3 Ticimax SiparisServis sözleşmesi

Kaynaklar: Ticimax resmî dokümanı
[SiparisServis.pdf](https://static.ticimax.com/dokumanlar/SiparisServis.pdf)
(metni bu oturumda PDF'ten çıkarıldı) ve açık kaynak PHP istemcisi
[alperragib/TicimaxPhpServiceProject](https://github.com/alperragib/TicimaxPhpServiceProject)
(`src/Service/Order/*.php`). Servis adresi `{SiteAdı}/Servis/SiparisServis.svc`,
SOAPAction kalıbı UrunServis'e göre büyük olasılıkla
`http://tempuri.org/ISiparisServis/<Metot>` (Faz 0'da doğrulanacak).

**Vega'nın büyük olasılıkla kullandığı metotlar:**

| Metot | Parametreler | Dönüş |
|---|---|---|
| `SelectSiparis` | `UyeKodu: string`, `f: WebSiparisFiltre`, `s: WebSiparisSayfalama` | `List<WebSiparis>` |
| `SetSiparisAktarildi` | `UyeKodu: string`, `siparisId: int` | boş |
| `SetSiparisAktarildiIptal` | `UyeKodu: string`, `siparisId: int` | boş |
| `SelectSiparisUrun` | `UyeKodu`, `SiparisId: int`, `IptalEdilmisUrunler: bool` | `List<WebSiparisUrun>` |
| `SelectSiparisOdeme` | `UyeKodu`, `SiparisId: int`, `OdemeId: int` (0 olabilir) | `List<WebSiparisOdeme>` |

**Vega'nın kullanması olası olmayan, ilk aşamada yazılmayacaklar:**
`SetSiparisDurum`, `SetSiparisKargoyaVerildi`, `SetSiparisTeslimEdildi`,
`SetFaturaNo`, `SaveKargoTakipNo`, `SetSiparisOdemeDurum`, `SaveSiparis`.
Faz 0/1 loglarında gelirse "desteklenmeyen metot" olarak görünür, o zaman
eklenir.

**`WebSiparisFiltre` (Vega'nın göndereceği filtre):** `EntegrasyonAktarildi`
(int: 0 = aktarılmayanlar, 1 = aktarılanlar, -1 = hepsi), `EntegrasyonParams`,
`IptalEdilmisUrunler`, `FaturaNo`, `OdemeDurumu`, `OdemeTipi`, `SiparisDurumu`,
`SiparisID`, `SiparisKaynagi`, `SiparisKodu`, `SiparisNo`,
`SiparisTarihiBas` / `SiparisTarihiSon`, `StrSiparisDurumu`, `TedarikciID`,
`UyeID`, `UyeTelefon`; ayrıca `OdemeGetir`, `UrunGetir`, `KampanyaGetir`,
tarih aralıkları. Sayısal alanlarda **-1 "filtre yok"** demek.

**`WebSiparisSayfalama`:** `BaslangicIndex`, `KayitSayisi`, `SiralamaDegeri`,
`SiralamaYonu`.

**`WebSiparis` alanları (PDF):** `AdiSoyadi`, `Durum` (int), `EntegrasyonAktarildi`
(bool), `FaturaAdresId`, `FaturaAdresi` (FaturaAdres), `FaturaNo`, `FaturaTarihi`,
`HediyeCeki`, `HediyeCekiTutari`, `HediyePaketiNotu`, `HediyePaketiTutari`,
`HediyePaketiVar`, `ID` (int), `IPAdresi`, `IndirimTutari`, `KargoAdresID`,
`KargoEntegrasyonID`, `KargoEntegrasyonTakipNo`, `KargoFirmaId`, `KargoTakipNo`,
`KargoTutari`, `Kaynak`, `Kur`, `Mail`, `Maliyet`, `Odemeler`
(List<WebSiparisOdeme>), `ParaBirimi`, `Referer`, `ReklamKaynagi`,
`SepetKampanyasiIndirimi`, `SiparisDurumu` (string), `SiparisKaynagi`,
`SiparisNo`, `SiparisNotu`, `SiparisTarihi`, `SiparisToplamTutari`,
`StokDustu` (bool), `TeslimatAdresi` (TeslimatAdres), `TeslimatGunu`,
`TeslimatSaati`, `ToplamKdv`, `ToplamTutar`, `Tutar`, `Urunler`
(List<WebSiparisUrun>), `UyeAdi`, `UyeID`, `UyeMusteriKodu`, `UyeSoyadi`.

**`FaturaAdres`:** `Adres`, `AliciTelefon`, `EntegrasyonId`, `FirmaAdi`, `ID`,
`Il`, `IlId`, `IlKodu`, `Ilce`, `IlceId`, `IlceKodu`, `Ulke` (WebUlke:
`Alpha2Code`, `Alpha3Code`…), `VergiDairesi`, `VergiNo`, `isKurumsal`.

**`TeslimatAdres`:** `Adres`, `AdresTarifi`, `AliciAdi`, `AliciTelefon`, `ID`,
`Il`, `IlId`, `IlKodu`, `Ilce`, `IlceId`, `IlceKodu`, `PostaKodu`, `Ulke`.

**`WebSiparisUrun`:** `Adet` (double), `Barkod`, `Durum`, `DurumAd`, `ID`,
`IslemAd`, `IslemID`, `KampanyaID`, `KampanyaIndirimTutari`, `KdvOrani` (int),
`KdvTutari`, `MagazaAtamaTarihi`, `MagazaDurum`, `MagazaGonderimTarihi`,
`MagazaID`, `MagazaKodu`, `Maliyet`, `SiparisId`, `StokKodu`, `TedarikciID`,
`TedarikciKodu`, `TedarikciKodu2`, `Tutar`, `UrunAdi`, `UrunID`, `UrunKartiID`.

**`WebSiparisOdeme`:** `BankaKomisyonu`, `CheckSum`, `HavaleBankaID`,
`HavaleHesapID`, `ID`, `KKOdemeBankaID`, `KapidaOdemeTutari`, `OdemeIndirimi`,
`OdemeNotu`, `OdemeSecenekID`, `OdemeTipi` (int), `Onaylandi` (int),
`PosReferansID`, `SiparisID`, `TaksitSayisi`, `Tarih`, `Tutar`, `UyeID`.

**Kod tabloları (PHP istemcisi; PDF'teki tabloyla bir sıra kayması var,
Faz 0'da doğrulanacak):**

- Sipariş durumu: 0 OnSiparis, 1 OnayBekliyor, 2 Onaylandi, 3 OdemeBekliyor,
  4 Paketleniyor, 5 TedarikEdiliyor, 6 KargoyaVerildi, 7 TeslimEdildi,
  8 Iptal, 9 Iade, 10 Silinmis, 11 IadeTalepAlindi, … 14 TeslimOncesiIptal.
- Ödeme durumu: 0 OnayBekliyor, 1 Onaylandi, 2 Hatali, 3 IadeEdilmis,
  4 IptalEdilmis.
- Ödeme tipi: 0 KrediKarti, 1 Havale, … 17 IYZIPAY, …

Önemli uyarı (PHP istemcisinden): Ticimax'ın `SelectSiparis`'i eksik filtre
alanında sessizce boş döner. Bizim tarafımızda filtreleri **gevşek** okumak
gerekiyor: yalnız `EntegrasyonAktarildi`, `SiparisID` ve tarih aralığı dikkate
alınır, diğerleri yok sayılır (ürün tarafındaki `SelectUrun` ile aynı yaklaşım).

**Cevap biçimi:** UrunServis'teki gibi WCF varsayılanı:
`<SelectSiparisResponse xmlns="http://tempuri.org/"><SelectSiparisResult xmlns:a="http://schemas.datacontract.org/2004/07/" …><a:WebSiparis>…`,
alanlar **alfabetik sırada**, gönderilmeyenler atlanabilir.

---

## 3. Alan eşleştirme tablosu

Tutarlar Ticimax'ta `double` TL (KDV dahil); sitede kuruş (`Int`). Dönüşüm
`(cents / 100).toFixed(2)`, `SelectUrun` ile aynı.

### 3.1 Sipariş başlığı (`WebSiparis`)

| Ticimax alanı | Site kaynağı | Not |
|---|---|---|
| `ID` (int) | **yok** → `Order.vegaId` (yeni) | Order.id cuid, orderNumber metin. Şemasız alternatif 6. bölümde |
| `SiparisNo` | `Order.orderNumber` (BLM261025-1234) | |
| `SiparisTarihi` | `Order.paidAt` (yoksa `createdAt`) | Fatura günü için ödeme tarihi daha doğru; karar: açık soru |
| `AdiSoyadi` | `customerName` | |
| `UyeAdi` / `UyeSoyadi` | `customerName` son boşluktan bölünür | |
| `UyeID` | 0 | Misafir/üye ayrımı Vega için gereksiz görünüyor |
| `Mail` | `customerEmail` | |
| `SiparisNotu` | `note` | |
| `Durum` / `SiparisDurumu` | `status` → PAID: 2 "Onaylandi", PREPARING: 4 "Paketleniyor", SHIPPED: 6, DELIVERED: 7 | Kod sırası doğrulanacak |
| `EntegrasyonAktarildi` | `vegaTransferredAt != null` | |
| `StokDustu` | `true` | Site stoğu zaten düştü. Vega'nın bu alana bakıp bakmadığı bilinmiyor (açık soru) |
| `Tutar` / `ToplamTutar` / `SiparisToplamTutari` | `totalCents` | Üçü de aynı değer; hangisini okuduğu bilinmiyor |
| `IndirimTutari` | `discountCents + bundleDiscountCents + loyaltyDiscountCents` | Satırlara da dağıtılmış hali var (3.3) |
| `SepetKampanyasiIndirimi` | aynı toplam ya da 0 | Çift indirim riskine göre seçilecek (açık soru) |
| `KargoTutari` | `shippingCents` | Kargo KDV'si %20 (`SHIPPING_VAT_RATE`) |
| `ToplamKdv` | satır KDV'leri + kargo KDV'si | `vatFromGrossCents` ile |
| `ParaBirimi` / `Kur` | "TL" / 1 | |
| `HediyePaketiVar` | false | |

### 3.2 Adresler

| Ticimax alanı | Site kaynağı | Not |
|---|---|---|
| `TeslimatAdresi.AliciAdi` | `customerName` | |
| `TeslimatAdresi.AliciTelefon` | `customerPhone` | |
| `TeslimatAdresi.Adres` | `shippingAddress` | |
| `TeslimatAdresi.Il` / `Ilce` | `city` / `district` | Metin |
| `TeslimatAdresi.IlId` / `IlKodu` / `IlceId` | **yok** → 0 / boş | Vega il kodu (plaka) isterse 81 ilin plaka tablosundan türetilebilir |
| `TeslimatAdresi.PostaKodu` | `postalCode` | |
| `Ulke.Alpha2Code` | "TR" | |
| `FaturaAdresi.*` | teslimat adresinin aynısı | **Site ayrı fatura adresi toplamıyor** |
| `FaturaAdresi.VergiNo` | **yok** | Site TC/VKN toplamıyor; iyzico'ya da `11111111111` gidiyor |
| `FaturaAdresi.VergiDairesi` / `FirmaAdi` | **yok** → boş | Kurumsal fatura desteklenmiyor |
| `FaturaAdresi.isKurumsal` | false | |

### 3.3 Satırlar (`Urunler` → `WebSiparisUrun`)

| Ticimax alanı | Site kaynağı | Not |
|---|---|---|
| `ID` | sıra no ya da yeni int | OrderItem.id cuid; satır kimliği Vega için gerekli mi bilinmiyor |
| `SiparisId` | sipariş `ID` | |
| `UrunID` | `ProductVariant.vegaId` | `SelectUrun`'daki `Varyasyon.ID` ile aynı |
| `UrunKartiID` | `Product.vegaId` | `SelectUrun`'daki `UrunKarti.ID` ile aynı |
| `Barkod` | `variant.barcode ?? variant.sku` | **`SelectUrun` ile birebir aynı kural**; Vega eşleştirmesi buna dayanıyor |
| `StokKodu` | `variant.sku` | |
| `UrunAdi` | `product.name` (+ varyant adı) | |
| `Adet` | `quantity` | |
| `Tutar` | `paidCents` (indirim dağıtılmış satır tutarı) ya da `unitPriceCents` | **Birim mi, satır toplamı mı, belirsiz** (açık soru) |
| `KdvOrani` | `resolveVatRate(product)` | 1 / 10 / 20 |
| `KdvTutari` | `vatFromGrossCents(tutar, oran)` | |
| `KampanyaIndirimTutari` | `totalCents - paidCents` | İndirim satıra dağıtılmışsa |

İndirimler: iyzico ödemesi kupon + paket + puan indirimini satırlara kuruş
kuruş dağıtıyor (`basket.ts` `allocateDiscount`) ve her satırın ödenen tutarı
`OrderItem.paidCents`'te duruyor. Faturanın tahsil edilen parayla birebir
tutması için satır tutarı olarak `paidCents` önerilir; tutarı 0 olan
(tamamen indirimli) siparişte `paidCents` boş kalır, o zaman `totalCents`
kullanılır.

Varyantı silinmiş satır (`variantId` null): barkod bulunamaz; satır yine
gönderilir ama Vega eşleştiremez. Panelde dikkat notu.

### 3.4 Ödeme (`Odemeler` → tek `WebSiparisOdeme`)

| Ticimax alanı | Site kaynağı | Not |
|---|---|---|
| `OdemeTipi` | 17 (IYZIPAY) ya da 0 (KrediKarti) | Vega'nın hangisini kasa/banka hesabına bağladığı bilinmiyor (açık soru) |
| `Onaylandi` | 1 | Yalnız ödenmiş sipariş gidiyor |
| `Tutar` | `paidCents` | Taksit farkı varsa `totalCents`'ten büyük olabilir |
| `TaksitSayisi` | `installment` | |
| `Tarih` | `paidAt` | |
| `PosReferansID` | başarılı `PaymentAttempt.paymentId` | |
| `ID` / `SiparisID` | sipariş `ID` | |

Tutarı 0 olan siparişte (`paymentProvider: "NONE"`) ödeme satırı boş liste.

---

## 4. Hangi siparişler aktarılır

**Aktarılır:** `paymentStatus = PAID` **ve** `status` ∈ {PAID, PREPARING,
SHIPPED, DELIVERED} **ve** `deletedAt` boş **ve** başlangıç tarihinden sonra
ödenmiş.

**Aktarılmaz:**

- `PENDING_PAYMENT`, `REVIEW` (iyzico dolandırıcılık incelemesi; netleşince
  PAID olur ve kendiliğinden listeye girer), `FAILED`.
- "Geç ödeme" (süresi dolup iptal edildikten sonra ödenen; `status` CANCELLED
  kalıyor): admin karar verir.
- Silinmiş (`deletedAt`) siparişler.

**Başlangıç tarihi (önemli):** Yeni alan eklendiğinde eski tüm ödenmiş
siparişler "aktarılmadı" görünür ve ilk çekimde Vega'ya topluca düşer.
Bunu önlemek için kodda sabit bir başlangıç anı (yayın günü) kullanılır;
veritabanına geriye dönük yazım gerekmez.

**Aktarıldıktan sonra iptal / iade / değişim:** Vega büyük olasılıkla yalnız
`EntegrasyonAktarildi = 0` olanları çekiyor; aktarılmış siparişteki sonraki
değişikliği görmez. Ticimax'ta da iptal/iade genelde ERP tarafında elle
işleniyordu. İlk sürümde:

- Faturası kesilmemiş sipariş iptal edilirse: Vega'da siparişi elle
  iptal et (ayrılmış stok serbest kalır).
- Faturası kesilmiş siparişte iade: Vega'da iade faturası elle.
- Sitede iade sırasında "stoğa geri ekle" seçilirse site stoğu artar, ama
  Vega'nın sonraki stok gönderimi zaten mutlak değeri yazar; iki taraf
  Vega'ya göre hizalanır.

Vega `EntegrasyonAktarildi = -1` (hepsi) ile de soruyorsa, `Durum` alanına
Iptal (8) / Iade (9) yazmak Vega'ya iptali bildirmenin yolu olabilir; Faz 0
logunda filtre değeri görülünce karar verilir.

**Çift aktarım nasıl önlenir:**

1. `SelectSiparis` yalnız `vegaTransferredAt` boş olanları döner
   (`EntegrasyonAktarildi = 0` isteğinde).
2. `SetSiparisAktarildi` koşullu tek yazım:
   `updateMany({ where: { vegaId, vegaTransferredAt: null }, data: { vegaTransferredAt: now } })`
   (iyzico tarafındaki "kazanan tek istek" deseniyle aynı). Tekrar çağrı
   zararsız.
3. Vega'nın kendisi de Ticimax sipariş `ID`'sini tekil tutuyor olmalı; aynı
   `ID` hep aynı siparişe karşılık geldiği için ikinci kez gelse bile Vega
   tarafında yeni sipariş açmaması beklenir (Faz 2'de doğrulanacak).

---

## 5. Stok koruması

### (a) Vega siparişi aldığını nasıl bildiriyor?

Ticimax sözleşmesinde bunun yolu `SetSiparisAktarildi(UyeKodu, siparisId)`.
Ticimax entegratörlerinin olağan döngüsü: `SelectSiparis` (aktarılmayanlar)
→ siparişi kendi sistemine yaz → `SetSiparisAktarildi`. Vega'nın bunu
çağırdığı **henüz kanıtlanmadı**; Faz 1 loglarında görülecek. Site bunu
`Order.vegaTransferredAt` ile kaydedebilir (şema önerisi). Vega çağırmıyorsa
(b)'deki zaman sınırlı yedek kullanılır.

> **Güncelleme (istek yakalandıktan sonra):** Vega `EntegrasyonAktarildi = -1`
> ile soruyor ve `SetSiparisAktarildi` çağırdığı henüz görülmedi. Bu yüzden
> "aktarıldı" anı olarak **siparişin `SelectSiparis` cevabında Vega'ya ilk
> kez gönderildiği an** kaydedilir (alan adı `vegaFetchedAt`; Vega 2 dk'da
> bir çektiği ve aldığını hemen işlediği için yeterli). `SetSiparisAktarildi`
> gelirse ek doğrulama olarak loglanır. Böylece Vega kapalıyken (gece)
> verilen sipariş, sabah Vega çekene kadar korunur; sabit 30 dakikalık
> sınıra gerek kalmaz, yalnız güvenlik için geniş bir üst sınır (ör. 24 saat)
> konur. Aşağıdaki sorguda `vegaTransferredAt` yerine `vegaFetchedAt` okunmalı.

### (b) Bekleme aralığı için hafif koruma (önerilen, en az kod)

`handleVaryasyonGuncelle` içinde, yazmadan önce tek bir toplama sorgusu:

```
bekleyen = SUM(OrderItem.quantity)
  WHERE variant.vegaId = <gelen ID>
    AND order.paymentStatus = PAID
    AND order.status IN (PAID, PREPARING, SHIPPED, DELIVERED)
    AND order.deletedAt IS NULL
    AND order.vegaTransferredAt IS NULL
    AND order.paidAt >= <başlangıç anı>
yeniStok = max(0, VegaStok - bekleyen)
```

Sipariş "aktarıldı" olunca koşuldan düşer, düşme kendiliğinden biter. Yaklaşık
10 satır; yeni tablo, kuyruk ya da kilit yok. Log satırına `bekleyen` eklenir.

**Emniyet:** Vega `SetSiparisAktarildi` çağırmıyorsa bu koşul hiç bitmez ve
stok sürekli fazladan düşük kalır. Bu yüzden ek bir üst sınır:
`order.paidAt` son **30 dakika** içinde. Vega 2 dakikada bir çekiyor; 30 dk
bol pay. En kötü durumda (Vega çekti, stoğu ayırdı, ayrılmış stoğu düşülmüş
değer gönderdi) site 30 dakika boyunca 1 eksik gösterir: az satış yönünde,
güvenli hata. Vega'nın aktarıldı bildirdiği kanıtlanırsa üst sınır kalabilir
ya da kaldırılabilir; ikisi de birkaç karakterlik değişiklik.

Şemasız sürüm: yalnız 30 dakika sınırıyla (aktarıldı bayrağı olmadan) da
çalışır. Bayrak eklenmezse en çok 30 dk az gösterme olur.

### (c) Bugünkü stok senkronunda yarış durumu

1. **Asıl risk bugün zaten var ve süresi sınırsız.** Site ödeme onayında
   stoğu kendisi düşüyor (`reconcile.ts` `decrementStock`). Vega ise
   `VaryasyonGuncelle` ile mutlak değer yazıyor. Vega siparişi hiç
   görmediği için, siz faturayı kesene kadar Vega'daki değer satış öncesi
   değer. Bu arada o varyant için Vega'dan herhangi bir gönderim gelirse
   (mağazada aynı varyanttan satış olması ya da akşamki toplu gönderim), site
   eski stoğu geri yazar. Loglarda akşam 150–190 varyantlık toplu
   gönderimler var (2026-10-13, 2026-10-21), yani bu pencere gerçekten açılıyor.
   Sipariş aktarımı bu pencereyi ~2 dakikaya, (b) ise neredeyse sıfıra indirir.
2. `handleVaryasyonGuncelle` önce "değişen var mı" sayar, sonra yazar (iki
   ayrı sorgu). Arada site stoğu değişirse yalnız önbellek tazeleme kararı
   yanlış olabilir; stok yazımının kendisi etkilenmez. Önemsiz.
3. Ödeme bekleyen siparişler stok ayırmıyor: son ürünü iki kişi aynı anda
   öderse ikincisinde "stok yetersiz" dikkat notu düşer (mevcut, bilinçli
   davranış). Bu planın konusu değil.
4. Aynı varyant için Vega gönderimi ile ödeme onayı aynı anda olursa: ödeme
   `stock >= adet` koşullu düşüm yapıyor, Vega düz yazıyor; sıra hangisi önce
   biterse o. (b) uygulandığında Vega'nın yazdığı değer bekleyen siparişi
   zaten düşmüş olur; ödeme önce bitmişse sonuç doğru, Vega önce bitmişse
   ödeme ayrıca 1 düşer ve stok 1 eksik kalır (az satış yönü, bir sonraki
   Vega gönderiminde düzelir). Kabul edilebilir.

### (d) Vega'nın gönderdiği stok "kullanılabilir" mi, "fiziksel" mi?

Kodla bilinemez. Güçlü ipucu (kullanıcı, 2026-10-25): Ticimax döneminde
Vega'da sipariş **iptal edilince siteye stok geri geliyordu**. Yani ayrılan
stok, Vega'nın gönderdiği değere yansıyordu; bu büyük olasılıkla
**kullanılabilir** stok demek. Bizim tarafta ek iş gerekmiyor: iptalde Vega
stoğu geri gönderir, `VaryasyonGuncelle` mutlak değeri yazar. Yine de ilk
gerçek siparişte doğrulama (7. bölümdeki deneme
siparişiyle birlikte):

1. Sipariş öncesi Vega'da o varyantın stoğunu not et: **X**.
2. Site siparişi Vega'ya düşsün, faturayı **henüz kesme**.
3. Vega'da o varyant için stok gönderimini tetikle (ya da otomatik gelmesini
   bekle).
4. Vercel logunda o varyantın satırına bak:
   `npx vercel logs --since 30m --query 'VaryasyonGuncelle'` → `stokAdedi`.
   - `X - 1` ise Vega **kullanılabilir** stok gönderiyor (beklenen; Ticimax
     deneyimiyle uyumlu).
   - `X` ise **fiziksel** stok gönderiyor: fatura kesilene kadar ayrılmış
     adet düşülmüyor demektir. O zaman (b)'deki koruma "aktarıldı" ile değil,
     **fatura kesilince** bitmeli; bu durum plan güncellemesi gerektirir.
5. Vega ekranında aynı stok kartında "rezerve / ayrılmış" sütunu var mı,
   not al.

---

## 6. Şema değişikliği (onay bekliyor, yapılmadı)

> **Güncelleme:** İkinci alanın anlamı "Vega'ya ilk gönderildiği an" oldu
> (bkz. 2.1.0 ve 5. bölüm); adı `vegaFetchedAt` önerilir. `vegaId` aynen
> gerekli, hatta daha kritik: Vega çift kaydı yalnız `ID` ile ayırıyor.

```prisma
model Order {
  // Ticimax SOAP semasi siparis kimligini int bekliyor (Product.vegaId ile
  // ayni gerekce).
  vegaId            Int       @unique @default(autoincrement())
  // Vega SetSiparisAktarildi ile siparisi aldigini bildirdigi an.
  vegaTransferredAt DateTime?
}
```

- **Neden `vegaId`:** `WebSiparis.ID` ve `SetSiparisAktarildi(siparisId)`
  tamsayı. Sitede siparişin tamsayı kimliği yok. Aynı desen 2026-09'da
  `Product`, `ProductVariant`, `Category` için `db push` ile sorunsuz
  uygulandı (mevcut satırlara sıra numarası otomatik verilir).
- **Neden `vegaTransferredAt`:** "aktarıldı" durumunu tutmak ve (b)'deki
  düşmeyi bitirmek için.
- Uygulama: `npm run db:push` (kullanıcı onayıyla). Yalnız ekleme; mevcut
  veri değişmez.

**Şemasız alternatif:**

- `ID`: sipariş numarasından türetilir. `BLM261025-1234` → (2026-01-01'den
  bu yana gün sayısı) × 10000 + 1234, ör. `2971234`. `orderNumber` zaten
  tekil olduğu için çakışmaz, int sınırına sığar, `SetSiparisAktarildi`'deki
  sayıdan sipariş numarası geri hesaplanabilir. Dezavantaj: numara biçimi
  değişirse kırılır.
- "Aktarıldı" bilgisi: mevcut `AuditLog` tablosuna `VEGA_SIPARIS_AKTARILDI`
  kaydı (yeni tablo/alan yok) ya da hiç tutmamak ve yalnız 30 dakikalık
  pencereye güvenmek. O zaman `SelectSiparis` "aktarılmayanları" sorgulamak
  için her seferinde AuditLog'a bakar.

Öneri: şemalı sürüm. İki alan, bilinen desen, daha az özel kod.

---

## 7. Fazlara bölünmüş uygulama adımları

### Faz 0: İsteği yakala (yalnız loglama, veriye yazmaz)

1. `worker.js`: 404 öncesine log satırı; Worker'ı deploy et (Cloudflare
   girişi: kullanıcı).
2. `route.ts`: `GET` export'u, yalnız log.
3. Bir mağaza günü bekle, sonra Worker ve Vercel loglarını oku.

**Doğrulama:** Sipariş isteğinin yöntemi, yolu, SOAPAction'ı ve (POST ise)
gövdesi elimizde. Gövdeden `WebSiparisFiltre` alanları ve namespace'i okundu.
İstek hiç gelmiyorsa: sorun Vega ayarında (8. bölümdeki sorular).

### Faz 1: Boş ama geçerli cevap

1. Gerekirse Worker yolunu / route eşlemesini düzelt (Faz 0 bulgusuna göre).
2. `SelectSiparis` geçerli bir **boş liste** döner;
   `SetSiparisAktarildi`, `SetSiparisAktarildiIptal` yalnız loglar.
3. Gelirse `?wsdl` GET'ine en küçük WSDL'i dön (yalnız Faz 0 bunu gösterirse).

**Doğrulama:** Vega hata vermeden çekmeye devam ediyor; logda 2 dakikada bir
`SelectSiparis basarili {donenAdet: 0}`; "desteklenmeyen metot" yok. Vega'nın
hata/ileti ekranında sipariş hatası yok.

> **Faz 0–1 sonucu (2026-10-25):** Faz 0 bulguları 2.1.0'da. Faz 1 canlıda (commit `fab3914`): `SelectSiparis` geçerli boş liste, `SetSiparisAktarildi`/`İptal` yalnız log; Faz 0 geçici logları kaldırıldı. 20:49 UTC'de iki sorgu da `SelectSiparis basarili` (donenAdet 0) aldı; hata varken her turda 3 istek geliyordu, şimdi 2 (Vega Fault sonrası bir kez yeniden deniyordu).

> **Faz 2-3 sonucu (2026-10-26 gece):** `Order.vegaId` + `vegaFetchedAt` (kullanıcı onayıyla db push), `lib/vega-siparis.ts` (birim testli), `SelectSiparis` gerçek siparişler, `SetSiparisDurum`, stok koruması canlıda. Canlı denemelerde öğrenilenler:
> 1. Ödenmiş yeni sipariş **OnayBekliyor (1)** gitmeli; Onaylandi (2) ile Vega yalnız "Kargo Bekleyen" sayacını artırdı, listeye almadı.
> 2. Vega yeni siparişi alınca hemen `SetSiparisDurum(<request><Durum>Onaylandi</Durum><SiparisID>N</SiparisID></request>)` çağırıyor; bu Vega'nın kesin alım onayı, `vegaFetchedAt` bu anda yazılıyor (stok koruması burada biter). Cevap `SetSiparisDurumResult{ErrorMessage, IsErros}`.
> 3. **DataContract alanlarının TAMAMI gönderilmeli** (WCF varsayılanları: 0, false, `0001-01-01T00:00:00`, `i:nil`). Yalnız doldurulan alanlar gidince Vega tutarı topladı ama siparişi kaydetmedi.
> 4. `EntegrasyonAktarildi` hep false; Vega `SetSiparisAktarildi` çağırmıyor.
> 5. "Sipariş No" sütunu `SiparisNo` ile dolmadı → `SiparisKodu` da yazılıyor; ödeme `Tarih`'i Vega UTC sayıyor (3 saat ileri göründü) → UTC gönderiliyor. İkisi bir sonraki siparişte doğrulanacak.
> 6. Vega listesinde doğru gelenler: Sipariş Id, tarih, Bireysel, il/ilçe, Müşteri Kodu `TM-<vegaId>`, ad/soyad, genel toplam, e-posta, ödeme durumu, KREDIKARTI/BANKAKART.
> 7. Vega bir kez `UrunServis.SelectTedarikci` çağırdı (desteklenmeyen; şimdilik gerek yok).
> 8. Sipariş silmek/iptal etmek site stoğunu geri eklemiyor (mevcut davranış); deneme sonrası stok elle düzeltildi.
> 9. **5(d) cevaplandı: Vega kullanılabilir stok gönderiyor.** Sipariş Vega'ya düşünce Vega ayırdığı adetleri düşüp `VaryasyonGuncelle` ile gönderdi (2111: 0, 2113: 0); Vega'da iptal edilince serbest kalan stoğu kendisi geri gönderdi (2111: 1, 2113: 2). Kullanıcı Vega ekranında da ayırmayı doğruladı.
> 10. Vega'da iptal **siteye bildirilmiyor** (SetSiparisDurum Iptal gelmedi). Vega'da iptal edilen müşteri siparişi sitede ayrıca iptal/iade edilmeli.
> 11. Fatura tutarı: KDV dahil `Tutar` ile Vega satırı Tutar + KdvTutari olarak faturaladı (1.390 → 1.516,36). Satır artık KDV hariç birim + birim KDV gidiyor (commit `8be9d3c`); 2 adetlik denemede genel toplam 2.780 doğru göründü, detay ekranındaki fatura tutarı ilk gerçek siparişte kontrol edilecek. Ödeme tarihi düzeltmesi doğrulandı. "Sipariş No" ve "F. İsmi" sütunları `SiparisNo`/`SiparisKodu`/`AliciAdi` ile dolmadı (Vega'nın kaynağı bilinmiyor; Sipariş Id ve TM-<id> ile eşleştirilebilir).
> 12. Vega `BaslangicIndex`'i SiparisServis'te sayfa numarası olarak 1'er artırıyor (commit `15976fe`).
> 13. **Gerçek Ticimax WSDL'i** (bir Ticimax mağazasının herkese açık `SiparisServis.svc?singleWsdl`'i) okundu: `WebSiparis` 106 alan; PDF eski. `SiparisNo`, `SiparisKodu`, `ReferansNo` var; bazı ID adları farklı (`FaturaAdresID`, `KargoFirmaID`, `IlID`, `IlceID`, satırda `SiparisID`) - düzeltildi.
> 14. Vega `FaturaAdresi.FirmaAdi`'yı "Firma" sütunu ve Arctos sevkiyat listesi alıcı adı olarak kullanıyor → müşteri adı soyadı yazılıyor (`b3fe065`).
> 15. Vega "No" sütununu `SiparisKaynagi`'ndan aynen, "Site Adresi"ni (faturadaki İnternet Sitesi) `SiparisKaynagi + ".com"` olarak dolduruyor; `Referer`'ı okumuyor → `SiparisKaynagi = "bollmark"` (Site Adresi bollmark.com).
> 16. **"Sipariş No" sütunu veriyle doldurulamadı:** `SiparisNo`, `SiparisKodu`, `ReferansNo`, `OzelAlan1-3`, `BNPLNo`, `MagazaTeslimKodu`, `UyeMusteriKodu`, `OdemeSiparisID` alanlarına ayırt edici değerler (101-110) yazılan denemede hiçbiri görünmedi; `UyeMusteriKodu` Müşteri Kodu'nu da değiştirmedi (TM-<UyeID>). Vega'nın kendi alanı ya da bu sürümde Ticimax için bağlı değil. Kullanıcıya göre Ticimax döneminde sitedeki numara görünüyordu; Vega desteğine sorulabilir.
> 17. Vega bazı siparişlerde `SetSiparisDurum(Onaylandi)` göndermedi (Id 19-22, "Onay Bekliyor" kaldı); o durumda stok koruması 24 saat üst sınırla biter.

### Faz 2: Şema + gerçek siparişler

1. Şema (6. bölüm), kullanıcı onayıyla `db push`.
2. Saf eşleme fonksiyonu (`Order` → `WebSiparis` XML), birim testli
   (`evaluate.test.ts` deseni, veritabanısız).
3. `SelectSiparis` başlangıç anından sonraki, 4. bölümdeki koşullara uyan
   siparişleri döner; `SetSiparisAktarildi` / `İptal` koşullu yazım yapar.
4. Kapatma anahtarı: `VEGA_SIPARIS_AKTARIM` env'i `on` değilse `SelectSiparis`
   boş döner (geri alma bir env değişikliği + redeploy).
5. Admin sipariş detayında küçük bir "Vega'ya aktarıldı: tarih" satırı
   (isteğe bağlı; istenmezse atlanır).

**Doğrulama:** Deneme siparişi (7. bölüm) Vega'da doğru müşteri, adres,
barkod eşleşmesi, adet, tutar, KDV ve kargo ile görünüyor; Vega'da stok
ayrıldı; `vegaTransferredAt` doldu; sonraki çekimlerde aynı sipariş gelmiyor.

### Faz 3: Stok koruması

1. `handleVaryasyonGuncelle`'e 5(b)'deki düşme.
2. 5(d) doğrulaması.

**Doğrulama:** Ödeme ile Vega'nın çekmesi arasında gelen stok gönderiminde
logda `bekleyen: 1` ve site stoğu `VegaStok - 1`. Aktarıldıktan sonra
`bekleyen: 0`.

### Faz 4: İlk gerçek müşteri siparişi

Bir hafta boyunca her siparişte Vega'daki kayıt ve fatura kontrol edilir;
iptal/iade olursa 4. bölümdeki elle akış uygulanır ve gerekirse plan
güncellenir.

### Test stratejisi (canlı veriye dokunmadan)

- **Birim testleri:** Eşleme fonksiyonu sahte `Order` nesneleriyle (indirimli,
  taksitli, tutarı 0, varyantı silinmiş satır, ayrı ilçe/il). Çıktı XML'i
  alfabetik sıra ve namespace açısından kontrol edilir. `npm test`.
- **Yerelde okuma denemesi:** `curl` ile yerel sunucuya `SelectSiparis`
  isteği (gerçek `UyeKodu` ile). `SelectSiparis` salt okuma olduğu için
  ortak veritabanına zarar vermez. `SetSiparisAktarildi` **yerelden
  denenmez** (canlı siparişe yazar).
- **Canlıda Vega ile deneme siparişi** (adımlar):
  1. Kapatma anahtarı açılmadan önce, Vega'da stoğu bol, ucuz bir varyant seç;
     stoğunu not et.
  2. Kendi adına sitede sipariş ver. İki seçenek:
     - Gerçek kartla öde, deneme bitince iyzico'dan aynı gün iptal (admin
       sipariş detayından tam iptal). Ya da:
     - Yalnız kendi e-postana, tek kullanımlık %100 + ücretsiz kargo
       kuponuyla tutarı 0 sipariş (iyzico'ya gitmez). Not: tutarı 0 olan
       siparişin ödeme satırı farklı olduğu için gerçek kartlı deneme daha
       temsili.
     Her iki yolda da müşteriye/admine mail gider, Meta/GA4 `purchase` olayı
     (rıza varsa) gider, site stoğu 1 düşer.
  3. Anahtarı aç, 2–4 dakika bekle; Vega'da sipariş görünsün.
  4. Kontrol listesi: müşteri, adres, satırlar (barkod eşleşmesi yeşil mi),
     tutarlar, KDV, kargo satırı, ödeme tipi; Vega'da stok ayrıldı mı;
     5(d) doğrulaması.
  5. **Faturayı kesme.**
- **Geri alma:**
  1. Vega'da deneme siparişini iptal et / sil (ayrılmış stok serbest kalır).
  2. Sitede siparişi iptal et; gerçek kartlıysa iyzico iptali + "stoğa geri
     ekle". Kuponu pasife al.
  3. Sorun varsa `VEGA_SIPARIS_AKTARIM` anahtarını kapat (redeploy); Vega
     boş liste görür. `vegaTransferredAt` dolu kalır, zararsız.
  4. Gerekirse Vega'dan stok gönderimiyle site stoğunu Vega'ya hizala.

---

## 8. Benim Vega'da / mağazada kontrol etmem gerekenler

**Cevaplananlar (2026-10-25):**

- Vega'da sipariş bölümü kapalıydı, kullanıcı açtı (madde 1–2'nin kökü).
- Bireysel faturada TC olarak `11111111111` yazılıyordu: `FaturaAdresi.VergiNo`
  = `11111111111`, ek veri toplamaya gerek yok (madde 6, bireysel kısım).
- İl/ilçe metin olarak kabul ediliyor: `IlId`/`IlKodu` 0/boş kalabilir
  (madde 7).
- Vega'da sipariş iptal edilince siteye stok geri geliyordu (madde 8–9,
  bkz. 5(d)).

**Hâlâ açık:**

1. Vega'nın "2 dakikada bir sipariş istiyor" bilgisini nereden görüyorsun?
   (ekranda sayaç mı, log/ileti penceresi mi?) O ekranda bir hata metni var
   mı? Ekran görüntüsü çok yardımcı olur.
2. Vega'da Ticimax site tanımında sipariş için **ayrı bir adres, servis adı
   ya da "sipariş aktarımı aktif" kutusu** var mı? Orada `SiparisServis`
   ya da farklı bir Site Adı yazıyor mu?
3. Vega'nın Ticimax sipariş ayarlarında **hangi durumdaki siparişler**
   çekilsin seçeneği var mı (Onaylandı, Paketleniyor…)? Ne seçili?
4. Ticimax döneminde Vega'ya düşen siparişte **ödeme tipi** nasıl eşleniyordu
   (kredi kartı → hangi kasa/banka hesabı)? Taksit bilgisi kullanılıyor muydu?
5. Kargo ücreti Vega'da **ayrı bir hizmet satırı** olarak mı geliyordu? Hangi
   stok/hizmet kartına bağlıydı?
6. Fatura için **TC kimlik no** isteniyor mu? Ticimax döneminde bireysel
   müşterilerde ne yazıyordu (11111111111 mi)? Kurumsal (vergi no) fatura
   istendiği oluyor mu? (Site şu an ikisini de toplamıyor.)
7. Vega il/ilçeyi **metin** olarak mı kabul ediyor, yoksa kod (plaka) mı
   istiyor?
8. Sipariş Vega'ya düşünce stok **hemen** mi ayrılıyor, yoksa siparişi
   onaylayınca mı? Ayrılmış stok, Vega'nın siteye gönderdiği stoktan
   **düşülüyor mu** (5(d))? Stok kartında "rezerve" gösteriliyor mu?
9. Vega'da bir sipariş **iptal** edilince ya da faturası kesilince siteye
   bir şey gönderiyor mu (Ticimax döneminde sipariş durumu Ticimax'ta
   değişiyor muydu)?
10. Vega aynı sipariş numarası / ID ikinci kez gelirse ne yapıyor: yeni
    sipariş mi açıyor, atlıyor mu? (Ticimax döneminden hatırlıyorsan.)
11. Worker loglarını okumak için Cloudflare'e giriş yapabilir misin
    (`npx wrangler login`) ya da "Edit Cloudflare Workers" yetkili bir token
    verebilir misin? Faz 0 için gerekiyor.

---

## 9. Açık sorular

1. Sipariş isteği neden Vercel'e ulaşmıyor (Faz 0'ın cevabı).
2. Vega `SetSiparisAktarildi` çağırıyor mu?
3. `WebSiparisUrun.Tutar` birim fiyat mı, satır toplamı mı? `IndirimTutari`
   ile satır tutarları birlikte okunursa indirim iki kez düşer mi?
4. `SiparisTarihi` olarak sipariş anı mı, ödeme anı mı?
5. `OdemeTipi` 0 mı, 17 mi?
6. `StokDustu = true` Vega'nın davranışını değiştiriyor mu (ör. stok ayırmayı
   atlıyor mu)? Atlıyorsa `false` gönderilmeli; bu durumda (b)'deki koruma
   daha da önemli.
7. Sipariş durumu kod sırası (PHP istemcisi ile PDF arasında bir kayma var).
8. Vega `?wsdl` istiyor mu? (UrunServis'te istemedi.)

---

## 10. Riskler

| Risk | Etki | Önlem |
|---|---|---|
| Faz 0'da istek hiç yakalanamaz | İş ilerlemez | Vega ayar sorularına (8. bölüm) cevap; webhook.site ile kısa yakalama |
| Yanlış alan biçimi | Vega siparişi sessizce yutar ya da hatalı fatura | Vega hataları sessiz yutuyor (2026-09 bulgusu); her fazda Vega ekranından görsel kontrol, kapatma anahtarı |
| Eski siparişlerin topluca Vega'ya düşmesi | Vega'da yüzlerce sahte stok ayrımı | Başlangıç anı sabiti |
| Çift aktarım | Çift stok ayrımı / fatura | Koşullu `vegaTransferredAt` yazımı + sabit `ID` |
| Vega aktarıldı bildirmiyor | (b) koruması bitmez | 30 dk üst sınır |
| Vega fiziksel stok gönderiyor | (b) yanlış anda biter | 5(d) doğrulaması, gerekirse plan güncelleme |
| Aktarılmış siparişin iptal/iadesi Vega'ya gitmez | Vega'da yanlış ayrılmış stok | İlk sürümde elle işlem (4. bölüm) |
| TC/VKN ve fatura adresi toplanmıyor | Kurumsal fatura kesilemez | Şimdilik bireysel; gerekirse ayrı iş |
| Ortak veritabanı | Yerel deneme canlıya yazar | Yerelde yalnız salt-okuma metotları; yazan metot canlıda tek deneme siparişiyle |
| Deneme siparişi yan etkileri | Mail, Meta/GA4 purchase, kupon sayacı | Kendi e-postan, olaylar rızaya bağlı; geri alma adımları |
