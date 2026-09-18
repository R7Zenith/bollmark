"use client";

import { useState } from "react";
import { SearchableMultiSelect } from "@/components/admin/searchable-multi-select";
import { PRODUCT_GENDERS } from "@/lib/product-constants";
import type { CategoryOption, BrandOption } from "@/components/admin/coupon-row";

const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";

const genderOptions = PRODUCT_GENDERS.map((g) => ({ id: g, value: g }));

// Kategori/Marka/Cinsiyet kisitlamasi - ucu de coklu secim (bkz.
// searchable-multi-select.tsx). Server action'lı <form>'un FormData'sinda
// gorunmeleri icin secili id'ler gizli input olarak render edilir (her
// secili id icin bir <input type="hidden">), ayni isimle getAll ile okunur
// (bkz. kampanyalar/page.tsx readCouponFields).
export function CouponCategoryBrandGenderFields({
  categories,
  brands,
  defaultCategoryIds,
  defaultBrandIds,
  defaultGenders,
  className
}: {
  categories: CategoryOption[];
  brands: BrandOption[];
  defaultCategoryIds: string[];
  defaultBrandIds: string[];
  defaultGenders: string[];
  className?: string;
}) {
  const [categoryIds, setCategoryIds] = useState(new Set(defaultCategoryIds));
  const [brandIds, setBrandIds] = useState(new Set(defaultBrandIds));
  const [genders, setGenders] = useState(new Set(defaultGenders));

  function toggle(set: Set<string>, setter: (s: Set<string>) => void, id: string) {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  }

  return (
    <div className={`grid grid-cols-1 gap-3 md:grid-cols-3 ${className ?? ""}`}>
      {[...categoryIds].map((id) => (
        <input key={id} type="hidden" name="categoryIds" value={id} />
      ))}
      {[...brandIds].map((id) => (
        <input key={id} type="hidden" name="brandIds" value={id} />
      ))}
      {[...genders].map((g) => (
        <input key={g} type="hidden" name="genders" value={g} />
      ))}
      <div>
        <label className={labelClass}>Kategori</label>
        <div className="mt-1">
          <SearchableMultiSelect
            options={categories.map((c) => ({ id: c.id, value: c.label }))}
            selectedIds={categoryIds}
            onToggle={(id) => toggle(categoryIds, setCategoryIds, id)}
            placeholder="Tüm kategoriler"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Marka</label>
        <div className="mt-1">
          <SearchableMultiSelect
            options={brands.map((b) => ({ id: b.id, value: b.name }))}
            selectedIds={brandIds}
            onToggle={(id) => toggle(brandIds, setBrandIds, id)}
            placeholder="Tüm markalar"
          />
        </div>
      </div>
      <div>
        <label className={labelClass}>Cinsiyet</label>
        <div className="mt-1">
          <SearchableMultiSelect
            options={genderOptions}
            selectedIds={genders}
            onToggle={(id) => toggle(genders, setGenders, id)}
            placeholder="Tüm cinsiyetler"
          />
        </div>
      </div>
    </div>
  );
}
