// Masaustu mega menusunun (Kadin/Erkek sekmeleri) sag tarafindaki promosyon
// gorsel kartlari. Bir sekmede kart yoksa sag panel hic render edilmez.
// Gorseller public/menu/ altinda; href'ler katalogun gercek filtre URL'leri
// (bkz. GenderPanel'deki kategori linkleri).
export type MegaMenuCard = {
  image: string;
  alt: string;
  label: string;
  title: string;
  href: string;
  // Yazi okunabilirligi icin varsayilan overlay'den (0.2) farkli gerekiyorsa.
  overlayOpacity?: number;
};

export const MEGA_MENU_CARDS: Record<"kadin" | "erkek", MegaMenuCard[]> = {
  kadin: [
    {
      image: "/menu/kadin-elbise.webp",
      alt: "Kadın elbise koleksiyonu",
      label: "YENİ SEZON",
      title: "Elbise",
      href: "/urunler?kategori=elbise&cinsiyet=Kadın"
    },
    {
      image: "/menu/kadin-bluz.webp",
      alt: "Kadın bluz koleksiyonu",
      label: "ÇOK SATANLAR",
      title: "Bluz",
      href: "/urunler?kategori=bluz&cinsiyet=Kadın",
      overlayOpacity: 0.3
    }
  ],
  erkek: [
    {
      image: "/menu/erkek-gomlek.webp",
      alt: "Erkek gömlek koleksiyonu",
      label: "YENİ SEZON",
      title: "Gömlek",
      href: "/urunler?kategori=gomlek&cinsiyet=Erkek",
      overlayOpacity: 0.3
    },
    {
      image: "/menu/erkek-ceket.webp",
      alt: "Erkek ceket koleksiyonu",
      label: "ÇOK SATANLAR",
      title: "Ceket",
      href: "/urunler?kategori=ceket&cinsiyet=Erkek"
    }
  ]
};
