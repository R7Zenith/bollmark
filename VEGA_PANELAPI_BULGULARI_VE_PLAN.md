# Vega "E-Ticaret" Entegrasyonu — panelapi Keşif Bulguları ve Uygulama Planı

## ÇALIŞIYOR (2026-09-11) — ürün listesi + barkod eşleştirme + STOK SENKRONİZASYONU

Uçtan uca çalışan akış (canlı doğrulandı):

1. Vega'nın "Ürün Yönetimi / TiciMax → Listele" ekranında **9 yayındaki
   Bollmark ürünü, tüm varyantlarıyla (barkod, stok kodu, adet, fiyat,
   kategori)** listelendi.
2. Kullanıcı Vega'daki stok kartlarıyla **barkod eşleştirmesini** yaptı
   (yeşil ışık) — bu tamamen Vega'nın kendi içinde olur, sunucumuza istek
   gelmez.
3. Vega'dan "stok miktarlarını gönder" denildiğinde **sitedeki stoklar
   gerçekten güncelleniyor** (`VaryasyonGuncelle`).

**Artık stok konusunda kaynak Vega'dır**: gönderdiği değer sitedeki stoğun
üzerine yazılır. Sadece barkodu eşleştirilmiş varyantlar etkilenir,
eşleşmeyenlere dokunulmaz.

Çalışan mimari:

```
Vega (Site Tipi: TiciMax, Site Adı: bollmark-vega-bridge.ozilevent.workers.dev)
  -> Cloudflare Worker (vega-bridge-worker/)
  -> https://bollmark.com/Servis/UrunServis.svc  (src/app/Servis/[service]/route.ts)
  -> Neon Postgres (Prisma)
```

### Çözüme götüren 4 kritik bulgu

1. **Vercel'e doğrudan bağlanılamıyor.** Vega'nın eski Embarcadero SOAP
   istemcisi webhook.site'a (Cloudflare) sorunsuz HTTPS isteği atarken
   `bollmark.com`'a (Vercel) hiç ulaşamıyordu — istek sessizce kayboluyordu,
   Vercel loglarında **hiçbir iz yoktu** (TLS uyumsuzluğu şüphesi). Çözüm:
   zaten var olan Cloudflare Worker köprüsü `/Servis/*` yolunu da iletecek
   şekilde genişletildi. Vega artık Worker'a bağlanıyor.
