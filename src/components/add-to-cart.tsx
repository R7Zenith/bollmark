"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { effectivePrice } from "@/lib/variant";

type Variant = {
  id: string;
  size: string;
  color: string;
  stock: number;
  priceCents: number | null;
};

export function AddToCart({
  productId,
  name,
  priceCents,
  image,
  variants
}: {
  productId: string;
  name: string;
  priceCents: number;
  image: string;
  variants: Variant[];
}) {
  const { addLine } = useCart();
  const router = useRouter();
  const sizes = Array.from(new Set(variants.map((v) => v.size)));
  const colors = Array.from(new Set(variants.map((v) => v.color)));
  const [size, setSize] = useState(sizes[0] ?? "");
  const [color, setColor] = useState(colors[0] ?? "");
  const [added, setAdded] = useState(false);

  const selected = variants.find((v) => v.size === size && v.color === color);
  const outOfStock = !selected || selected.stock <= 0;
  // Varyantin kendi fiyati varsa o kullanilir, yoksa urunun genel fiyatina duser
  const selectedPriceCents = selected ? effectivePrice({ priceCents }, selected) : priceCents;

  const handleAdd = () => {
    if (!selected || outOfStock) return;
    addLine({
      productId,
      variantId: selected.id,
      name,
      size,
      color,
      priceCents: selectedPriceCents,
      image,
      quantity: 1
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1800);
  };

  return (
    <div className="mt-8 space-y-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-ink/60">Renk</p>
        <div className="mt-2 flex gap-2">
          {colors.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`border px-4 py-2 text-sm ${
                color === c ? "border-ink bg-ink text-paper" : "border-line"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-ink/60">Beden</p>
        <div className="mt-2 flex gap-2">
          {sizes.map((s) => (
            <button
              key={s}
              onClick={() => setSize(s)}
              className={`border px-4 py-2 text-sm ${
                size === s ? "border-ink bg-ink text-paper" : "border-line"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleAdd}
        disabled={outOfStock}
        className="w-full bg-ink py-4 text-sm uppercase tracking-widest2 text-paper transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
      >
        {outOfStock ? "Stokta Yok" : added ? "Sepete Eklendi ✓" : `Sepete Ekle · ${formatPrice(selectedPriceCents)}`}
      </button>

      {added && (
        <button
          onClick={() => router.push("/sepet")}
          className="w-full border border-ink py-3 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
        >
          Sepete Git
        </button>
      )}
    </div>
  );
}
