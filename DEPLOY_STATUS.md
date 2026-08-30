# Bollmark - Kurulum ve Canliya Alma Durumu

Son guncelleme: 2026-08-29 (bu oturum)

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
