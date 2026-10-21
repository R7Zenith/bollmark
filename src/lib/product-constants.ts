// Product.gender alanina yazilan tek gecerli degerler - src/lib/excel-import.ts
// GENDER_MAP bu degerlerin disina hic cikmiyor. Kampanya formu (admin) ve
// baska cinsiyet secim yerleri bu sabiti kullanir, drift'i onlemek icin.
export const PRODUCT_GENDERS = ["Kadın", "Erkek", "Kız Çocuk", "Erkek Çocuk", "Çocuk", "Unisex"] as const;
