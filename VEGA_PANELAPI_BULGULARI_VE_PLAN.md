# Vega "E-Ticaret" Entegrasyonu — panelapi Keşif Bulguları ve Uygulama Planı

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
