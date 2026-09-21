// Ana sayfadaki Instagram galerisinin 6 karesi (bkz. components/home/instagram-grid.tsx).
// Instagram API'si kullanilmiyor (token ister, kirilgan): fotograflar elle
// public/instagram/ altina konur. Dosya adlari ve alt metinlerin nasil
// duzenlenecegi icin bkz. public/instagram/README.md.
export const INSTAGRAM_POSTS: { image: string; alt: string }[] = [
  { image: "/instagram/post-1.jpg", alt: "Bollmark Instagram paylaşımı 1" },
  { image: "/instagram/post-2.jpg", alt: "Bollmark Instagram paylaşımı 2" },
  { image: "/instagram/post-3.jpg", alt: "Bollmark Instagram paylaşımı 3" },
  { image: "/instagram/post-4.jpg", alt: "Bollmark Instagram paylaşımı 4" },
  { image: "/instagram/post-5.jpg", alt: "Bollmark Instagram paylaşımı 5" },
  { image: "/instagram/post-6.jpg", alt: "Bollmark Instagram paylaşımı 6" }
];