2. **Vega TÜM hataları sessizce yutuyor.** Kasten gönderilen bir SOAP Fault'a
   bile "Kategoriler Başarıyla Yüklendi" dedi. Yani o başarı penceresi
   **hiçbir şey kanıtlamaz** - kategori ekranı teşhis için kullanılamaz.
   Buna karşılık **Ürün Yönetimi → Listele ekranı gerçek hata metnini
   gösteriyor** (ayrıştıramadığı ham XML'i ekrana döküyor) - teşhis hep bu
   ekrandan yapılmalı.
3. **DataContract namespace'i tahminle bulunamaz, Vega'nın kendi isteğinden
   okundu.** İki tahmin (".../2004/07/UrunServis", ".../2004/07/Ticimax")
   tutmadı. Vega'nın gönderdiği `SelectUrunCount` isteğinin filtre
   alanlarında namespace açıkça görülüyordu:
   `<Aktif xmlns="http://schemas.datacontract.org/2004/07/">-1</Aktif>`
   — yani **sonu BOŞ**: `http://schemas.datacontract.org/2004/07/`
   (Ticimax'ın DataContract sınıfları C# tarafında kök/isimsiz namespace'te).
   Genel ders: bilinmeyen bir şemayı tahmin etmek yerine, karşı tarafın
   kendi İSTEK gövdesinde sızdırdığı ipuçlarına bakmak çok daha hızlı.
4. **webhook.site ile hızlı iterasyon.** webhook.site'ın ücretsiz API'si ile
   sabit bir cevap tanımlanabiliyor, böylece her XML denemesi için deploy
   beklemeye gerek kalmadı:
   `curl -X PUT https://webhook.site/token/<TOKEN> -H "Content-Type: application/json" -d '{"default_status":200,"default_content_type":"text/xml; charset=utf-8","default_content":"<xml...>"}'`
   Ama dikkat: tek bir sabit cevap döndüğü için ÇOK uç noktalı testlerde
   (SelectUrunCount + SelectUrun birlikte) yetersiz kalır, gerçek sunucu gerekir.

### Uygulanan uç noktalar (`src/app/Servis/[service]/route.ts`)

- `SelectKategori` — Bollmark kategorilerini `Kategori` şemasıyla döner.
  (Not: Vega'nın Kategori Ağacı ekranı hâlâ boş görünüyor ama bu akış için
  gerekmiyor — ürün listesindeki kategori adları doğru geliyor.)
- `SelectUrunCount` — yayındaki ürün sayısı (basit int).
- `SelectUrun` — `BaslangicIndex`/`KayitSayisi` ile sayfalanmış ürün listesi;
  `UrunKarti` alanları ALFABETİK sırada (WCF varsayılanı), varyantlar
  `Varyasyonlar` altında (barkod, stok kodu, adet, fiyat).
- `VaryasyonGuncelle` — **stok senkronizasyonu**. Vega her varyant için ayrı
  bir istek atar. Yakalanan gerçek gövde:
  ```xml
  <VaryasyonGuncelle xmlns="http://tempuri.org/">
    <UyeKodu>...</UyeKodu>
    <urun xsi:type="NS1:Varyasyon">
      <Aktif>true</Aktif><ID>28</ID><StokAdedi>0</StokAdedi>
    </urun>
    <ayar xsi:type="NS1:VaryasyonAyar">
      <AktifGuncelle>true</AktifGuncelle><StokAdediGuncelle>true</StokAdediGuncelle>
    </ayar>
  </VaryasyonGuncelle>
  ```
  `urun.ID` = `ProductVariant.vegaId`. `ayar` bloğu hangi alanların
  yazılacağını söyler; sadece bayrağı `true` olan alan güncellenir.
  `Aktif` bilinçli olarak yok sayılıyor (Bollmark'ta varyant seviyesinde
  aktiflik alanı yok; ürünün tamamını pasife çekmek istenmeyen bir yan etki
  olurdu). Cevap tipi `int` — güncelleme olduysa varyant ID'si, olmadıysa 0.

### Şema alanları nereden alındı

Ticimax'ın `Kategori`, `UrunKarti`, `Varyasyon`, `VaryasyonAyar` sınıflarının
tam alan listeleri, gerçek bir Ticimax mağazasının WSDL'inden üretilmiş açık
kaynak PHP istemcisinden okundu:
`github.com/asilbalaban/ticimax-wsdl-php` (örn.
`Urun/Karti/TicimaxStructUrunKarti.php`, `Varyasyon/TicimaxStructVaryasyon.php`).
Resmî dokümantasyon: `static.ticimax.com/dokumanlar/webservis.pdf` ve
`.../UrunServis.pdf`. **Alanlar cevapta ALFABETİK sırada yazılmalı** (WCF
DataContract varsayılanı); göndermediğimiz alanlar `minOccurs=0` olduğu için
atlanabiliyor.

### Veritabanı tarafı

Ticimax şeması tamsayı kimlik beklediği için Prisma modellerine kalıcı,
otomatik artan `vegaId` alanları eklendi: `Category.vegaId`,
`Product.vegaId`, `ProductVariant.vegaId`. Kimlik doğrulama için
`VegaIntegration.ticimaxUyeKodu` (düz metin - Vega'ya aynen kopyalanan bir
API anahtarı gibi çalıştığı ve panelde gösterilmesi gerektiği için
hash'lenmiyor). Hepsi `npm run db:push` ile Neon'a uygulandı.

Kimlik doğrulama: Vega'daki **"Web Servis Kodu"** alanı SOAP gövdesinde
`<UyeKodu>` olarak gelir; `/admin/ayarlar` sayfasındaki "Üye Kodu" değeriyle
(VegaIntegration.ticimaxUyeKodu) karşılaştırılır.

Vega ayar ekranındaki "Site Adı" kutusunun önündeki sabit `www.` etiketi
**sadece görseldir** - gerçek istekte host'a eklenmiyor (canlı yakalamayla
doğrulandı).

### Sırada (bir sonraki oturum buradan devam etsin)

- **Fiyat senkronizasyonu**: Vega listesinde "Liste Fiyat" doluyor ama
  "Satış Fiyatı" 0 görünüyor — muhtemelen `IndirimliFiyati` alanı da
  doldurulmalı. Ayrıca Vega fiyat güncellemesi gönderirse
  `VaryasyonGuncelle` içinde `SatisFiyatiGuncelle`/`IndirimliFiyatiGuncelle`
  bayrakları gelecek; şu an sadece `StokAdediGuncelle` işleniyor, fiyat
  alanları için handler genişletilmeli.
- **Sipariş akışı**: Vega periyodik olarak (~2 dakikada bir)
  `SiparisServis.svc` üzerinde `SelectSiparis` çağırıyor — dikkat, bu
  istekler **GET** olarak geliyor (gövdesiz), route şu an sadece POST
  export ediyor, o yüzden hiç loglanmıyor. Sitedeki siparişlerin Vega'ya
  düşmesi için `SelectSiparis` + `SelectSiparisUrun` + `SelectSiparisOdeme`
  uygulanmalı (alan listeleri yine ticimax-wsdl-php reposundan alınabilir).
- **Kategori Ağacı ekranı**: hâlâ boş; ürün akışı için gerekmediğinden
  ertelendi.

### Teşhis yöntemleri (tekrar gerekirse)

- **Vercel logları** (uygulama tarafı, `[vega-tcmx]` etiketli satırlar):
  `npx vercel logs bollmark.com --token <VERCEL_TOKEN> --scope team_OUEAesDWsxc7OOxNugNNIY5l --since 15m -n 300`
- **Cloudflare Worker canlı trafiği** (istek Worker'a ulaşıyor mu):
  `cd vega-bridge-worker && CLOUDFLARE_API_TOKEN=<CF_TOKEN> npx wrangler tail --format pretty`
- **Bilinmeyen bir metot geldiğinde** route.ts gövdeyi de logluyor
  (UyeKodu gizlenerek) — yeni bir uç noktanın şeması tek canlı denemede
  böyle yakalandı.
- Token'lar repoda saklanmıyor; her yeni oturumda kullanıcıdan istenmeli
  (Vercel: Account Settings → Tokens, Cloudflare: My Profile → API Tokens →
  "Edit Cloudflare Workers").

## GÜNCEL DURUM (2026-09-10 gece) — buradan devam et — Ticimax taklidi yaklaşımı

**Yön değişikliği**: Aşağıdaki "panelapi" (JSON) yaklaşımı tıkanınca (bkz.
altındaki eski GÜNCEL DURUM bölümü), kullanıcının önerisiyle farklı bir yol
denendi: Vega'nın "Site Tipi" ayarında zaten **Ticimax** gibi hazır,
bilinen platform entegrasyonları var. Ticimax'ın GERÇEK, resmi web servis
protokolünü (SOAP/WCF, dokümante) taklit edip Vega'ya "ben bir Ticimax
mağazasıyım" dedirtmek, bizim uydurduğumuz JSON formatını tahmin etmekten
çok daha güvenilir bir temel sağlıyor.

**Bulgular**:
- Ticimax'ın resmi dokümantasyonu: `static.ticimax.com/dokumanlar/webservis.pdf`
  ve `static.ticimax.com/dokumanlar/UrunServis.pdf`. Protokol SOAP/WCF
  (`.svc` uzantılı), REST/JSON DEĞİL. 4 servis: `UrunServis.svc`
  (kategori/marka/tedarikçi/ürün), `SiparisServis.svc`, `UyeServis.svc`,
  `CustomServis.svc`. Kimlik doğrulama tek bir düz metin `UyeKodu`
  parametresiyle (her metoda geçiliyor, email+parola yok).
- **webhook.site ile gerçek Vega isteği yakalandı** (Vega'da Site Tipi=
  Ticimax seçilip Site Adı geçici olarak webhook.site'a çevrilerek):
  ```
  POST {SiteAdı}/Servis/UrunServis.svc
  SOAPAction: http://tempuri.org/IUrunServis/SelectKategori
  User-Agent: Embarcadero SOAP 1.4
  <SelectKategori xmlns="http://tempuri.org/">
    <UyeKodu>...</UyeKodu><kategoriID>0</kategoriID><dil>tr</dil>
  </SelectKategori>
  ```
  Önemli: Vega, Site Adı'nın sonuna kendisi `/Servis/UrunServis.svc` ekliyor
  ve **çift slash sorunu burada YOK** (panelapi'deki gibi tek `/` ile
  birleşiyor) - yani Cloudflare Worker köprüsüne gerek kalmadan doğrudan
  `bollmark.com`'a bağlanılabilir.
- **Gerçek bir Ticimax mağazasının (lorisparfum.com) WSDL'inden otomatik
  üretilmiş açık kaynak bir PHP SOAP istemcisi bulundu**
  (`github.com/asilbalaban/ticimax-wsdl-php`) - `Kategori` DataContract
  sınıfının TAM alan listesi buradan doğrulandı: `Aktif`(bool), `ID`(int),
  `Icerik`(string, nillable), `KategoriMenuGoster`(bool), `Kod`(string),
  `PID`(int, üst kategori), `SeoAnahtarKelime`/`SeoSayfaAciklama`/
  `SeoSayfaBaslik`(string), `Sira`(int), `Tanim`(string), `Url`(string).
  Alfabetik sıra (`Aktif, ID, Icerik, KategoriMenuGoster, Kod, PID,
  SeoAnahtarKelime, SeoSayfaAciklama, SeoSayfaBaslik, Sira, Tanim, Url`)
  C#'ın DataContract varsayılan sıralamasıyla eşleşiyor, response XML'inde
  bu sırayla kullanıldı.
  - **Not**: `lorisparfum.com` artık Ticimax kullanmıyor (Shopify'a
    geçmiş, `?wsdl` isteği 404 döndü) - bu yüzden gerçek namespace URI'sini
    (DataContract namespace'i) canlı bir WSDL'den doğrulayamadık, sadece
    alan adı/tip listesini doğrulayabildik.
  - **Denenmeyen/vazgeçilen yol**: Ticimax'ın müşteri referans sayfasından
    bulunan başka canlı mağazaların (`tudors.com` vb.) `.svc?wsdl`
    adreslerini topluca çekmeye çalışırken **Claude Code'un güvenlik
    sınıflandırıcısı bunu engelledi** (üçüncü taraf sitelerin iç servis
    dosyalarını otomatik/toplu taramak gibi göründüğü için) - bu zorlanmadı,
    tahmine dayalı ilerlendi.

**Uygulanan** (bu oturumda kodlandı, deploy edilmeyi bekliyor):
- `prisma/schema.prisma`: `Category.vegaId` (Int, `@unique @default(autoincrement())`)
  eklendi - Ticimax'ın int kategori ID'si beklemesi nedeniyle (Prisma'nın
  cuid string'leri yerine). `VegaIntegration.ticimaxUyeKodu` (String, düz
  metin - hash'lenmedi çünkü Vega'ya aynen kopyalanacak bir değer, panelden
  gösterilebilmesi gerekiyor). `npx prisma db push --accept-data-loss` ile
  Neon'a uygulandı (kullanıcı onayı + Prisma'nın AI-agent güvenlik
  kontrolü için `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` env'i
  kullanıldı - gerçek veri kaybı YOK, sadece yeni sütun eklendi).
- **Yeni route**: `src/app/api/vega-tcmx/Servis/[service]/route.ts` - şu an
  sadece `SelectKategori` metodunu (UrunServis.svc) implemente ediyor:
  `UyeKodu`'nu `VegaIntegration.ticimaxUyeKodu` ile karşılaştırıyor,
  Bollmark kategorilerini yukarıdaki `Kategori` şemasına göre SOAP XML
  cevabı olarak dönüyor (`SelectKategoriResponse`/`SelectKategoriResult`
  sarmalaması, `http://schemas.datacontract.org/2004/07/UrunServis`
  namespace'i - **bu namespace TAHMİNİ**, servis dosya adından türetildi,
  canlı testte yanlış çıkarsa Vega'nın davranışından anlaşılıp
  düzeltilecek). Başka bir metot çağrılırsa SOAP Fault dönüp logluyor
  (hangi metodun sırada geldiğini görmek için).
- Admin panel (`/admin/ayarlar`): yeni "Vega — Ticimax Taklidi (SOAP)
  Entegrasyonu" kartı - `ticimaxUyeKodu` için bir form alanı.

**Sıradaki adım (henüz yapılmadı)**:
1. Kullanıcı admin panelden `/admin/ayarlar` içinde yeni karta bir Üye Kodu
   girip kaydetsin.
2. Vega'da Site Tipi=Ticimax, Site Adı=`https://bollmark.com/api/vega-tcmx`,
   Üye Kodu=panelden girilen deger olarak ayarlanıp **gerçek** "Kategori
   Seçimi" denensin (webhook.site değil, artık canlı sunucumuz - gerçek
   bir cevap dönebiliyor).
3. Sonuç: kategoriler gerçekten göründü mü, boş mu kaldı, hata mesajı mı
   çıktı? Vercel loglarından (`[vega-tcmx]` etiketli satırlar,
   `npx vercel logs`) hangi metodun çağrıldığı ve gönderdiğimiz XML
   görülebilir. Namespace/sarmalama tahmini yanlışsa (en olası hata
   noktası budur) buna göre düzeltilip tekrar denenecek - ama artık
   rastgele tahmin değil, gerçek Ticimax şemasına dayanan küçük
   ayarlamalar olacak.
4. Kategori Seçimi çalışırsa: `SelectMarka`, `SelectTedarikci`,
   `SelectParaBirimi`, ve asıl hedef olan `SaveUrun` (ürün yükleme)
   metotları aynı yöntemle (webhook.site ile gerçek istek yakalama +
   `ticimax-wsdl-php` reposundaki ilgili struct dosyalarından şema alma)
   sırayla eklenecek.

---

## GÜNCEL DURUM (2026-09-10 akşamı, eski/JSON yaklaşımı — artık aktif yol
DEĞİL, referans için tutuluyor)

**Çalışan kısım**: Vega ↔ Bollmark bağlantısı, giriş (Account/Token) ve
kategori listesi (Categories) HTTP seviyesinde tam çalışıyor — Vercel
loglarıyla defalarca doğrulandı (200 OK, doğru veri, doğru `Count`/
`TotalPageSize`). Mimari:

```
Vega SanalMağaza (Site Adı: https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega)
  -> Cloudflare Worker (vega-bridge-worker/, cift slash'i normalize edip iletir)
  -> https://bollmark.com/api/vega/panelapi/... (Next.js/Vercel, src/app/api/vega/panelapi/[...path]/route.ts)
  -> Neon Postgres (Prisma)
```

**Kilitlenen nokta**: Vega'nın "Kategori Seçimi" penceresi (ve buna bağlı
olarak "Seçili Ürünleri Yükle" akışı) HTTP isteği başarılı dönmesine
rağmen (`Data` dizisinde 40 kategori, doğru `Count`/`TotalPageSize`)
**hep boş/"No data to display" kalıyor**. Ürün yükleme denemesi de
kategori ağacı boş olduğu için Bollmark'a **hiç istek atmadan** anında
iptal oluyor — yani bu, atlanabilecek bir ayrıntı değil, gerçek bir
önkoşul engeli.

