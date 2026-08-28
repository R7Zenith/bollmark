# Bollmark - Kurulum ve Canliya Alma Durumu

Son guncelleme: 2026-08-28

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

## Simdi yapilmasi gerekenler (kaldigimiz yer)

1. **Kullanicinin Cloudflare dashboard'dan yapmasi gerekenler:**
   - Workers & Pages -> `bollmark` -> Settings -> Domains & Routes'tan
     `bollmark.com` ve `www.bollmark.com` custom domain kayitlarini KALDIR
     (eski Cloudflare Worker denemesinden kalma, yeni DNS kayitlariyla
     cakisir).
   - `bollmark.com` zone'unda DNS -> Records: apex (`@`) ve `www` icin
     **A kaydi -> 76.76.21.21**, Proxy status **"DNS only"** (gri bulut,
     turuncu degil - proxy acikken Vercel SSL dogrulamasi basarisiz olur).
2. Kullanici bu adimlari tamamladiktan sonra Claude'a haber vermeli,
   Claude `vercel domains inspect` ile dogrulamayi kontrol edecek.
3. Domain aktif olunca `bollmark.com` uzerinden ayni testler (gate,
   preview, admin login) tekrar dogrulanmali.
4. **Otomatik deploy** istenirse: Vercel dashboard'dan
   Settings -> Git -> Connect Git Repository ile GitHub App yetkilendirmesi
   kullanici tarafindan yapilmali (Claude'un CLI'dan bunu tetikleyememesi
   Cloudflare'deki ile ayni sinirlama). O ana kadar her degisiklik icin
   elle `vercel deploy --prod` gerekiyor.

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
