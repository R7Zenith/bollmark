// Fiziksel magaza ve marka iletisim bilgileri - anasayfadaki Organization /
// ClothingStore JSON-LD semasi buradan okur (bkz. SEO_TEKNIK_DENETIM_VE_PLAN.md
// 2.7). Yalniz sitede zaten yazan bilgiler girildi; bilinmeyenler null (semaya
// hic yazilmaz) - uydurma deger girmeyin.
// Magaza Google Haritalar'da "Koton Karacabey" adiyla kayitli; semada bilincli
// olarak "Bollmark" kullaniliyor (30 Eylul 2026 karari).
export const STORE_INFO = {
  brandName: "Bollmark",
  email: "bilgi@bollmark.com",
  // Magazanin telefonu yok (30 Eylul 2026). Olursa uluslararasi bicimde
  // girilir, ornek "+90 224 000 00 00".
  phone: null as string | null,
  instagramUrl: "https://www.instagram.com/koton.karacabey/",
  address: {
    streetAddress: "Runguşpaşa Mah. 75. Sk. No:6/A",
    addressLocality: "Karacabey",
    addressRegion: "Bursa",
    postalCode: "16700",
    addressCountry: "TR"
  },
  // "Iade Kosullari" sayfasi: teslimden itibaren 14 gun cayma hakki, iade
  // kargo ucreti aliciya ait.
  returnDays: 14,
  // Teslimat suresi (is gunu) - Merchant Center kargo ayariyla ayni olmali.
  // Hazirlama: "Teslimat Sartlari" sayfasi (1-3 is gunu); yolda kalma: kullanici
  // bilgisi (30 Eylul 2026).
  handlingDays: { min: 1, max: 3 },
  transitDays: { min: 1, max: 3 },
  // iletisim sayfasindaki "Calisma Saatleri" ile ayni (Pazar kapali).
  openingHours: {
    days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    opens: "10:00",
    closes: "19:00"
  }
};