**Denenip İŞE YARAMAYAN kategori-ogesi format degisiklikleri** (hepsi
canli Vega testiyle dogrulandi, sirayla):
1. Kok kategoriler icin `ParentId: null` -> `ParentId: ""` (bos metin).
2. `Id`/`ParentId` degerlerini Prisma cuid'den GUID formatina cevirmek
   (`toGuid()` fonksiyonu, route.ts'te hala duruyor).
3. JSON cevaplara acikca `charset=utf-8` eklemek (Turkce karakter
   bozulmasi ihtimaline karsi).
4. Her kategori ogesine ic ice (nested) `Children`/`SubCategories` dizisi
   eklemek (duz `Data` listesi + ic ice agac ayni anda donuluyor).

**Ayrica (asil sorunla ilgisiz ama yol boyunca cikan ve DUZELTILEN gercek
hatalar)**:
- `TotalPageSize` alani once "kayit sayisi" sanildi, gercekte Vega bunu
  "toplam SAYFA sayisi" olarak okuyor - yanlis deger Vega'nin 40 sayfayi
  tek tek (cogu bos) cekmesine yol acmisti. Duzeltildi.
- `Count` adinda ayrica bir alan daha gerekiyordu (`TotalPageSize`'a ek).
  Eklendi.
- Token/oturum sorunu: once JWT (197 karakter) kullanildi, "gecersiz
  token" hatalari cikti - once "Vega token'i kirpiyor" sanildi (kisa opak
  32 karakterlik token'a gecildi), ama GERCEK sebep baskaydi: tek bir
  "aktif token" alani, Claude'un test icin attigi HER giris isteginin
  Vega'nin kendi aldigi token'i sessizce GECERSIZ KILMASIYDI. Ayri bir
  `VegaSession` tablosuna gecilip her giris kendi bagimsiz satirini alacak
  sekilde duzeltildi - bu artik saglam, tekrar test edilebilir.

**Sonuc**: Kategori-ogesi seviyesindeki makul tahminler (isimlendirme,
tip, null/bos, encoding, duzlik/ic-ice-lik) tukendi. Sunucu tarafinda
yapabilecegimiz sey kalmadi - Vega'nin `panelapi/Categories` cevabini TAM
OLARAK nasil bir semaya gore bekledigini bilmiyoruz ve bunu tahminle
bulmak cok fazla deploy+test turu gerektiriyor.

### Sıradaki adım (kullanıcı eve gidince)

**Onerilen**: Vega'nin kendi teknik destek ekibine (SanalMagaza v_9.9.0.6
uretici destegi) su soruyu sormak - asagidaki teknik metni oldugu gibi
kopyalayip gonderebilir:

> Merhaba, panelapi entegrasyonu uzerinde calisiyoruz.
> `GET panelapi/Categories?PageIndex=1&PageSize=100` uc noktasina
> Bearer token ile istek attigimizda 200 OK donuyoruz ve govdede su
> sekilde bir JSON gonderiyoruz (asagida ornek), ama "Kategori Secimi"
> penceresi hep bos kaliyor / "No data to display" gosteriyor. Sunucu
> tarafinin dondurmesi gereken TAM JSON semasini (alan adlari, tipler,
> zorunlu/opsiyonel alanlar, sayfalama zarfi) paylasabilir misiniz?
>
> Su an gonderdigimiz ornek govde:
> `{"Data":[{"Id":"<guid>","Name":"Bluz","ParentId":"","Children":[]}],
> "Count":40,"TotalPageSize":1,"TotalPages":1,"PageIndex":1,"PageSize":100}`

Cevap gelince route.ts'teki `handleCategories` fonksiyonu (bkz.
`src/app/api/vega/panelapi/[...path]/route.ts`) gercek semaya gore tek
seferde duzeltilebilir - artik deploy+test dongusune gerek kalmadan.

