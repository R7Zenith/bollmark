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

## Simdi yapilmasi gerekenler (kaldigimiz yer)

1. ~~`npm run build` sonucunu kontrol et~~ ✅ tamamlandi, basarili.
2. ~~`src/middleware.ts` icin Next 16'nin onerdigi `proxy` donusumu~~ ✅
   tamamlandi (`src/proxy.ts`).
3. ~~`npm run dev` ile yerelde hizli kontrol~~ ✅ tamamlandi (ana sayfa,
   admin login, urun listeleme 200 dondu).
4. ~~Tum degisiklikleri commit'leyip GitHub'a push et~~ ✅ tamamlandi.
5. **Sirada:** `npx wrangler login` ile bu makineyi Cloudflare hesabina
   bagla (tarayicida oturum acmak gerekiyor - bu adim kullanicinin kendisi
   tarafindan tetiklenmeli). Giris yapildiktan sonra devam:
   - **Build command**'i `npm run build` yerine `npx opennextjs-cloudflare
     build` olarak degistir (Next build'i de icinde calistirir).
   - **Deploy command** `npx wrangler deploy` olarak kalabilir (varsayilan
     dogru).
   - "Connect" butonuna bas.
7. Cloudflare'de **Settings -> Variables and secrets** kismina asagidaki
   ortam degiskenlerini ekle (Production, gerekirse Preview icin de):
   - `DATABASE_URL` (Neon baglanti adresi - kullanicida mevcut, ben yerel
     `.env` dosyasina yazdim ama Cloudflare'e ELLE girilmesi gerekiyor,
     guvenlik icin buraya tekrar yazilmadi)
   - `NEXTAUTH_SECRET` (yerel `.env` dosyasinda mevcut)
   - `NEXTAUTH_URL` = `https://bollmark.com`
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
8. **Compatibility flags**'e (Settings -> Runtime, ekran goruntusunde bu alan
   zaten goruldu) `nodejs_compat` ekle (Prisma ve next-auth/bcryptjs icin
   gerekli). `wrangler.jsonc` icinde de zaten tanimli, ama dashboard
   tarafinda da kontrol edilmeli.
9. Deploy'u tetikle, build loglarini kontrol et, hata olursa Claude'a
   yapistir.
10. **Domains** sekmesinden `bollmark.com`'un bu Worker'a bagli oldugunu
    dogrula (kullanici daha once baglamis oldugunu belirtti).

## Onemli notlar / hatirlatmalar

- Yerel `.env` dosyasi GitHub'a gitmiyor (`.gitignore`'da). Evdeki
  bilgisayarda calismak icin: `git clone` yaptiktan sonra `.env.example`'i
  `.env` olarak kopyala, `DATABASE_URL` (Neon), `NEXTAUTH_SECRET`,
  `ADMIN_EMAIL`, `ADMIN_PASSWORD` degerlerini doldur.
- Veritabani artik **Neon Postgres** (paylasilan/canli veritabani) - hem
  yerel gelistirme hem canli site AYNI Neon veritabanini kullaniyor. Yerelde
  test verisi eklerken dikkatli olunmali (canli veriyle karismasin).
- GitHub repo: https://github.com/R7Zenith/bollmark.git (branch: `main`)
- Cloudflare Workers proje adi: `bollmark` (hesap: ozilevent@gmail.com,
  GitHub: R7Zenith)
- Domain: bollmark.com (Cloudflare uzerinde, daha once aktiflestirilmis)
