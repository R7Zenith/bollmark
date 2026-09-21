# Instagram galerisi (ana sayfa)

Ana sayfadaki "Bizi takip edin" bölümü, gerçek Instagram fotoğrafları eklenene kadar **görünmez** (stok fotoğrafla sahte
galeri doldurulmaz). Bölümün görünmesi için iki şart birlikte sağlanmalı:

1. `NEXT_PUBLIC_INSTAGRAM_URL` ortam değişkeni dolu olmalı (örn. `https://www.instagram.com/kullaniciadi`).
   Yerelde `.env` dosyasına, canlıda Vercel > Settings > Environment Variables altına eklenir. Bu değişken build sırasında
   koda gömüldüğü için Vercel'de değiştirildikten sonra yeniden deploy gerekir.
2. Bu klasörde 6 fotoğraf bulunmalı:
   `post-1.jpg`, `post-2.jpg`, `post-3.jpg`, `post-4.jpg`, `post-5.jpg`, `post-6.jpg`

Fotoğrafları Instagram hesabınızdaki paylaşımlarınızdan indirin. Önerilen boyut **1080×1080** (kare). Kare olmayan
görseller kırpılarak ortalanır. Dosya boyutunu küçük tutun (her biri ~200 KB civarı), Next.js zaten optimize eder.

## Alt metinleri düzenleme

Her karenin ekran okuyucu metni (`alt`) `src/lib/instagram-posts.ts` içindeki `INSTAGRAM_POSTS` dizisinde durur:

```ts
{ image: "/instagram/post-1.jpg", alt: "Bollmark Instagram paylaşımı 1" }
```

Fotoğrafı ne gösteriyorsa `alt` metnini ona göre yazın (örn. "Bej palto ile sonbahar kombini"). Dosya adlarını
değiştirirseniz `image` alanını da aynı şekilde güncelleyin. Dizideki dosyalardan biri eksikse bölüm hiç render edilmez.
