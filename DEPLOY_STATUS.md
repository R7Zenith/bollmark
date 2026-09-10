# Bollmark - Kurulum ve Canliya Alma Durumu

Son guncelleme: 2026-09-10 (bu oturum - Vega entegrasyonu, yarim kaldi,
bkz. dosyanin sonundaki "Vega SanalMagaza panelapi entegrasyonu" bolumu)

Bu dosya, projeyi Claude Code ile kurup canliya alma surecinde nereye kadar
gelindigini kaydeder. Kaldigimiz yerden devam etmek icin bu dosyayi Claude'a
okutman yeterli.

## Su ana kadar tamamlananlar

1. **Yerel kurulum**: Node.js kuruldu, `npm install` calisti, proje `npm run dev`
   ile yerelde test edildi ve calistigi dogrulandi.
2. **Prisma sema duzeltmesi**: Orijinal sema SQLite + enum kullaniyordu, SQLite
   enum desteklemedigi icin hata veriyordu. Enum'lar `String` alanlara
   cevrildi (bkz. `prisma/schema.prisma`, `prisma/seed.ts`,
   `src/app/admin/kargolar/page.tsx`, `src/app/admin/siparisler/[id]/page.tsx`).
3. **GitHub'a baglandi**: Repo `git init` ile olusturuldu, ilk commit atildi,
   `https://github.com/R7Zenith/bollmark.git` reposuna (main branch) push
   edildi. `.claude/` ve `bollmark.zip` depoya dahil edilmedi (.gitignore'da).
4. **SQLite -> Neon Postgres gecisi**: Cloudflare Workers'ta (edge ortaminda)
   SQLite dosya tabanli veritabani calismadigi icin, veritabani Neon
   (serverless Postgres, ucretsiz katman) ile degistirildi.
   - `prisma/schema.prisma`: `provider = "postgresql"`, `driverAdapters`
     preview feature acik.
   - `src/lib/prisma.ts`: `@prisma/adapter-neon` + `@neondatabase/serverless`
     Pool kullanarak baglaniyor.
   - Neon baglanti adresi kullanicidan alindi ve yerel `.env` dosyasina
     `DATABASE_URL` olarak yazildi (bu dosya GitHub'a gitmez, `.gitignore`'da).
   - `npm run db:push` ve `npm run db:seed` Neon uzerinde basariyla calistirildi
     (admin kullanici + ornek "Bollmark Oversize Mont" urunu eklendi).
   - Yerelde `npm run dev` ile Neon baglantisi test edildi, `/urunler`
     sayfasi 200 donup urunu gosterdi (dogrulandi).
5. **Cloudflare Workers Builds baglantisi (kullanici tarafinda basladi)**:
   Kullanici Cloudflare dashboard'da mevcut `bollmark` Workers projesine
   girdi (Workers & Pages -> bollmark). Bu proje "static assets only" bir
   Worker olarak durmustur (SSR/Next.js build'i henuz baglanmamis).
   - Sag menude **Builds** sekmesi bulundu, GitHub App yetkilendirmesi
     yapildi ("Only select repositories" -> `bollmark` secildi).
   - "Connect to a repository" ekraninda repo=`bollmark`, branch=`main`,
     varsayilan **Build command: `npm run build`**, **Deploy command:
     `npx wrangler deploy`** goruldu. Bu, Cloudflare'in artik Next.js icin
     **OpenNext (Cloudflare adaptoru)** bekledigini gosteriyor (klasik
     "Pages" framework preset degil).
6. **OpenNext Cloudflare adaptoru icin hazirlik yapildi (Next.js 14 -> 16
   yukseltmesi gerekti)**:
   - `@opennextjs/cloudflare` guncel surumu Next.js `>=15.5.24` istiyor,
     eski surumu (0.6.0) ise bozuk bir on-surum bagimliligina isaret ediyordu
     (kullanilamaz). Bu yuzden kullaniciya soruldu ve **Next.js'i 16'ya
     yukseltme** karari verildi.
   - `package.json` guncellendi: `next@16.3.3`, `react@19.2.8`,
     `react-dom@19.2.8`, `next-auth@4.24.15`, `eslint@9`,
     `eslint-config-next@16.3.3`, `@opennextjs/cloudflare@1.20.4`,
     `wrangler@4.125.0` eklendi.
   - `.eslintrc.json` kaldirildi, yerine flat-config `eslint.config.mjs`
     eklendi (eslint 9 icin gerekli).
   - `wrangler.jsonc` ve `open-next.config.ts` dosyalari olusturuldu
     (Cloudflare Worker + OpenNext yapilandirmasi).
   - `npm install` basariyla tamamlandi (Next 16, React 19 kuruldu).
   - `npm run build` calistirildi; ciktida bir uyari var:
     `middleware` dosya kurali deprecated, yerine `proxy` kullanilmasi
     onerildi (`src/middleware.ts` -> muhtemelen yeniden adlandirma/uyarlama
     gerekebilir, henuz **kesin build sonucu (basarili mi hatali mi)
     dogrulanmadi** - oturum burada yarim kaldi).
7. **Build dogrulandi ve middleware -> proxy gecisi tamamlandi (bu oturumda)**:
   - Bu bilgisayarda Node.js PATH'e tanimli degildi (yeni terminal
     oturumlarinda `C:\Program Files\nodejs` PATH'te gorunmuyordu) - her
     komuttan once `$env:PATH += ";C:\Program Files\nodejs"` eklenerek
     asildi. Kalici cozum icin PowerShell'i/terminali yeniden baslatmak
     (veya sistem PATH'inin yenilenmesini saglamak) yeterli olabilir.
   - `npm run build` **basariyla** calisti (hata yok).
   - `src/middleware.ts` dosyasi `src/proxy.ts` olarak yeniden adlandirildi
     (icerik degismedi - `next-auth/middleware`'den `withAuth` default export
     olarak kaliyor, sadece dosya adi Next 16 kuralina uyduruldu). Codemod
     (`npx @next/codemod@canary middleware-to-proxy .`) calisan git durumu
     kontrolunde takildigi icin (working tree temiz olmasina ragmen) elle
     `git mv` ile yapildi.
   - Build tekrar calistirildi, `middleware` deprecated uyarisi **kayboldu**.
   - Zaten calisan bir `npm run dev` sunucusu (PID ile, port 3000) bulundu;
     ana sayfa (`/`), `/admin/login`, `/urunler` route'lari `curl` ile test
     edildi, hepsi **200 OK** dondu.
   - Degisiklik commit'lenip GitHub'a push edildi (`2d1ec42`).
   - **Cloudflare tarafinda engel**: bu makinede `wrangler` CLI Cloudflare
     hesabina giris yapili degil (`npx wrangler whoami` -> "not
     authenticated"). Tarayici tabanli OAuth istedigi icin Claude tarafindan
     otomatik yapilamiyor. Kullaniciya soruldu, **"simdilik burada dur"**
     secildi - Cloudflare adimlarina (5-9) henuz baslanmadi.
8. **Sifreli magaza onizleme kapisi eklendi (bu oturumda)**: Canliya alindiginda
   herkesin "yapim asamasinda" gorunumunu gormeye devam etmesi, ama ozel bir
   linkle gercek magazanin gorulebilmesi istendi.
   - Cloudflare'deki mevcut statik "yapim asamasinda" sayfasinin gercek HTML/CSS
     kaynagi kullaniciyla birlikte alinip (`https://bollmark.com` fetch edildi)
     birebir bu projeye tasindi: **`src/app/(gate)/yapim-asamasinda/page.tsx`**
     (Fraunces + Work Sans fontlari `next/font/google` ile, animasyonlu SVG
     kuyruk figurleri dahil, orijinaliyle piksel esdeger).
   - Bu sayfanin header/footer olmadan, tamamen izole gorunmesi icin proje
     **route groups** ile ikiye bolundu: mevcut tum sayfalar (magaza + admin +
     api) `src/app/(site)/` altina tasindi (kendi `layout.tsx`'i, header/footer,
     CartProvider dahil), yeni placeholder ise `src/app/(gate)/` altinda kendi
     minimal `layout.tsx`'ine sahip ayrı bir "root layout". Bu sayede ana
     sayfa/`urunler` gibi rotalarin statik (`○`) build ciktisi bozulmadi
     (headers()/dynamic API kullanan bir alternatif denenmedi, bilinçli olarak
     bundan kacinildi).
   - `src/proxy.ts` genisletildi: `/admin` icin eski NextAuth kontrolu aynen
     duruyor; onun disindaki tum magaza rotalari icin yeni bir "onizleme
     kapisi" eklendi. `PREVIEW_PASSWORD` ortam degiskeni tanimliysa,
     `?preview=DOGRU_SIFRE` ile gelen istek 30 gunluk `bm_preview` adinda
     **httpOnly** cookie birakip sorgu parametresi temizlenmis ayni adrese
     yonlendiriliyor; cookie yoksa/yanlissa istek `/yapim-asamasinda`
     sayfasina **rewrite** ediliyor (adres cubugu degismiyor). `PREVIEW_PASSWORD`
     tanimsizsa koruma tamamen devre disi. Ortak sabitler
     `src/lib/preview-gate.ts` icinde.
   - `.env.example`'a `PREVIEW_PASSWORD=""` (aciklamali) eklendi; yerel `.env`
     dosyasina Claude tarafindan `node crypto.randomBytes` ile uretilen 32
     karakterlik rastgele bir sifre yazildi (guvenlik icin degeri kullaniciya
     gosterilmedi, `.env` dosyasindan okunabilir).
   - Yerelde `npm run build` (hatasiz, `/` ve `/urunler` hala statik) ve
     `npm run dev` ile asagidaki senaryolar `Invoke-WebRequest` ile dogrulandi:
     cookiesiz `/` ve `/urunler` -> gate gosteriyor; `/admin/login` -> gate
     GOSTERMIYOR (her zaman erisilebilir); cookiesiz `/admin` -> login'e 307
     redirect; dogru `?preview=` -> 307 redirect + httpOnly cookie set; ayni
     cookie ile tekrar istek (sayfa yenileme simulasyonu) -> gercek site
     gosteriyor; yanlis sifre -> gate gosteriyor; `/api/auth/session` -> proxy
     tarafindan hic dokunulmuyor (200, JSON).
   - Degisiklik commit'lendi ve push edildi (`28e0696`).
   - **Cloudflare hatirlatmasi**: canliya alirken **Settings -> Variables and
     secrets** kismina `PREVIEW_PASSWORD` da eklenmeli (asagidaki listeye
     eklendi) - eklenmezse canlida koruma calismaz, herkes gate sayfasini gorur.

## Cloudflare Workers denemesi (yarim kaldi, sebebi: 3MB boyut limiti)

Bu oturumda `npx wrangler login` ile Cloudflare hesabina baglanildi (OAuth,
ilk denemede "Timed out waiting for authorization code" hatasi alindi,
ikinci denemede basarili oldu). `wrangler deploy`'un OpenNext'e delege
etmesi Windows'ta "Error: write EOF" ile cakisiyordu (ic ice npx/child
process spawn zinciri) - bu, `OPEN_NEXT_DEPLOY=true npx wrangler deploy`
ile (delegasyonu atlayarak) asildi ve Worker'a ilk deploy basarili oldu.

Ardindan `.env`'de `ADMIN_PASSWORD` placeholder oldugu fark edildi
(`guclu-bir-sifre-belirleyin`), kullanicinin belirledigi gercek deger
(`ozilevent@gmail.com` / `kujju123`) ile guncellendi; `PREVIEW_PASSWORD` da
hic yoktu, rastgele uretilip eklendi. Cloudflare secret'lari
(`wrangler secret put`) ile Worker'a eklendi ve **admin login "kullanici
adi veya sifre hatali" verdi**. Kok neden arastirmasi:

1. Once DB'de eski/placeholder admin kullanicisi oldugu dusunuldu, seed
   tekrar calistirildi (yeni email icin upsert yeni satir olusturdu) -
   yardimci olmadi.
2. `wrangler tail` ile canli log izlendi, gercek hata bulundu: **"Code
   generation from strings disallowed for this context"** - Prisma 5.22'nin
   (o zamanki surum) WASM/Rust tabanli query engine'i Cloudflare Workers'in
   izin vermedigi dinamik kod uretimi (`eval`/`new Function`) kullaniyordu.
3. **Cozum**: Prisma 5 -> 7.10.0'a yukseltildi, `schema.prisma`'da
   generator `provider = "prisma-client-js"` yerine engine-free
   `provider = "prisma-client"` (+ `output = "../src/generated/prisma"`)
   yapildi, `datasource` bloğundan `url = env("DATABASE_URL")` satiri
   kaldirildi (Prisma 7'de artik desteklenmiyor, adapter connection string'i
   kendi tasiyor). `@prisma/adapter-neon`'un API'si de degismisti: artik
   hazir bir `Pool` nesnesi degil, dogrudan `{ connectionString }` config
   objesi bekliyor (`src/lib/prisma.ts` ve `prisma/seed.ts` guncellendi).
   `prisma/seed.ts`'e ayrica `import "dotenv/config"` eklendi (yeni Prisma
   surumu .env'i otomatik yuklemiyor).
4. Bu duzeltmeyle build+deploy tekrar denendiginde **yeni bir engel**
   cikti: Worker boyutu **3 MB ucretsiz plan limitini asti** (gzip ~4.5MB,
   en buyuk parca Prisma'nin yeni JS sorgu motorunu de iceren
   `handler.mjs` - 12.5MB sikistirilmamis). `next.config.mjs`'e
   `outputFileTracingExcludes` ile kullanilmayan `@vercel/og` wasm
   dosyalarini (resvg/yoga, ~1.4MB) cikarma denendi ama bu dosyalar
   Next.js'in kendi output-file-tracing'inden degil, OpenNext'in ayri
   esbuild bundling adimindan geldigi icin **etkisi olmadi**.
5. Kullaniciyla goruşuldu: Cloudflare Workers ucretsiz planda boyut
   limitini asan bu Next.js 16 + Prisma 7 + NextAuth kombinasyonunu
   sikistirmak (ya paid plan $5/ay ya da ciddi bir yeniden yapilanma)
   yerine **Vercel'e gecis** karari verildi. Cloudflare tarafindaki
   `wrangler.jsonc`, `open-next.config.ts`, `@opennextjs/cloudflare`
   bagimliligi bilincli olarak **bozulmadan birakildi** (ileride tekrar
   denenebilir, `git log`'da referans).

## Vercel'e gecis (bu oturumda tamamlandi)

1. `npx vercel login` interaktif (tarayici) akisi bu ortamda TTY hatasi
   verdi ("Worker timed out" / "Error: write EPIPE" - Cloudflare'deki
   spawn sorunlarina benzer). Bunun yerine kullanicidan bir **Vercel API
   token** istendi (vercel.com/account/tokens), `--token` flag'i ile tum
   komutlar calistirildi.
2. `vercel link --project bollmark` ile proje olusturuldu/baglandi.
   **GitHub reposunu otomatik baglama basarisiz oldu** ("Failed to connect
   R7Zenith/bollmark to project" - muhtemelen GitHub App yetkilendirmesi
   dashboard'dan yapilmasi gerekiyor), bu yuzden **su an otomatik
   deploy-on-push YOK** - her deploy `vercel deploy --prod --token ...`
   ile elle tetiklenmeli (veya kullanici dashboard'dan
   Settings -> Git -> Connect Git Repository ile GitHub baglantisini
   kurabilir).
3. `vercel env add ... production` ile 6 degisken eklendi: `DATABASE_URL`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL=https://bollmark.com`, `ADMIN_EMAIL`,
   `ADMIN_PASSWORD`, `PREVIEW_PASSWORD` (degerler yerel `.env`'den okundu).
4. `vercel deploy --prod` basarili. Gecici domain: `https://bollmark-xi.vercel.app`
   (ayrica `https://bollmark-culjjywv0-bollmark.vercel.app` deployment-spesifik
   adres). Dogrulanan senaryolar (curl ile):
   - `/` -> "Cok yakinda" gate sayfasi (200, dogru title) ✅
   - `/admin/login` -> her zaman erisilebilir (200) ✅
   - `?preview=<sifre>` -> 307 redirect + `bm_preview` httpOnly cookie set ✅
   - NextAuth credentials login (`ozilevent@gmail.com` / `kujju123`) ->
     basarili, session cookie donuyor ✅
5. `vercel domains add bollmark.com bollmark` ve
   `vercel domains add www.bollmark.com bollmark` ile domain proje'ye
   eklendi. Vercel'in istedigi DNS kaydi: **`A bollmark.com 76.76.21.21`**
   (ayni IP `www` icin de). Alan adi hala Cloudflare nameserver'larinda
   kaliyor (nameserver degistirilmiyor) - kullaniciya Cloudflare DNS
   panelinden yapmasi gereken adimlar anlatildi (asagida).

## Tamamlandi: domain + otomatik deploy

- Kullanici Cloudflare DNS panelinden apex (`@`) ve `www` icin
  **A kaydi -> 76.76.21.21** ekledi (Proxy status: DNS only / gri bulut).
  Worker'daki eski custom domain kayitlarina dokunulmasina gerek kalmadi
  (zaten DNS kaydi olarak gorunmuyorlardi, Worker'in kendi ozel
  mekanizmasiydi).
- DNS yayilmasi dogrulandi (`nslookup` ile 1.1.1.1 uzerinden), Vercel SSL
  sertifikasi birkac dakika icinde otomatik olustu.
- `https://bollmark.com` ve `https://www.bollmark.com` uzerinde tum
  senaryolar tekrar dogrulandi: gate sayfasi, `?preview=<sifre>` cookie
  akisi, ve tam NextAuth credentials login (curl ile) - hepsi basarili.
- **GitHub baglantisi kullanici tarafindan Vercel dashboard'dan yapildi**
  (Settings -> Git -> Connect Git Repository). Vercel API ile dogrulandi:
  proje `R7Zenith/bollmark` reposuna, `main` production branch'ine bagli.
  **Artik `main`'e her push otomatik olarak Vercel'e deploy oluyor** -
  elle `vercel deploy --prod` calistirmaya gerek kalmadi.

## Yapim asamasinda sayfasi: beyaz border / scrollbar duzeltmesi (bu oturumda)

Kullanici canli sitede `yapim-asamasinda` gate sayfasinin kenarlarinda
beyaz bir border oldugunu ve bunun hem masaustunde hem mobilde dikey/yatay
scrollbar acilmasina sebep oldugunu bildirdi.

- **Kok neden**: `src/app/(gate)/layout.tsx` izole bir root layout - ana
  `src/app/globals.css`'i import etmiyor. Bu yuzden tarayicinin varsayilan
  `body { margin: 8px }` kurali hic sifirlanmiyordu; koyu arka planin
  etrafinda beyaz kenarlik gibi gorunen sey aslinda bu margin'di, ve
  `min-height:100vh` + bu fazladan margin toplami viewport'u asinca
  scrollbar cikiyordu (mobilde adres cubugu yuzunden `100vh` gercek
  gorunur alani yanlis hesapladigi icin sorun daha belirgindi).
- **Duzeltme** (`src/app/(gate)/yapim-asamasinda/page.tsx` icindeki
  `<style>` bloguna eklendi): `html, body { margin:0; padding:0;
  height:100%; overflow-x:hidden; }` ve `.gate` icin `min-height:100vh`
  yaninda `min-height:100dvh` (mobil viewport fallback'i, `dvh`
  desteklenmeyen tarayicilarda `vh` degeri gecerli kaliyor).
- Yerelde `npm run dev` ile dogrulandi (uretilen HTML'de yeni kurallarin
  yer aldigi teyit edildi). Commit'lenip push edildi (`52d9dd3`) - Vercel
  git baglantisi sayesinde otomatik deploy tetiklendi.

## Cloudflare artiklarinin temizlenmesi (bu oturumda)

Vercel'e tam gecis yapildigindan Cloudflare Workers/OpenNext kalintilari
kaldirildi:

- `wrangler.jsonc` ve `open-next.config.ts` dosyalari silindi.
- `package.json`'dan `@opennextjs/cloudflare` ve `wrangler` devDependency'leri
  cikarildi; `npm install` ile `package-lock.json` guncellendi (278 paket
  kaldirildi).
- `next.config.mjs`'deki `outputFileTracingExcludes` bloğu kaldirildi - bu,
  Cloudflare Worker'in 3MB boyut limiti icin denenmis ama etkisiz kalmis bir
  workaround'du (bkz. yukaridaki "Cloudflare Workers denemesi" bolumu).
- `.gitignore`'dan `.open-next/` ve `.wrangler/` satirlari kaldirildi.
- `npm run build` tekrar calistirilip basarili oldugu ve `/` + `/urunler`
  rotalarinin hala statik (`○`) kaldigi dogrulandi.
- Prisma semasindaki Neon adapter'i aciklayan yorum (Cloudflare/edge
  ortamlarindan bahsediyor) bilincli olarak dokunulmadan birakildi - hala
  gecerli bir mimari aciklama (Vercel de edge-uyumlu bir platform).

## Kalan/opsiyonel

- Cloudflare Workers ve Vercel API token'lari onceki oturumlarin scratchpad
  dizininde (repo disinda) tutuldu; sadece o oturumlar sirasinda kullanildi,
  hicbir zaman commit edilmedi.

## Onemli notlar / hatirlatmalar

- Yerel `.env` dosyasi GitHub'a gitmiyor (`.gitignore`'da). Evdeki
  bilgisayarda calismak icin: `git clone` yaptiktan sonra `.env.example`'i
  `.env` olarak kopyala, `DATABASE_URL` (Neon), `NEXTAUTH_SECRET`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD` degerlerini doldur.
- Veritabani artik **Neon Postgres** (paylasilan/canli veritabani) - hem
  yerel gelistirme hem canli site AYNI Neon veritabanini kullaniyor. Yerelde
  test verisi eklerken dikkatli olunmali (canli veriyle karismasin).
- GitHub repo: https://github.com/R7Zenith/bollmark.git (branch: `main`)
- **Canli site artik Vercel'de** - Vercel proje adi: `bollmark` (takim:
  `bollmark`, kullanici: `r7zenith`). Cloudflare Workers denemesi
  (`bollmark` worker'i) 3MB boyut limiti yuzunden yarim birakildi, kod
  hala repoda duruyor ama kullanilmiyor.
- Domain: bollmark.com - DNS hala Cloudflare'de yonetiliyor (nameserver
  degismedi), ama artik A kaydiyla Vercel'e (`76.76.21.21`) isaret ediyor
  (bkz. yukaridaki "Simdi yapilmasi gerekenler").
- Prisma artik v7.10.0, "engine-free" `prisma-client` generator'i
  kullaniyor (`src/generated/prisma`'ya uretiliyor, .gitignore'da).
  `@prisma/adapter-neon` API'si degisti: `new PrismaNeon({ connectionString })`
  seklinde dogrudan config aliyor, artik ayrica bir `Pool` nesnesi
  olusturmaya gerek yok.

## Onizleme sifresi senkronizasyonu ve urun sayfasi hatasi (2026-08-28, yeni oturum)

- **PREVIEW_PASSWORD uyusmazligi bulundu**: Yerel `.env`'deki `PREVIEW_PASSWORD`
  degeri, Vercel'de tanimli gercek degerden farkliydi (gecmis Cloudflare/Vercel
  gecisleri sirasinda `.env` guncel tutulmamis). Kullanici `?preview=...` linkini
  denedi ama gate hala "yapim asamasinda" sayfasini gosteriyordu.
  - Vercel dashboard'dan (kullanici giris yapti, Claude panelde islem yapti)
    `PREVIEW_PASSWORD` yeni bir degerle degistirildi (deger burada gizli
    tutuluyor, `.env` dosyasindan okunabilir).
  - Degisiklik sonrasi Vercel'de **Redeploy** tetiklendi (env degisikligi mevcut
    deployment'a otomatik yansimiyor, yeniden deploy gerekiyor).
  - Yerel `.env`'deki `PREVIEW_PASSWORD` da ayni degerle guncellendi (Claude Code
    araciligiyla, cunku `.env` dosyasina uzaktan yazma araclariyla dogrudan
    yazma izni yok).
  - Canlida (`https://bollmark.com/?preview=<sifre>`) ve yerelde
    (`http://localhost:3000/?preview=...`) test edildi, ikisi de calisiyor.
  - **Not**: `ADMIN_PASSWORD` de `.env`'de hala eski placeholder
    (`guclu-bir-sifre-belirleyin`) olarak duruyor; gercek admin sifresi
    veritabaninda kayitli (deger gizli tutuluyor), bu satiri guncellemek
    gercek girisi etkilemez (sadece `db:seed` tekrar calistirilirsa devreye
    girer).

- **Next.js 16 dynamic route params hatasi bulundu ve duzeltildi**: Magazada
  bir urune tiklandiginda (`/urunler/[slug]`) `PrismaClientValidationError` ile
  sayfa hata veriyordu. Kok neden: Next.js 15+/16'da sayfa `params` prop'u artik
  bir `Promise`, ama kod hala eski senkron sekilde (`params.slug`) okuyordu -
  bu da Prisma sorgusuna gecersiz bir deger (Promise nesnesi) gonderiyordu.
  Ayni desen 3 dosyada da vardi, ucu de duzeltildi (`params: Promise<...>` +
  `await params`):
  - `src/app/(site)/urunler/[slug]/page.tsx` (magaza urun detay sayfasi)
  - `src/app/(site)/admin/urunler/[id]/page.tsx` (admin urun duzenleme)
  - `src/app/(site)/admin/siparisler/[id]/page.tsx` (admin siparis detay)
  - Yerelde `bollmark-oversize-mont` urun sayfasi test edildi, artik 200 donup
    urun detaylarini (renk/beden secenekleri, sepete ekle) dogru gosteriyor.
  - Degisiklik commit'lenip GitHub'a push edildi (`9ca8d55`) - Vercel git
    baglantisi sayesinde otomatik deploy tetiklendi.

## Kalan/opsiyonel (guncel)

- Kullanici artik hem ev hem dukkan bilgisayarindan gelistirme yapacak; dukkan
  PC'sinde de ayri bir `.env` dosyasi olusturulmasi gerekiyor (DATABASE_URL,
  NEXTAUTH_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD, PREVIEW_PASSWORD - ev
  bilgisayariyla ayni degerler, ozellikle guncel PREVIEW_PASSWORD).

## Admin paneli yenilemesi - Faz 1: Temel (2026-08-29, yeni oturum)

Plan `ADMIN_PANEL_PLAN.md` dosyasinda cikarildi (Shopify tarzi profesyonel
panel, notr indigo tema, fazlara bolunmus uygulama). Bu oturumda sadece
**Faz 1 - Temel** kapsami uygulandi:

1. **`lucide-react` kuruldu** (ikon kutuphanesi, `package.json`/`package-lock.json`).
2. **Panele ozel renk paleti** eklendi (`tailwind.config.ts`) - magaza
   tarafinin `ink/paper/accent/line` renklerine dokunulmadi, panel icin ayri
   isimler kullanildi: `admin-bg` (#f6f6f7), `admin-surface` (#ffffff),
   `admin-border` (#e3e3e5), `admin-text` (#1a1a1a), `admin-text-muted`
   (#6b6b6f), `admin-accent` (indigo, #4f46e5).
3. **Ortak panel bilesenleri** olusturuldu (`src/components/admin/`):
   `button.tsx` (primary/secondary/danger/ghost), `badge.tsx` (sari/mavi/
   yesil/kirmizi/gri tonlari), `card.tsx`, `data-table.tsx` (checkbox
   kolonu + tiklanabilir siralama + secim durumuna gore `BulkActionBar` +
   bos durum), `bulk-action-bar.tsx`, `search-input.tsx`, `filter-bar.tsx`,
   `pagination.tsx` (link tabanli, `?page=`), `toast.tsx` (`ToastProvider`
   + `useToast` context'i, sag-alt kose bildirimleri), `empty-state.tsx`,
   `stat-card.tsx`, `sidebar.tsx`, `topbar.tsx`. Bu bilesenler simdilik
   sadece Ayarlar sayfasinda (Card, Toast) ve yeni layout'ta (Sidebar,
   Topbar) kullaniliyor; Urunler/Siparisler gibi listelerin DataTable'a
   gecisi Faz 2/3'e birakildi.
4. **Admin layout yenilendi** (`src/app/(site)/admin/layout.tsx`): eski
   duz `<aside>` navigasyonu kaldirilip yeni `Sidebar` (lucide ikonlu, 7
   bolum: Panel/Urunler/Kategoriler/Siparisler/Kargolar/**Musteriler**/
   **Ayarlar** - son ikisi yeni) ve `Topbar` (calisan hizli arama kutusu +
   kullanici menusu/cikis) ile degistirildi. Sayfa geneli `ToastProvider`
   ile sarmalandi.
   - **Hizli arama**: `src/app/api/admin/search/route.ts` yeni bir API
     route - oturum kontrolu yapip (`getServerSession`, oturumsuzsa 401),
     `q` parametresine gore urun adinda ve siparis no/musteri adinda
     (case-insensitive, ilk 5 sonuc) arama yapiyor. `Topbar` bu route'u
     250ms debounce ile cagirip sonuclari kucuk bir dropdown'da gosteriyor
     (urun -> `/admin/urunler/[id]`, siparis -> `/admin/siparisler/[id]`).
   - **Musteriler** sayfasi (`src/app/(site)/admin/musteriler/page.tsx`):
     su an sadece `EmptyState` ile "Yakinda" mesaji gosteriyor (gercek
     musteri listesi Faz 3'te, V1 turetilen liste olarak gelecek).
5. **`StoreSettings` modeli** eklendi (`prisma/schema.prisma`) - tek
   satirlik singleton kayit (`id` sabit `"singleton"` string literal ile
   varsayilaniyor): `storeName`, `contactEmail`, `contactPhone`,
   `defaultShippingCents`. `npm run db:push` ile Neon'a basariyla
   uygulandi, ardindan `npx prisma generate` ile client yeniden uretildi.
   - **Yeni bulgu - `prisma.config.ts` gerekiyor**: Prisma 7'de
     `db push`/`generate` komutlari artik `.env`'i otomatik okumuyor,
     kok dizinde bir `prisma.config.ts` dosyasi bekliyor. Proje koküne
     bu dosya eklendi - Node'un yerlesik `process.loadEnvFile()` fonksiyonu
     ile (ek bir `dotenv` bagimliligi eklemeden) `.env`'den `DATABASE_URL`
     okunuyor; dosya yoksa (orn. Vercel'de degiskenler dogrudan enjekte
     edildigi icin) hata sessizce yutuluyor, bu yuzden production build'i
     etkilemiyor. **Not**: `prisma/seed.ts`'teki `import "dotenv/config"`
     satirinin aslinda calismadigi fark edildi (`dotenv` paketi node_modules
     kokunde yok, sadece ic bagimlilik olarak gomulu) - bu, mevcut/onceki
     bir sorun, bu oturumda dokunulmadi (db:seed kullanilmadi).
6. **Ayarlar sayfasi** (`src/app/(site)/admin/ayarlar/page.tsx`) tam
   olarak yapildi:
   - **Hesap**: giris yapan admin'in adi/e-postasi gosteriliyor + sifre
     degistirme formu (server action: mevcut sifreyi `bcrypt.compare` ile
     dogrulayip, yeni sifreyi `bcrypt.hash` ile `AdminUser.passwordHash`'e
     yaziyor; yeni sifre en az 8 karakter ve tekrar alaniyla eslesmeli).
   - **Magaza Bilgileri**: `StoreSettings` kaydini `upsert` ile
     okuyup/olusturup gosteren form (magaza adi, iletisim email/telefon,
     varsayilan kargo ucreti TL cinsinden) - server action ile kaydediliyor.
   - **Onizleme Sifresi**: `PREVIEW_PASSWORD`'un bir Vercel ortam
     degiskeni oldugunu, panelden degistirilemedigini, degistirmek icin
     Vercel dashboard gerektigini belirten salt-bilgi kutusu (input yok).
   - Basari/hata geri bildirimi icin `src/components/admin/settings-feedback.tsx`
     eklendi: server action'lar `?basarili=...` / `?hata=...` query
     parametresiyle yonlendiriyor, bu client bilesen mount'ta `useToast`
     ile toast gosterip URL'i temizliyor (`router.replace`).
7. **Diger mevcut admin sayfalari** (Panel/Urunler/Kategoriler/Siparisler/
   Kargolar, urun duzenle/yeni, siparis detay) yeniden yazilmadi - sadece
   yeni Sidebar/Topbar icine duzgun oturmalari icin class'lari (`border-line`
   -> `border-admin-border`, `bg-ink` -> `bg-admin-accent`, `font-display`
   basliklar -> sade `font-semibold` vb.) panel paletine uyacak sekilde
   minimal guncellendi; sayfa yapilari/mantigi degismedi.

**Test edildi** (`npm run build` hatasiz + `npm run dev` ile canli Neon
veritabanina karsi, oturum acip):
- Sidebar'daki 7 link ve Topbar arama kutusu `/admin` sayfasinda dogru
  render ediliyor (HTML'de link/metin kontrolu).
- `/api/admin/search?q=mont` gercek urunu (`Bollmark Oversize Mont`)
  donduruyor; oturumsuz istek 401; 2 karakterden kisa sorgu bos sonuc
  donduruyor.
- `/admin/ayarlar`, `/admin/musteriler` ve diger tum admin sayfalari 200
  donuyor.
- **Magaza bilgileri kaydetme**: form gercekten submit edilip (React
  Server Action'in multipart/form-data + gizli `$ACTION_ID_*` alani
  gerektirdigi tespit edildi, curl ile buna gore test edildi) deger
  Neon'a basariyla yazildigi ve sayfa yenilenince geri geldigi dogrulandi,
  ardindan test verisi guvenli bos degerlere sifirlandi.
- **Sifre degistirme - hata yolu**: kasten yanlis mevcut sifreyle
  denendi, `bcrypt.compare` dogru sekilde reddedip `?hata=mevcut-sifre-yanlis`'a
  yonlendirdi (gercek admin sifresi **degistirilmedi** - yerel gelistirme
  canli Neon veritabanina bagli oldugu icin gercek sifreyle test
  edilmedi, sadece hata yolu dogrulandi).
- Test sirasinda gecmis bir oturumdan kalma, eski (StoreSettings eklenmeden
  onceki) Prisma Client'i bellekte tutan bashi bos bir `npm run dev`
  sureci bulunup kapatildi (`prisma generate` sonrasi dev sunucusunun
  yeniden baslatilmasi gerekiyor, aksi halde singleton Prisma Client
  guncellenmiyor).
- Degisiklikler commit'lenip GitHub'a push edildi - Vercel git baglantisi
  sayesinde otomatik deploy tetiklendi. **Not**: canlida `StoreSettings`
  tablosu zaten Neon'a `db:push` ile eklendigi icin ayrica migration
  adimi gerekmiyor.

## Admin paneli yenilemesi - Faz 2: Urunler & Kategoriler (2026-08-29, yeni oturum)

`ADMIN_PANEL_PLAN.md` Faz 2 kapsami uygulandi: urun liste/detay sayfalari
Faz 1'de kurulan ortak bilesenlerle (Card, Badge, DataTable, SearchInput,
FilterBar, BulkActionBar, Toast, EmptyState) yeniden yazildi, kategoriler
sayfasina duzenleme/silme eklendi.

1. **Urunler listesi** (`src/app/(site)/admin/urunler/page.tsx`) tamamen
   yeniden yazildi:
   - Server component olarak `q` (isim aramasi), `durum`, `kategori`, `sort`,
     `dir` URL query parametrelerini okuyup Prisma sorgusuna uyguluyor
     (stok siralamasi Prisma'da dogrudan desteklenmedigi icin variant
     toplami hesaplandiktan sonra JS tarafinda siralaniyor).
   - Yeni client bilesenler: `src/components/admin/products-filters.tsx`
     (arama kutusu 300ms debounce + durum/kategori select'leri, URL'i
     `router.push` ile guncelliyor) ve `src/components/admin/products-table.tsx`
     (DataTable sarmalayicisi: kucuk gorsel thumbnail'i, renkli Badge
     durum - Taslak=gri, Yayinda=yesil, Arsiv=yeni `gray-muted` tonu -,
     tiklanabilir isim/fiyat/stok/olusturulma basliklari URL'e `sort`/`dir`
     yaziyor, checkbox + BulkActionBar ile toplu "Yayina Al/Taslaga Al/
     Arsivle/Sil").
   - Toplu islemler icin yeni API route: `src/app/api/admin/urunler/bulk/route.ts`
     (POST, oturum kontrollu, `SET_STATUS` ve `DELETE` aksiyonlari; silme
     siparislere bagli bir urune denk gelirse FK hatasini yakalayip 409 +
     aciklayici mesaj donduruyor, hicbir urun silinmiyor).
   - Hic urun yoksa (DB'de toplam 0) tam sayfa `EmptyState` ("Henuz urun
     yok" + "Ilk Urununu Ekle" butonu); filtre sonucu bos ama DB'de urun
     varsa `DataTable`'in kendi "Sonuc bulunamadi" bos durumu gosteriliyor.
   - `Badge` bilesenine yeni bir ton eklendi: `gray-muted` (Arsiv icin,
     Taslak'in `gray` tonundan gorsel olarak ayrisan daha soluk gri).
   - `DataTable` bilesenine opsiyonel `initialSort` prop'u eklendi (URL'deki
     mevcut siralamayi sayfa yenilendiginde ok ikonuna yansitmak icin).
2. **Urun duzenle** (`urunler/[id]/page.tsx`) ve **yeni urun**
   (`urunler/yeni/page.tsx`) sayfalari `Card` bolumlerine ayrildi: Temel
   Bilgiler / Fiyatlandirma (fiyat + daha once hic kullanilmayan
   `compareAtCents` alani icin "indirim oncesi fiyat" eklendi) / Varyantlar
   (beden-renk-stok, satir basi metin formati korundu) / Gorseller / Kategori
   ve Durum.
   - Duzenleme sayfasi artik sadece isim/aciklama/fiyat/durum degil, **gorsel
     ve varyant listelerini de** guncelleyebiliyor (`prisma.$transaction` ile
     urun + gorseller + varyantlar tek islemde guncelleniyor; varyant
     silme bir siparise bagliysa (FK kisitlamasi) transaction hata verip
     hicbir sey degismeden `?hata=kaydedilemedi` ile geri donuyor).
   - Yeni `src/components/admin/save-bar.tsx`: forma `id="product-form"`
     verilip bu client bilesen `input`/`change` olaylarini dinliyor, herhangi
     bir alan degisince sayfanin altinda sabit (`sticky bottom-4`) "Kaydedilmemis
     degisiklikler var - [Vazgec] [Kaydet]" cubugu beliriyor (Kaydet, HTML5
     `form` attribute'u ile forma disaridan bagli submit butonu).
   - Yeni `src/components/admin/product-feedback.tsx`: server action basarili/
     hatali oldugunda `?basarili=...`/`?hata=...` query'sine redirect ediyor,
     bu client bilesen mount'ta Toast gosterip URL'i temizliyor (Ayarlar
     sayfasindaki `settings-feedback.tsx` deseniyle ayni).
   - Yeni `src/components/admin/delete-product-form.tsx`: silme formunu
     `window.confirm` ile sarmalayan kucuk bir client bilesen.
3. **Kategoriler** (`src/app/(site)/admin/kategoriler/page.tsx`) `Card` ile
   toparlandi, urun sayisi `Badge` olarak gosteriliyor.
   - Yeni `src/components/admin/category-row.tsx`: her satir icin inline
     duzenleme (kalem ikonuna tiklayinca isim input'una donusuyor) ve silme
     (cop kutusu ikonu, `window.confirm`) eklendi.
   - `deleteCategory` server action'i, silmeden once kategoriye bagli urun
     sayisini kontrol ediyor: urun varsa silme engelleniyor ve
     `?hata=urun-bagli` ile kullaniciya uyari toast'i gosteriliyor (kategori
     silinmiyor).
   - Yeni `src/components/admin/category-feedback.tsx`: ekleme/guncelleme/
     silme sonrasi Toast bildirimi (ayni redirect+query deseni).

**Test edildi** (`npm run build` hatasiz + `npm run dev` ile canli Neon
veritabanina karsi, NextAuth credentials ile giris yapip `curl` uzerinden):
- `/admin/urunler`, `?q=mont`, `?durum=DRAFT`, `?sort=price&dir=asc` hepsi
  200 donuyor; arama gercek urunu buluyor, durum filtresi (eslesmeyen
  durum) bos sonuc + "Sonuc bulunamadi" gosteriyor, thumbnail `<img>`
  etiketi dogru gorsel URL'iyle render ediliyor.
- **Urun olusturma**: React Server Action'in multipart/form-data + gizli
  `$ACTION_ID_*` alani gerektirdigi tespit edilip (Faz 1'deki gibi) buna
  gore test edildi - yeni test urunu basariyla olusturuldu, Card
  bolumleriyle (Temel Bilgiler/Fiyatlandirma/Varyantlar/Gorseller/
  Kategori ve Durum) dogru render edildi, `?basarili=olusturuldu` ile
  yonlendirildi.
- **Urun guncelleme**: bound server action'larin (`$ACTION_REF_N` +
  `$ACTION_N:0`/`$ACTION_N:1` alanlari) HTML'deki tam kodlamasi curl ile
  birebir tekrarlanarak test edildi - isim/fiyat/indirim-oncesi-fiyat/
  varyant degisikligi Neon'a basariyla yazildi ve sayfada geri geldigi
  dogrulandi.
- **Toplu islemler**: `/api/admin/urunler/bulk` - durum degistirme (200,
  DB'de dogrulandi), oturumsuz istek (401), toplu silme (200, urun
  gercekten silindi, `GET` sonrasi 404).
- **Kategoriler**: yeni test kategorisi olusturuldu; urune bagli mevcut
  "Dis Giyim" kategorisini silmeye calisinca `?hata=urun-bagli` ile
  engellendi (kategori silinmedi, dogrulandi); bagli urunu olmayan test
  kategorisi basariyla silindi (`?basarili=silindi`).
- Test sirasinda olusturulan tum test verileri (test urunu, test
  kategorisi) temizlendi; gercek seed verisi (`Bollmark Oversize Mont`,
  `Dis Giyim` kategorisi) dokunulmadan kaldi.
- Degisiklikler commit'lenip GitHub'a push edildi (`fa96f2a`) - Vercel git
  baglantisi sayesinde otomatik deploy tetiklendi.

## Admin paneli yenilemesi - Faz 3: Siparisler & Kargolar & Musteriler (2026-08-29, yeni oturum)

`ADMIN_PANEL_PLAN.md` Faz 3 kapsami uygulandi: siparis liste/detay sayfalari
Faz 1/2'de kurulan ortak bilesenlerle yeniden yazildi, kargolar sayfasi
DataTable + satir ici duzenlemeye gecti, musteriler sayfasi siparislerden
turetilen gercek bir liste oldu (V1, sema degisikligi yok).

1. **Ortak yardimcilar**: `src/lib/status.ts` - Order.status (7 deger) ve
   Shipment.status (5 deger) icin Turkce etiket + Badge tonu eslemeleri tek
   yerde tutuluyor (siparisler listesi/detayi, kargolar sayfasi hepsi buradan
   okuyor). `src/lib/shipment.ts` - kargo guncelleme mantigi (`applyShipmentUpdate`,
   FormData alir: shipmentId/carrier/trackingCode/status; durum
   KARGOYA_VERILDI/TESLIM_EDILDI oldugunda ilgili tarih alanini otomatik
   set eder) tek yerde tanimlandi; hem kargolar sayfasi hem siparis detay
   sayfasi kendi kucuk "use server" sarmalayicisi icinden (kendi redirect
   hedefiyle) bu fonksiyonu cagiriyor - kod tekrari onlendi, ayni zamanda
   Next.js'in "use server" dosyalarinin sadece async fonksiyon export
   edebilmesi kisitlamasina da uyuldu (sabitler/etiketler ayri, "use server"
   olmayan bir dosyada).
2. **Siparisler listesi** (`src/app/(site)/admin/siparisler/page.tsx`)
   tamamen yeniden yazildi:
   - `q` (siparis no, musteri adi **veya e-posta**), `durum` (Order.status),
     `kargoDurum` (Shipment.status, veya kargo kaydi olmayanlar icin ozel
     `YOK` degeri -> `shipment: null`), `baslangic`/`bitis` (createdAt
     tarih araligi, gun sonu/basi ile), `sort`/`dir` URL parametreleri
     Prisma sorgusuna uygulaniyor.
   - Yeni `src/components/admin/orders-filters.tsx` (arama debounce +
     odeme durumu/kargo durumu select'leri + iki tarih input'u,
     products-filters.tsx'in ayni deseni) ve
     `src/components/admin/orders-table.tsx` (DataTable sarmalayicisi:
     odeme durumu ve kargo durumu **iki ayri renkli Badge yan yana**, kargo
     kaydi yoksa gri "Kargo Yok"; checkbox + BulkActionBar ile toplu
     "Odendi Olarak Isaretle / Hazirlaniyor Olarak Isaretle / Iptal Et" -
     silme yok).
   - Yeni API route `src/app/api/admin/siparisler/bulk/route.ts` (POST,
     oturum kontrollu, sadece `SET_STATUS`, 7 durumdan biri).
   - **Karar (plan acik birakmisti)**: musteriler sayfasindan gelen
     "bu musterinin siparislerini goster" linki e-posta ile filtreleme
     yaptigi icin, `q` aramasina `customerEmail` de eklendi (plan sadece
     "siparis no / musteri adi" diyordu ama e-posta olmadan musteri->siparis
     linki calismazdi).
3. **Siparis detayi** (`siparisler/[id]/page.tsx`) Card bolumlerine
   ayrildi: ust ozet (odeme+kargo Badge'leri yan yana + toplam tutar +
   duruma gore tek buton: PENDING_PAYMENT->"Odendi Olarak Isaretle",
   PAID->"Hazirlaniyor Olarak Isaretle", PREPARING->"Kargola",
   **SHIPPED->"Teslim Edildi Olarak Isaretle"** (plan bu adimi belirtmemisti,
   akisin tamamlanmasi icin eklendi) + CANCELLED/DELIVERED/REFUNDED disinda
   her zaman "Iptal Et"), sol kolonda Urunler karti + Zaman Cizelgesi
   (siparis olusturulma + varsa kargoya verilme/teslim tarihi, sade
   div/Tailwind dikey timeline), sag kolonda Musteri karti ve
   duzenlenebilir Kargo karti (`applyShipmentUpdate` kullanir, kaydedince
   `#kargo` anchor'ina donuyor). Toast bildirimi icin
   `src/components/admin/order-feedback.tsx` eklendi.
4. **Kargolar** (`src/app/(site)/admin/kargolar/page.tsx`) `DataTable` +
   satir ici duzenlemeye gecti: Yeni `src/components/admin/shipments-table.tsx`
   client bileseni bir `editingId` state'i tutuyor, kalem ikonuna tiklanan
   satirda Kargo Firmasi/Takip Kodu/Durum hucreleri input/select'e donusuyor
   - bu alanlar DataTable'in ayri `<td>` hucrelerinde oldugu icin, tek bir
     gizli `<form>` (Kargo Firmasi hucresinde) ile digerleri arasinda
     HTML5'in yerlesik `form="..."` attribute'u kullanildi (projede
     `save-bar.tsx`'teki submit butonunun forma disaridan baglanmasiyla
     ayni teknik). Arama (siparis no) + durum filtresi icin yeni
     `src/components/admin/kargolar-filters.tsx`. Toast icin yeni
     `src/components/admin/shipment-feedback.tsx` (category-feedback.tsx'i
     dogrudan yeniden kullanmaya calisildi ama o bilesen `/admin/kategoriler`
     yoluna sabit yonlendirdigi icin kargolar sayfasini yanlis yere
     redirect ediyordu - fark edilip ayri bir bilesene ayrildi).
5. **Musteriler** (`src/app/(site)/admin/musteriler/page.tsx`) V1 olarak
   gercek liste oldu (sema degisikligi yok): tum siparisler tek sorguda
   cekilip `customerEmail`'e gore JS'te gruplaniyor (siparis sayisi, toplam
   harcama toplaniyor; isim/en son siparis tarihi olarak **en yeni siparisin
   degerleri** kullaniliyor - musteri isim degistirsin diye). **Karar (plan
   acik birakmisti)**: liste varsayilan olarak **son siparis tarihine gore
   azalan** sirali (en son alisveris yapan en üstte) - baska bir siralama
   kriteri belirtilmemisti, en dogal varsayilan bu secildi. Arama (isim/
   e-posta) icin yeni `src/components/admin/customers-filters.tsx`. Musteri
   adina tiklaninca `/admin/siparisler?q=<email>` adresine yonlendiriyor.
   - **Bulunan hata**: ilk yazimda `columns` (icinde JSX `render` fonksiyonlari
     olan) dogrudan sayfa (server component) icinde tanimlanip `DataTable`
     (client component) bilesenine prop olarak geciriliyordu - bu, Next.js'in
     "fonksiyonlar Server'dan Client'a `use server` isaretlenmeden
     gecirilemez" kuralina takilip calisma zamaninda hata verdi (curl ile
     test edilirken RSC payload'inda acikca gorundu). **Duzeltme**: Faz 2'deki
     `products-table.tsx`/`orders-table.tsx` deseniyle ayni sekilde, yeni bir
     `src/components/admin/customers-table.tsx` client bileseni olusturulup
     `columns` tanimi bu bilesenin **icine** tasindi, sayfa sadece duz veri
     (`CustomerRow[]`) geciriyor.
6. **`Card` bilesenine** (`src/components/admin/card.tsx`) opsiyonel `id`
   prop'u eklendi - siparis detayindaki Kargo karti `id="kargo"` ile
   isaretlenip "Kargola"/kargo guncelleme sonrasi `#kargo` anchor'ina
   yonlendirmeyi mumkun kildi.

**Test edildi** (`npm run build` hatasiz, TypeScript temiz, `/` ve
`/urunler` hala statik; `npm run dev` ile canli Neon veritabanina karsi,
NextAuth credentials ile giris yapip iki gecici test siparisi olusturarak -
`POST /api/orders` ile - `curl` uzerinden):
- **Onemli bulgu**: `npm run build` sonrasi ayni `.next` klasoru uzerine
  `npm run dev` calistirildiginda TUM route'lar (hatta `/` ve `/admin/login`)
  404 donduruyordu (build ve dev modlarinin `.next` cikti formati
  cakisiyor). `rm -rf .next` ile temizleyip `npm run dev`'i sifirdan
  baslatmak sorunu cozdu - build/dev modlarini ayni `.next` klasorunu
  paylastirmadan, aralarinda `.next` silinerek gecis yapilmali.
- Siparis listesi: arama (siparis no + e-posta), durum filtresi (eslesmeyen
  durumda "Sonuc bulunamadi"), kargo durumu filtresi, tarih araligi (bugunu
  iceren araliktda gorunuyor, dislayan aralikta bos), `sort=total`
  siralamasi - hepsi dogrulandi.
- Toplu islem API'si: oturumsuz istek 401; oturumlu `SET_STATUS=PAID`
  200 donup DB'de dogrulandi.
- Siparis detayi: bulk ile PAID yapilan siparis sirasiyla `curl` ile
  React Server Action'in multipart/form-data kodlamasi (`$ACTION_REF_N` +
  `$ACTION_N:0`/`$ACTION_N:1` alanlari, Faz 1/2'deki gibi HTML'den
  birebir okunarak) kullanilarak PREPARING -> SHIPPED durumlarina
  gecirildi; her adimda dogru sonraki buton ("Hazirlaniyor Olarak Isaretle"
  -> "Kargola" -> "Teslim Edildi Olarak Isaretle") ve dogru Badge
  goruldu; SHIPPED'e gecince redirect'in `#kargo` anchor'i icerdigi
  dogrulandi. Kargo karti formu (carrier/trackingCode/status) ayni
  yontemle gonderilip Neon'a yazildigi, zaman cizelgesine "Kargoya
  Verildi" olayinin eklendigi ve kargolar sayfasina da yansidigi
  dogrulandi.
- Kargolar sayfasi: arama (siparis no) ve durum filtresi `curl` ile
  dogrulandi. **Not**: satir ici duzenleme (kalem ikonu -> form) React
  `useState` ile calisan istemci tarafi bir etkilesim oldugu icin (ilk
  sunucu tarafi HTML'de duzenleme formu hic render edilmiyor, sadece
  JS hydration sonrasi goruntuleniyor) `curl` ile uctan uca test
  edilemedi - ayni paylasilan `applyShipmentUpdate` fonksiyonu siparis
  detay sayfasindaki kargo formu uzerinden basariyla test edildi, kod
  yolu ayni. Gercek tarayicida pencil-tikla-duzenle-kaydet akisinin
  gorsel olarak da dogrulanmasi onerilir.
- Musteriler sayfasi: yukaridaki DataTable/Server-Client fonksiyon hatasi
  bulunup duzeltildikten sonra, iki test siparisi (ayni e-posta,
  farkli musteri adi) tek bir musteri satirinda dogru toplaniyor
  (siparis sayisi=2, toplam harcama=iki siparisin toplami, isim=en son
  siparisteki ad) dogrulandi; arama (isim/e-posta) ve bos sonuc durumu
  calisiyor; musteri satirina tiklaninca `/admin/siparisler?q=<email>`
  adresinin (yukaridaki e-posta arama duzeltmesi sayesinde) dogru
  siparisleri gosterdigi dogrulandi.
- Test icin olusturulan iki gecici siparis (`test-faz3@example.com`,
  cascade ile shipment/orderItem kayitlariyla birlikte) `tsx` ile yazilan
  gecici bir betikle Neon'dan silindi, betik commit'lenmeden kaldirildi;
  gercek seed verisine dokunulmadi.
- Degisiklikler commit'lenip GitHub'a push edildi - Vercel git baglantisi
  sayesinde otomatik deploy tetiklendi.

**Sirada**: `ADMIN_PANEL_PLAN.md` Faz 4 (Dashboard: grafikler, son
siparisler / stogu azalan urunler mini listeleri).

## Admin paneli yenilemesi - Faz 4: Dashboard (2026-08-29, yeni oturum)

`ADMIN_PANEL_PLAN.md` Faz 4 kapsami uygulandi: dashboard (`/admin`) tamamen
yeniden yazildi - Faz 1'de yazilip hic kullanilmayan `StatCard` bileseni
devreye alindi, 30 gunluk siparis grafigi (`recharts`) ve iki mini liste
eklendi. **Bu, planin son fazi - Faz 1-4 hepsi tamamlandi.**

1. **`recharts` kuruldu** (`npm install recharts`, `package.json`/
   `package-lock.json`).
2. **Sayac kartlari `StatCard`'a gecti** (`src/app/(site)/admin/page.tsx`):
   Toplam Urun (Package ikonu), Toplam Siparis (ShoppingCart), Odeme
   Bekleyen (Clock), Ciro (Wallet). Siparis ve Ciro kartlarina trend eklendi:
   bu ayin 1'inden bugune kadar olan siparis sayisi/ciro, gecen ayin ayni
   gun sayisi kadarki (`Math.min(bugunun_gunu, gecen_ayin_gun_sayisi)`)
   donemiyle karsilastiriliyor. **Karar**: onceki donemde hic siparis yoksa
   (`previous === 0`) trend hic gosterilmiyor (sahte/yaniltici %/fark
   uretilmiyor) - `src/app/(site)/admin/page.tsx` icindeki `trendFrom`
   yardimci fonksiyonu bunu yapiyor. Toplam Urun ve Odeme Bekleyen
   kartlarinda trend gosterilmedi (plan sadece siparis sayisi/ciro icin
   trend istiyordu, stok/bekleyen siparis sayisi icin anlamli bir "onceki
   donem" karsilastirmasi yok).
3. **Son 30 gunluk siparis grafigi**: Prisma ile son 30 gunun siparisleri
   (`createdAt`, `status`, `totalCents` alanlari) tek sorguda cekilip JS
   tarafinda GUNE gore gruplaniyor; ciro sadece PAID/PREPARING/SHIPPED/
   DELIVERED durumundaki siparislerden hesaplaniyor (dashboard'daki ana
   ciro sayaciyla ayni filtre - `REVENUE_STATUSES` sabiti). Siparis olmayan
   gunler 0 olarak diziye ekleniyor.
   - **Bulunan ve duzeltilen hata (yerel test sirasinda)**: gun anahtarlari
     ilk yazimda yerel saat (`setDate`/`setHours`) ile hesaplanip
     `toISOString()` ile UTC string'e cevriliyordu - sunucu saat dilimi
     UTC'den farkli oldugunda (bu makine Turkiye, UTC+3) bu, butun gunleri
     bir gun geriye kaydiriyor ve BUGUNUN siparislerini grafikten tamamen
     dusuruyordu (curl ile test edilirken grafigin flight payload'inda
     "orders":0 hepsi ve bugunun tarihinin hic gorunmedigi fark edildi).
     **Duzeltme**: hem 30 gunluk baslangic hem gun dongusu `Date.UTC(...)` /
     `setUTCDate` ile tamamen UTC takvim gunlerine gore hesaplanacak sekilde
     degistirildi, siparislerin `createdAt.toISOString().slice(0,10)`
     anahtariyla eslesmesi garanti edildi (hangi sunucu saat diliminde
     calisirsa calissin tutarli).
   - Yeni client bileseni `src/components/admin/orders-chart.tsx`:
     "use client", `recharts`'in `ResponsiveContainer` + `LineChart`'i,
     tek renk (`#4f46e5`, admin-accent) cizgi, sade tooltip (siparis sayisi
     + ciro TL olarak). Sayfa (server component) sadece duz veri dizisini
     (`{ date, orders, revenueCents }[]`) bu bilesene prop olarak geciriyor
     - proje kuralina uyularak JSX/render mantigi client bilesenin icinde
     tutuldu, server->client'a JSX render fonksiyonu gecirilmedi.
   - Grafik bir `Card` icinde "Son 30 Gun" basligiyla; hic siparis yoksa
     (`orderCount === 0`) `EmptyState` gosteriliyor.
4. **"Son Siparisler" mini listesi**: son 5 siparis (`createdAt desc`),
   siparis no + musteri adi + tutar + `status.ts`'teki `orderStatusTone`/
   `orderStatusLabel` ile Badge (Faz 3'teki `orders-table.tsx` ile ayni
   desen), tiklaninca `/admin/siparisler/[id]`'ye giden `Link`. Hic siparis
   yoksa `EmptyState`.
5. **"Stogu Azalan Urunler" mini listesi**: `ProductVariant` uzerinden
   `stock < 5` olan varyantlar, en dusuk stoklu ustte, en fazla 8 satir;
   urun adi + beden/renk + kalan stok, tiklaninca `/admin/urunler/[id]`'ye
   giden `Link`. Hic dusuk stoklu varyant yoksa sakin bir "Stok seviyeleri
   iyi gorunuyor" metni (panik yaratmayan ifade, plan bunu istiyordu).
6. **Layout**: ustte 4 `StatCard` (grid-cols-2 md:grid-cols-4 korundu),
   altinda solda (2/3 genislik) grafik karti + sagda (1/3) Son Siparisler
   karti, en altta tam genislik Stogu Azalan Urunler karti; mobilde
   (`lg:` altinda) tek kolona dusuyor.

**Test edildi** (`npm run build` hatasiz, `/` ve `/urunler` hala statik;
`rm -rf .next` ile temizleyip `npm run dev` ile canli Neon veritabanina
karsi, NextAuth credentials login'i `curl` ile `/api/auth/callback/credentials`
uzerinden yapip authenticated cookie ile):
- **StatCard sayilari**: gercek DB durumuyla (1 urun, 3 siparis, 1 odeme
  bekleyen, ₺5.697 ciro) birebir eslesti dogrulandi.
- **Trend**: veritabaninda onceki ay siparisi olmadigi icin (butun test
  siparisleri bugun olusturulmus) trend metni **dogru sekilde
  gosterilmedi** (sahte veri uretilmedigi dogrulandi) - "veri yetersizse
  gosterme" karari bu senaryoda calistigi teyit edildi.
- **30 gunluk grafik**: yukaridaki UTC duzeltmesinden sonra, React flight
  payload'i (`curl` ciktisinda) incelenerek 30 gun anahtarinin dogru
  uretildigi, bugunun tarihinin (`2026-08-29`) dizide yer aldigi ve
  `orders:3, revenueCents:569700` ile gercek siparislerle esleştigi
  (ana ciro sayaciyla ayni toplam) dogrulandi. **Not**: `recharts`'in
  `ResponsiveContainer`i genislik olcumu icin tarayici hidrasyonu
  gerektirdigi icin sunucu tarafi HTML'de (curl) grafik SVG'si tam
  gorunmuyor - bu kutuphanenin bilinen/beklenen davranisi, gercek
  tarayicida sorun teskil etmez; bu ortamda headless tarayici araci
  olmadigi icin piksel-duzeyinde gorsel dogrulama yapilamadi (kullaniciya
  onerilir).
- **Son Siparisler listesi**: 3 gercek siparis dogru sirada (en yeni once),
  dogru Badge tonlariyla (Odeme Bekliyor/Hazirlaniyor/Kargolandi) ve dogru
  `/admin/siparisler/[id]` linkleriyle render edildi.
- **Stogu Azalan Urunler**: gecici bir test varyanti (stock=2,
  `TEST-LOWSTOCK-*` SKU'su ile) olusturulup dashboard'da dogru urun adi +
  beden/renk + "2 adet" ile gorundugu dogrulandi, ardindan test verisi
  Neon'dan silindi (gercek seed verisine dokunulmadi); silme sonrasi "Stok
  seviyeleri iyi gorunuyor" mesaji tekrar goruldu.
- Test icin kullanilan gecici `lowstock-test.ts` betigi (proje kokunde,
  `prisma.config.ts`'teki gibi `process.loadEnvFile()` ile calisan) test
  sonunda silindi, commit'e dahil edilmedi.
- Degisiklikler commit'lenip GitHub'a push edildi - Vercel git baglantisi
  sayesinde otomatik deploy tetiklendi.

**Sirada**: Plan tamamlandi (Faz 1-4). Ileride eklenmesi istenirse gercek
bir `Customer` modeli (V2, `ADMIN_PANEL_PLAN.md`'de Musteriler bolumunde
not dusuldu) disinda acik bir madde kalmadi.

## Varyant yonetimi yenilemesi - Faz A: Sema (2026-08-30, yeni oturum)

Plan `VARYANT_YONETIMI_PLANI.md` dosyasinda cikarildi (varyant basina
opsiyonel fiyat/indirim/gorsel + toplu duzenleme). Bu oturumda Faz A -
Sema kapsami uygulandi.

1. **`ProductVariant` modeline** (`prisma/schema.prisma`) uc yeni opsiyonel
   alan eklendi: `priceCents` (Int?), `compareAtCents` (Int?), `imageUrl`
   (String?). Hicbiri zorunlu degil - bos birakilirsa urunun genel
   `Product.priceCents`/`compareAtCents` degeri gecerli olmaya devam eder
   (geriye donuk uyumlu, mevcut varyantlar hicbir deger kaybetmedi).
2. **`npm run db:push`** Neon'a basariyla uygulandi, ardindan
   `npx prisma generate` ile client yeniden uretildi.
3. **`src/lib/variant.ts`** eklendi: `effectivePrice(product, variant)` ve
   `effectiveCompareAt(product, variant)` yardimci fonksiyonlari - varyantin
   kendi degeri varsa onu, yoksa urunun genel degerini donduruyor. Bu iki
   fonksiyon Faz B (admin formu varsayilan fiyat placeholder'i) ve Faz D
   (sepet/siparis fiyat hesabi) tarafindan ortak kullanilacak.
4. **Yan bulgu**: `git pull` ile gelen son 5 commit `package.json`'a
   `recharts` bagimliligini eklemisti ama yerel `node_modules` guncel
   degildi, bu yuzden `npm run build` `recharts` bulunamadi hatasi verdi
   (bu oturumun degisikligiyle ilgisiz). `npm install` ile duzeltildi.

**Test edildi**: `rm -rf .next` + `npm run build` hatasiz calisti (tum
route'lar ayni sekilde derlendi, sema degisikligi TypeScript/Prisma Client
tarafinda hicbir mevcut kullanimi bozmadi - cunku yeni alanlarin hepsi
opsiyonel ve henuz hicbir yerde okunmuyor/yaziliyor).

**Sirada**: Faz B - Admin UI (VariantEditor bileseni, CSV textarea'nin
kaldirilmasi).

## Varyant yonetimi yenilemesi - Faz B: Admin UI (2026-08-30, ayni oturum)

CSV formatli tek metin kutusu ("Beden,Renk,SKU,Stok" satir satir) tamamen
kaldirildi, yerine gercek bir tablo bileseni geldi.

1. **`src/components/admin/variant-editor.tsx`** (yeni, "use client") -
   mevcut `DataTable` (checkbox secimi + `BulkActionBar` zaten dahili
   destekliyor) uzerine kurulu. Sutunlar: Beden, Renk, SKU, Stok, Fiyat
   (TL, opsiyonel, placeholder "Varsayılan: {ürün fiyatı} TL"), İndirim
   Öncesi (TL, opsiyonel), Görsel URL (opsiyonel), sil ikonu. Her hucre
   kendi input'una sahip, state React `useState<VariantRow[]>` ile client
   tarafinda tutuluyor. "+ Varyant Ekle" butonu (`Button` bileseni) altta
   bos bir satir ekliyor. Form gonderilirken state `serializeVariantRows`
   ile sayisal alanlara (priceCents/compareAtCents cent cinsine, bos ise
   `null`) cevrilip gizli `<input type="hidden" name="variantsJson">`
   alanina `JSON.stringify` ile yaziliyor.
2. **`urunler/[id]/page.tsx`** ve **`urunler/yeni/page.tsx`**: `updateProduct`/
   `createProduct` server action'lari artik `variantsJson`'u parse edip
   dogruluyor (`parseVariantsJson` yardimci fonksiyonu, negatif olmayan
   stok, gecersiz sayilar `null`'a dusuyor). Kaydetmeden once **SKU tekilligi**
   ve **beden+renk kombinasyonu tekilligi** JS tarafinda onceden kontrol
   ediliyor (DB'deki `@@unique` kisitlamasina denk gelmeden once anlamli
   hata mesaji vermek icin) - ihlal varsa `?hata=sku-tekrar` veya
   `?hata=varyant-tekrar` ile geri donuluyor.
   - **Karar**: `urunler/yeni/page.tsx` daha once hic `?hata=` ile geri
     donmuyordu (create action'da try/catch yoktu); bu fazda eklendi -
     sayfa artik `searchParams` okuyup mevcut `ProductFeedback` bilesenini
     (Faz 2'den, zaten genel amacli) kullaniyor.
3. **`src/components/admin/product-feedback.tsx`**: yeni iki hata mesaji
   eklendi (`sku-tekrar`, `varyant-tekrar`) - digerleriyle ayni desen.
4. **Yan not**: `git pull` ile gelen `package.json` degisikligi (`recharts`)
   yerel `node_modules`'a hic yansimamisti; Faz A'da fark edilip `npm install`
   ile duzeltildi (bu notu tekrarlamaya gerek yok, sadece derleme calisir
   durumda tutuldu).

**Test edildi**: `npm run build` hatasiz. Ayrica yerel `npm run dev` +
NextAuth credentials login (curl, Faz 2/3'teki ayni yontem) ile **gercek
bir uctan uca senaryo** calistirildi:
- `/admin/urunler/yeni` sayfasi VariantEditor'i dogru render etti (tablo
  basliklari, "Varyant Ekle" butonu, gizli `variantsJson` alani HTML'de
  goruldu).
- React Server Action'in gerektirdigi multipart/form-data + `$ACTION_ID_*`
  (basit action) / `$ACTION_REF_N` + `$ACTION_N:0`/`:1` (bound action,
  update/delete icin) alanlari HTML'den okunup curl ile birebir
  tekrarlanarak: 2 varyantli (biri fiyat override'li) bir test urunu
  **olusturuldu** (dogrulandi: her iki varyant da dogru SKU/fiyat/indirim
  ile edit sayfasinda goruldu) -> **guncellendi** (bir varyant silindi,
  yeni bir varyant eklendi, digerinin stogu degistirildi - hepsi dogru
  yansidi) -> **silindi** (urun ve varyantlari Neon'dan kalkti, sonraki
  istek 404 dondu). Test verisi tamamen temizlendi, gercek seed verisine
  dokunulmadi.

**Sirada**: Faz C - Toplu islem (checkbox + BulkActionBar zaten VariantEditor
icinde hazir; simdi yuzde indirim/stok/silme aksiyonlarinin dogrulanmasi).

## Varyant yonetimi yenilemesi - Faz C: Toplu islem (2026-08-30, ayni oturum)

Checkbox ile coklu secim ve `BulkActionBar` entegrasyonu aslinda Faz B'de
`VariantEditor` yazilirken bitmisti (`DataTable`'in kendi `selectable` +
`bulkActions` mekanizmasi yeniden kullanildi - ayri bir bilesen gerekmedi).
Bu fazda odak, uc aksiyonun (% indirim, stok ekle/cikar, secilenleri sil)
gercekten dogru hesapladigini test edilebilir hale getirip dogrulamakti.

1. **Kucuk refactor**: Yuzde indirim ve stok delta hesaplama mantigi,
   bileşen icine gomulu `onClick` closure'larindan disari cikarilip iki
   saf fonksiyon olarak export edildi: `applyPercentDiscount(rows,
   selectedIds, pct)` ve `applyStockDelta(rows, selectedIds, delta)`
   (`src/components/admin/variant-editor.tsx`). Davranis degismedi, sadece
   test edilebilir hale geldi - React state guncellemesi hala ayni
   `setRows((prev) => applyXxx(prev, ...))` deseniyle yapiliyor.
   - **% Indirim**: sadece secili VE fiyati doldurulmus satirlara uygulanir
     (fiyati bos - urun fiyatini kullanan - satirlara dokunulmaz, cunku
     hangi taban fiyattan indirim yapilacagi belirsiz olurdu). Sonuc
     `Math.max(0, ...)` ile negatife dusmez.
   - **Stok Ekle/Cikar**: pozitif veya negatif tam sayi kabul eder, sonuc
     yine `Math.max(0, ...)` ile 0'in altina dusmez.
   - **Secilenleri Sil**: `window.confirm` sonrasi satirlari state'ten
     cikarir (mevcut urun/kategori sayfalarindaki silme onayi deseniyle
     ayni).
2. Proje kokunde gecici bir `tmp-variant-editor-test.ts` betigi yazilip
   `npx tsx` ile calistirildi (onceki oturumdaki `lowstock-test.ts`
   deseniyle ayni - repo disina cikmadan, DB'ye dokunmadan, saf fonksiyon
   testi): 10 senaryo (yuzde indirimin secili olmayan/fiyati bos satirlara
   dokunmadigini, stok delta'nin 0 siniri asmadigini, `serializeVariantRows`'un
   tamamen bos satirlari elemesini ve TL->cent donusumunu dogru yaptigini
   kontrol ediyor) - **hepsi basarili**. Test betigi calistirildiktan sonra
   silindi, commit'e dahil edilmedi.

**Test edildi**: Yukaridaki 10 otomatik senaryo + `npm run build` hatasiz.
Checkbox/BulkActionBar UI etkilesimi (tiklama) bu ortamda headless bir
tarayici araci olmadigi icin gorsel olarak denenmedi (Faz 4'teki `recharts`
notuyla ayni kisit) - ancak alttaki hesaplama mantigi ve `DataTable`'in
zaten Urunler/Siparisler sayfalarinda calistigi dogrulanmis secim/BulkActionBar
mekanizmasi degistirilmeden yeniden kullanildigi icin risk dusuk
degerlendirildi.

**Sirada**: Faz D - Sipariş akışı düzeltmesi (kritik: sepet + siparis
olusturma varyant fiyatini dogru okumali).

## Varyant yonetimi yenilemesi - Faz D: Siparis akisi duzeltmesi - kritik (2026-08-30, ayni oturum)

Planin en kritik adimi: varyant fiyati admin panelinde girilebiliyor olsa
bile, sepete ekleme ve siparis olusturma hala urunun genel fiyatini
okuyorsa musteri hicbir zaman dogru tutari odemiyordu. Bu fazda iki katmanli
bir duzeltme yapildi.

1. **`src/components/add-to-cart.tsx`**: `Variant` tipine `priceCents:
   number | null` eklendi, `effectivePrice` (`src/lib/variant.ts`, Faz A)
   ile secili varyantin gecerli fiyati hesaplanip hem "Sepete Ekle" buton
   metninde hem de `addLine()`'a gonderilen `priceCents` degerinde
   kullaniliyor - eskiden ikisi de sabit `product.priceCents` idi.
   - **Kapsam siniri (plana sadik kalindi)**: urun sayfasinin ustundeki ana
     fiyat/indirim bloğu ve gorsel galerisi **dokunulmadan** birakildi -
     bunlarin secime gore dinamik guncellenmesi plan tarafindan acikca
     "ileride" olarak isaretlenmisti. Sadece "Sepete Ekle" butonunun
     gosterdigi/gonderdigi fiyat duzeltildi (bu, siparis tutarinin dogrulugu
     icin zorunluydu, dinamik gorsel/fiyat gosterimi degil).
   - `src/app/(site)/urunler/[slug]/page.tsx`: `AddToCart`'a gecirilen
     `variants` listesine `priceCents` alani eklendi (`getProductBySlug`
     zaten Faz A'dan beri bu alani donduruyor, sadece prop'a aktarilmiyordu).
2. **`src/app/(site)/api/orders/route.ts`** - **daha onemli/asil duzeltme**:
   Route eskiden siparis tutarini **tamamen istemcinin gonderdigi
   `priceCents` degerine** guveniyordu (tarayici konsolundan degistirilebilir
   bir deger, admin panelindeki varyant fiyati zaten hic okunmuyordu). Bu
   fazda `lineSchema`'dan `priceCents` alani tamamen kaldirildi; route artik
   her satir icin `productId`+`variantId`'yi veritabanindan (`prisma.product.findMany`
   + `include: { variants: true }`) yeniden cekip `effectivePrice(product,
   variant)` ile **sunucu tarafinda** fiyati hesapliyor. Boylece: (a) varyant
   fiyati artik gercekten siparise yansiyor, (b) istemci tarafinda
   degistirilmis/sahte bir fiyatla siparis verilmesi **artik mumkun degil**
   (onceki davranis bir guvenlik acigiydi, bu fazin dogal bir sonucu olarak
   kapatildi). Gecersiz urun/varyant id'si gelirse 400 + acikca mesajla
   reddediliyor. `src/app/(site)/odeme/page.tsx`'teki checkout formu artik
   `priceCents`'i sunucuya gondermiyor (zaten kullanilmiyordu).

**Test edildi** (yerelde `npm run dev`, canli Neon veritabanina karsi,
gecici bir test urunu ile - **kullanicinin acikca istedigi gercek uctan uca
senaryo**):
- Genel fiyati **100 TL** olan bir test urunu, **250 TL** fiyat override'li
  bir "L" varyanti ile olusturuldu (admin panel server action'i uzerinden,
  onceki fazlardaki curl yontemiyle).
- `POST /api/orders`'a bu varyant icin miktar=2 ve **kasten yanlis/dusuk bir
  `priceCents` (1 kurus)** gonderildi. Siparis basariyla olustu (201) ve
  veritabaninda dogrulandi: `unitPriceCents=25000` (varyantin gercek
  override fiyati, ne genel urun fiyati ne de gonderilen sahte deger),
  `totalCents(satir)=50000`, `subtotalCents=50000`, kargo esigi asilmadigi
  icin `shippingCents=4900`, siparis `totalCents=54900` - **hepsi dogru**.
  Bu, hem varyant fiyatinin artik dogru okundugunu hem de istemci tarafinda
  fiyat manipulasyonunun artik mumkun olmadigini kanitliyor.
- Ayni urune fiyat override'i **olmayan** bir "M" varyanti eklendi, miktar=3
  ile siparis verildi: `unitPriceCents=10000` (urunun genel fiyatina dogru
  sekilde dustu) dogrulandi.
- Var olmayan bir `variantId` ile istek atildi: `400` + "Sepetteki bir ürün
  veya varyant artık mevcut değil." mesaji dondu (dogrulandi).
- Test icin kullanilan gecici Prisma betikleri (`tmp-get-variant-id.ts`,
  `tmp-verify-order.ts`, `tmp-cleanup.ts`, proje kokunde) test sonunda hem
  test urunu/siparislerini Neon'dan sildiler hem de kendileri silindi -
  commit'e dahil edilmediler. `npm run build` hatasiz.

**Sirada**: Faz E - genel test (varyant ekleme/silme/duzenleme, bos fiyat
alaninin urun fiyatina dusmesi, toplu indirim - Faz D'de zaten dogrulanan
siparis tutari haric hepsi tekrar gozden gecirilecek).

## Varyant yonetimi yenilemesi - Faz E: Genel test (2026-08-30, ayni oturum)

Onceki dort faz zaten kendi kapsamlarini tek tek dogrulamisti (Faz B: varyant
ekle/sil/duzenle uctan uca; Faz C: toplu islem hesaplamalari 10 senaryoyla;
Faz D: siparis tutari, hem override'li hem override'siz varyantla). Bu fazda
odak, **bunlarin hepsinin tek bir akista birlikte** dogru calistigini
(bilesenlerin ayri ayri degil, birlikte kullanildiginda da sorunsuz oldugunu)
gostermekti - ayrica planin acikca istedigi "toplu indirim uygulanmis bir
varyantla gercek siparis" senaryosu daha once tam olarak denenmemisti.

Yerelde `npm run dev`, canli Neon'a karsi, NextAuth ile giris yapilip gecici
bir test urunuyle (`faz-e-test-urun`):

1. Admin panel server action'i uzerinden **3 varyantli** bir urun olusturuldu:
   ikisine **%20 toplu indirim uygulanmis gibi** (100 TL -> 80 TL, 200 TL ->
   160 TL - `applyPercentDiscount`'in Faz C'de dogrulanan ciktisiyla birebir
   ayni degerler) fiyat girildi, ucuncusu (L bedeni) **fiyat alani bos**
   birakildi (urunun 100 TL genel fiyatina dusmesi beklenen senaryo).
2. Urun duzenleme sayfasi tekrar acilip **hepsinin dogru kaydedildigi**
   dogrulandi (80.00, 160.00 TL goruldu; L bedeninin stok/SKU'su goruldu,
   fiyat alani bos).
3. Fiyati bos birakilan L varyanti icin **gercek bir siparis** verildi
   (`POST /api/orders`, miktar=1): `unitPriceCents=10000` (urunun genel
   100 TL fiyati) dogru sekilde uygulandi, `totalCents=14900` (10000 +
   4900 kargo) dogrulandi.
4. Test siparisi ve test urunu (3 varyantiyla birlikte, `onDelete: Cascade`)
   Neon'dan tamamen silindi; kullanilan gecici betik (`tmp-cleanup2.ts`)
   de silindi, commit'e dahil edilmedi.
5. `rm -rf .next && npm run build` - **hatasiz**, tum route'lar onceki
   fazlardaki gibi derlendi.
   - **Yan not**: `npm run lint` bu oturumda "Invalid project directory
     provided, no such directory: .../lint" hatasi veriyor - Next.js
     16.3.3'te `next lint` komutunun kendisiyle ilgili, bu fazin
     degisiklikleriyle **ilgisiz** onceden var olan bir durum (ESLint 9
     flat-config'e gecisle ilgili olabilir, arastirilmadi - `npm run build`
     zaten TypeScript tip kontrolunu de yapiyor).

**Sonuc**: Plan `VARYANT_YONETIMI_PLANI.md`'deki 5 fazin (A-E) tamami
tamamlandi ve her biri gercek Neon veritabanina karsi calisan senaryolarla
dogrulandi. Varyant bazinda opsiyonel fiyat/indirim/gorsel, gercek bir
tablo UI'i, toplu islem ve - en kritik olarak - siparis tutarinin artik
dogru (ve istemci tarafinda manipule edilemez) hesaplandigi calisir
durumda. Degisiklikler asama asama commit'lendi; push henuz yapilmadi
(kullanicinin onayi bekleniyor - Vercel git baglantisi sayesinde push
sonrasi otomatik deploy tetiklenecek).

## Varyant Ozellikleri V2 - Faz A (bu oturum)

`VARYANT_OZELLIKLERI_V2_PLANI.md` okundu, Faz A ("Sema") uygulandi: Beden/
Renk artik serbest metin degil, magaza genelinde tanimli bir "Varyant
Ozellikleri" havuzundan geliyor (CRUD ekrani Faz B'de gelecek; bu fazda
sadece veri katmani ve mevcut ekranlarin **calismaya devam etmesi**
saglandi).

1. **Riskli islem oncesi onay**: `prisma db push`, canli/tek Neon
   veritabanina karsi `size`/`color` sutunlarini silecegi icin Prisma'nin
   kendi "AI ajani" guvenlik kontrolune takildi. Kullaniciya durum (islem,
   neden, geri donusu olmadigi, bunun uretim DB'si oldugu) acikca anlatildi
   ve **acik onay alindi** ("onaylıyorum"), ancak sonra
   `PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` ile komut calistirildi.
2. **Yedekleme**: pg_dump/psql bu makinede kurulu olmadigindan, Prisma
   uzerinden tum tablolari (urun, varyant, siparis, vb.) JSON'a doken tek
   seferlik bir betik yazildi (`scripts/backup-before-variant-v2.ts`) ve
   sema degisikliginden hemen once calistirildi (1 urun, 4 varyant, 3
   siparis - kucuk bir veri seti, yedek scratchpad'e kaydedildi, musteri
   verisi icerdigi icin repoya dahil edilmedi).
3. **Sema degisikligi**: `prisma/schema.prisma`'ya `VariantAttribute`,
   `VariantAttributeValue`, `ProductVariantOption` modelleri eklendi;
   `ProductVariant`'a `barcode` (opsiyonel) eklendi, `size`/`color`
   kaldirildi. `npx prisma db push --accept-data-loss` ile Neon'a
   uygulandi, ardindan `npx prisma generate`.
4. **Veri tasima**: `scripts/migrate-variant-attributes.ts`, adim 2'deki
   JSON yedekten okuyup (DB'de artik size/color olmadigi icin), SKU
   eslestirmesiyle mevcut 4 varyanti "Beden"/"Renk" ozellik degerlerine
   bagladi (`ProductVariantOption` satirlari olusturuldu). Sonuc: "Baglanan
   varyant: 4, eslesmeyen: 0".
5. **Kod uyarlamasi (Faz A kapsaminda zorunlu, uygulamanin derlenebilir/
   calisir kalmasi icin)**: Yeni ortak yardimci `src/lib/variant-attributes.ts`
   eklendi (`resolveOptionValueIds` - serbest metinden ozellik degeri
   upsert eder, `optionValue`/`optionLabel` - okuma tarafinda gosterim).
   VariantEditor UI'i **henuz degistirilmedi** (serbest metin Beden/Renk
   input'lari duruyor - kutucukla secim Faz D'de gelecek); sadece bu
   input'lardan gelen deger artik dogrudan sutuna degil, ozellik havuzuna
   yaziliyor. Guncellenen dosyalar: `prisma/seed.ts`,
   `src/lib/catalog.ts`, `src/app/(admin)/admin/page.tsx`,
   `src/app/(admin)/admin/urunler/yeni/page.tsx`,
   `src/app/(admin)/admin/urunler/[id]/page.tsx`,
   `src/app/(site)/urunler/[slug]/page.tsx`.
6. **Yerel test**: `npx tsc --noEmit` temiz, `npm run build` hatasiz (tum
   route'lar onceki gibi derlendi). `npm run dev` ile canli Neon'a karsi:
   - Magaza urun sayfasi (`/urunler/bollmark-oversize-mont`, preview
     cookie ile) dogru Beden (S/M/L) ve Renk (Siyah/Bej) degerlerini
     gosterdi - options iliskisinden okuma dogrulandi.
   - Admin panel sorgulari (dusuk stok listesi, urun duzenleme formu) ayni
     helper'lar ile test edilip dogru etiketler (orn. "Beden: M · Renk:
     Bej") ve varyant sayisi (4) dogrulandi.
   - `npm run lint` onceki fazlarda da bilinen, bu degisiklikle ilgisiz
     "Invalid project directory" hatasini vermeye devam ediyor (build zaten
     TS kontrolu yapiyor).

**Sonuc**: Faz A tamamlandi. Sema + veri tasima canli DB'de basariyla
uygulandi, hicbir veri kaybolmadi (4 varyantin da Beden/Renk bilgisi yeni
tablolarda korundu), mevcut admin ve magaza akislari (henuz redesign
edilmemis UI ile) sorunsuz calismaya devam ediyor. Faz B (Varyant
Ozellikleri admin CRUD ekrani) icin sonraki adim hazir. Degisiklikler
commit'lendi (`275af25`).

## Varyant Ozellikleri V2 - Faz B (bu oturum)

Faz B ("Varyant Ozellikleri admin sayfasi") uygulandi: yeni
`/admin/ayarlar/varyant-ozellikleri` sayfasi, ozellik (Beden, Renk, ...)
ve deger (S, M, L / Siyah, Beyaz, ...) CRUD'u + siralama + Renk ozelligi
icin hex renk secici.

1. **Ek onayli sema degisikligi**: `ProductVariantOption.value` iliskisine
   `onDelete: Cascade` eklendi (bir ozellik degeri silindiginde onu
   kullanan varyantlardaki bag satirlari da silinsin, varyantin kendisi
   etkilenmesin - planin "silme engellenmez ama onay istenir" kuralini
   uygulayabilmek icin gerekliydi). Bu da canli DB'ye karsi bir
   `prisma db push` gerektirdi; otomatik mod siniflandiricisi tekrar
   engelledi, kullaniciya ayrica anlatilip acik onay alindi, veri kaybi
   uyarisi olmadan (sadece FK davranisi degisiyor) sorunsuz uygulandi.
2. **Yeni sayfa**: `src/app/(admin)/admin/ayarlar/varyant-ozellikleri/page.tsx`
   - "Ozellik Ekle" formu (isim benzersizligi kontrolu).
   - Her ozellik bir Card: yukari/asagi ok ile siralama (`position` swap),
     silme (onay + kullanildigi varyant sayisi bilgisi).
   - Deger listesi: yukari/asagi siralama, silme (kullanim sayisi > 0 ise
     confirm mesaji farkli - "N varyantta kullaniliyor, yine de silmek
     istiyor musunuz?").
   - Renk ozelliginde (`attribute.name === "Renk"`, TR locale-insensitive)
     her degerin yaninda renk yuvarlagi + `<input type="color">` (degisince
     otomatik kaydediliyor - `ColorAutoSubmitInput` client bileseni).
   - Yeni paylasilan client bilesenler: `confirm-submit-button.tsx`
     (jenerik onayli sil butonu, `delete-product-form.tsx`'teki desenin
     genellestirilmis hali), `color-auto-submit-input.tsx`.
   - `src/components/admin/sidebar.tsx`'e link eklendi (mevcut "Ayarlar"in
     yanina).
3. **Yerel test**: `npx tsc --noEmit` ve `npm run build` hatasiz (yeni route
   `/admin/ayarlar/varyant-ozellikleri` build ciktisinda gorunuyor).
   `npm run dev` ile:
   - Girissiz istek beklenen sekilde `/admin/login`'e yonlendirildi (route
     korumasi bozulmamis).
   - **Not**: Bu oturumda NextAuth credentials girisi `.env`'deki
     `ADMIN_EMAIL`/`ADMIN_PASSWORD` ile denendi ama basarisiz oldu (401) -
     muhtemelen admin kullanicisinin DB'deki sifre hash'i, `.env`'deki
     mevcut `ADMIN_PASSWORD` degerinden farkli bir sifreyle olusturulmus
     (onceki bir oturumda elle degistirilmis olabilir). Bu, bu fazin
     degisiklikleriyle ilgisiz onceden var olan bir durum - kullaniciya
     bildirilmesi gerekiyor, arastirilip cozulmedi (kapsam disi).
   - Bu yuzden CRUD mantigi tarayici yerine dogrudan ayni Prisma
     islemleriyle (gecici, sonradan silinen bir betikle) canli DB'ye karsi
     test edildi: ozellik/deger olusturma, siralama (position swap),
     deger silince sadece `ProductVariantOption` baginin cascade silinip
     **varyantin kendisinin etkilenmedigi** dogrulandi, ozellik silince
     alti degerlerin de silindigi dogrulandi. Test verisi (gecici
     `TestOzellik` ozelligi ve gecici bir varyant) sonrasinda tamamen
     temizlendi, gercek veriye dokunulmadi.

**Sonuc**: Faz B tamamlandi. Magaza sahibi artik Beden/Renk (ve istenirse
"Kalip" gibi ucuncu bir ozellik) degerlerini serbest metin yazmadan, tanimli
bir havuzdan yonetebiliyor; Renk icin hex renk onizlemesi var. VariantEditor
UI'i (urun duzenleme ekranindaki kutucukla secim) hala Faz D'de - simdilik
serbest metin girisi bu havuza yaziyor.

**Admin girisi sorunu duzeltildi (kullaniciyla teyit edilip)**: `.env`'deki
mevcut `ADMIN_PASSWORD` degeriyle canli DB'deki admin kullanicisinin
(`admin@bollmark.com`) sifre hash'i yeniden olusturuldu (gecici tek
seferlik betikle, sonra silindi). Bu islem de canli DB'ye yazdigi icin
kullaniciya ayrica anlatilip acik onay alindi. Sonrasinda NextAuth
credentials girisi `curl` ile denenip **basarili** oldu (200, gecerli
session donuyor), ardindan `/admin/ayarlar/varyant-ozellikleri` sayfasi
gercek oturumla cekilip Beden/Renk verilerinin dogru goruntulendigi
dogrulandi.

## Varyant Ozellikleri V2 - Faz C (bu oturum)

Faz C ("Gorsel yukleme - Vercel Blob") uygulandi: varyant gorseli artik
sadece URL yapistirma degil, bilgisayardan dogrudan yuklenebiliyor.

1. **Blob store kurulumu (kullaniciyla birlikte, birkac deneme gerekti)**:
   - Ilk olusturulan store **Private** erisimliydi - Vercel'de erisim modu
     (Public/Private) **sadece store olusturulurken** secilebiliyor, sonradan
     degistirilemiyor (bkz. Vercel resmi dokumantasyonu:
     https://vercel.com/docs/vercel-blob/private-storage ve
     https://vercel.com/docs/vercel-blob/public-storage). Private store'da
     dosyalar public URL ile servis edilemiyor (sadece yetkilendirilmis bir
     fonksiyon uzerinden veya en fazla 7 gunluk imzali URL ile) - urun
     gorselleri icin (kalici, herkese acik olmasi gereken) uygun degildi.
   - Kullanici store'u silip **Public** erisimle yeniden olusturdu, projeye
     bagladi, yeni `BLOB_READ_WRITE_TOKEN` degeri paylasti - yerel `.env`'e
     islendi.
2. **Paket**: `@vercel/blob` eklendi (`package.json`).
3. **Upload endpoint**: `src/app/api/admin/upload/route.ts` - oturum
   kontrolu (401 yetkisiz), dosya tipi kontrolu (sadece jpg/png/webp, 400),
   boyut kontrolu (max 5MB, 400), basarili yuklemede `put()` ile Blob'a
   yazip donen public URL'i JSON olarak donuyor.
4. **VariantEditor entegrasyonu**: `src/components/admin/variant-image-cell.tsx`
   (yeni client bileseni) - kucuk bir "yukle" kutusu/thumbnail, yukleme
   sirasinda spinner, hata mesaji, "Degistir"/kaldirma. `variant-editor.tsx`
   "Gorsel URL" text input'unu bu bilesenle degistirdi (serbest URL alani
   plana gore zorunlu tutulmadigi icin kaldirildi, sadece dosya yukleme
   var).
5. **Yerel test**: `npx tsc --noEmit` ve `npm run build` hatasiz (yeni route
   `/api/admin/upload` build ciktisinda gorunuyor). `npm run dev` ile
   canli oturuma karsi `curl` uzerinden:
   - Gecerli bir PNG basariyla yuklendi, donen URL dogrudan taraycidan
     (auth'suz) **200** donup goruntuyu servis etti - gercekten public
     oldugu dogrulandi.
   - Yanlis dosya tipi (`.txt`) **400** + doğru hata mesajiyla reddedildi.
   - Oturumsuz istek **401** ile reddedildi.
   - Test icin yuklenen gecici gorsel, testin sonunda Blob'dan silindi
     (`del()`).

**Sonuc**: Faz C tamamlandi. Magaza sahibi artik varyant gorselini
bilgisayarindan dogrudan surukleyip/secip yukleyebiliyor, gorsel Vercel
Blob'da kaliciyor ve herkese acik URL ile hem admin panelde hem magazada
kullanilabiliyor. **Onemli**: bu ozelligin canlida calismasi icin ayni
`BLOB_READ_WRITE_TOKEN` degerinin Vercel projesinin **production** ortam
degiskenlerinde de tanimli olmasi gerekiyor - store projeye baglandiginda
Vercel bunu genelde otomatik ekliyor, ama deploy sonrasi ayrica dogrulanmali
(Settings -> Environment Variables -> Production sekmesi).

## Varyant Ozellikleri V2 - Faz D (bu oturum)

Faz D ("VariantEditor yeniden tasarim") uygulandi - planin en buyuk UI
degisikligi. Beden/Renk artik serbest metin degil, Faz B'deki ozellik
havuzundan kutucukla secilip otomatik kombinasyon uretiliyor.

1. **`variant-editor.tsx` bastan yazildi**:
   - `VariantRow`/`SerializedVariant` artik `size`/`color` yerine
     `optionValueIds: string[]` ve `barcode` tasiyor.
   - Yeni `AttributeOption` tipi ve `attributes` prop'u - her ozellik icin
     bir kutucuk grubu (chip toggle), Renk gibi hex renkli degerlerde
     yanlarinda renk yuvarlagi.
   - "Varyantları Oluştur" butonu -> `generateVariantCombinations()` (yeni,
     disari export edilen saf fonksiyon): secili degerlerin kartezyen
     kombinasyonunu uretir (2 beden x 2 renk = 4 satir), zaten var olan
     kombinasyonlari (ayni `optionValueIds` seti, sirasiz) tekrar eklemez,
     mevcut satirlarin stok/fiyat/barkod/SKU/gorseli degismeden kalir.
   - Tablo sutunlari artik dinamik: tanimli her ozellik icin bir salt-okunur
     sutun (secim yukaridan yapiliyor), ardindan SKU, **Barkod** (yeni),
     Stok, Fiyat, Indirim Fiyati, Gorsel, Sil. Ozellik sayisi/isimleri
     magaza sahibinin Faz B'de tanimladigina gore otomatik degisiyor (orn.
     ileride "Kalip" eklenirse kod degismeden yeni sutun cikar).
2. **`urunler/yeni/page.tsx` ve `urunler/[id]/page.tsx`**: `VariantEditor`'a
   artik tanimli `VariantAttribute`+degerleri prop olarak geciliyor.
   Yazma tarafi sadelesti - Faz A/B'de kullanilan `resolveOptionValueIds`
   (serbest metinden ozellik degeri bul/olustur) artik gerekmiyor, cunku
   secilen degerlerin ID'leri UI'dan doğrudan geliyor; `options: { create:
   optionValueIds.map(valueId => ({ valueId })) }` ile direkt baglaniyor.
   Kopya kombinasyon kontrolu artik `size::color` yerine siralanmis
   `optionValueIds` anahtariyla yapiliyor.
   - **Dar tablo sorunu (kapsamin 1. maddesi)**: plandaki iki secenekten
     basit olani uygulandi - bu iki sayfanin icerik genisligi `max-w-2xl`
     (672px) yerine `max-w-5xl` (1024px) yapildi. Paylasilan `DataTable`
     bileseni (urun/siparis listelerinde de kullanildigi icin) degistirilmedi,
     tasma durumunda hala kendi `overflow-x-auto`'su devrede.
3. **Yerel test**: `npx tsc --noEmit` ve `npm run build` hatasiz.
   - `generateVariantCombinations` DB'siz, saf fonksiyon olarak test edildi
     (gecici betikle): 2x2 secimden 4 doğru kombinasyon uretti, ayni secimle
     tekrar cagirinca yeni satir eklemedi, var olan bir satirin elle
     girilmis stok/fiyati korundu, `serializeVariantRows` ciktisinda
     `optionValueIds`/`barcode` dogru gorunuyor.
   - Sunucu action'larinin yaptigi Prisma islemleri (urun+varyant olustur
     with barkod+optionValueIds, sonra sil+yeniden olustur - update
     action'in deseni) gercek DB'ye karsi gecici bir test urunuyle
     dogrulandi, sonra silindi.
   - Gercek admin oturumuyla mevcut urunun (`bollmark-oversize-mont`)
     duzenleme sayfasi cekildi: kutucuklu ozellik secici, "Varyantları
     Oluştur" butonu, "Barkod" sutunu ve 4 varyantin doğru Beden/Renk
     etiketleriyle goruntulendigi HTML'de dogrulandi.

**Sonuc**: Faz D tamamlandi. Magaza sahibi artik urun duzenlerken Beden/Renk
degerlerini kutucukla secip "Varyantları Oluştur" ile toplu satir
uretebiliyor, her varyanta barkod girebiliyor, tablo daha genis bir alanda
goruntuleniyor. Degisiklikler commit'lendi (`7f13782`).

## Varyant Ozellikleri V2 - Faz E (bu oturum)

Faz E ("Siparis/sepet akisi kontrolu") uygulandi - kod degisikligi yok,
sadece dogrulama. Amac: `effectivePrice` mantiginin ve `/api/orders`
route'unun, `size`/`color` kaldirilip `ProductVariantOption`'a gecilmesinden
sonra da dogru calismaya devam ettigini kanitlamak.

`src/app/(site)/api/orders/route.ts` incelendi: fiyat hesaplama zaten hicbir
zaman `size`/`color`'a bakmiyordu - sadece `variantId` ile DB'den varyanti
bulup `effectivePrice(product, variant)` (varyantin `priceCents`'i varsa o,
yoksa urunun genel fiyati) kullaniyor. Bu alanlar Faz A'da hic degismedi,
yani riskin dusuk oldugu onceden biliniyordu - yine de plan acikca regresyon
testi istedigi icin gercek bir uctan uca senaryo calistirildi:

1. Gecici bir test urunu (100 TL genel fiyat) + 2 varyant olusturuldu:
   biri kendine ozel fiyatla (80 TL, Beden:M + Renk:Bej), digeri fiyat
   alani bos (urunun 100 TL genel fiyatina dusmesi beklenen).
2. `npm run dev` calisirken gercek `POST /api/orders` istegi atildi (2x
   80 TL varyant + 1x genel fiyat varyanti): **201**, `subtotalCents=26000`
   (dogru), kargo esigi altinda oldugu icin `shippingCents=4900`,
   `totalCents=30900` - hepsi beklenenle birebir eslesti.
3. **Guvenlik regresyonu**: istekte satira sahte bir `priceCents: 1` alani
   eklenip sunucunun bunu yoksayip yoksaymadigi test edildi - siparis
   yine dogru **8000** (varyantin gercek fiyati) uzerinden olusturuldu,
   istemciden gelen fiyat hicbir sekilde kullanilmadi.
4. Test siparisleri ve test urunu (varyantlariyla birlikte,
   `onDelete: Cascade`) temizlendi, gecici test betigi silindi.

**Sonuc**: Faz E tamamlandi, regresyon yok.

## Varyant Ozellikleri V2 - Faz F (bu oturum)

Faz F ("Test") uygulandi - planda ayrica listelenen, tum parcalari **tek
bir akista birlikte** dogrulayan son kabul testi (kullanici bu fazin
atlandigini fark edip sordu, once ayri ayri fazlarin kendi testleriyle
yetinilmisti). Gercek Neon DB'ye ve calisan `npm run dev` sunucusuna karsi,
gecici bir betikle uctan uca senaryo:

1. Varyant Ozellikleri sayfasinin yaptigi gibi **yeni bir ucuncu ozellik**
   ("Kalip Faz F" -> "Slim" degeri) DB'ye eklendi - mimarinin "yeni bir
   ozellik eklenince sema/kod degismeden calisir" iddiasi kanitlandi.
2. VariantEditor'un yaptigi gibi **2 Beden x 1 Renk x 1 Kalip = 2
   kombinasyon** `generateVariantCombinations` ile uretildi.
3. Bir varyanta **barkod** ve bir onceki oturumda gercekten Vercel Blob'a
   yuklenmis **gercek bir gorsel URL'i** atandi; digerine toplu **%20
   indirim** (150 -> 120 TL) ve **hepsine +10 stok** (5 -> 15) uygulandi
   (`applyPercentDiscount`/`applyStockDelta`).
4. Bu veriler `createProduct` server action'inin yaptigi Prisma
   islemleriyle gercek bir urune yazildi; DB'den geri okunup barkod,
   gorsel URL'i, fiyat ve stogun **hepsinin dogru kaydedildigi**
   dogrulandi.
5. Barkodlu/gorselli varyanttan (100 TL) **gercek bir siparis** verildi
   (`POST /api/orders`, adet=3): `subtotalCents=30000`,
   `totalCents=34900` (kargo dahil) - beklenenle birebir eslesti.
6. Tum test verisi (siparis, urun+varyantlari, gecici "Kalip Faz F"
   ozelligi ve degeri, yuklenen test gorseli Blob'dan) temizlendi; gecici
   test betikleri silindi, commit'e dahil edilmedi.

**Sonuc**: Faz F tamamlandi. Varyant Ozellikleri V2 planinin **tum
fazlari (A-F)** bu oturumda tamamlandi: sema + veri tasima, Varyant
Ozellikleri admin ekrani, Vercel Blob ile gorsel yukleme, VariantEditor'un
kutucuklu/otomatik kombinasyonlu yeniden tasarimi, siparis akisinin
dogrulanmasi ve hepsinin birlikte calistigi uctan uca kabul testi.
Degisiklikler asama asama commit'lenip GitHub'a push edildi
(`ff2fd6b..0984b58`) - Vercel git baglantisi sayesinde otomatik deploy
tetiklenmeli. **Deploy sonrasi dogrulanmasi gereken tek nokta**:
`BLOB_READ_WRITE_TOKEN` degerinin Vercel projesinin **production** ortam
degiskenlerinde de tanimli oldugu (Settings -> Environment Variables ->
Production sekmesi) - bu oturumda sadece yerel `.env` dogrulandi, canli
ortamda gorsel yukleme ayrica test edilmedi.

## Gorsel Yonetimi Yenileme - Faz 1 (bu oturum)

`GORSEL_YONETIMI_PLANI.md`'nin Faz 1'i ("Sema") uygulandi: renk bazli
gorsel galerisinin altyapisi kuruldu, eski varyant-bazli tekil `imageUrl`
kaldirildi.

1. **`prisma/schema.prisma`**:
   - `VariantAttribute.isColor Boolean @default(false)` eklendi - hangi
     ozelligin "renk ekseni" oldugunu artik koda gomulu `"Renk"` string
     eslesmesi yerine acikca isaretliyor.
   - Yeni `ProductOptionImage` modeli eklendi (`productId`, `valueId`,
     `url`, `position`) - bir urunun bir rengine ait birden fazla fotograf
     tutabiliyor. `Product.optionImages` ve `VariantAttributeValue.optionImages`
     iliski alanlari eklendi.
   - `ProductVariant.imageUrl` alani **kaldirildi**.
2. **Veri tasima (gercek Neon DB'ye karsi)**: Once mevcut veri incelendi -
   hicbir varyantta `imageUrl` dolu degildi (0 satir), tasinacak veri
   yoktu. Gecici bir betikle (`scripts/tmp-migrate-images.ts`, is bitince
   silindi) "Renk" adli mevcut attribute `isColor: true` yapildi (1 satir
   guncellendi) ve genel amacli tasima mantigi (renkli varyant ->
   `ProductOptionImage`, renksiz varyant -> `Product.images` fallback,
   dedupe ile) yazilip calistirildi - dogrulama: 0 varyant tasindi (beklenen,
   cunku kaynak veri zaten bostu).
3. **Kolon silme (geri donusumsuz)**: `npx prisma db push` once additive
   degisiklikleri (isColor + ProductOptionImage) sorunsuz uyguladi. `imageUrl`
   kolonunu dusuren ikinci `db push --accept-data-loss` calistirmasinda
   Prisma'nin AI-ajan guvenlik kilidi devreye girdi
   (`PRISMA_USER_CONSENT_FOR_DANGEROUS_AI_ACTION` gerektiriyor) - kullaniciya
   durum (islem, risk, veri kaybi olmadigi bilgisi) acikca anlatilip
   `AskUserQuestion` ile onay alindi, onay sonrasi komut calistirildi.
   Kolon basariyla dusuruldu.
4. **Kod guncellemesi (build'i yesilde tutmak icin ayni fazda yapildi)**:
   `imageUrl` referanslari `variant-editor.tsx` (`VariantRow`/`SerializedVariant`
   tiplerinden ve tablodan "Gorsel" sutunu), `urunler/yeni/page.tsx` ve
   `urunler/[id]/page.tsx` (`parseVariantsJson`, `createProduct`/`updateProduct`,
   `variantRows` okuma) icinden kaldirildi. Artik kullanilmayan
   `variant-image-cell.tsx` silindi (Faz 2/4'te yerini ortak `ImageField`/
   `MultiImageField` + renk galerisi alacak). `AttributeOption` tipine
   `isColor: boolean` eklendi (Faz 4'te kullanilacak).
5. **Test**: `npx tsc --noEmit` ve `npm run build` hatasiz gecti.

**Sonuc**: Faz 1 tamamlandi, veri kaybi olmadi. Varyant tablosunda artik
gorsel sutunu yok (gecici olarak - Faz 4'te renk bazli galeri UI'i
gelecek), urun genel gorselleri (eski `<textarea>`) ve DB semasi sonraki
fazlar icin hazir.

## Gorsel Yonetimi Yenileme - Faz 2 (bu oturum)

Faz 2 ("Ortak gorsel bilesenleri") uygulandi.

1. **`src/components/admin/image-field.tsx` (yeni)**: Tek bir gorsel icin
   hem URL yapistirma hem PC'den yukleme sunan ortak bilesen - kucuk
   onizleme + "Kaldir" + URL metin girisi (blur/Enter'da `onChange`
   tetikler, dis degisiklikler `useEffect` ile senkronize edilir) + dosya
   yukleme butonu. Faz 1'de silinen `variant-image-cell.tsx`'in isini
   gorup ustune URL girisini geri getiriyor.
2. **`src/components/admin/multi-image-field.tsx` (yeni)**: Birden cok
   gorselden olusan bir listeyi (`{ url: string }[]`) yonetiyor - her
   satirda `ImageField`, yukari/asagi siralama, silme, "Gorsel Ekle"
   butonu.
3. **Test**: DB'siz, saf UI bileseni oldugu icin `npx tsc --noEmit` ve
   `npm run build` ile derleme/build dogrulandi (henuz hicbir sayfada
   kullanilmiyor, Faz 3/4'te baglanacak).

**Sonuc**: Faz 2 tamamlandi.

## Gorsel Yonetimi Yenileme - Faz 3 (bu oturum)

Faz 3 ("Urun genel gorselleri") uygulandi.

1. **`src/components/admin/product-images-field.tsx` (yeni)**: `MultiImageField`'i
   sarmalayan client bileseni - state'i `\n` ile birlestirip `images` adinda
   gizli bir input'a yaziyor, boylece server tarafi (`createProduct`/
   `updateProduct` icindeki `.split("\n")` mantigi) **hic degismedi**.
2. **`urunler/yeni/page.tsx`** ve **`urunler/[id]/page.tsx`**: "Gorseller"
   kartindaki eski `<textarea name="images">` yerine `ProductImagesField`
   kullanildi (yeni sayfada bos liste, duzenleme sayfasinda mevcut
   `product.images` sirali sekilde `initialImages` olarak geciliyor).
3. **Uctan uca test (gercek Neon DB'ye karsi)**: `npm run dev` calisirken
   NextAuth credentials login'i `curl` ile yapilip oturum cookie'si alindi,
   `/admin/urunler/yeni` sayfasinin gercek HTML'inden React Server Action
   `$ACTION_ID_*` degeri okundu, ayni multipart form POST'u curl ile
   tekrarlanip **2 URL** iceren `images` alaniyla gecici bir test urunu
   olusturuldu (`faz3-test-urun`). DB'den geri okunup **iki `ProductImage`
   satirinin da dogru URL ve sirayla (`position: 0,1`)** kaydedildigi
   dogrulandi. Test urunu ve gecici betikler sonrasinda silindi.
4. `npx tsc --noEmit` ve `npm run build` hatasiz.

**Sonuc**: Faz 3 tamamlandi. Magaza sahibi artik urun genel gorsellerini
hem URL yapistirarak hem bilgisayarindan yukleyerek ekleyebiliyor,
siralayabiliyor, silebiliyor.

## Gorsel Yonetimi Yenileme - Faz 4 (bu oturum)

Faz 4 ("Renk bazli varyant galerisi") uygulandi.

1. **`variant-editor.tsx`**: `colorImages: Record<valueId, {url}[]>` state'i
   eklendi (`initialColorImages` prop'undan besleniyor). Secili satirlarin
   (`rows`) `optionValueIds`'inden, `isColor:true` olan attribute'un
   degerleri arasindan **su an tabloda kullanilan** benzersiz renk
   `valueId`'leri turetiliyor (`activeColorValueIds`). "Varyant Oluştur"
   kutusunun altina, DataTable'dan sonra yeni bir "Renk Görselleri" karti
   eklendi: her aktif renk icin baslik (renk noktasi + isim) + Faz 2'nin
   `MultiImageField`'i. Hic `isColor` attribute yoksa "Görsel eklemek icin
   once bir Renk özelligi tanımlayın" notu, attribute var ama henuz secili
   renk yoksa "yukaridan secip varyant olusturun" notu gosteriliyor. Yeni
   gizli input `colorImagesJson`, sadece **aktif** renkleri (gorunen
   MultiImageField'lardaki veriyi) `{valueId, urls}[]` olarak gonderiyor.
2. **`urunler/yeni/page.tsx` ve `urunler/[id]/page.tsx`**:
   - Yeni `parseColorImagesJson` yardimcisi (bos/URL olmayan girisleri
     filtreliyor).
   - `createProduct`: transaction icinde varyantlar olusturulduktan sonra
     her `{valueId, urls}` icin `tx.productOptionImage.createMany` ile
     sirali kayit acılıyor.
   - `updateProduct`: varyant `deleteMany`'den sonra
     `tx.productOptionImage.deleteMany({ where: { productId } })` + ayni
     `createMany` deseni (tam yeniden yazma - product genel gorselleri ile
     ayni desen).
   - `[id]/page.tsx` sorgusuna `optionImages: { orderBy: { position: "asc" } }`
     eklendi, `valueId`'ye gore gruplanip `initialColorImages` olarak
     `VariantEditor`'a geciliyor.
3. **Uctan uca test (gercek Neon DB'ye karsi, gercek admin oturumuyla)**:
   `npm run dev` + curl ile NextAuth login, React Server Action
   `$ACTION_ID_*`/bound `$ACTION_REF_*`+`$ACTION_N:0/1` alanlari gercek
   sayfa HTML'inden okunup ayni sekilde tekrarlandi (Faz A'daki gibi):
   - **Olusturma**: mevcut "Beden" (S/M) x "Renk" (Siyah/Bej) degerleriyle
     **4 varyantli** bir test urunu (`faz4-test-urun`) olusturuldu, Siyah'a
     **2**, Bej'e **1** gorsel atandi. DB'den geri okunup 4 varyantin
     dogru `optionValueIds`'e sahip oldugu ve `ProductOptionImage`'in
     **dogru `valueId` + sirayla** (Siyah: pos 0,1; Bej: pos 0) kaydedildigi
     dogrulandi.
   - **Guncelleme**: ayni urunun duzenleme sayfasi cekilip render edilen
     HTML'de "Renk Görselleri" basligi ve 3 gorsel URL'inin gectigi
     dogrulandi (initialColorImages dogru besleniyor); ardindan bound
     `updateProduct` action'i curl ile tetiklenip Siyah'a **3.
     gorsel eklendi, Bej'in tum gorselleri kaldirildi** - DB'den geri
     okunup Siyah'ta tam 3 satir (dogru sira), Bej'de 0 satir kaldigi
     (eski satirlarin `deleteMany` ile gercekten silindigi) dogrulandi.
   - Test urunu ve gecici betikler temizlendi.
4. `npx tsc --noEmit` ve `npm run build` hatasiz.

**Sonuc**: Faz 4 tamamlandi. Magaza sahibi artik her renk icin bedenden
bagimsiz, birden fazla fotograftan olusan bir galeri tanimlayabiliyor;
renk yoksa bu bolum otomatik gizleniyor.

## Gorsel Yonetimi Yenileme - Faz 5 (bu oturum)

Faz 5 ("Vitrin senkronizasyonu") uygulandi.

1. **`src/lib/catalog.ts`**: `getProductBySlug` sorgusuna
   `optionImages: { include: { value: true }, orderBy: { position: "asc" } }`
   eklendi.
2. **`src/lib/variant-attributes.ts`**: Yeni `colorValueId(variant)`
   yardimcisi - bir varyantin renk ekseni (`isColor:true`) icin secili
   degerinin id'sini donduruyor, `ProductOptionImage` galerisiyle
   eslestirmek icin.
3. **`src/components/product-viewer.tsx` (yeni, eski `add-to-cart.tsx`'in
   yerini aliyor)**: Renk secimi ile galeriyi ortak state altinda
   birlestiren client bileseni. Renk/beden butonlari + sepete ekle
   `add-to-cart.tsx`'ten tasindi, ustune kategori etiketi, baslik,
   fiyat/indirim-oncesi-fiyat ve aciklama da eklendi (eskiden sayfada
   sabitti). Secili rengin `colorGalleries[valueId]`'i varsa galeri onu
   gosteriyor, yoksa `fallbackImages`'a (urunun genel gorselleri, o da
   yoksa sabit bir Unsplash gorseline) duşuyor.
4. **`src/app/(site)/urunler/[slug]/page.tsx`**: Sadelesti - `ProductViewer`'i
   cagirip `optionImages`'i `valueId`'ye gore gruplayip `colorGalleries`
   olarak, her varyanti `colorValueId` ile birlikte geciyor. Eski
   `add-to-cart.tsx` silindi (hicbir yerde referansi kalmadi).
5. **Uctan uca test (gercek Neon DB'ye karsi, gercek `npm run dev`
   sunucusuna curl ile)**:
   - Magazanin `?preview=...` sifre duvari oldugu kesfedilip
     (`PREVIEW_COOKIE_NAME=bm_preview`) once cookie alindi.
   - 2 renkli (Siyah/Bej), her birine 1 gorsel atanmis **PUBLISHED**
     bir test urunu (`faz5-test-urun`) olusturuldu, sayfa curl ile cekildi:
     ilk render'da **varsayilan/ilk renk olan Siyah'in gorseli** dogru
     `<img>` (next/image) etiketinde goruldu, Renk/Beden buton gruplari
     dogru secili durumla (Siyah secili, Bej degil) render edildi, **her
     iki rengin de** galeri verisi (client'a Bej'e gecince kullanilacak
     sekilde) sayfa payload'inda mevcuttu.
   - **Fallback dogrulamasi**: renk galerisi hic tanimlanmamis mevcut
     seed urunu (`bollmark-oversize-mont`) cekilip, galerinin dogru
     sekilde urunun genel gorseline (`ProductImage`) duştugu dogrulandi.
   - **Not**: renk butonuna tiklandiginda React state degisiminin gercek
     tarayicida galeriyi degistirdigi, bu ortamda headless tarayici
     olmadigi icin piksel-duzeyinde dogrulanamadi (onceki fazlardaki
     `recharts` notuyla ayni kisitlama) - kullaniciya tarayicidan elle
     kontrol onerilir.
   - Test urunu ve gecici betikler temizlendi.
6. `npx tsc --noEmit` ve `npm run build` hatasiz.

**Sonuc**: Faz 5 tamamlandi.

## Gorsel Yonetimi Yenileme - Faz 6 (bu oturum)

Faz 6 ("Test/temizlik") uygulandi - `GORSEL_YONETIMI_PLANI.md`'nin Faz 1'den
Faz F benzeri son kabul testine kadar **tum fazlari (1-6)** bu oturumda
tamamlandi. Gercek Neon DB'ye ve calisan `npm run dev` sunucusuna karsi,
onceki fazlarin hepsini **tek akista** birlikte dogrulayan bir kabul testi:

1. 2 renk (Siyah: 2 gorsel, Bej: 1 gorsel) x 2 beden'den **3 varyantli**
   bir urun (`faz6-kabul-testi`) admin panel server action'i (curl ile
   gercek form submit) uzerinden olusturuldu - biri ozel fiyatli (400 TL),
   genel urun gorseli de (fallback icin) eklendi, indirim-oncesi fiyat
   (349,90 TL) tanimlandi.
2. Vitrin sayfasi (`/urunler/faz6-kabul-testi`, onizleme sifresi cookie'siyle)
   cekildi: fiyat/indirim-oncesi-fiyat dogru (₺300/₺350 - TL bazinda
   yuvarlanmis gosterim), varsayilan rengin (Siyah) gorseli ilk `<img>`'de
   dogru, her iki rengin galeri verisi de sayfa payload'inda mevcuttu.
3. Ozel fiyatli (M-Siyah, 400 TL) varyanttan **gercek bir siparis**
   verildi (`POST /api/orders`, adet=2): `subtotalCents=79980`,
   `shippingCents=4900`, `totalCents=84880` - hepsi beklenenle birebir
   eslesti (varyant fiyatlandirma + siparis akisinin sema degisikliklerinden
   etkilenmedigi dogrulandi).
4. **Renk ozelligi hic kullanilmayan urun** senaryosu ayrica test edildi
   (`faz6b-renksiz-urun`, sadece Beden secilmis 2 varyant): vitrinde "Renk"
   secici hic gorunmedi (sadece "Beden"), galeri dogru sekilde genel urun
   gorseline duştu; admin duzenleme sayfasinda "Renk Görselleri" karti
   "Görsel eklemek için yukarıdan en az bir renk seçip varyant oluşturun"
   notuyla goruntulendi (bolum tamamen gizlenmiyor, kullaniciyi
   yonlendiriyor - Faz 1'deki "Renk" attribute'u DB'de zaten `isColor:true`
   oldugu icin bu, planin "hicbir Renk ozelligi tanimli degilse" (attribute
   bile yokken) senaryosundan farkli, daha sik karsilasilacak bir durum;
   attribute'un kendisi hic yoksa "önce bir Renk özelligi tanımlayın" notu
   gösteriliyor - kod yolu `variant-editor.tsx` icinde ayrica mevcut).
5. Tum test verileri (2 test urunu, siparis) ve gecici test betikleri
   temizlendi.
6. `npx tsc --noEmit` ve `npm run build` hatasiz.

**Sonuc**: `GORSEL_YONETIMI_PLANI.md`'nin **tum fazlari (1-6)** bu
oturumda tamamlandi:
- Sema: `VariantAttribute.isColor`, `ProductOptionImage` modeli,
  `ProductVariant.imageUrl`'in kaldirilmasi (veri kaybi olmadan, kullanici
  onayiyla).
- Ortak `ImageField`/`MultiImageField` bilesenleri.
- Urun genel gorselleri artik URL + PC'den yukleme destekliyor.
- Varyant tablosundaki tekil gorsel sutunu kalkti, yerine renk bazli,
  cok-gorselli "Renk Görselleri" galerisi geldi.
- Vitrinde renk secimi ile galeri senkronize (fallback dahil).
- Tum akis (olusturma, guncelleme, silme, siparis, renksiz urun kenar
  durumu) gercek DB'ye karsi dogrulandi.

Degisiklikler faz faz, ayri commit'lerle **yerel olarak** commit'lendi
(push edilmedi - kullanicinin son onayi bekleniyor). **Bilinen kapsam
disi konu** (plan Bolum 4'te de belirtilmisti, Faz C'deki
`variant-image-cell.tsx` icin de gecerliydi): bir gorsel kaldirilip/
degistirildiginde eski Vercel Blob dosyasi silinmiyor - bu, kullanicinin
mevcut Blob deposunda zamanla kullanilmayan dosya birikmesine yol acabilir,
ayri bir iyilestirme olarak ele alinmali.

## Vercel Blob temizligi - kullanilmayan gorsellerin silinmesi (2026-08-31)

Görsel Yönetimi Yenileme'nin (Faz 1-6) "kapsam dışı" olarak not düşülen
maddesi ele alındı: bir görsel kaldırılıp/değiştirildiğinde eski Vercel
Blob dosyası artık siliniyor, depoda kullanılmayan dosya birikmesi
önlendi.

1. **`src/lib/blob.ts` (yeni)**: `deleteBlobUrls(urls)` yardımcısı -
   verilen url listesinden sadece `*.public.blob.vercel-storage.com`
   host'unda barınanları (yani kullanıcının elle yapıştırdığı harici
   url'leri değil, gerçekten bu sitenin PC'den yüklediği dosyaları)
   filtreleyip `@vercel/blob`'un `del()` fonksiyonuyla siliyor. Silme
   hatası (ağ sorunu, dosya zaten silinmiş olma vb.) yutuluyor - bu
   temizlik hiçbir zaman asıl ürün kaydetme/silme işlemini
   engellememeli.
2. **`urunler/[id]/page.tsx` - `updateProduct`**: Transaction'dan önce
   ürünün mevcut `images` + `optionImages` url'leri okunuyor
   (`oldUrls`). Transaction başarıyla bitince yeni gönderilen url
   kümesiyle (`imageUrls` + tüm renk galerilerindeki url'ler)
   karşılaştırılıp artık hiçbir yerde kullanılmayanlar
   `deleteBlobUrls` ile siliniyor.
3. **`urunler/[id]/page.tsx` - `deleteProduct`**: Ürün silinmeden önce
   tüm `images` + `optionImages` url'leri okunuyor, DB'den silme
   başarılı olunca aynı `deleteBlobUrls` ile bu görsellerin hepsi
   Blob'dan da temizleniyor.
4. **Not**: bu, "kaydet"/"sil" anındaki temizliktir. Kullanıcı bir
   görseli PC'den yükleyip (yeni bir blob oluşturup) sonra formu hiç
   kaydetmeden sayfadan ayrılırsa, o tek seferlik yetim blob bu akışla
   temizlenmiyor - bu, ayrıca ele alınabilecek küçük bir kenar durumu
   olarak not düşülüyor.
5. **Test (yerel PC, 2026-08-31)**: `npm install` (eksik `@vercel/blob`
   ve güncel Prisma client'ı kurdu) sonrasında `npx tsc --noEmit` ve
   `npm run build` temiz geçti. Ayrıca gerçek Neon DB'ye ve gerçek
   Vercel Blob deposuna karşı uçtan uca bir test yapıldı: geçici bir
   script ile Blob'a test dosyası yüklendi, `images` alanında bu url'i
   taşıyan geçici bir ürün DB'de oluşturuldu, `updateProduct` akışı
   simüle edilerek görsel kaldırılıp `deleteBlobUrls` çağrıldı,
   ardından `list()` ile dosyanın Blob deposundan gerçekten silindiği
   doğrulandı (`SONUC: BASARILI`). Test ürünü ve script sonrasında
   temizlendi.

**Sonuc**: Test edildi, `main`'e push edildi - Vercel git bağlantısı
otomatik deploy'u tetikleyecek.

## Varyant Oluştur: aranabilir çoklu seçim bileşeni (2026-08-31, yeni oturum)

`variant-editor.tsx` içindeki "Varyant Oluştur" kutusunda her özellik
(Beden, Renk vb.) için değerler artık düz buton listesi yerine aranabilir,
çoklu seçimli bir combobox ile seçiliyor - onlarca değeri olan bir
özellikte (ör. 15 beden) doğru değeri bulmak zorlaşıyordu.

1. **Yeni bileşen**: `src/components/admin/searchable-multi-select.tsx`
   (tamamen client-side, sıfır npm bağımlılığı, projenin diğer sıfırdan
   yazılmış bileşenleriyle - `MultiImageField`, `Button` - aynı Tailwind/
   `admin-*` renk token stilinde):
   - Input + altında açılır liste: input'a focus olunca (yazı yazmadan)
     tüm değerler gösteriliyor; yazdıkça `toLocaleLowerCase("tr-TR")` ile
     Türkçe karakter duyarlı (ör. "sarı" -> "Sarı" eşleşir), anlık
     filtreleniyor.
   - Bir satıra tıklamak `onToggle` çağırıp değeri seçili/seçili-değil
     yapıyor, dropdown KAPANMIYOR (art arda çoklu seçim). Seçili satırlar
     `Check` ikonu + accent renkle işaretleniyor.
   - Renk özelliği (`isColor`) için mevcut `ColorDot` davranışı hem
     dropdown satırlarında hem seçili etiketlerde korundu.
   - Seçili değerler input'un içinde kaldırılabilir "chip" (× ikonlu)
     olarak gösteriliyor.
   - Klavye: yukarı/aşağı ok gezinme, Enter toggle, Escape kapatma;
     dropdown dışına tıklayınca (`mousedown` + `containerRef.contains`
     kontrolü) kapanıyor. Dropdown satırlarında `onMouseDown`'da
     `preventDefault` yapılıyor - yoksa tıklama input blur'undan önce
     kayboluyordu.
   - Değer sayısı azken (ör. 3 renk) de aynı bileşen kullanılıyor, ayrı
     bir "az/çok" dalı yok.
2. **`variant-editor.tsx`**: her attribute için `attr.values.map(...)` ile
   düz buton render eden blok kaldırılıp yerine tek bir
   `<SearchableMultiSelect options={attr.values} selectedIds={selected[attr.id] ?? new Set()} onToggle={...} />`
   satırı kondu. `selected`/`toggleValue`/`generateVariantCombinations`
   mantığı ve "Varyantları Oluştur" akışı hiç değişmedi - sadece seçim
   arayüzü değişti.
3. **Test**: `npx tsc --noEmit` ve `npm run build` hatasız geçti. Türkçe
   karakter duyarlı filtreleme mantığı (`normalize`) ayrı bir Node
   script'iyle ("Sarı"/"sarı", "Kırmızı"/"kırmızı", "İstanbul Mavisi"/
   "istanbul" eşleşmeleri) doğrulandı. Bileşenin mantığı (state, toggle,
   klavye/click-outside davranışı) kod okuması ile satır satır kontrol
   edildi.
   - **Kısıtlama**: bu makinede zaten çalışan bir `npm run dev` süreci
     (port 3000) vardı; NextAuth credentials ile `curl` üzerinden giriş
     denendi ama komut, parola değerini komut satırında taşıdığı için
     Claude Code'un otomatik güvenlik sınıflandırıcısı tarafından
     engellendi (parolayı ortam değişkeninden dahi curl komutuna
     gömmek reddedildi). Bu yüzden ürün düzenleme sayfasındaki yeni
     combobox'ın gerçek tarayıcıda fare/klavye ile uçtan uca tıklanması
     bu oturumda **yapılamadı** - kullanıcının `npm run dev` ile
     `/admin/urunler/[id]` sayfasını açıp Varyant Oluştur kutusunda
     birkaç değeri arayıp seçmesi, tarayıcı testi olarak önerilir.
4. Değişiklikler commit'lenip `main`'e push edildi - Vercel git bağlantısı
   sayesinde otomatik deploy tetiklenecek.

## Excel'den toplu ürün aktarımı + Koton görsel eşleştirme (2026-09-02/03, yeni oturum)

Plan `EXCEL_URUN_AKTARIM_PLANI.md` dosyasında çıkarıldı (dükkanın checklist
excel'inden admin panelden toplu ürün/varyant aktarımı + Koton.com'dan renk
bazlı otomatik görsel/açıklama bulma). Faz A'dan F'ye kadar tek oturumda,
aradan onay beklenmeden uygulandı (kullanıcı tercihi); sadece Faz F'nin
**gerçek veritabanına ilk yazma** anında durulup soruldu, onay alındı.

1. **`xlsx` (SheetJS) paketi eklendi** - hem `.xls` hem `.xlsx` okuyor.
   `npm audit` 5 yüksek önem dereceli uyarı veriyor (SheetJS'in npm registry
   paketindeki bilinen prototype-pollution/ReDoS sorunları) - bilinçli kabul
   edildi, aynı `.xls` desteğine sahip bakımlı bir alternatif yok.
2. **`lib/excel-import.ts`**: excel satırlarını tip güvenli okuyan parser
   (`parseExcelFile` - eksik/bozuk satır olursa satır no'suyla hata biriktirir,
   tüm dosyayı reddetmez; tekrarlayan barkod da satır hatası sayılır), ÜRÜN
   KODU'na göre gruplama (`groupExcelRows`), ve asıl upsert mantığı
   (`importProductGroups` - barkod bazlı: mevcut barkod varsa sadece
   stok/fiyat güncellenir, yoksa yeni Product+ProductVariant oluşturulur;
   Renk/Beden `resolveOptionValueIds` ile çözülür).
   - **Bulunan performans sorunu**: ilk gerçek DB denemesinde satır başına
     birkaç sorgu (Renk/Beden upsert x2, vs.) içeren tek bir
     `prisma.$transaction` içinde 49 satır işlenirken Neon'un pooled
     bağlantı gecikmesiyle **P2028 transaction timeout** (30sn'de bile
     yetmedi) alındı. **Düzeltme**: Renk/Beden değer id'leri + marka id'si +
     slug'lar transaction AÇILMADAN ÖNCE (düz `prisma` ile) çözülüp bir
     cache'e alındı; transaction içinde sadece asıl product/variant
     create/update sorguları kaldı. Yeniden denemede sorunsuz çalıştı.
3. **`lib/koton-images.ts`**: barkod ile `koton.com/autocomplete/` araması
   yapıp bulunan ürün sayfasını `?format=json` ile çekiyor, `base_code`
   excel'deki ÜRÜN KODU ile karşılaştırıp doğru ürünü bulduğundan emin
   oluyor, `variants` içindeki "Renk" grubundan **excel'de gerçekten olan**
   renklerin `productimage_set` görsellerini indirip `@vercel/blob`'a
   (`koton-import/` klasörü) yeniden yüklüyor, `urun_aciklama` alanını
   Product.description olarak kaydediyor. Sadece **bu importla YENİ
   oluşturulan** ürünler için çalışır (mevcut ürünün foto/açıklaması varsa
   dokunulmaz). Ürünler arası ~900ms bekleme ile hız sınırlı, sıralı
   çalışıyor; bir üründe hata/bulunamama diğerlerini durdurmuyor.
   - Sadece o ürün grubunun **ilk satırındaki barkod** deneniyor, bulunamazsa
     gruptaki diğer barkodlar denenmiyor (bilinçli v1 sınırı, plan da
     böyleydi - ürün koduyla değil barkodla aramanın Koton'da daha güvenilir
     olduğu belirtilmişti). İyileştirme fırsatı olarak not düşülüyor.
4. **API route'ları**: `/api/admin/urunler/excel-yukle` (POST, sadece
   parse+önizleme, DB'ye dokunmaz) ve `/api/admin/urunler/excel-aktar`
   (POST, asıl upsert + ardından yeni ürünler için sıralı Koton
   zenginleştirmesi) - `getServerSession` + `role === "ADMIN"` kontrolüyle.
5. **`/admin/urunler/excel-yukle` sayfası**: dosya yükle -> önizleme
   (ürün/varyant/stok özeti, kategori seçimi - tüm gruba tek seferde
   uygulanıyor, opsiyonel) -> "İçe Aktar" -> sonuç raporu (kaç ürün/varyant
   eklendi-güncellendi, hangi üründe Koton'da görsel bulunup bulunmadığı).
   Ürünler listesine "Excel'den Yükle" butonu eklendi.
6. **Faz F - gerçek Neon veritabanında uçtan uca test** (kullanıcı onayıyla):
   - İlk çalıştırma: örnek `KOTON11052026CHECKLIST.xls` (49 satır, 6 ürün
     kodu) -> 6 ürün + 49 varyant oluşturuldu; 6 üründen 4'ü Koton'da
     bulunup görsel+açıklama otomatik eklendi (toplam 37 görsel), 2'si
     bulunamayıp görselsiz DRAFT kaldı (beklenen yedek davranış).
   - Aynı dosya tekrar yüklendi (idempotency testi): 0 yeni kayıt, sadece
     6 üründe/49 varyantta stok/fiyat güncellendi, mevcut Koton açıklaması/
     görselleri **dokunulmadan** kaldı - plandaki "tekrar yüklenirse
     stok/fiyat güncellenir, foto/açıklama zaten varsa dokunulmaz" kuralı
     doğrulandı.
   - Commit'lendi, push edildi (`923f95c`) - Vercel otomatik deploy
     tetikledi.

### Ardından bulunan 2 hata (kullanıcı canlıda denedi, bu oturumda düzeltildi)

**Hata 1 - Türkçe karakterli ürünlere tıklayınca "sayfa yok" hatası**:
Bu projedeki Next.js sürümü, dinamik rota segmentlerini (`/urunler/[slug]`)
**otomatik decode etmiyor** - standart Next.js'in aksine. Tarayıcı
`düğmeli` gibi bir kelimeyi `%C3%BC%C4%9F...` şeklinde kodluyor, sunucu
bunu çözmeden `params.slug` olarak veritabanında arıyor, bulamayıp
`notFound()`'a düşüyordu. Sadece Türkçe karakter içeren slug'larda
görünüyordu (`bollmark-oversize-mont` gibi düz İngilizce slug'lı eski
üründe sorun yoktu - ilk testte gerçek Next dev sunucusunu (kullanıcının
zaten çalışan `npm run dev` süreci, port 3000) `curl`/`fetch` ile,
önizleme şifresi cookie'siyle (`PREVIEW_PASSWORD`) test edip
`console.log` ile `params.slug`'ın ham (`%XX` kodlu) geldiği doğrulandı.
**Düzeltme**: `src/app/(site)/urunler/[slug]/page.tsx`'te hem
`generateMetadata` hem `ProductPage` içinde `decodeURIComponent(rawSlug)`
uygulandı (try/catch ile, bozuk bir dizi gelirse ham değere düşer).
Commit + push (`6849777`).

**Hata 2 - Katalog/anasayfa/favoriler/ilgili-ürünlerde varsayılan foto**:
Sadece renk bazlı galerisi (`ProductOptionImage` - Koton'dan gelen) olan,
genel `Product.images`'ı boş olan ürünler; katalog (`/urunler`), anasayfa
öne çıkanlar, favorilerim ve ürün detayındaki "Benzer Ürünler" bölümlerinde
hep sabit unsplash placeholder fotoğrafı gösteriyordu (bu bölümler sadece
`Product.images`'a bakıyordu). **Düzeltme**: `lib/catalog.ts`'e ortak
`firstImageUrl()` yardımcı fonksiyonu eklendi (genel görsel yoksa renk
galerisinden ilk fotoğrafa düşer), `getPublishedProducts`/`getRelatedProducts`
sorgularına `optionImages` include edildi, 5 dosyadaki (`urunler/page.tsx`,
`(site)/page.tsx`, `urunler/[slug]/page.tsx`, `hesap/favorilerim/page.tsx`,
admin `urunler/page.tsx` liste thumbnail'i) ilgili yerler bu fonksiyona
geçirildi. Gerçek sitede (`/urunler`, `/`) `curl`/`fetch` ile Koton görsel
URL'lerinin artık HTML'de geçtiği doğrulandı. Commit + push (`b1464d0`).

**Not**: Her iki hata da az önce eklenen Excel/Koton özelliğinden kaynaklı
DEĞİL - siteye Türkçe karakterli slug'lı veya sadece renk-galerili (genel
görseli boş) ilk ürünler bu importla eklendiği için daha önce hiç tetiklenmemiş,
gizli kalmış genel site hatalarıydı. Yeni ürün eklenen her yerde tekrar
karşılaşılabilir.

## Varyant özellikleri (Beden/Renk) sıralama düzeltmesi (2026-09-07, yeni oturum)

Admin panelinde varyant özellikleri sayfasındaki (`ayarlar/varyant-ozellikleri`)
yukarı/aşağı ok düğmeleri bazı değerlerde hiçbir şey yapmıyor gibi görünüyordu,
ayrıca ürün sayfasındaki beden butonları küçükten büyüğe değil rastgele/ekleniş
sırasına göre geliyordu. Kök neden ve düzeltme üç parçalıydı:

1. **Admin ok düğmeleri neden çalışmıyordu**: `src/lib/variant-attributes.ts`
   içindeki `resolveOptionValueIds` - ürün oluşturma/düzenlemede serbest metin
   (ör. Beden kutusu) alanından yeni bir değer geldiğinde bunu
   `VariantAttributeValue.upsert()` ile veritabanına yazıyordu, ama `create`
   bloğunda `position` hiç set edilmiyordu (varsayılan `0`'da kalıyordu).
   Aynı `attributeId` altında birden çok değer `position: 0` ile girince,
   admin sayfasındaki yer değiştirme (swap) mantığı görsel olarak "hiçbir şey
   olmuyor" gibi görünüyordu. **Düzeltme**: admin sayfasındaki `createValue`
   server action'ıyla aynı desen uygulandı - yeni değer oluşturulmadan önce o
   `attributeId` için mevcut en yüksek `position` bulunup `+1` ile atanıyor.
2. **Ön yüzde bedenler neden sıralı gelmiyordu**: `src/components/product-viewer.tsx`
   içindeki `sizes`/`colors` listeleri `variants.map(v => v.size)` ile ham
   (variant ekleniş) sırasıyla oluşturuluyordu, `VariantAttributeValue.position`
   hiç kullanılmıyordu (sorgu zaten position'ı çekiyordu, sadece kullanılmıyordu).
   **Düzeltme**: `src/lib/variant-attributes.ts`'e `optionPosition()` yardımcı
   fonksiyonu eklendi, `urunler/[slug]/page.tsx` bunu `ProductViewer`'a
   `sizePosition`/`colorPosition` olarak geçiriyor, `product-viewer.tsx`'teki
   yeni `orderedOptionValues()` fonksiyonu benzersiz değerleri bu position'a
   göre (küçükten büyüğe) sıralıyor - hem Beden hem Renk için aynı mantık.
3. **Bozuk mevcut veri**: Veritabanında halihazırda birçok
   `VariantAttributeValue` satırı `position: 0` ile duruyordu. Yeni bir
   script yazıldı: `scripts/backfill-variant-value-positions.ts` - her
   `attributeId` için değerleri doğal sıraya koyuyor (sayısal bedenler
   küçükten büyüğe, harfli bedenler XXS→5XL bilinen bir sıra tablosuna göre
   - "3XL" gibi rakam+XL yazımları da XXXL ile eşleniyor -, geri kalanlar
   alfabetik/sona ekleniyor) ve her değere `1`'den başlayan sıralı yeni bir
   `position` atıyor. Script `npx tsx scripts/backfill-variant-value-positions.ts`
   ile canlı Neon veritabanına karşı çalıştırıldı: **2 özellik (Beden, Renk)
   tarandı, 31 değer güncellendi**. (Script `dotenv/config` import ediyor -
   `.env`'deki `DATABASE_URL`'i okuyabilmesi için gerekli, `prisma/seed.ts`'teki
   aynı desenle.)

**Test edildi**: `npm run build` hatasız tamamlandı (TypeScript temiz,
`.next` klasörü bu oturumda bozuk/yarım bir `routes.d.ts` içerdiği için önce
silinip yeniden build edildi). Backfill sonrası DB'den okunan `position`
değerleri doğrulandı (Beden: 34:1…48:8, XS:9…3XL:15 doğru sırada). Gerçek bir
ürünün (`Regular Fit Klasik Yaka Pamuklu Kısa Kollu Gömlek`) varyant verisiyle
test edilip `position` değerlerinin S<M<L<XL<XXL<3XL sırasına karşılık geldiği
doğrulandı - `product-viewer.tsx` artık beden butonlarını bu sırayla gösterecek.

## "Yeni Sipariş" rozeti (2026-09-08, yeni oturum)

Admin panelinde henüz görüntülenmemiş siparişleri ayırt etmek için yeşil
"YENİ SİPARİŞ" rozeti eklendi.

1. `Order` modeline `viewedAt DateTime?` (nullable) alanı eklendi
   (`prisma/schema.prisma`). **Önemli bulgu**: bu projede Prisma Migrate hiç
   kullanılmamış - `prisma/migrations` klasörü hiç yok, `package.json`'da
   sadece `db:push` scripti var. `npx prisma migrate dev` bu yüzden "drift
   detected" diyip **veritabanının tamamen sıfırlanmasını (`migrate reset`,
   tüm veri kaybı)** istedi - bu çalıştırılmadı, bunun yerine her zamanki
   `npx prisma db push` ile aynı (ek, nullable) kolon veri kaybı olmadan
   canlı Neon veritabanına uygulandı. Ardından `npx prisma generate` ile
   client yeniden üretildi (üretilmeden önce `viewedAt` alanı Prisma
   Client'ta tanınmıyordu, script hata verdi).
2. Sipariş detay sayfası (`siparisler/[id]/page.tsx`) açıldığında `viewedAt`
   null ise sayfa render edilmeden önce `new Date()` ile işaretleniyor
   (sadece null ise, tekrar tekrar yazmıyor).
3. Sipariş listesi sorgusu ve `OrderRow` tipi (`orders-table.tsx`)
   `viewedAt` alanını taşıyor; "Sipariş No" kolonunun yanında
   `viewedAt === null` olan satırlar için mevcut `Badge` (`tone="green"`)
   ile "YENİ SİPARİŞ" rozeti gösteriliyor. Aynı rozet dashboard'daki
   "Son Siparişler" kartında da (`admin/page.tsx`) gösteriliyor.
4. Tek seferlik `scripts/test-siparis-olustur.ts` yazılıp çalıştırıldı -
   `viewedAt: null` olan, gerçekçi verilerle (Ayşe Yılmaz, adres, telefon,
   1 sipariş kalemi, `PENDING_PAYMENT`) bir test siparişi (`BLM260908-1362`)
   canlı Neon veritabanına eklendi - rozetin görülebilmesi için kasıtlı
   olarak silinmedi.

**Test edildi**: `npm run build` hatasız tamamlandı (TypeScript temiz, 61
route başarıyla oluşturuldu, `/` ve `/urunler` hâlâ statik).

## Kodsuz otomatik kampanya + Değer alanı (%/TL) netleştirmesi (2026-09-09, geçmiş oturumda kodu yazılmış, bu oturumda loglandı)

Bu bölüm, `KAMPANYA_OTOMATIK_PLANI.md` planına göre önceki oturumda (commit
`ae1fb1a` + `f27efe6`) zaten kodlanmış ama bu dosyaya hiç işlenmemiş işi
belgeler.

1. **Veri modeli** (`prisma/schema.prisma`): `Coupon.code` zorunlu
   `String @unique`'ten nullable `String? @unique`'e çevrildi (Postgres
   nullable unique alanda birden fazla `NULL`'a izin verir, çakışma
   olmaz), `name String?` alanı eklendi. Kod girilen kampanyalarda `name`
   opsiyonel kalıyor; kodsuz (otomatik) kampanyalarda listede ve site
   tarafında gösterilecek görünen ad olarak zorunlu. Amaç: admin'in kod
   girmeden, sadece kategori/marka bazlı, sepete/ürüne otomatik uygulanan
   bir kampanya oluşturabilmesi (örn. "Ayakkabılarda %20 İndirim" - müşteri
   hiçbir şey yazmıyor).
2. **İndirim motoru** (`src/lib/coupons.ts`):
   - Ortak `checkCouponEligibility` (aktiflik/tarih/kullanım limiti/min.
     sepet tutarı) ve `computeCouponDiscount` (kategori/marka kısıtına
     uyan satırlar üzerinden indirim hesabı) yardımcıları çıkarılıp hem
     `validateCoupon` (tek kod) hem yeni `resolveBestDiscount` (tüm
     otomatik kampanyalar) tarafından paylaşılıyor - kod tekrarı önlendi.
   - `resolveBestDiscount(tx, enteredCode, lines)`: `code: null` olan tüm
     uygun otomatik kampanyaları çekip **satır bazlı** değerlendiriyor -
     her sepet satırına (ürüne) en yüksek indirimi veren TEK otomatik
     kampanya atanıyor (`bestPerLine` map'i), böylece aynı ürüne iki
     otomatik kampanya üst üste binmiyor. Satır bazlı sonuçlar toplanıp
     rozet/isim için en çok toplam indirim sağlayan kampanya seçiliyor.
     Girilen kod varsa `validateCoupon` ile onun toplamı hesaplanıp
     otomatik toplamla karşılaştırılıyor - **hangisi daha yüksekse o
     kazanıyor, eşitlikte kod kazanıyor** (müşteri bilerek kod girmiş).
     İkisi asla karışık uygulanmıyor, tek sonuç dönüyor
     (`{ couponId, discountCents, freeShipping, appliedName, codeMessage }`).
   - `getApplicableAutomaticDiscountForProduct` / `matchAutomaticDiscount`:
     ürün kartları için ayrı sorgu atmadan, aktif kodsuz `PERCENT`
     kampanyaları tek seferde çekip (`getActiveAutomaticPercentCampaigns`)
     bellekte ürünün kategori/marka'sıyla eşleştiriyor (yalnızca `PERCENT`
     - `FIXED`/`FREE_SHIPPING` ürün bazında rozet için uygun değil).
3. **Admin formu**:
   - `src/components/admin/coupon-identity-field.tsx` (yeni): "Kampanya
     Türü" için "Kupon Kodlu" / "Otomatik (kod gerekmez)" segmented
     control - Otomatik seçilince kod input'u `disabled` olup yerine
     `name` zorunlu hale geliyor, kategori/marka ikisi de boşsa "tüm
     sitede geçerli olur" uyarısı gösteriliyor.
   - `src/components/admin/coupon-value-field.tsx` (yeni): Tip
     (`PERCENT`/`FIXED`/`FREE_SHIPPING`) `<select>`'i `useState` ile
     izleniyor, Değer input'unun sağında canlı `%`/`₺` badge'i
     gösteriliyor; `FREE_SHIPPING` seçiliyken input `disabled` +
     `opacity-50`, placeholder `—`. Statik "(% veya TL)" etiketi
     kaldırılıp sade "Değer" yapıldı. `kampanyalar/page.tsx`'teki "Yeni
     Kupon" formu server component olduğu için bu iki alan ayrı client
     bileşenlere çıkarıldı; input `name` attribute'ları (`code`/`name`/
     `type`/`value`) değişmediği için server action'ın `FormData` okuması
     etkilenmedi. `coupon-row.tsx` (düzenleme formu) aynı mantığı zaten
     `"use client"` olduğu için doğrudan içeriyor.
4. **Entegrasyon noktaları**:
   - `src/app/(site)/api/kuponlar/dogrula/route.ts`: artık boş kod da
     kabul ediyor (`code: z.string()`, boş string geçerli) ve her zaman
     `resolveBestDiscount` çağırıyor - kod girilmese bile sepete uyan
     otomatik kampanya varsa sonuçta görünüyor.
   - `src/components/coupon-field.tsx`: `applyCode` yerine
     `checkDiscount(code, isExplicitApply)` - sepet her değiştiğinde
     (kod girilmemiş olsa bile) boş kodla sorgu atılıp otomatik kampanya
     yakalanıyor; kullanıcı ayrıca kod girip "Uygula" derse iki sonuç
     karşılaştırılıp otomatik kampanya kazanırsa "Zaten `<ad>` indirimi
     uygulanıyor, bu kod daha düşük bir indirim sağlıyor" mesajı
     gösteriliyor.
   - `src/app/(site)/api/orders/route.ts`: `validateCoupon` yerine
     `resolveBestDiscount(tx, data.couponCode ?? null, resolvedLines)`
     kullanılıyor (kod girilmiş olsun olmasın) - kazanan kampanyanın
     `usedCount`'u aynı `$transaction` içinde artırılıyor (yarış
     durumunda son kullanım hakkının iki müşteri tarafından eş zamanlı
     tüketilip limitin aşılmasını önlemek için, kupon sistemindeki
     mevcut pattern'le aynı).
   - `src/lib/audit-actions.ts`: `KAMPANYA_OTOMATIK_OLUSTURULDU` action'ı
     eklendi ("Otomatik Kampanya Oluşturuldu" etiketiyle), işlem geçmişi
     sayfası mevcut pattern sayesinde otomatik yakalıyor.
   - `src/components/product-card.tsx`, `src/app/(site)/page.tsx`,
     `src/app/(site)/urunler/page.tsx`, `src/app/(site)/urunler/[slug]/page.tsx`,
     `src/components/product-viewer.tsx`: ana sayfa/ürünler listesi/ürün
     detayındaki `ProductCard`'lara (ve ürün detay görüntüleyicisine)
     `getApplicableAutomaticDiscountForProduct`/`matchAutomaticDiscount`
     ile hesaplanan otomatik indirim yüzdesi bağlandı - ürün kategori/
     marka kısıtına giren aktif bir otomatik `PERCENT` kampanyası varsa
     rozet + indirimli fiyat gösteriliyor.

**Test edildi**: `npm run build` bu oturumda tekrar çalıştırılıp hatasız
tamamlandığı doğrulandı (TypeScript temiz).

## Admin paneli mobil görünüm düzeltmesi (2026-09-09, yeni oturum)

Kullanıcı admin panelinin telefonda ekrana oturmadığını (yatay taşma) ve
sidebar'ın ekranı kapladığını bildirdi. Kök neden analizi ve kapsam
`MOBIL_GORUNUM_PLANI.md` dosyasında çıkarıldı (bu commit ile repoya
eklendi): admin panelindeki hiçbir bileşen Tailwind responsive
breakpoint'i (`sm:`/`md:`/`lg:`) kullanmıyordu, panel tamamen tek bir
masaüstü genişliği varsayımıyla yazılmıştı. Plan 4 faza bölünüp sırayla
uygulandı, her faz ayrı commit'lendi:

1. **Faz 1 - İskelet (`7a7a711`)**: `layout.tsx` server component olduğu
   için mobil menü state'ini tutamıyordu; yeni bir client wrapper
   (`src/components/admin/admin-shell.tsx`) eklenip Sidebar + Topbar bunun
   içine alındı, `isMobileNavOpen` state'i burada tutulup ikisine prop
   olarak geçiriliyor. `sidebar.tsx` mobilde (`< md`, 768px altı) varsayılan
   ekran dışında (`fixed` + `-translate-x-full`), `md:` üzerinde eskisi gibi
   `static`/görünür; açıkken arkada `bg-black/40` backdrop var, tıklanınca
   veya route değişince (`usePathname`) otomatik kapanıyor. `topbar.tsx`'e
   sadece mobilde görünen (`md:hidden`) hamburger butonu eklendi; `main`
   içerik boşluğu `px-4 py-4 md:px-8 md:py-8` yapıldı.
2. **Faz 2 - Topbar (`c6a8501`)**: Arama kutusu mobilde `hidden md:block`,
   yerine tıklanınca tam genişlikte açılan bir arama overlay'i (aynı arama
   mantığı, farklı mobil görünüm) eklendi. Kullanıcı menüsü butonunun
   dokunma alanı min 40px'e çıkarıldı.
3. **Faz 3 - Tablolar (`1b4d35f`)**: `data-table.tsx`'teki `DataTableColumn`
   tipine `hideOnMobile?: boolean` eklendi, bu `true` olan kolonlar mobilde
   `hidden md:table-cell` ile gizleniyor ("Sütunlar" panelinden yine
   açılabiliyor). 8 tablo dosyasında (orders/products/customers/returns/
   shipments/reviews/audit-log/top-products) ikincil kolonlara (tarih,
   kargo durumu, e-posta, ürün kodu, takip kodu, puan, hedef, kâr marjı)
   bu bayrak verildi. Tablo wrapper'ına mobilde yatay kaydırılabilir
   olduğunu belli eden hafif bir kenar gölgesi eklendi.
4. **Faz 4 - Filtreler ve formlar (`4c4d494`)**: Siparişler filtre
   panelindeki sabit `w-72` açılır panel `w-[calc(100vw-2rem)] max-w-72
   md:w-72` ile ekran genişliğine sığacak hale getirildi (plandaki diğer 7
   filtre dosyası incelendiğinde kod tabanının daha önceki bir oturumda
   sadeleştirildiği, artık bu `absolute`/`w-72` panel kalıbını taşımadıkları
   görüldü - `FilterBar` zaten `flex-wrap` kullandığı için ek değişikliğe
   gerek kalmadı). `grid-cols-2`/`grid-cols-3` kullanan tüm form alanları
   (ürün yeni/düzenle, ayarlar, personel, kampanyalar, kupon ve bundle
   formları, excel import önizlemesi - 12 dosya) `grid-cols-1
   md:`/`sm:grid-cols-N` olacak şekilde mobilde tek kolona düşürüldü.
   `variant-editor.tsx`/`product-images-field.tsx`/`tags-field.tsx`
   incelendi, zaten esnek/tablo tabanlı oldukları için değişiklik
   gerekmedi.
5. **Ek düzeltme (`726da67`)**: Gerçek tarayıcı testinde (bkz. aşağı)
   siparişler sayfasındaki durum sekmeleri satırının (Tümü/Ödenmedi/Açık/
   Kapatıldı) 375px'te sarmadığı için body seviyesinde yatay taşmaya yol
   açtığı bulundu; `orders-tabs.tsx`'e `overflow-x-auto` +
   `flex-shrink-0` eklenerek mobilde yatay kaydırılabilir hale getirildi.

**Test edildi**: Her fazdan sonra `npx tsc --noEmit` ile tip kontrolü
yapıldı, Faz 4 sonunda ayrıca tam bir `npm run build` çalıştırılıp
hatasız tamamlandığı doğrulandı. Ardından proje kök `package.json`'ına
dokunmadan geçici bir scratchpad dizininde Playwright kurulup, yerel dev
sunucusu gerçek admin oturumuyla (`.env`'deki `ADMIN_EMAIL`/
`ADMIN_PASSWORD`) headless Chrome ile sürüldü: Panel, Siparişler,
Ürünler, Ürün Ekle, Kampanyalar, Personel, Ayarlar sayfaları 375px ve
768px genişliklerde kontrol edildi - 375px'te hiçbir sayfada body
seviyesinde yatay scrollbar yok (`document.documentElement.scrollWidth
<= clientWidth`), hamburger menü backdrop'lu açılıp kapanıyor, mobil
arama overlay'i ve filtre paneli ekrana sığıyor; 768px'te hamburger
görünmüyor ve sidebar her zaman açık - masaüstü görünüm değişmedi. Bu
testte bulunan siparişler sekme taşması yukarıdaki 5. maddeyle
düzeltildi ve tekrar doğrulandı. Değişiklikler push edildi.

## Ürünler sayfası buton küçültme (2026-09-09, aynı oturum)

Ürünler sayfasındaki (`/admin/urunler`) "Excel'den Yükle" ve "Yeni Ürün"
(boş durumda "İlk Ürününü Ekle") butonları mobilde orantısız büyük
görünüyordu.

- `src/components/admin/button.tsx`'teki `ButtonSize` tipine yeni bir
  responsive seçenek eklendi: `"sm-md"` - mobilde `sm` boyutunda
  (`px-3 py-1.5 text-xs gap-1.5`), `md:` breakpoint'inde `md` boyutuna
  büyüyor (`md:px-4 md:py-2 md:text-sm md:gap-2`). Mevcut `sm`/`md`
  davranışı değişmedi; sadece bileşenin taban `className`'indeki sabit
  `gap-2` kaldırılıp `sm`/`md` class'larına taşındı (yeni `sm-md`
  seçeneğiyle çakışmaması için, görsel sonuç aynı kaldı).
- `src/app/(admin)/admin/urunler/page.tsx`'teki hem üst header'daki hem
  boş durumdaki iki `Button` çiftine `size="sm-md"` verildi, buton
  satırının container `gap-3`'ü `gap-2 md:gap-3` yapıldı. Başka hiçbir
  buton değiştirilmedi.
- `npx tsc --noEmit` ve `npm run build` hatasız tamamlandı. Playwright
  ile (geçici scratchpad kurulumu) 375px ve 800px genişliklerde
  `/admin/urunler` kontrol edildi: 375px'te body seviyesinde yatay
  taşma yok (`scrollWidth === clientWidth`), butonlar küçük ve orantılı;
  800px'te (`md:` breakpoint aktif) butonlar eski normal boyutuna
  dönüyor.
- Değişiklikler commit'lenip push edildi.

## Kategori tekrarını kaldırma + kategori listesinde aç/kapa (2026-09-09, aynı oturum)

İki bağımsız değişiklik yapıldı: Kadın/Erkek kategori ağacındaki isim
tekrarlarının kaldırılması (veri) ve admin kategori listesine
aç/kapa (collapse) desteği eklenmesi (UI).

1. **Kadın/Erkek kategori birleştirme** (`scripts/merge-kadin-erkek-kategoriler.ts`,
   commit `50e0547`): Kadın ve Erkek üst kategorileri altında aynı isimli
   9 alt kategori çifti (Tişört, Gömlek, Pantolon, Kot Pantolon,
   Sweatshirt, Hırka, Ceket, Mont & Kaban, Eşofman) tek kategoride
   birleştirildi (daha çok ürünü olan/eşitse önce oluşturulan kanonik
   kabul edildi; ürün/kod eşlemesi/kupon kayıtları taşındı, diğeri
   silindi). Eşi olmayan 20 alt kategori üst seviyeye taşındı, slug'ları
   sadeleştirildi. Boş kalan Kadın/Erkek üst kategorileri silindi.
   Aksesuar grubuna dokunulmadı. Cinsiyet ayrımı artık `Product.gender`
   alanıyla yapılıyor, kategori sadece ürün tipini temsil ediyor.
   Kategori sayısı 54 -> 43.
2. **Önceden var olan tekrarlı üst kategoriler** (`scripts/merge-tekrarli-ust-kategoriler.ts`,
   commit `7cd6453`): DB'de (bu seed'den önce, 0 ürünlü) zaten var olan
   tekil Tişört/Elbise/Gömlek/Bluz üst kategorileri, madde 1'den çıkan
   aynı isimli kategorilerle çakışıyordu. Genel bir "üst seviyede aynı
   isimli çiftleri birleştir" betiği yazılıp çalıştırıldı, kategori
   sayısı 43 -> 39. **Bulunan hata**: ilk çalıştırmada kanonik
   kategorinin yeni slug'ı hesaplanmadan önce kendi eski slug'ı ile
   birleşecek kategorinin slug'ı "kullanılan slug" kümesinden
   çıkarılmamıştı - bu yüzden "Tişört" ve "Gömlek" gereksiz "-2" son eki
   almıştı (`tisort-2`, `gomlek-2`). Elle düzeltildi (doğru `tisort`/
   `gomlek` slug'larına geri alındı), her iki betikte de sıralama
   düzeltilip tekrar çalıştırılarak idempotent olduğu doğrulandı.
3. **Kategori listesinde aç/kapa** (`category-manager.tsx`,
   `category-row.tsx`, commit `133d532`): Alt kategorisi olan satırların
   başına chevron ikonu eklendi, tıklanınca o kategorinin altındaki tüm
   satırlar client-side gizlenip gösteriliyor (sunucuya istek atmadan).
   Aç/kapa durumu `localStorage`'da kategori id'sine göre saklanıyor,
   sayfa yenilendiğinde geri yükleniyor. Arama kutusuna yazıldığında
   collapse durumu geçici olarak yok sayılıyor, eşleşen satırların
   ebeveyn zinciri her zaman görünür kalıyor. Sürükle-bırak sıralama
   sadece görünen (expand edilmiş) satırlar arasında çalışmaya devam
   ediyor.

**Test edildi**: `npx tsc --noEmit` temiz. Geçici scratchpad dizininde
Playwright kurulup gerçek admin oturumuyla (`.env`'deki `ADMIN_EMAIL`/
`ADMIN_PASSWORD`) `/admin/kategoriler` sayfası sürüldü: birleştirme
sonrası liste tekrarsız (39 satır, her isim tek), Aksesuar'ın chevron'ına
tıklanınca 8 alt kategorisi gizleniyor/gösteriliyor, sayfa yenilendiğinde
kapalı durum korunuyor, arama sırasında (kapalı Aksesuar altındaki
"Çanta" aranınca) ebeveyn zinciri collapse'a rağmen görünüyor. Üç commit
de push edildi.

## Storefront header'a mega-menu eklendi (2026-09-09, aynı oturum)

Storefront üst menüsü sadece 3 sabit link'ten (Tüm Ürünler, kırık "Dış
Giyim", Hikayemiz) Koton/LC Waikiki tarzı bir mega-menu'ye çevrildi.

1. **Cinsiyet filtresi** (`src/lib/catalog.ts`): `getCatalogEntries` ve
   `getPublishedProducts`'a opsiyonel `genderLabel` parametresi eklendi
   (Prisma `where`'e `gender` koşulu). `src/app/(site)/urunler/page.tsx`
   `cinsiyet` query param'ını okuyup buna geçiriyor, başlık/metadata
   kategori+cinsiyet kombinasyonuna göre uyarlanıyor.
2. **Mega-menu verisi** (`src/lib/site-nav.ts`, yeni dosya):
   `getMegaMenuData()` (react.cache) - Kadın/Erkek için en az bir
   PUBLISHED+o cinsiyette ürünü olan aktif kategorileri, Aksesuar için
   `parentId`'si Aksesuar olan aktif alt kategorileri paralel (`Promise.all`)
   çekiyor. `src/app/(site)/layout.tsx` bunu çağırıp `SiteHeader`'a prop
   geçiyor.
3. **`src/components/site-header.tsx` yeniden yazıldı**: masaüstünde
   Kadın/Erkek/Aksesuar sekmeleri hover/click ile açılan mega-menu paneli
   gösteriyor (aktif kategori/cinsiyet linkte vurgulu), mobilde hamburger
   ikonuyla açılan, akordeonlu, body-scroll-kilitli tam ekran off-canvas
   menüye geçildi. Kırık "Dış Giyim" linki tamamen kaldırıldı.
4. **Bulunan ve düzeltilen 2 gerçek hata** (özellik testi sırasında,
   kod öncesinden beri vardı):
   - Next.js 16'da `page.tsx`'in `searchParams` prop'u artık bir
     `Promise` - `urunler/page.tsx`'in sayfa bileşeni bunu (sadece
     `generateMetadata` değil) await etmiyordu, bu da **önceden var olan
     `kategori` filtresini de** sessizce çalışmaz hale getiriyordu.
     Await edilecek şekilde düzeltildi.
   - Header'daki `backdrop-blur` (`backdrop-filter`) CSS'te `position:
     fixed` elemanlar için containing block oluşturuyor - mobil
     off-canvas menü bu yüzden tam ekran değil header yüksekliğiyle
     kırpılıyordu. `createPortal` ile `document.body`'ye taşınarak
     düzeltildi.
5. **Kullanıcı bulgusu - mega-menu paneli çok dar, yazı taşıyor + sekme
   isimleri (Kadın/Erkek/Aksesuar) küçük harf kalıyor**: panel `absolute
   ... w-full`, `w-full`'ü küçük sekme `<div>`'ine göre hesaplıyordu
   (containing block hatası) - panel header'ın doğrudan altına, header
   genişliğinde konumlandırılacak şekilde yeniden yapılandırıldı (açık
   sekme state'i `SiteHeader`'a taşındı, `onMouseLeave` header'a bağlandı).
   `<button>` elemanları tarayıcı varsayılanında `text-transform`'u miras
   almadığı için `uppercase` class'ı doğrudan butonlara eklendi.
6. **Veri düzeltmesi**: DB'de gender alanı dolu (4 Kadın + 4 Erkek)
   PUBLISHED 8 ürünün `categoryId`'si `null`'dı, bu yüzden mega-menu
   Kadın/Erkek panelleri boş geliyordu (kod doğruydu, veri eksikti).
   Ürün adlarına bakılarak (script ile, kullanıcı onayıyla) kategoriler
   atandı: 4 Gömlek ürünü -> Gömlek, Kadın Yelek -> Yelek, Kadın El
   Çantası -> Çanta (Aksesuar altı), 2 Kadın Pantolon -> Pantolon.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasız. Zaten
çalışan bir `npm run dev` sunucusu (port 3000, önizleme şifresi
`.env`'deki `PREVIEW_PASSWORD` ile `?preview=` cookie'si alınarak)
kullanıldı, scratchpad'e kurulan Playwright ile 1280px ve 375px'te
gerçek Neon veritabanına karşı doğrulandı: Kadın (`cinsiyet=Kadın` ->
4 ürün) ve Erkek (7 katalog girişi) filtreleri doğru çalışıyor, Aksesuar
paneli 8 kategoriyi tam genişlikte gösteriyor ve tıklanan kategori
`?kategori=...&cinsiyet=...`'e gidip aktif linki vurguluyor, eski "Dış
Giyim"/`outerwear` linki hiçbir yerde yok, mobilde hamburger + akordeon +
body-scroll-kilidi + kapatma çalışıyor, yatay taşma yok
(`scrollWidth <= clientWidth`), konsol/sayfa hatası yok. Commit
(`79e1d0c`) GitHub'a push edildi - Vercel git bağlantısı sayesinde
otomatik deploy tetiklendi.

**Kullanıcı geri bildirimi 1** (aynı oturum): mega-menu paneli çok dar,
yazı taşıyor + sekme isimleri küçük harf kalıyor. Yukarıdaki 5. maddede
anlatılan düzeltmelerle giderildi, önceki commit'e `amend` edildi
(`79e1d0c`).

**Kullanıcı geri bildirimi 2** (aynı oturum): Kadın/Erkek/Aksesuar üst
sekmeleri tıklanınca hiçbir yere gitmiyordu (sadece hover ile panel
açılıyordu). `site-header.tsx`'te sekmeler `<button>`'dan `Link`'e
çevrildi - hover hâlâ paneli açıyor, tıklama Kadın/Erkek için
`/urunler?cinsiyet=...`'e, Aksesuar için `/urunler?kategori=aksesuar`'a
yönlendiriyor. Bu sırada yeni bir hata bulundu: Aksesuar'ın kendisine
hiç ürün bağlı değil (hepsi Çanta/Ayakkabı gibi alt kategorilerde),
bu yüzden `/urunler?kategori=aksesuar` her zaman 0 sonuç dönüyordu -
tıpkı eski "Dış Giyim" linki gibi ölü bir link olacaktı. `catalog.ts`'teki
kategori filtresi genelleştirildi: artık slug'ı birebir eşleşen kategori
VEYA o kategoriyi `parent` olarak gösteren bir alt kategori eşleşiyor
(`OR: [{ slug }, { parent: { slug } }]`) - bu, gelecekte eklenecek başka
üst/alt kategori çiftleri için de genel olarak doğru davranış. Playwright
ile doğrulandı: Kadın/Erkek tıklaması doğru sayfaya gidip doğru ürün
sayısını gösteriyor, Aksesuar tıklaması artık 1 ürün (Çanta'ya atanan
ürün) gösteriyor, hover davranışı bozulmadı. `npx tsc --noEmit` ve
`npm run build` hatasız. Commit (`869a5d0`) GitHub'a push edildi.

**Kullanıcı geri bildirimi 3** (aynı oturum): mobil menüde Kadın/Erkek/
Aksesuar başlıklarına tıklanınca da bir yere gitmiyordu (sadece
akordeonu açıp kapatıyordu, üst sekmelerdeki gibi bir link değildi).
`MobileAccordionSection` yeniden düzenlendi: başlık metni artık ayrı bir
`Link` (tıklayınca Kadın/Erkek için `/urunler?cinsiyet=...`'e, Aksesuar
için `/urunler?kategori=aksesuar`'a gidiyor, bir önceki maddedeki
üst/alt kategori genellemesi sayesinde Aksesuar burada da 0 sonuç
dönmüyor), ok ikonu ise ayrı bir `<button>` olarak sadece alt kategori
listesini aç/kapa yapıyor. Playwright ile 375px'te doğrulandı: başlığa
tıklama doğru URL'e gidiyor, ok ikonuna tıklama akordeonu açıp alt
kategori linkleri (`?kategori=...&cinsiyet=...`) doğru çalışıyor, görsel
düzen bozulmadı (ekran görüntüsüyle kontrol edildi). `npx tsc --noEmit`
ve `npm run build` hatasız. Commit (`399f77f`) GitHub'a push edildi.

## Excel aktarimi - Koton gorsel arama takilmasi + urun bazinda "yeniden ara" (2026-09-09, ayni oturum)

Plan `EXCEL_KOTON_GORSEL_ARAMA_TAKILIYOR_PLANI.md` dosyasinda cikarildi ve
uygulandi. Kullanici, `KOTON11052026CHECKLIST.xls` (68 urun) ile Excel
aktariminin Faz 2'sinde (Koton gorsel arama) "3. Sonuc" ekranina hic
ulasmadigini, aktarimdan sonra takili kaldigini bildirdi.

1. **Kok neden**: `src/lib/koton-images.ts`'teki uc dis `fetch` cagrisinda
   (`fetchAutocompleteUrl`, `fetchKotonProductData`, `reuploadImageToBlob`)
   hic zaman asimi yoktu - koton.com yanit vermezse (engelleme, sezon
   bitmis urun, ag sorunu) her istek Vercel'in `gorsel-getir` route'undaki
   30sn'lik `maxDuration`'a kadar askida kalabiliyordu; 68 urunle bu
   toplamda onlarca dakikaya cikip "donmus" gibi gorunuyordu.
2. **Zaman asimi eklendi**: `koton-images.ts`'e `fetchWithTimeout` yardimci
   fonksiyonu (8sn, `AbortController`) eklendi, uc `fetch` cagrisi da buna
   cevrildi. `excel-import-wizard.tsx`'teki `/gorsel-getir` cagrisina da
   ayrica 12sn'lik istemci tarafli zaman asimi eklendi.
3. **Teshis icin loglama eklendi**: autocomplete HTTP hatasi ve
   `base_code` uyusmazligi durumlarinda `console.error` (Vercel fonksiyon
   loglarina duser, bir sonraki denemede gercek nedeni - engelleme mi,
   sezon bitmis urun mu - netlestirmek icin).
4. **"Gorselleri atla ve bitir" butonu** eklendi (Faz 2 ilerleme
   cubugunun altinda, sadece `progress.phase === "gorseller"` iken
   gorunur) - admin isterse gorsel aramayi yarida kesip direkt sonuc
   ekranina gecebiliyor (kalan urunler `found:false` ile isaretleniyor).
5. **Sonuc ekranina link eklendi**: Koton'da bulunamayan urun varsa,
   daha once eklenmis `/admin/urunler?fotograf=yok` filtresine giden bir
   link gosteriliyor.
6. **Urun bazinda "Fotograflari yeniden ara" butonu** (yeni ozellik):
   yeni route `src/app/api/admin/urunler/[id]/gorsel-yenile/route.ts`
   (POST, admin oturum kontrollu) urunun DB'deki kod/barkod/renk
   verilerinden bir `KotonEnrichmentTarget` kurup mevcut `enrichOne`'i tek
   urun icin cagiriyor - yeni bir arama mantigi yazilmadi, Excel
   aktarimindaki mekanizma yeniden kullanildi.
   `src/components/admin/products-table.tsx`'in "actions" kolonuna,
   fotografi olmayan satirlarda "Duzenle" linkinin yanina bu butonu
   ekleyen `RefreshCw`/`Loader2` ikonlu, satir bazli yukleme durumu
   (`Set<string>`) tutan bir buton eklendi.
   - **Karar**: `enrichOne`'a opsiyonel `overwriteDescription` parametresi
     eklendi (varsayilan `true`, Excel aktarimindaki mevcut davranis
     korundu). Urun bazli "yeniden ara" butonu bunu `false` geciriyor -
     bu buton muhtemelen zaten gozden gecirilmis, elle duzenlenmis bir
     urune karsi calistirilacagi icin Koton'dan gelen aciklamanin uzerine
     otomatik yazilmamasi daha guvenli bir varsayilan olarak secildi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz (yeni
route derleme ciktisinda gorunuyor). `npm run lint` bu ortamda
(Windows, ESLint 9 flat-config) projeden bagimsiz, onceden var olan bir
hata veriyor (`Invalid project directory provided` / `next lint`
komutunda; dogrudan `npx eslint` de "Converting circular structure to
JSON" hatasi veriyor - React eklentisi flat-config'te dairesel referans
olusturuyor) - bu oturumdaki degisikliklerle ilgisi yok, calistirilamadi.
**Gercek Koton davranisi (engelleme/sezon bitmis/baska) bir sonraki
canli Excel denemesinde Vercel loglarina bakilarak dogrulanmali** -
bu oturumda gercek bir Excel dosyasiyla canliya karsi test yapilmadi,
sadece kod incelemesi + tip/derleme kontrolu yapildi.

## Koton gorsel eslesmesi - renk etiketi buyuk/kucuk harf uyumsuzlugu (2026-09-10, yeni oturum)

Kullanici, Koton'da stogu bitmis urunlerin fotograflarinin cekilemedigini
bildirdi ve bir hipotez onerdi: `fetchAutocompleteUrl`'un stokta olmayan
urunleri hic dondurmedigi, bunun yerine `koton.com/list/` arama sonuclari
uc noktasinin denenmesi gerektigi. Bu hipotez `curl` ile canli Koton
API'sine karsi dogrudan test edilerek **yanlislandi**:

- Gercekten stogu 0 olan, coktan beri OOS kalmis urunler (orn. Koton
  kodu `6WKB40009TW`, `5WKB40048TW`) autocomplete uc noktasinda sorunsuz
  bulundu, urun sayfasi JSON'unda tum renk secenekleri (OOS olanlar dahil)
  ve gorselleri eksiksiz geliyordu - **autocomplete stok durumuna gore
  filtrelemiyor**.
- `koton.com/list/?search_text=...&format=json` uc noktasi gercekten
  var ve JSON donduruyor (hipotezin bu kismi dogru), ama bazi gercek
  kodlarda (orn. `6SAK40004UK`) autocomplete'in buldugunu bulamadi -
  yani **`/list/` autocomplete'ten daha az guvenilir**, ondan sonraki bir
  fallback olarak eklemek gercek bir sorunu cozmezdi.
- Bu yuzden PR'da onerilen `/list/` fallback'i **uygulanmadi** - mevcut
  kanitlar boyle bir fallback'in gercek bir vakayi kurtaracagini
  gostermedi ve gereksiz karmasiklik/ek istek yuku eklerdi.

**Gercek kok neden, canli DB'deki fotografsiz 2 gercek urun uzerinden
bulundu** (`optionImages: none`'a gore sorgulandi):

1. **`6SAK30097AA` (Kadın Çizgili Ahşap Saplı Tote Çanta) - dogrulanan
   gercek hata**: Koton'da urun autocomplete ile sorunsuz bulunuyor,
   sayfa JSON'unda renk etiketi `"LACİVERT ÇİZGİLİ"` (tamamen buyuk
   harf) olarak geliyor. Ama bizim DB'de (Excel'den gelen) renk etiketi
   `"Lacivert Çizgili"` (Title Case) olarak kayitli. `findKotonProductData`
   -> `colorImageUrls` Map'i tam string eslesmesi bekliyordu, bu yuzden
   `enrichOne` sessizce `found: true, imagesAdded: 0` donduruyordu (kullanici
   acisindan "bulunamadi" ile ayni sonuc: fotograf eklenmiyor).
   - **Duzeltme** (`src/lib/koton-images.ts`): yeni `normalizeColorLabel()`
     yardimcisi eklendi - `label.trim().toLocaleUpperCase("tr-TR")` (Turkce
     "i"/"İ" karakterlerinin dogru buyutulmesi icin `tr-TR` locale'i
     kullaniliyor). Hem `fetchKotonProductData`'nin Map'e yazarken hem
     `enrichOne`'in Map'ten okurken kullandigi anahtar bu fonksiyondan
     geciriliyor. Ayrica `imagesAdded === 0` oldugunda (sayfa bulundu ama
     hicbir renk eslesmedi) beklenen/gelen renk listelerini karsilastiran
     bir `console.error` teshis logu eklendi.
   - **Canli DB'ye karsi gercek dogrulama yapildi**: `enrichOne` bu urun
     icin dogrudan calistirildi (gecici bir script ile, commit'lenmedi),
     duzeltmeden once `imagesAdded: 0` verirken duzeltmeden sonra
     **`imagesAdded: 3`** donup Vercel Blob'a gercekten 3 gorsel yuklendigi
     ve `ProductOptionImage` kayitlarinin olustugu dogrulandi. Bu urun artik
     canli DB'de fotografli.
2. **`6SAK40062PW` (Viskon Kumaş Bağlama Detaylı Cepli Pileli Geniş Paça
   Palazzo Pantolon, renk "BEJ") - baslangicta "cozulemedi" denildi,
   kullanicinin verdigi dogrudan link ile ikinci bir gercek hata daha
   bulunup duzeltildi**: Bu kod autocomplete'te, `/list/`'te ve Google'da
   hicbir sonuc vermiyor (urun Koton'un arama indeksinden tamamen
   dusmus), ANCAK kullanici urune koton.com uzerinde "stokta yok" olarak
   isaretli ama tiklaninca acilan bir sonuc karti uzerinden ulasip
   dogrudan URL'ini verdi (`https://www.koton.com/viskon-kumas-baglama-detayli-cepli-pileli-genis-paca-palazzo-pantolon-ekru-4096215/`).
   Bu URL'i `?format=json` ile dogrudan cekince **ikinci, bagimsiz bir kok
   neden** ortaya cikti: `data.product.base_code` beklenen kodla dogru
   eslesiyor (`in_stock: false, stock: 0`), AMA `data.variants` dizisi
   **tamamen bos** donuyor - Koton, bir urunun renk secici (Renk varyant
   grubu) olusturmasi icin en az 2 farkli renk secenegi olmasini bekliyor
   gibi gorunuyor; bu urunun tek rengi (Bej/Ekru) oldugu ve/veya tum
   stogu tukendigi icin `variants: []` donuyor. `fetchKotonProductData`
   gorselleri SADECE `data.variants` icindeki Renk grubundan okuyordu,
   bu yuzden `colorImageUrls` Map'i bos kaliyor, `enrichOne` yine sessizce
   `imagesAdded: 0` donduruyordu - oysa gercek gorseller `data.product.
   productimage_set`'te (renkten bagimsiz, urune dogrudan bagli) 7 adet
   olarak duruyordu.
   - **Duzeltme** (`src/lib/koton-images.ts`): `KotonProductData`'ya yeni
     bir `fallbackImageUrls: string[]` alani eklendi (`data.product.
     productimage_set`'ten dolduruluyor). `enrichOne` icinde, Koton'dan
     hic renk grubu gelmediginde (`colorImageUrls.size === 0`) VE hedef
     urunun DB'de de tek rengi oldugunda (`targetColors.length === 1`) -
     birden fazla renk beklenirken yanlislikla tek renge ait gorselleri
     hepsine uygulamamak icin bilincli olarak bu kosula baglandi - bu
     yedek kullanilip o tek renge tum gorseller ekleniyor.
   - **Canli DB'ye karsi gercek dogrulama yapildi**: `fetchKotonProductData`
     gecici olarak export edilip (test sonrasi geri alindi) yukaridaki
     gercek URL ile bu urun icin calistirildi: `colorImageUrls size: 0`,
     `fallbackImageUrls: 7` dogru tespit edildi, 6 gorsel (MAX_IMAGES_
     PER_COLOR siniri) gercekten Vercel Blob'a yuklenip `ProductOptionImage`
     kayitlari olusturuldu. Bu urun de artik canli DB'de fotografli.
   - **Bilinen sinir**: bu duzeltme sadece "sayfaya zaten ulasilabiliyor
     ama gorseller variants disinda" durumunu cozer. Koton'un arama
     indeksinden tamamen dusmus urunler (bu urun gibi) otomatik/toplu
     Excel akisinda hala **bulunamaz** - cunku onlara giden URL'i hicbir
     arama uc noktasi vermiyor, sadece kullanicinin elle bulup verdigi
     dogrudan linkle erisilebiliyor. Bunun icin asagidaki "Gorsel
     linkiyle ekle" butonu eklendi.

## "Görsel linkiyle ekle" butonu (2026-09-10, aynı oturum)

Yukarıdaki bilinen sınırı çözmek için: Koton'un arama indeksinden tamamen
düşmüş ürünlerde otomatik arama (ne "yeniden ara" ne de yeni eklenen
`/list/` benzeri hiçbir uç nokta) sonuç vermiyor, ama admin koton.com'da
ürünü elle bulup görselin URL'ini (sağ tık -> "Görsel adresini kopyala")
alabiliyor. Kullanıcı bunu bir Koton **sayfa** linki değil, doğrudan
**görsel** linki olarak eklemek istedi (sayfa parse etmeye gerek yok,
daha basit ve genel amaçlı: Koton dışı bir görsel kaynağı için de işe
yarar).

1. **`src/lib/koton-images.ts`**: daha önce modül içi (private) olan
   `reuploadImageToBlob` fonksiyonu `export` edildi ve ikinci bir opsiyonel
   `folder` parametresi eklendi (varsayılan `"koton-import"`, manuel
   akış `"manuel-gorsel"` kullanıyor) - Koton içe aktarımıyla aynı
   "kendi Blob'umuza indirip yeniden yükle" mantığı tekrar kullanıldı,
   kod tekrarı yok.
2. **Yeni route** `src/app/api/admin/urunler/[id]/gorsel-ekle/route.ts`
   (POST, admin oturum kontrollü, `gorsel-yenile` route'uyla aynı desen):
   body'de `urls: string[]` alıyor (max 10, tekilleştiriliyor, `http(s)://`
   ile başlamayan URL varsa 400 döner), her birini `reuploadImageToBlob`
   ile indirip yükler, başarılı olanları ürünün **genel** `images`
   (renkten bağımsız `ProductImage` tablosu - `ProductOptionImage` değil,
   çünkü admin panelindeki "Fotoğraf Yok" göstergesi zaten
   `images[0] ?? optionImages[0]` sırasıyla kontrol ediyor ve genel
   `images` her ürün için renk sayısından bağımsız çalışıyor) listesine,
   mevcut `position`'lardan sonrasına ekliyor. Hiçbiri indirilemezse
   `added: 0` ile hata toast'ı gösterilecek şekilde dönüyor.
3. **`src/components/admin/products-table.tsx`**: "Fotoğrafları yeniden
   ara" butonunun yanına (sadece fotoğrafı olmayan satırlarda görünür,
   aynı kural) yeni bir "Görsel linkiyle ekle" butonu eklendi. Tıklanınca
   `window.prompt` ile bir veya birden fazla (virgül/satır ile ayrılmış)
   URL isteniyor, yeni route'a POST ediliyor, sonucu Toast ile gösterip
   `router.refresh()` ile listeyi tazeliyor. Basit tutmak için ayrı bir
   modal bileşeni yazılmadı - projede zaten `window.confirm` kullanan
   `delete-product-form.tsx` ile aynı "hızlı ve düşük karmaşıklık" deseni
   izlendi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasız (yeni route
derleme çıktısında görünüyor). Uçtan uca, gerçek bir Koton görsel URL'i
ile (`reuploadImageToBlob` + `prisma.productImage.create`) canlı Neon
DB'sine karşı doğrulandı - indirme, Blob'a yeniden yükleme ve DB kaydı
oluşturma başarıyla çalıştı; test kaydı doğrulama sonrası temizlendi
(gerçek ürün verisine kalıcı bir değişiklik bırakılmadı). HTTP katmanı
(oturum kontrolü, `window.prompt` akışı) tarayıcıda elle test edilmedi -
kod aynı, zaten çalışan `gorsel-yenile` route'uyla birebir aynı oturum/
yetki deseninden kopyalandı.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz (ayrica
bu oturumda, pull ile gelen `Order.deletedAt` sema degisikligi sonrasi
`npx prisma generate` calistirilmadigi icin once alakasiz ~40 tip hatasi
goruldu - `prisma generate` calistirilinca duzeldi, koddaki degisiklikle
ilgisi yoktu). Her iki gercek urun de (`6SAK30097AA` ve `6SAK40062PW`)
canli Neon DB'sinde artik fotografli - gecici test scriptleriyle uctan
uca dogrulanip scriptler commit'lenmeden silindi. Degisiklik commit'lendi
(`d15bfdb` + bu ikinci duzeltme icin ek bir commit), henuz push
edilmedi (kullanici onayi bekleniyor).

## Kullanici geri bildirimi - "Görsel linkiyle ekle" yanlis tasarlanmis + urun duzenleme sayfasinda gorsel silme SaveBar'i tetiklemiyor (2026-09-10, ayni oturum)

Bir onceki bolumde eklenen "Görsel linkiyle ekle" butonu push edildikten
sonra kullanici iki sorun bildirdi:

1. **Buton yanlis anlasilmis tasarlanmisti**: kullanici aslinda bir Koton
   **urun sayfasi** linki verip gorsellerin otomatik cekilmesini
   istiyordu ("ben ürünün linkini verecektim o kendisi görselleri
   otomatik ekleyecekti"), ama buton dogrudan **gorsel** URL'i istiyordu
   (bir onceki oturumda kullanicinin kendi ifadesiyle "görsel linki"
   tasarlanmisti - geriye donuk bakildiginda bu talebin yanlis
   yorumlandigi ortaya cikti).
   - **Duzeltme**: `src/lib/koton-images.ts` yeniden duzenlendi - `enrichOne`
     icindeki (arama sonrasi) renk eslestirme + gorsel indirme/yukleme
     mantigi ortak bir `applyKotonProductData()` yardimcisina cikarildi.
     Yeni `enrichFromUrl(target, productUrl, options)` eklendi - arama
     adimini (`findKotonProductData`) tamamen atlayip dogrudan verilen
     URL'i `fetchKotonProductData` ile okuyor, ayni renk eslestirme/
     yukleme mantigini kullaniyor.
   - `src/app/api/admin/urunler/[id]/gorsel-ekle/route.ts` yeniden
     yazildi: artik `{ url: string }` (tek bir Koton urun sayfasi linki)
     aliyor, `koton.com` domain kontrolu yapiyor, urunun renk
     varyantlarini (`gorsel-yenile` route'uyla ayni sekilde) DB'den
     cikarip `enrichFromUrl` cagiriyor. Eski "birden fazla ham gorsel
     URL'i" tasarimi (`urls: string[]`, `prisma.productImage.createMany`)
     tamamen kaldirildi.
   - `products-table.tsx`: buton etiketi "Koton linkiyle ekle" oldu,
     `window.prompt` metni artik urun sayfasi linki istiyor, sonuc
     mesajlari `gorsel-yenile` butonuyla ayni ("Sayfa bulundu ama..." /
     "Bu linkten ürün verisi alınamadı...").
   - **Dogrulama**: canli veriyi kirletmemek icin gecici, tek kullanimlik
     bir test urunu olusturulup (gercek "Lacivert Çizgili" renk degerine
     referans vererek) `enrichFromUrl` gercek bir Koton URL'iyle
     calistirildi - `found: true, imagesAdded: 3` dogru sonucu verdi,
     test urunu sonra silindi (cascade ile option image'lari da gitti).
2. **Urun duzenleme sayfasinda gorsel silme, "Kaydedilmemiş
   değişiklikler var" cubugunu tetiklemiyordu**: kullanici bir gorseli
   cop kutusu ikonuyla siliyor, gorsel ekrandan kayboluyor, ama
   `SaveBar` gorunmedigi icin "Kaydet"e basmadan sayfa yenilenirse
   silme islemi hic gerceklesmemis gibi geri geliyordu.
   - **Kok neden**: `SaveBar` (`src/components/admin/save-bar.tsx`)
     formun native `"input"`/`"change"` DOM olaylarini dinliyor. Metin
     kutusuna yazmak (SKU, fiyat, gorsel URL/alt input'lari) bu
     olaylari gercekten tetikliyor, ama "Görseli sil" / "Görsel Ekle" /
     "Yukarı-Aşağı taşı" gibi butonlar sadece React state'ini
     guncelliyor - React, kontrollu bir input'un `value`'sunu
     programatik olarak degistirdiginde native bir DOM olayi
     **tetiklemiyor**. Bu yuzden butonla yapilan HER degisiklik
     (varyant satiri silme/ekleme, renk gorseli silme/ekleme/siralama,
     genel urun gorseli silme/ekleme/siralama, toplu %indirim/stok
     islemleri) SaveBar tarafindan fark edilmiyordu - sadece bu
     oturumda rastlanti eseri bulunan "gorsel silme" degil, ayni
     kok nedene sahip daha genis bir sorun.
   - **Duzeltme**: yeni `src/components/admin/use-dirty-signal.ts` hook'u
     eklendi - `useDirtySignal(value)` bir ref donduruyor, bu ref bir
     gizli `<input>`'a baglaniyor; `value` degistiginde (ilk render haric)
     o input uzerinde `dispatchEvent(new Event("input", { bubbles: true }))`
     ile bubbling bir native olay tetikliyor, bu da `SaveBar`'in form
     dinleyicisine ulasiyor. Bu hook `product-images-field.tsx`'teki
     (genel urun gorselleri) ve `variant-editor.tsx`'teki **iki** gizli
     input'a (varyantlar JSON'u + renk gorselleri JSON'u) baglandi -
     boylece butonla yapilan TUM degisiklikler artik SaveBar'i
     tetikliyor.
   - **Dogrulama**: tarayicida elle/Playwright ile test edilemedi -
     yerel `.env`'deki `ADMIN_PASSWORD` hala eski placeholder
     (`guclu-bir-sifre-belirleyin`, bkz. 2026-08-28 notu), gercek admin
     sifresi bu makinede yok, bu yuzden admin oturumu acilamadi. Sadece
     `npx tsc --noEmit` ve `npm run build` ile dogrulandi (ikisi de
     hatasiz). Mekanizma (kontrollu input + programatik degisiklikte
     manuel event dispatch) standart, dusuk riskli bir React deseni -
     ama **kullanicinin bir sonraki oturumda gercek tarayicida
     dogrulamasi onerilir** (bir gorsel/varyant silip SaveBar'in
     gorunup gorunmedigine bakarak).

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz. Koton
linki degisikligi gercek (gecici) veriyle dogrulandi (yukarida). SaveBar
degisikligi sadece derleme seviyesinde dogrulandi, tarayici testi
yapilamadi (admin sifresi bu makinede yok).

## Yerel .env'deki gercek admin sifresi + DuckDuckGo web arama yedegi (2026-09-10, ayni oturum)

1. **Yerel `.env` guncellendi**: kullanici gercek admin sifresini verdi
   (deger burada gizli tutuluyor, `.env` dosyasindan okunabilir).
   `ADMIN_PASSWORD` bu degerle guncellendi. DB'ye
   karsi kontrol edilince bu sifrenin `admin@bollmark.com` (eski
   `.env`'deki placeholder-seeded hesap) ile degil, `ozilevent@gmail.com`
   ile eslestigi dogrulandi (`bcrypt.compare` ile) - bu yuzden
   `ADMIN_EMAIL` de `ozilevent@gmail.com` olarak guncellendi. Bu deger
   `.env`'de oldugu icin GitHub'a gitmiyor (`.gitignore`'da) - sadece bu
   makinede.
   - Bu sifre sayesinde yukaridaki SaveBar duzeltmesi artik gercekten
     **tarayicida** (Playwright, gecici scratchpad kurulumu) dogrulandi:
     bir urun duzenleme sayfasinda "Görseli sil" ikonuna tiklandi,
     SaveBar oncesi 0 -> sonrasi 1 olarak goruldu (dogru calisiyor).

2. **Kullanici geri bildirimi**: "Koton linkiyle ekle" butonu hala elle
   mudahale gerektiriyordu - kullanici, Claude'un konusma icinde Koton
   urun sayfasini WebSearch ile kolayca bulabildigini fark edip "bu
   linki kendisi arayip bulamaz mi, basit bir is" dedi. Google'in resmi
   arama API'si ucretli/kotali oldugu icin dogrudan kullanilmadi, onun
   yerine **DuckDuckGo'nun anahtar gerektirmeyen HTML arama uc noktasi**
   (`https://html.duckduckgo.com/html/?q=...`) kullanildi - `curl` ile
   `site:koton.com 6SAK40062PW` araninca **ilk sonuc** doğru urun
   sayfasiydi (dogrulandi).
   - **`src/lib/koton-images.ts`**: yeni `fetchWebSearchUrl(query)`
     fonksiyonu eklendi - DuckDuckGo HTML sonuclarini `cheerio` ile
     (proje zaten `description-html.ts`'te kullaniyor, yeni bagimlilik
     eklenmedi) parse edip `a.result__a` linklerinin `uddg` parametresini
     (DuckDuckGo'nun yonlendirme sarmalayicisi) cozup ilk `koton.com`
     sonucunu donduruyor.
   - `findKotonProductData` icine **ucuncu bir deneme** olarak eklendi:
     barkod ve urun kodu ile autocomplete ikisi de basarisiz olursa,
     `site:koton.com <urun kodu>` ile DuckDuckGo aranip bulunan URL
     `fetchKotonProductData` ile deneniyor. Bu, hem `enrichOne` (Excel
     ice aktarimi + "Fotoğrafları yeniden ara" butonu) hem de yeni
     eklenen `enrichFromUrl` yolunu etkiliyor - yani **artik cogu
     durumda "Koton linkiyle ekle" butonuna hic gerek kalmiyor**, buton
     sadece DuckDuckGo'nun da bulamadigi nadir durumlar icin bir yedek
     olarak duruyor.
   - **Canli dogrulama**: gecici bir test urunuyle (`6SAK40062PW` -
     otomatik aramanin (autocomplete) hicbir sekilde bulamadigi, sadece
     manuel URL ile cozulebilen bilinen ornek) `enrichOne` **hicbir
     manuel URL verilmeden** calistirildi - `found: true, imagesAdded: 6,
     descriptionUpdated: true` sonucunu verdi, log'da "web araması ile
     bulundu" goruldu. Test urunu sonra silindi.

**Test edildi**: `npx tsc --noEmit` ve `npm run build` hatasiz. Hem
DuckDuckGo yedegi (gecici test urunuyle, tamamen otomatik) hem SaveBar
duzeltmesi (gercek admin oturumuyla Playwright, tarayicida) canli/gercek
kosullarda dogrulandi.

## Kullanici geri bildirimi - DuckDuckGo yedegi canlida calismiyor (2026-09-10, ayni oturum)

Kullanici canlida `6SAK40062PW` icin "Fotoğrafları yeniden ara" butonunu
tekrar denedi (deploy'un kesin bittigi bir zamanda), yine "Koton'da
bulunamadı" hatasi aldi - oysa yukaridaki DuckDuckGo yedegi yerel
makinede ayni urunle dogru calismisti.

- Kullanicidan bir Vercel API token istendi (ilk paylasilan token
  gecersizdi - "User not found" - ikinci token calisti), `vercel logs`
  ile canli fonksiyon loglari kontrol edildi. Ilgili istek net gorundu:
  `POST .../gorsel-yenile` -> `Koton eşleşmesi (6SAK40062PW): bulunamadı`
  - hicbir ara hata (`autocomplete başarısız`, `DuckDuckGo araması
  başarısız oldu`) loglanmamisti, yani her iki istek de HTTP 200 donmus
  ama sonuc bulunamamisti.
- **Kok neden (yuksek guvenle)**: DuckDuckGo'nun HTML arama uc noktasi,
  Vercel'in sunucu (veri merkezi) IP'lerinden gelen istekleri otomatik/
  bot trafigi olarak tespit edip normal sonuc sayfasi yerine bos/
  engellenmis bir sayfa donduruyor gibi gorunuyor (hata firlatmiyor,
  sadece organik sonuc yok) - bu, bulut saglayicilarindan arama motoru
  scraping'inde çok yaygin bilinen bir sorun. Yerel gelistirme
  makinesinden (normal/ev IP'si) calisirken sorunsuz calismasi bunu
  gizlemisti.
- **Karar**: DuckDuckGo denemesi koddan **cikarilmadi** (zararsiz - basarisiz
  olursa sessizce bir sonraki adima/`bulunamadi` sonucuna dusuyor, bazi
  durumlarda/IP'lerde hala ise yarayabilir), ama artik guvenilir bir
  cozum olarak sunulmuyor. **`Koton linkiyle ekle` butonu (elle link
  yapistirma) bu tur "otomatik aramanin bulamadigi" urunler icin asil
  guvenilir yol olarak kaldi.**
- Vercel token'i sadece bu tanilama icin kullanildi, hicbir yere
  kaydedilmedi/commitlenmedi.

## DuckDuckGo -> Google Custom Search API'ye gecis (2026-09-10, ayni oturum, tamamlanmadi)

Kullanici "bunu Google'da aratip bulamaz mi" dedi - once resmi bir arama
API'sinin (anahtar/ucret gerektirdigi icin ilk basta tercih edilmemisti)
DuckDuckGo'nun Vercel'i engelleme sorununu cozecegi dusunuldu. Kullanici
kendi Google hesabinda **Google Custom Search API** kurulumunu yapti
(Programmable Search Engine + Cloud Console API key + Custom Search API
enable + billing baglandi - hepsi dogrulandi, adim adim ekran
goruntuleriyle kontrol edildi).

- **Kod tarafi tamamlandi**: `src/lib/koton-images.ts`'teki DuckDuckGo
  scraping fonksiyonu (`fetchWebSearchUrl`, `cheerio` bagimliligi dahil)
  tamamen **kaldirildi** - kanitlanmis sekilde Vercel'den calismadigi
  icin tutmanin bir degeri yoktu. Yerine `fetchGoogleCseUrl(query)`
  eklendi: `GOOGLE_CSE_API_KEY` + `GOOGLE_CSE_CX` ortam degiskenlerini
  okuyup `googleapis.com/customsearch/v1` uzerinden sorgu atiyor, ilk
  `koton.com` sonucunu donduruyor. Bu iki degisken tanimsizsa adim
  sessizce atlaniyor (ozellik kapali kalir, hata vermez) - yerel `.env`
  ve `.env.example`'a eklendi. `npx tsc --noEmit` ve `npm run build`
  hatasiz.
- **Canli test edilemedi**: Google API'si kullanicinin hesabinda saatler
  gecmesine ragmen surekli `403 "This project does not have the access
  to Custom Search JSON API"` hatasi verdi - kontrol listesindeki HER
  adim dogrulandi (API Library'de "Enable" yapildi, key "Custom Search
  API"ye kisitlandi - ayni projede oldugu "Select API restrictions"
  dropdown'inin sadece o projede etkin API'leri listelemesiyle
  dogrulandi -, billing hesabi projeye bagli oldugu Billing sayfasindan
  dogrulandi, `cx` gecerli oldugu `cse.google.com/cse.js?cx=...`
  widget'inin 200 donup calismasiyla dogrulandi). Bu kontrollerin hepsi
  gecmesine ragmen API surekli reddetti - bu, Google Cloud'un Custom
  Search API'ye ozel, taze/yeni etkinlestirilen projelerde bazen saatler
  surebilen bilinen bir arka uc gecikme sorunu gibi gorunuyor (bizim
  kurulumumuzda bir hata bulunamadi).
- **Karar (ilk hali)**: Kullanici daha fazla vakit kaybetmek istemedi,
  Google tarafi su an icin birakildi. Kod commit'lenip push edildi (env
  degiskenleri tanimsiz oldugu icin Vercel'de bu adim sessizce devre
  disi - mevcut davranisi bozmuyor).

### Kesin neden bulundu: Google bu API'yi yeni musterilere kapatmis (artik denemeye gerek yok)

Kullanici, Google'in kendi destek forumunda ayni hatayi yasayan baska
birine verilen resmi cevabi buldu: **Custom Search JSON API artik yeni
musterilere kapali** ("closed to new customers", dokumantasyonda acikca
yaziyor). Mevcut/eski musterilerin 1 Ocak 2027'ye kadar alternatif bir
cozume (Google'in onerdigi **Vertex AI Search** - cok daha karmasik,
kurumsal, muhtemelen ucretli bir urun) gecmesi bekleniyor; yeni
hesaplar/organizasyonlar (bizimki gibi) bu API'ye **hicbir zaman**
erisemiyor.

- Bu, oncesinde varsayilan "propagation gecikmesi" teorisini **yanlisliyor** -
  sorun gecici degil, kalici bir kisitlama. Kontrol listesindeki (enable,
  billing, key kisitlamasi, cx) her adimin dogru olmasinin hicbir onemi
  yoktu - hesap turu yuzunden API zaten erisilemezdi.
- **Kesin karar**: Google Custom Search yolu **tamamen terk edildi**.
  Vertex AI Search'e gecmek bu kucuk ozellik icin orantisiz karmasik/
  maliyetli bulundu, denenmedi. Koddaki `fetchGoogleCseUrl` fonksiyonu
  (bkz. `src/lib/koton-images.ts`) env degiskenleri hic tanimlanmayacagi
  icin kalici olarak devre disi kalacak (zararsiz, silinmesi gerekmiyor -
  ama ileride bu urune tekrar bakilirsa bu notun okunmasi onerilir, aksi
  halde ayni cikmaza tekrar zaman harcanabilir).
  **`Koton linkiyle ekle` butonu (elle link yapistirma), otomatik aramanin
  bulamadigi urunler icin kalici/tek cozum olarak kaldi.**

## Gorsel sikistirma ve Blob kota temizligi (bu oturum)

Bkz. `GORSEL_SIKISTIRMA_VE_BLOB_LIMIT_PLANI.md`. Vercel Blob Hobby plan
kotasi (1GB depolama) hizla doluyordu; dort fazli plan uygulandi.

### Faz 1 - Yeni yuklemelerde sikistirma (tamamlandi)

`sharp` `package.json`'a dogrudan bagimlilik olarak eklendi (onceden
sadece Next.js'in transitive bagimliligiydi). Yeni `src/lib/image-compress.ts`
paylasimli `compressImage()` fonksiyonu: genislik max 1600px (orantili
kucultur, kucukse buyutmez), WebP'e cevirir, kalite ~78. Hem
`src/app/api/admin/upload/route.ts` (admin panel PC yuklemesi, 5MB/tip
kontrolunden SONRA uygulaniyor) hem `src/lib/koton-images.ts` ->
`reuploadImageToBlob()` (Excel aktariminda Koton'dan cekilen gorseller)
bu fonksiyonu kullanacak sekilde guncellendi. Fonksiyon seviyesinde test
edildi: `public/logo.png` (28.310 bytes) sikistirilinca 17.856 bytes
WebP cikti (canli admin panelden gercek buyuk bir foto yukleyip
karsilastirma yapilamadi - bu oturumda tarayici/UI erisimi yoktu, kod
incelemesi + fonksiyon testi + `tsc`/`build` ile dogrulandi).

### Faz 2 - Toplu silme bug'i (tamamlandi)

`src/app/api/admin/urunler/bulk/route.ts`'deki DELETE aksiyonu artik
`deleteMany`'den ONCE silinecek urunlerin `images`/`optionImages`
url'lerini okuyor, silme basarili olduktan sonra `deleteBlobUrls()` ile
Blob'dan da siliyor (tekli silmedeki `admin/urunler/[id]/page.tsx` ->
`deleteProduct` ile ayni desen). Canli admin panelden birkac test urunu
toplu silip Blob dashboard'unda dogrulama yapilamadi (UI/tarayici
erisimi yok) - kod incelemesi + `tsc`/`build` ile dogrulandi.

### Faz 3 - Yetim Blob temizligi (TAMAMLANDI)

`scripts/temizle-yetim-blob.ts` yazildi (varsayilan dry-run, `--execute`
ile gercek silme). Dry-run: 148 blob, 45 referansli, **103 yetim
(~275 MB)**. Kullanici onayladi, `--execute` calistirildi:

- **103 dosya silindi, 274.99 MB bosaldi.**

### Faz 4 - Mevcut gorselleri geriye donuk sikistirma (TAMAMLANDI)

`scripts/sikistir-mevcut-gorseller.ts` yazildi (varsayilan dry-run,
`--execute` + opsiyonel `--limit=N` ile gercek islem, 20'serli grup +
300ms bekleme, hata veren gorsel atlanip loglanir, script durmaz).
Dry-run: 45 referansli gorsel, ~116 MB, tahmini sikistirma sonrasi
~17.4 MB. Kullanici onayladi, tum 45 gorselle `--execute` calistirildi:

- **45/45 gorsel basariyla sikistirildi, 0 basarisiz.** Her gorsel
  indirilip sharp ile (max 1600px, WebP kalite ~78) islendi, yeni Blob
  path'ine yuklendi, ilgili DB satirindaki url alani guncellendi, eski
  (sikistirilmamis) dosya silindi.
- Dogrulama: script tekrar dry-run modunda calistirildi -> "islenecek
  gorsel: 0, zaten islenmis (.webp): 45" (hepsi artik WebP). Yetim Blob
  scripti de tekrar calistirildi -> "toplam blob: 45, referansli: 45,
  yetim: 0" (hicbir eski/yetim dosya kalmadi, DB url'leri dogru
  guncellenmis).

### Genel

`npx tsc --noEmit` ve `npm run build` her iki fazdan sonra da hatasiz
gecti. `.env`'de olmayip `.env.local`'de duran `BLOB_READ_WRITE_TOKEN`
yuzunden her iki yeni script de standart `import "dotenv/config"`e ek
olarak `.env.local`'i de aciyor (diger scriptlerden farkli, cunku onlar
Blob'a degil sadece DB'ye erisiyor).

**Toplam kazanc bu oturumda**: Blob deposundan ~275 MB yetim dosya
silindi, kalan ~116 MB'lik kullanilan gorseller ~17 MB civarina indi -
Hobby plandaki 1GB kotadan toplamda yaklasik 370+ MB yer acildi. Yeni
yuklemeler de (Faz 1) artik otomatik sikistiriliyor, kota bir daha bu
hizla dolmayacak.

## Urunler listesi - Aksiyonlar kolonu ikon butonlara cevrildi (bu oturum)

`URUNLER_LISTESI_AKSIYON_BUTONLARI_PLANI.md`'deki plan uygulandi:

- `src/components/admin/icon-button.tsx` (yeni): ortak `IconButton`
  (buton) ve `IconLinkButton` (link, `disabled` durumunda `<span>`'e
  duser) bilesenleri eklendi - `h-8 w-8`/`h-9 w-9`, `title`+`aria-label`
  zorunlu, `border-admin-border`, hover'da `admin-accent`.
- `src/components/admin/products-table.tsx`: "Aksiyonlar" kolonu artik
  5 ikon buton: **Duzenle** (`Pencil`), **Fiyat Guncelle** (`Tag`),
  **Fotograflari Yeniden Ara** (`RefreshCw`/`Loader2`, sadece
  `imageUrl` yoksa), **Koton Linkiyle Ekle** (`Link2`, sadece
  `imageUrl` yoksa), **Urunu Gor** (`ExternalLink`, yeni sekmede
  `/urunler/{slug}`, `status !== "PUBLISHED"` ise pasif +
  "Urun yayinda degil, sitede gorunmez" tooltip'i). Fiyat Guncelle
  popup/prompt KULLANMIYOR: "Fiyat" kolonunun kendi hucresi
  `editingPriceId` state'iyle inline `<input>`'a donusuyor, yaninda
  Check (kaydet) ve X (vazgec) ikon butonlari cikiyor, Enter/Escape
  destekleniyor, kaydederken `Loader2` spinner + input/butonlar
  disabled, hata varsa (`<=0` veya sayi degil) kirmizi border + "Gecerli
  bir fiyat girin" mesaji gosteriyor.
- `src/app/api/admin/urunler/bulk/route.ts`: `SET_PRICE` action'i
  eklendi (`priceCents` say 0'dan buyukse `updateMany`, degilse 400).
- `src/app/(admin)/admin/urunler/page.tsx` ve `arsiv/page.tsx`:
  `ProductRow`'a `slug` alani eklendi ("Urunu Gor" linki icin), her iki
  sayfadaki `rows` map'ine `slug: p.slug` eklendi.
- Mevcut gorsel arama/ekleme network mantigi (`handleGorselYenile`,
  `handleGorselEkle`) ve toast/`router.refresh()` davranisi degismedi,
  sadece gorunum ikon-butona cevrildi.
- Dogrulama: `npx tsc --noEmit`, `npm run lint`, `npm run build` ucu de
  hatasiz gecti. Canli admin panelden tarayici testi bu oturumda
  yapilamadi (UI/tarayici erisimi yok) - kod incelemesi + tip/lint/build
  kontrolleriyle dogrulandi.

## Vega SanalMagaza "panelapi" entegrasyonu (2026-09-10, yeni oturum) - YARIM KALDI

Detayli bulgular, denenen/basarisiz olan seyler, guncel mimari ve
**sıradaki somut adım** icin **`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`**
dosyasinin en ustundeki "GÜNCEL DURUM" bolumune bakin - bu oturuma
kaldigi yerden devam etmek icin ilk okunmasi gereken dosya budur.

Ozet: Vega ↔ Bollmark baglantisi (giris + kategori listesi cekme) HTTP
seviyesinde calisiyor (Cloudflare Worker koprusu `vega-bridge-worker/` +
`/api/vega/panelapi/...` route'u + yeni `VegaSession` tablosu - hepsi
deploy edildi, canli test edildi). Ama Vega'nin "Kategori Secimi"
penceresi hala bos kaliyor (cok sayida format denendi, hicbiri
calismadi) ve bu, urun yukleme akisini tamamen engelliyor.

## Vega - Ticimax taklidi SOAP entegrasyonu - CALISIYOR (2026-09-11)

Uctan uca calisan akis (canli dogrulandi): (1) Vega'nin "Urun Yonetimi /
TiciMax -> Listele" ekraninda 9 yayindaki Bollmark urunu, tum varyantlari
(barkod, stok kodu, adet, fiyat, kategori) ile listelendi. (2) Kullanici
barkod eslestirmesini yapti. (3) Vega'dan stok gonderildiginde **sitedeki
stoklar gercekten guncelleniyor** (`VaryasyonGuncelle` uc noktasi).

**Artik stok konusunda kaynak Vega'dir** - gonderdigi deger sitedeki stogun
uzerine yazilir (sadece barkodu eslestirilmis varyantlar icin).

Detayli bulgular ve siradaki adimlar icin
**`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`** dosyasinin EN USTUNDEKI
"CALISIYOR (2026-09-11)" bolumune bakin.

Ozet mimari: Vega -> Cloudflare Worker koprusu (`vega-bridge-worker/`) ->
`https://bollmark.com/Servis/UrunServis.svc` -> Neon. Vega'da Site Tipi =
TiciMax, Site Adi = `bollmark-vega-bridge.ozilevent.workers.dev`, Web Servis
Kodu = `/admin/ayarlar` sayfasindaki "Uye Kodu" degeri (deger burada
yazilmiyor, panelden okunabilir).

**Onemli**: Vega, Vercel'e (bollmark.com) DOGRUDAN baglanamiyor - eski SOAP
istemcisi ile TLS uyumsuzlugu suphesi; istek sessizce kayboluyor ve Vercel
loglarinda hic gorunmuyor. Cloudflare Worker koprusu bu yuzden zorunlu.

## Vega - Ticimax taklidi SOAP entegrasyonu (2026-09-10 gece) - ILK KURULUM

Vega destege ulasilamadigi icin (kullanici bildirdi) yon degistirildi:
Vega'nin "Site Tipi" ayarinda hazir bulunan **Ticimax** platformunun
GERCEK, dokumante (SOAP/WCF) protokolu taklit edilmeye baslandi - tahmine
dayali JSON yerine artik gercek bir semaya dayaniyor. Detaylar, canli
yakalanan gercek Vega SOAP istegi, ve siradaki somut adim icin
**`VEGA_PANELAPI_BULGULARI_VE_PLAN.md`** dosyasinin EN USTUNDEKI
"GÜNCEL DURUM ... Ticimax taklidi yaklaşımı" bolumune bakin.

Bu oturumda kodlanan/deploy edilen (kisa ozet):
- `prisma/schema.prisma`: `Category.vegaId` (int, Ticimax'in beklediği
  tamsayi kategori ID'si icin) ve `VegaIntegration.ticimaxUyeKodu`
  (duz metin) eklendi, Neon'a `db push` ile uygulandi.
- Yeni route: `src/app/api/vega-tcmx/Servis/[service]/route.ts` -
  `UrunServis.svc`nin `SelectKategori` metodunu gercek Ticimax SOAP
  seklinde cevaplıyor (namespace tahmini, canli testte dogrulanacak).
- Admin panel (`/admin/ayarlar`): yeni "Ticimax Taklidi (SOAP)" karti,
  `ticimaxUyeKodu` alani.
- **Henuz yapilmadi**: kullanicinin panelden Uye Kodu girip Vega'da
  Site Tipi=Ticimax, Site Adi=`https://bollmark.com/api/vega-tcmx` ile
  canli "Kategori Secimi" testi + Vercel loglarindan sonucun okunmasi.
