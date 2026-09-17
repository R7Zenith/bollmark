export type ProductBadgeVariant = "discount" | "low-stock" | "new";
export type ProductBadgeSize = "sm" | "lg";

// Release'in canli urun sayfasindan (release-main.myshopify.com/products/top-13)
// Playwright ile computed style olarak birebir olculdu (17 Eylul 2026):
// font-size 10px, font-weight 500, letter-spacing 1.4px, uppercase,
// padding 6px 8px, border-radius 4px, line-height 12.5px - katalog kartinda
// (collections/all) ve urun detay sayfasinda AYNI, tek fark renk (asagida).
const baseClasses = "whitespace-nowrap rounded px-2 py-1.5 text-[10px] font-medium uppercase leading-[12.5px] tracking-[1.4px]";

// Indirim rozeti her yerde kirmizi/beyaz (bg-badge-sale). Indirim disi rozetler
// ("last few"/"New" karsiligi) Release'de baglama gore degisiyor: katalog
// kartinda (collections/all) beyaz zemin + siyah yazi, urun detay sayfasinda
// (PDP) koyu gri (#5E5A59) zemin + beyaz yazi - bu ikisi Release'in kendisinde
// de boyle farkli, tahmin degil olculmus veri.
const colorClasses: Record<ProductBadgeVariant, Record<ProductBadgeSize, string>> = {
  discount: { sm: "bg-badge-sale text-white", lg: "bg-badge-sale text-white" },
  "low-stock": { sm: "bg-white text-ink", lg: "bg-badge-dark text-white" },
  new: { sm: "bg-white text-ink", lg: "bg-badge-dark text-white" }
};

export function ProductBadge({
  variant,
  size = "sm",
  children
}: {
  variant: ProductBadgeVariant;
  size?: ProductBadgeSize;
  children: React.ReactNode;
}) {
  return <span className={`${baseClasses} ${colorClasses[variant][size]}`}>{children}</span>;
}