**Alternatif/paralel**: Kullanicinin bilgisayarinda Fiddler/Wireshark gibi
bir arac calistirilip Vega'nin `Categories` cevabini aldiktan SONRA
NE YAPTIGI (hata firlatiyor mu, baska bir istek mi atiyor, cevabi nasil
isliyor) gozlemlenebilir - ama bu daha ileri duzey bir adim, once vendor
destegi denenmeli.

### Devam ederken hatırlatmalar

- **Vercel loglarini okumak icin** (bu oturumda kullanilan yontem):
  `cd Bollmark && npx vercel logs --token <TOKEN> --scope team_OUEAesDWsxc7OOxNugNNIY5l --since 10m --limit 300`
  (`--token` kullanicidan alinmis gecici bir Vercel API token'idir, repoda
  saklanmadi - yeni oturumda kullanicidan tekrar istenmeli, dash.vercel.com
  -> Account Settings -> Tokens).
- **Worker'i yeniden deploy etmek icin**: `cd vega-bridge-worker && npx wrangler deploy`
  (Cloudflare API token gerekir, dash.cloudflare.com -> My Profile ->
  API Tokens -> "Edit Cloudflare Workers" sablonu; repoda saklanmadi).
- **Vega'daki mevcut ayarlar**: Site Adi =
  `https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega`, E-Mail =
  `oguzhanleventoglu@hotmail.com`, Parola = kullanicinin /admin/ayarlar
  panelinden belirledigi deger (Caps Lock'a dikkat - daha once bir kere
  yanlislikla BUYUK harfle kaydedilmisti).
