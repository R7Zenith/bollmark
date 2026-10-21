// Urun formundaki cinsiyet dropdown'u icin sabit secenekler.
export const GENDER_OPTIONS = ["Kadın", "Erkek", "Unisex", "Kız Çocuk", "Erkek Çocuk", "Çocuk"] as const;

// Dropdown'da degerden farkli gorunecek etiketler.
export const GENDER_OPTION_LABEL: Partial<Record<string, string>> = { Çocuk: "Çocuk (unisex)" };
