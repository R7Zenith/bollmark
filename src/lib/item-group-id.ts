// Urunun katalog grup kimligi: feed'lerde g:item_group_id, JSON-LD'de
// productGroupID, Meta AddToWishlist'te content_ids (content_type "product_group")
// hep bu degeri kullanir (bkz. META_KATALOG_PLANI.md). Istemci bilesenlerinden de
// cagrilabilir (sunucu bagimliligi yok).
export function getItemGroupId(product: { id: string; code: string | null }): string {
  return product.code ?? product.id;
}