- Test icin curl ile giris/kategori cekme ornegi (artik guvenle
  calistirilabilir, Vega'nin oturumunu BOZMUYOR - VegaSession duzeltmesi
  sayesinde):
  ```
  TOKEN=$(curl -s -X POST "https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega/panelapi//Account/Token" -H "Content-Type: application/json" -d '{"email":"oguzhanleventoglu@hotmail.com","password":"<parola>"}' | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d).token))")
  curl -s "https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega/panelapi//Categories?PageIndex=1&PageSize=100" -H "Authorization: Bearer $TOKEN"
  ```

Bu dosya VEGA_ENTEGRASYON_PLANI.md'nin devamı. Orada karar verilen
"webhook.site ile canlı yakalama" yöntemi uygulandı ve gerçek istekler
yakalandı. Bu dosya o bulguları ve buradan sonraki uygulama planını içerir.

## Nasıl yakalandı

Kullanıcı VegaSanalMağaza programında (v_9.9.0.6) "Ürün Yönetimi" ekranından
ürünleri seçip "Seçili Ürünleri Yükle" dedi; bundan önce "Kategori Seçimi"
penceresi açıldı ve "No data to display" gösterdi (kategori listesi boş
geldiği için ürün yüklenemiyor). Vega'nın "E-Ticaret" ayarındaki "Site Adı"
alanına geçici olarak bir webhook.site adresi yazılmış, Vega'nın o adrese
attığı gerçek istekler webhook.site'ta yakalanıp incelendi.

## Yakalanan istekler

### 1. Login: `POST {SiteAdı}/panelapi//Account/Token`

Headers:
```
User-Agent: Embarcadero RESTClient/1.0   (Vega Delphi ile yazılmış)
Accept: application/json
Content-Type: application/json
Accept-Charset: utf-8, *;q=0.8
```

Body:
```json
{
  "email": "<Vega'daki 'E-Mail' alanına girilen değer>",
  "password": "<Vega'daki 'Parola' alanına girilen değer>",
  "rememberMe": true
}
```

Bu istek testte 4 kez tekrarlandı (aynı saniyede) — muhtemelen Vega
beklediği formatta bir cevap alamayınca (webhook.site her zaman boş/200
dönüyor) birkaç kez retry ediyor.

**Beklenen davranış:** Bollmark tarafı bu isteği email+parola ile doğrulayıp
bir bearer token dönmeli. Vega'nın bu token'ı sonraki isteklerde nasıl bir
JSON alanından okuduğunu (örn. `token`, `accessToken`, `access_token`) şu an
kesin bilmiyoruz — webhook.site gerçek bir cevap vermediği için Vega sonraki
adıma (Categories) **boş bir Bearer ile** geçti, yani cevabı parse edemedi
ya da hiç cevap gelmediği için varsayılan/boş değerle devam etti.

### 2. Kategori listesi: `GET {SiteAdı}/panelapi//Categories?PageIndex=1&PageSize=100`

Headers:
```
Authorization: Bearer          (boş — login'den gerçek token gelmediği için)
Accept: application/json
Content-Type: application/json
```

