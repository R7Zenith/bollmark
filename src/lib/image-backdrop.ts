// Slazenger fotograflari beyaz arkaplanli - beyaz sayfa ve beyaz rozetlerle
// kaynasmasin diye bu markanin gorselleri gri zemin (bg-image-bg) uzerinde
// mix-blend-multiply ile gosterilir (bkz. product-card.tsx, product-viewer.tsx).
// Diger markalar (ör. Koton, mankenli/dolu arkaplanli) etkilenmez.
export function usesGreyBackdrop(brandName: string | null | undefined): boolean {
  return brandName?.trim().toLocaleLowerCase("tr") === "slazenger";
}
