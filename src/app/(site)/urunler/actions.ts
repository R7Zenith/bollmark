"use server";

import { CATALOG_PAGE_SIZE } from "@/lib/catalog-filters";
import { getCatalogListing, toCatalogCardProps } from "@/lib/catalog-listing";

// "Daha Fazla Goster" butonunun sonraki partiyi getirdigi aksiyon. Sayfayla
// ayni listeleme hattini (getCatalogListing) kullanir; yalnizca yayindaki
// katalog verisini okur, bu yuzden oturum kontrolu gerekmez.
export async function loadMoreCatalog(query: string, offset: number) {
  const start = Number.isInteger(offset) && offset > 0 ? offset : 0;
  const { entries, automaticCampaigns } = await getCatalogListing(new URLSearchParams(String(query)));
  return {
    items: entries
      .slice(start, start + CATALOG_PAGE_SIZE)
      .map((entry) => toCatalogCardProps(entry, automaticCampaigns)),
    total: entries.length
  };
}