Query string: `PageIndex=1`, `PageSize=100` — sayfalanmış bir liste
bekleniyor.

Bu, "Kategori Seçimi" penceresindeki "No data to display" durumunun kesin
sebebi: Vega, ürün yüklemeden önce **Bollmark'ın kendi kategori ağacını** bu
uç noktadan çekmeye çalışıyor.

## Önemli teknik detay: çift slash

Her iki istekte de yol `panelapi//Account/Token` ve `panelapi//Categories`
şeklinde **çift `/`** ile geldi (Site Adı'nın sonuna kullanıcı trailing
slash eklemedi, dolayısıyla bu Vega'nın kendi tarafında path'i
`"panelapi/" + "/Account/Token"` gibi birleştirmesinden kaynaklanıyor).
Bollmark tarafındaki route'lar bu çift slash'i de karşılayacak şekilde
tasarlanmalı (örn. gelen path'i normalize eden bir middleware/rewrite).

## Bilinmeyenler / araştırma sonucu

Web'de "Vega panelapi" için genel-geçer, herkese açık bir API dokümanı
bulunamadı (Vega bu tür entegrasyonları destek ekibi üzerinden,
özel/kapalı doküman paylaşarak yürütüyor gibi görünüyor). Yani protokolün
geri kalanını (Categories/Account/Token dışındaki uç noktalar: muhtemelen
Brands, Warehouses/Depo listesi, Products, Stock, Orders) da aynı
"canlı yakalama + deneme-yanılma" yöntemiyle adım adım çıkarmamız gerekecek.

## Önerilen uygulama planı (Claude Code ile)

1. Bollmark projesine `/api/vega/panelapi/...` altında bir route grubu
   eklenecek; gelen path'teki tekrarlanan `/` karakterleri normalize
   edilecek (örn. bir middleware ile `//` -> `/`), böylece Vega'nın
   `panelapi//Account/Token` ve `panelapi//Categories` gibi çift slash'li
   isteklerini doğru route'a yönlendirebilelim.
2. Ayrı bir "Vega entegrasyon kullanıcısı" (email + parola, admin panel
   personel hesaplarından bağımsız, tek kullanıcı yeterli) modeli/ayarı
   eklenecek — Vega'nın "E-Mail"/"Parola" alanlarına bunlar girilecek.
3. `POST /api/vega/panelapi/Account/Token`: email+parola doğrulanacak,
   başarılıysa kısa ömürlü bir JWT üretilecek ve olası birkaç yaygın alan
   adıyla birlikte dönülecek ki Vega hangisini okuyorsa çalışsın (örn. hem
   `token` hem `accessToken` alanı aynı değeri taşısın) — ilk denemede
   hangisinin işe yaradığını sonraki testte anlarız.
4. Bearer doğrulayan bir middleware eklenecek; sonraki tüm
   `/api/vega/panelapi/*` çağrıları bunu kullanacak.
5. `GET /api/vega/panelapi/Categories`: `PageIndex`/`PageSize` query
   parametrelerini okuyup Bollmark'ın kendi kategori tablosunu (üst+alt
   kategori) sayfalanmış şekilde dönecek. Kesin şema bilinmediği için en
   yaygın REST sayfalama zarfı kullanılacak (`data`/`totalCount`/`pageIndex`
   /`pageSize` gibi) — bunu da bir sonraki gerçek testte doğrularız.
6. Tüm bu uç noktalara **detaylı log** eklenecek (gelen header/body,
   dönülen response) ki Vercel loglarından "Vega ne gönderdi, biz ne
   döndük" akışını görebilelim.
7. Deploy edilip DEPLOY_STATUS.md'ye not düşülecek.
8. Kullanıcı Vega'daki "Site Adı"nı artık webhook.site yerine gerçek
   Bollmark adresine (`https://bollmark.com/api/vega/panelapi` ya da
   kararlaştırılacak taban yol) çevirip, "E-Mail"/"Parola" alanlarına 3.
   maddedeki entegrasyon kullanıcısını girip tekrar "Kategori Seçimi"ni
   deneyecek. Sonuç (kategori listesi geldi mi, hata mesajı çıktı mı, Vega
   hiç istek attı mı) bize aktarılacak; gerekirse Vercel logları da
   incelenip bir sonraki adıma (muhtemelen Depo listesi / Brands / asıl
   ürün yükleme uç noktası) geçilecek.

## Basarili: Kategori Secimi calisiyor (2026-09-10)

Yukaridaki Cloudflare Worker koprusu + PascalCase sayfalama alanlari
duzeltmeleri sonrasi kullanici Vega'da "Kategori Seçimi"ni tekrar denedi ve
**kategoriler basariyla indirildi**. Canli iterasyonlarla ortaya cikan,
Vega'nin sayfalama cevabinda kesin olarak gerektirdigi alanlar (`/api/vega/panelapi/[...path]/route.ts`
icindeki `paginatedResponse()` helper'inda):

- `Count` (toplam kayit sayisi) - zorunlu, eksikse "value 'Count' not
  found" hatasi.
- `TotalPageSize` (toplam kayit sayisi, `Count` ile ayni deger) - zorunlu,
  eksikse "value 'TotalPageSize' not found" hatasi.
- Muhtemelen ihtiyac olmayan ama zarar vermeyen ekstra alanlar da
  birakildi: `data`/`Data`, `totalCount`/`TotalCount`, `TotalPages`,
  `pageIndex`/`PageIndex`, `pageSize`/`PageSize`. Hangilerinin gercekten
  okundugu tam kesinlesmedi (Vega sessizce yoksayiyor olabilir), ama
  fazladan alan sorun cikarmadi.

