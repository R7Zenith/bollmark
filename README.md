# Bollmark E-Ticaret Sitesi

Bu proje Next.js (TypeScript, Tailwind CSS, Prisma) ile hazirlanmis, hem musteri
tarafi magazayi hem de yonetim panelini (admin) tek bir uygulamada barindiran
bir e-ticaret altyapisidir.

## Icerik

- **Magaza (musteri tarafi):** Ana sayfa, urun listeleme, urun detay, sepet,
  odeme adimi (su an test modunda, gercek tahsilat yapmiyor).
- **Yonetim paneli (`/admin`):** Giris ekrani, genel bakis, urun yonetimi
  (ekle/duzenle/sil), kategori yonetimi, siparis yonetimi ve durum guncelleme,
  kargo takip yonetimi.
- **Veritabani:** Prisma ORM. Yerelde sifir kurulumla calisan SQLite, canliya
  alirken tek satir degisiklikle PostgreSQL'e gecilebilir.

## Ilk Kurulum (bilgisayarinizda)

Once bilgisayarinizda [Node.js](https://nodejs.org) (LTS surumu) kurulu olmali.

```bash
# 1) Bagimliliklari kur
npm install

# 2) Ornek .env dosyasini kopyalayin ve ADMIN_EMAIL / ADMIN_PASSWORD degerlerini kendinize gore duzenleyin
cp .env.example .env

# 3) Veritabani semasini olustur
npm run db:push

# 4) Ilk admin kullanicisini ve ornek urunu olustur
npm run db:seed

# 5) Gelistirme sunucusunu baslat
npm run dev
```

Ardindan:
- Magaza: http://localhost:3000
- Yonetim paneli: http://localhost:3000/admin/login
  (`.env` dosyasindaki ADMIN_EMAIL / ADMIN_PASSWORD ile giris yapin)

## GitHub ile Iki Bilgisayardan Senkron Calisma

Bu proje bir GitHub reposuna baglanacak. Boylece hem dukkandaki bilgisayardan
hem de evdeki bilgisayardan ayni projeyi guncelleyebilirsiniz. Adimlar icin
sohbetteki mesaja bakin; ozetle:

1. **Degisiklik yapmadan once:** `git pull` ile son halini cekin.
2. **Degisiklik yaptiktan sonra:** `git add .`, `git commit -m "aciklama"`,
   `git push` ile GitHub'a gonderin.
3. Diger bilgisayarda calismaya baslarken yine once `git pull` yapin.

En kolay yol icin **GitHub Desktop** uygulamasini kullanmanizi oneririz -
komut satiri bilmenize gerek kalmaz.

## Sonraki Adimlar

- Odeme saglayicisi (iyzico vb.) entegrasyonu
- Kargo firmasi API entegrasyonu (otomatik takip numarasi)
- Canli yayina alma (Vercel + Postgres onerilir)
- Urun gorsellerini dosya olarak yukleme (su an URL ile ekleniyor)
