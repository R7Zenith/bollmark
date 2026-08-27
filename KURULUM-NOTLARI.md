# Kurulum Gecmisi ve Notlar

Bu dosya, projenin bu bilgisayarda ilk kez calisir hale getirilmesi sirasinda
yapilan islemleri ve karsilasilan sorunlarin nasil cozuldugunu ozetler.

> Not: Bu dosya git'e eklenebilir, ancak icinde hicbir sifre/baglanti adresi
> gecmiyor - tum gizli bilgiler `.env` dosyasinda tutuluyor ve `.gitignore` ile
> repoya girmesi engelleniyor.

## Yapilan Adimlar

1. **Node.js kurulumu** - Bu bilgisayarda Node.js kurulu degildi. `winget`
   uzerinden Node.js LTS (v24.19.0) kuruldu.
2. **Bagimliliklar** - `npm install` calistirildi (Prisma Client de otomatik
   olarak `postinstall` adiminda uretildi).
3. **.env dosyasi** - `.env.example` -> `.env` olarak kopyalandi.
4. **Veritabani baglantisi duzeltildi** - `.env.example` icindeki
   `DATABASE_URL="file:./dev.db"` (SQLite) degeri, projenin gercek yapisiyla
   **uyumsuzdu**: `prisma/schema.prisma` dosyasi `provider = "postgresql"`
   olarak tanimli ve `src/lib/prisma.ts` dogrudan `@prisma/adapter-neon` +
   `@neondatabase/serverless` kullaniyor, yani proje SQLite ile degil sadece
   gercek bir Postgres/Neon baglantisiyla calisiyor. Bu yuzden `npm run
   db:push` `P1012` hatasi verdi.
   - Cozum: Neon (neon.tech) uzerinde ucretsiz bir veritabani projesi
     olusturuldu, verilen baglanti adresi `.env` icindeki `DATABASE_URL`
     degerine yazildi.
   - **Oneri:** README.md'de "yerelde sifir kurulumla calisan SQLite" ifadesi
     gecici olarak yanlis/eski kalmis - ileride SQLite destegi eklenmediyse bu
     satirin guncellenmesi iyi olur.
5. **Semanin veritabanina uygulanmasi** - `npm run db:push` calistirildi,
   tablolar Neon veritabaninda olusturuldu.
6. **Ornek veri (seed)** - `npm run db:seed` calistirildi:
   - Ilk admin kullanicisi (`.env` icindeki `ADMIN_EMAIL` / `ADMIN_PASSWORD`
     degerleriyle) olusturuldu.
   - "Dis Giyim" kategorisi ve "Bollmark Oversize Mont" ornek urunu (gorseller
     ve varyantlarla) eklendi.
7. **Gelistirme sunucusu** - `npm run dev` calistirildi, `http://localhost:3000`
   uzerinden erisim dogrulandi (HTTP 200).
8. **Admin sifresi degistirildi** - Kullanicinin istegi uzerine admin sifresi
   guncellendi:
   - `.env` icindeki `ADMIN_PASSWORD` degeri guncellendi.
   - `prisma/seed.ts` dosyasindaki `upsert` mantigi, kullanici zaten varsa
     sifreyi **guncellemiyor** (`update: {}`). Bu yuzden var olan admin
     kaydinin `passwordHash` alani, gecici bir script ile (bcrypt hash
     uretilip Prisma `update` cagrisi yapilarak) dogrudan veritabaninda
     guncellendi, script isi bitince silindi.

## Giris Bilgileri

- **Magaza:** http://localhost:3000
- **Yonetim paneli:** http://localhost:3000/admin/login
- E-posta ve sifre icin `.env` dosyasindaki `ADMIN_EMAIL` / `ADMIN_PASSWORD`
  degerlerine bakin (bu dosya git'e girmez, degerler burada tekrar
  yazilmiyor).

## Bilinen Kucuk Sorunlar / Ileride Bakilabilecekler

- `npm install` sirasinda Next.js 14.2.15 icin bilinen bir guvenlik acigi
  uyarisi cikti (`npm audit` ile detaylar goruntulenebilir, guncelleme
  onerilir).
- `prisma` paketinin 8.0.0-rc.12 gibi cok daha yeni bir surumu mevcut; su an
  5.22.0 kullaniliyor, buyuk surum guncellemesi ileride planli sekilde
  yapilmali.
- README.md'deki "yerelde SQLite calisir" ifadesi, kodun gercek davranisiyla
  (sadece Postgres/Neon) tutarli degil - kafa karisikligini onlemek icin
  guncellenmesi faydali olur.