**Guncel mimari**: Vega -> `https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega`
(Cloudflare Worker, `vega-bridge-worker/`) -> cift slash normalize edilip
sunucu-sunucu fetch ile -> `https://bollmark.com/api/vega/panelapi/...`
(Next.js/Vercel, asil is mantigi + Neon DB).

## Sirada (henuz yapilmadi)

- **SalesOrder**: Vega, Kategori Secimi'nden hemen sonra kendiliginden
  `GET SalesOrder` cagiriyor (siparis senkronizasyonu, `OrderDateMin`/
  `OrderDateMax` araligiyla). Su an bos ama gecerli bir sayfali cevap
  donuyor (hata vermiyor, ama gercek siparis verisi de gondermiyor). Vega'nin
  beklidigi siparis JSON semasi bilinmiyor - gerekirse ayri bir arastirma/
  plan konusu.
- **Urun yukleme uc noktasi (asil hedef)**: Kullanici "Secili Urunleri
  Yukle" dedigi zaman Vega'nin hangi uc noktaya (muhtemelen `POST Products`
  veya benzeri) ne formatta veri gonderdigi henuz yakalanmadi/gorulmedi -
  bir sonraki canli testte (kullanici gercekten bir urun secip yuklemeyi
  deneyince) Vercel loglarindan veya webhook.site ile gorulecek.
- **Brands/Warehouses (Depo) vb.**: Plandaki diger olasi uc noktalar henuz
  hic denenmedi, Vega onlara ihtiyac duyarsa ayni "canli yakalama + PascalCase
  alan adi deneme-yanilma" yontemiyle eklenecek.

## Sıradaki adım

Yukarıdaki 1-7 maddeleri için Claude Code'a verilecek promptu aşağıda
hazırladık (bkz. sohbet). Kullanıcı onaylarsa Claude Code çalıştırılıp
deploy edilecek, sonra 8. madde ile gerçek Vega testi yapılacak.

## Uygulama sonuçları (bu oturumda tamamlandı)

1-7 maddeleri kodlandı ve yerelde `curl` ile ucdan uca dogrulandi:

- **Prisma**: `VegaIntegration` singleton modeli eklendi (`prisma/schema.prisma`,
  `StoreSettings` ile ayni desen). `npm run db:push` ile Neon'a uygulandi.
- **`src/lib/vega-auth.ts`**: `signVegaToken`/`verifyVegaToken` - ayri bir sir
  gerektirmesin diye mevcut `NEXTAUTH_SECRET` (jose/HS256 ile) kullanilir,
  token'a `scope: "vega-panelapi"` eklenerek NextAuth session JWT'sinden
  ayirt edilir. Sure: 1 saat.
- **`src/app/api/vega/panelapi/[...path]/route.ts`**: tek bir catch-all route,
  `POST Account/Token` (email+parola dogrulama, bcrypt) ve
  `GET Categories` (Bearer dogrulama + `PageIndex`/`PageSize` sayfalama)
  destekleniyor. Tanimadigi her `method+path` icin 404 + JSON hata donup
  logluyor (bilinmeyen sonraki uc noktalari - Brands/Depo/Products/Orders -
  canli testte gormek icin). Token cevabinda `token`/`accessToken`/
  `access_token` alanlarinin ucu de doluyor (Vega'nin hangisini okudugu hala
  bilinmiyor, canli testte netlesecek). Tum istekler `console.log` ile
  detayli loglaniyor (parola/redakte edilmis body dahil, Vercel loglarindan
  okunabilir); `Authorization` header'inin tam degeri **loglanmiyor** (sadece
  var/yok bilgisi) - guvenlik icin bilincli tercih.
- **Admin panel**: `/admin/ayarlar`'a "Vega E-Ticaret Entegrasyonu" karti
  eklendi (yalnizca ADMIN rolu, `requireAdmin()` ile korunan sayfa) - email +
  parola (bos birakilirsa degismez) girilip `VegaIntegration` singleton
  satirina yaziliyor.
- **Dogrulanan senaryolar** (yerel `npm run dev`, gercek Neon DB'ye karsi):
  yanlis parola -> 401; dogru email+parola -> 200 + token; token'siz
  `Categories` -> 401; gecerli Bearer ile `Categories` -> 200, 40 aktif
  kategorinin `PageIndex`/`PageSize`'a gore dilimlenmis hali; tanimsiz bir uc
  nokta (`GET Brands`) -> 404 + log satiri.

### Kritik bulgu: cift slash'i biz duzeltemiyoruz - bu, Next.js'in cekirdeginde

Ilk planda "route'lar cift slash'i karsilayacak sekilde tasarlanmali" denmisti;
bunun icin `[...path]` catch-all + bos segment filtreleme yapildi (route
dosyasinda hala duruyor, zararsiz). Ama testte asagidaki **daha temel** bir
gercek ortaya cikti:

- Next.js'in kendi sunucu kodu (`node_modules/next/dist/server/base-server.js`,
  `urlNoQuery.match(/(\\|\/\/)/)` kontrolu) path'te `//` gorursen **proxy.ts
  dahil hicbir uygulama kodu calismadan once**, kosulsuz olarak
  `normalizeRepeatedSlashes` ile tek slash'e indirip **308 Permanent Redirect**
  donuyor. Bu next.config.js'te belgelenen hicbir bayrakla (sadece trailing
  slash icin `skipTrailingSlashRedirect` var, tekrarlanan ic slash'ler icin
  yok) kapatilamiyor.
