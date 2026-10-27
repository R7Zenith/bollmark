// Fiziksel magaza ve marka iletisim bilgileri - anasayfadaki Organization /
// ClothingStore JSON-LD semasi buradan okur (bkz. SEO_TEKNIK_DENETIM_VE_PLAN.md
// 2.7). Yalniz sitede zaten yazan bilgiler girildi; bilinmeyenler null (semaya
// hic yazilmaz) - uydurma deger girmeyin.
// Magaza Google Haritalar'da "Koton Karacabey" adiyla kayitli; semada bilincli
// olarak "Bollmark" kullaniliyor (30 Eylul 2026 karari).
export const STORE_INFO = {
  brandName: "Bollmark",
  email: "bilgi@bollmark.com",
  // Bulutfon sabit numara (26 Ekim 2026). Yalniz WhatsApp Business icin
  // kullanilir, aramalar acilmaz - bu yuzden sitede tel: linki yok; yasal
  // metinlerde "Telefon / WhatsApp" duz metin. Uluslararasi bicimde; gosterim
  // ve wa.me linki asagidaki yardimcilarla turetilir - baska dosyaya yazilmaz.
  phone: "+90 224 323 01 21" as string | null,
  // WhatsApp Business bu numarada 27 Ekim 2026'da acildi. false yapilirsa wa.me
  // linkleri (footer, iletisim, anasayfa karti, yuzen buton menusu, urun
  // sayfasi) gizlenir, yerine yalniz Instagram DM kalir.
  whatsappActive: true,
  // Yasal kimlik (Mesafeli Sozlesmeler Yon. 5/1-c, e-ticaret hizmet saglayici
  // yon.; bkz. docs/planlar/ILETISIM_TELEFON_VE_INSTAGRAM_DM_PLANI.md). MERSIS
  // ve VKN kullanicidan alindi (26 Ekim 2026); unvan ve vergi dairesi Mesafeli
  // Satis Sozlesmesi / Gizlilik Politikasi'nda zaten yazan degerler. KEP
  // kullanici bildirince doldurulacak - deger uydurulmaz, null olan gosterilmez.
  legalName: "Oğuzhan Leventoğlu (Bollmark)" as string | null,
  mersisNo: "1667655626000001" as string | null,
  taxOffice: "Karacabey Vergi Dairesi" as string | null,
  taxNo: "6080753452" as string | null,
  kepAddress: null as string | null,
  // Profil ve DM linki bundan turetilir (asagida). 27 Ekim 2026'da
  // koton.karacabey -> bollmarkcom ("bollmark" Instagram'da alinamadi).
  instagramUsername: "bollmarkcom",
  address: {
    streetAddress: "Runguçpaşa Mah. 75. Sk. No:6/A",
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
    closes: "19:30"
  }
};

export const INSTAGRAM_URL = `https://www.instagram.com/${STORE_INFO.instagramUsername}/`;
export const INSTAGRAM_DM_URL = `https://ig.me/m/${STORE_INFO.instagramUsername}`;

// "+90 224 323 01 21" -> "0 (224) 323 01 21" (yurt ici okunus).
export function phoneDisplay(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^90/, "");
  return `0 (${digits.slice(0, 3)}) ${digits.slice(3, 6)} ${digits.slice(6, 8)} ${digits.slice(8)}`;
}

// "+90 224 323 01 21" -> "https://wa.me/902243230121"; text varsa sohbet
// kutusuna hazir mesaj olarak gelir (?text=).
export function whatsappHref(phone: string, text?: string): string {
  const base = `https://wa.me/${phone.replace(/\D/g, "")}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

// Yasal kimlik satirlari (etiket, deger) - null alanlar atlanir. Footer,
// iletisim sayfasi ve On Bilgilendirme Formu ayni listeyi kullanir.
export function legalIdentityRows(): { label: string; value: string }[] {
  const rows: [string, string | null][] = [
    ["Ticaret Unvanı", STORE_INFO.legalName],
    ["MERSİS No", STORE_INFO.mersisNo],
    ["Vergi Dairesi", STORE_INFO.taxOffice],
    ["Vergi No", STORE_INFO.taxNo],
    ["KEP Adresi", STORE_INFO.kepAddress]
  ];
  return rows.filter((row): row is [string, string] => !!row[1]).map(([label, value]) => ({ label, value }));
}

// Pazar kapali: openingHours.days'te olmayan gunler.
const DAY_LABELS: Record<string, string> = {
  Monday: "Pazartesi",
  Tuesday: "Salı",
  Wednesday: "Çarşamba",
  Thursday: "Perşembe",
  Friday: "Cuma",
  Saturday: "Cumartesi",
  Sunday: "Pazar"
};

// Ardisik gunler tek satirda: "Pazartesi - Cumartesi: 10:00 - 19:30", "Pazar: Kapalı".
export function openingHoursLines(): string[] {
  const { days, opens, closes } = STORE_INFO.openingHours;
  const closed = Object.keys(DAY_LABELS).filter((d) => !days.includes(d));
  const open = days.length > 1 ? `${DAY_LABELS[days[0]]} - ${DAY_LABELS[days[days.length - 1]]}` : DAY_LABELS[days[0]];
  return [`${open}: ${opens} - ${closes}`, ...closed.map((d) => `${DAY_LABELS[d]}: Kapalı`)];
}
