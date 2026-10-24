import { optionValue, variantOptionsInclude, type VariantOptionInclude } from "@/lib/variant-attributes";
import type { Ga4Item, Ga4Purchase } from "@/lib/meta/track";
import { resolveVatRate, SHIPPING_VAT_RATE, vatFromGrossCents } from "@/lib/vat";

// Google Analytics 4 - sunucu tarafi kararlar (bkz. GA4_KURULUM_PLANI.md). Olay
// gonderimi yalniz tarayicidan (lib/meta/track.ts); Measurement Protocol yok.

// Yalniz production'da; baska ortamlarda (localhost dahil) yalniz
// NEXT_PUBLIC_GA4_DEBUG=true ise debug_mode ile (GA4 DebugView testi).
export function ga4Config(): { measurementId: string; debug: boolean } | null {
  const measurementId = process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;
  if (!measurementId) return null;
  if (process.env.VERCEL_ENV === "production") return { measurementId, debug: false };
  return process.env.NEXT_PUBLIC_GA4_DEBUG === "true" ? { measurementId, debug: true } : null;
}

export const ga4PurchaseOrderSelect = {
  totalCents: true,
  shippingCents: true,
  coupon: { select: { code: true } },
  items: {
    select: {
      variantId: true,
      quantity: true,
      unitPriceCents: true,
      product: {
        select: {
          name: true,
          vatRate: true,
          brand: { select: { name: true } },
          category: { select: { name: true, vatRate: true, parent: { select: { vatRate: true } } } }
        }
      },
      variant: { select: { sku: true, ...variantOptionsInclude } }
    }
  }
} as const;

type Ga4PurchaseOrder = {
  totalCents: number;
  shippingCents: number;
  coupon: { code: string | null } | null;
  items: {
    variantId: string | null;
    quantity: number;
    unitPriceCents: number;
    product: {
      name: string;
      vatRate: number | null;
      brand: { name: string } | null;
      category: { name: string; vatRate: number | null; parent: { vatRate: number | null } | null } | null;
    };
    variant: (VariantOptionInclude & { sku: string }) | null;
  }[];
};

export function ga4PurchaseData(order: Ga4PurchaseOrder): Ga4Purchase {
  const items: Ga4Item[] = order.items.map((item) => ({
    item_id: item.variant?.sku ?? item.variantId ?? "",
    item_name: item.product.name,
    item_brand: item.product.brand?.name,
    item_category: item.product.category?.name,
    item_variant: item.variant
      ? [optionValue(item.variant, "Renk"), optionValue(item.variant, "Beden")].filter(Boolean).join(" / ") || undefined
      : undefined,
    price: item.unitPriceCents / 100,
    quantity: item.quantity
  }));
  // tax: her kalem kendi oraniyla (bkz. lib/vat.ts) KDV dahil satir tutarindan, kargo %20.
  const taxCents =
    order.items.reduce(
      (sum, item) => sum + vatFromGrossCents(item.unitPriceCents * item.quantity, resolveVatRate(item.product)),
      0
    ) + vatFromGrossCents(order.shippingCents, SHIPPING_VAT_RATE);
  return {
    value: order.totalCents / 100,
    tax: Math.round(taxCents) / 100,
    shipping: order.shippingCents / 100,
    coupon: order.coupon?.code ?? undefined,
    items
  };
}