- Bu, sadece yerel `npm run dev`'de degil, **canli `bollmark.com`'da da**
  ayni sekilde davraniyor - `curl -i "https://bollmark.com//urunler"` gercek
  siteye karsi da `308` + `Server: Vercel` donuyor (test edildi). Yani Vercel
  tarafinda bir normalizasyon YOK, direkt Next.js'in kendi davranisi;
  proxy.ts'e (veya baska bir uygulama katmanina) bir "cift slash'i rewrite et"
  mantigi eklemek **hicbir sey degistirmiyor** (denendi, proxy hic
  calismadigi icin geri alindi).
- **Sonuc**: Vega'nin gonderdigi `panelapi//Account/Token` / `panelapi//Categories`
  istekleri Bollmark'a ulasmadan once mutlaka bir 308 redirect alacak. 308,
  metodu ve govdeyi koruyarak yonlendirmesi gereken bir kod oldugu icin (301/302'nin
  aksine) standartlara uyan bir HTTP istemcisi bunu otomatik takip edip ayni
  POST + govde ile `Location` adresine tekrar istek atmalidir - ama Vega'nin
  Embarcadero REST istemcisinin bunu gercekten yapip yapmadigi **bilinmiyor**
  ve sadece gercek Vega testinde (madde 8) gorulebilir.
### Cozum: Cloudflare Worker koprusu (bu oturumda kuruldu, dogrulandi)

Canli testte yukaridaki tahmin dogrulandi: kullanici parolayi duzeltip Site
Adi'ni `https://bollmark.com/api/vega` yaptiktan sonra bile "kategoriler
yuklenemedi" hatasi devam etti. Vercel loglari 45+ dakika boyunca **sifir**
Vega istegi gosterdi (sadece alakasiz bir bot taramasi vardi). Kesin teshis
icin Site Adi gecici olarak yeniden bir webhook.site adresine
(`.../api/vega` seklinde, ayni yapida) cevrilip Vega'nin gercekte ne
gonderdigi tekrar yakalandi (webhook.site API'si `GET/POST
/token/{token}/request/{id}` ile programatik okundu):

- 4x `POST .../api/vega/panelapi//Account/Token` (webhook.site gecerli bir
  token formati donmedigi icin Vega tekrar tekrar deniyor - orijinal bulguyla
  birebir ayni).
- Sonra `GET .../api/vega/panelapi//Categories?PageIndex=1&PageSize=100`,
  `Authorization: Bearer` (bos) ile - yani token alamamasina ragmen Vega yine
  de devam ediyor.

Ikisi de **cift slash** iceriyor, Site Adi'ndan bagimsiz (Vega'nin sabit
`"panelapi/" + "/<endpoint>"` birlestirmesi, hicbir Site Adi degeri bunu
engelleyemez). webhook.site (Cloudflare tabanli) bu path'i sorunsuz kabul
ediyor (200), ama bollmark.com (Vercel/Next.js) koşulsuz 308 donuyor - ve
Vega bu 308'i **takip etmiyor**, istek sessizce kayboluyor. Bu, "kategoriler
yuklenemedi" hatasinin kesin sebebi.

**Denenip ise yaramayan** ek onlemler (kayit icin):
- `proxy.ts`'te cift slash'i yakalayip rewrite etmek - proxy hic
  calismiyor (Next.js'in `base-server.js`'indeki kontrol proxy'den once,
  kosulsuz calisiyor).
- `vercel.json`'a `rewrites` eklemek (`/api/vega/panelapi//:path*` ->
  `/api/vega/panelapi/:path*`) - Vercel'in edge katmani da ayni
  normalizasyonu, custom rewrite kurallari degerlendirilmeden once
  uyguluyor; deploy edilip dogrulandi, hala 308.

**Ise yarayan cozum**: Next.js/Vercel disinda, cift slash'i normalize
etmeyen ayri bir platformda (Cloudflare Workers - webhook.site testinde zaten
sorunsuz oldugu goruldu) kucuk bir "kopru" servisi kuruldu:
`vega-bridge-worker/` (bu depoda, ana Next.js uygulamasindan tamamen ayri,
kendi `wrangler.toml`'u ile). Worker, gelen istegin path'indeki tekrarlanan
slash'leri kendi JS kodunda duzeltip, asil `https://bollmark.com/api/vega/panelapi/...`
adresine sunucu-sunucu bir `fetch` ile iletip cevabi oldugu gibi donuyor -
Vega hicbir zaman bir redirect cevabi gormuyor. `npx wrangler deploy` ile
Cloudflare'in ucretsiz `workers.dev` adresine (`https://bollmark-vega-bridge.ozilevent.workers.dev`)
deploy edildi (DNS/custom domain gerekmedi). Uctan uca `curl` ile cift
slash'li login + Categories akisi dogrulandi, ikisi de basarili.

**Vega'da Site Adi artik su olmali**: `https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega`
(E-Mail/Parola degismedi).

- **Onerilen ek onlem (ucretsiz, denemeye deger)**: kullanici canli testte
  Vega'daki "Site Adi" alanina once **sonunda `/` olacak sekilde**
  (`https://bollmark.com/api/vega/panelapi/`) girmeyi dener - Vega'nin kendi
  path birlestirme mantigi degisip cift slash hic olusmayabilir, bu durumda
  redirect'e hic ihtiyac kalmaz. Olmazsa (yine `panelapi//...` gorulurse),
  redirect'in Vega tarafindan takip edilip edilmedigi `wrangler tail` yerine
  Vercel'in canli loglarindan (`vega-panelapi` etiketli satirlar) izlenerek
  anlasilabilir: istek Bollmark'a **hic ulasmiyorsa** (log'da hicbir satir
  yoksa) Vega redirect'i takip etmiyor demektir ve o zaman Vega tarafinin
  destek ekibiyle (ya da Site Adi'na dogrudan `.../panelapi` yerine farkli bir
  taban yol denenerek) ayrica konusulmasi gerekecek.
