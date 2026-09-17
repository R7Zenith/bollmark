export type ProductBadgeVariant = "discount" | "low-stock";
export type ProductBadgeSize = "sm" | "lg";

const sizeClasses: Record<ProductBadgeSize, string> = {
  sm: "px-1.5 py-1 text-[9px] leading-[11px] tracking-[1.2px] sm:px-2 sm:py-1.5 sm:text-[10px] sm:leading-[12.5px] sm:tracking-[1.4px]",
  lg: "px-2.5 py-1.5 text-[11px] leading-[13px] tracking-[1.4px] sm:text-[12px] sm:leading-[14px]"
};

// Indirim rozeti her zaman kirmizi (bg-sale) - katalogdakiyle ayni, kullanicinin
// tercihiyle koyu/siyaha cevrilmedi. Dusuk stok rozeti ise boyuta gore degisir:
// "sm" katalog kartindaki mevcut beyaz zeminle ayni kalir, "lg" (urun detay
// sayfasi) release'deki koyu rozet gorunumune yaklastirmak icin bg-ink kullanir.
const variantClasses: Record<ProductBadgeVariant, Record<ProductBadgeSize, string>> = {
  discount: { sm: "bg-sale text-white", lg: "bg-sale text-cream" },
  "low-stock": { sm: "bg-white text-ink", lg: "bg-ink text-cream" }
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
  return (
    <span
      className={`whitespace-nowrap rounded font-medium uppercase ${sizeClasses[size]} ${variantClasses[variant][size]}`}
    >
      {children}
    </span>
  );
}
