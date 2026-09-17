"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Minus, Plus, X } from "lucide-react";
import { useCart } from "@/lib/cart";
import { formatPrice } from "@/lib/format";
import { useAutomaticDiscount } from "@/lib/use-automatic-discount";

// MobileMenu'deki (site-header.tsx) ile ayni mount/visible iki asamali
// pattern - `open` false olur olmaz DOM'dan kaldirmiyoruz, transform
// transition'inin (450ms) gercekten oynamasi icin bir sonraki frame'de
// `visible`'i true'ya cekiyoruz.
export function CartDrawer() {
  const { lines, removeLine, updateQuantity, totalCents, totalCount, isDrawerOpen, closeDrawer } = useCart();
  const { discountCents: automaticDiscountCents, appliedName } = useAutomaticDiscount(lines);
  const [mounted, setMounted] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isDrawerOpen) {
      setShouldRender(true);
      document.body.style.overflow = "hidden";
    } else {
      setVisible(false);
      document.body.style.overflow = "";
      const timeout = setTimeout(() => setShouldRender(false), 450);
      return () => clearTimeout(timeout);
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isDrawerOpen]);

  useEffect(() => {
    if (!shouldRender) return;
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [shouldRender]);

  if (!shouldRender || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[800]">
      <button
        type="button"
        aria-label="Sepeti kapat"
        className={`absolute inset-0 bg-black/50 ${visible ? "" : "invisible"}`}
        onClick={closeDrawer}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Sepetim"
        className={`absolute inset-y-0 right-0 z-[801] flex h-full w-[36rem] max-w-full flex-col bg-cream transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)] ${
          visible ? "visible translate-x-0" : "invisible translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5">
          <p className="text-[36px] font-normal leading-[36px] tracking-[-1.44px]">
            Sepetim <span className="align-top text-[21px] leading-[21px] tracking-[-0.84px]">{totalCount}</span>
          </p>
          <button type="button" aria-label="Kapat" onClick={closeDrawer} className="p-1">
            <X size={20} strokeWidth={1.5} />
          </button>
        </div>

        {lines.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
            <p className="text-[61px] font-normal leading-[61px]">
              Biraz <em className="font-accent text-[73.2px] italic font-normal">boş</em> görünüyor
            </p>
            <p className="mt-3 text-[14px] leading-[17.5px] tracking-[0.28px] text-ink/60">Sepetiniz şu anda boş.</p>
            <Link
              href="/urunler"
              onClick={closeDrawer}
              className="mt-8 flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] leading-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
            >
              Alışverişe Başla
            </Link>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-line px-6">
            {lines.map((line) => (
              <div key={line.variantId} className="flex gap-4 py-6">
                <div className="relative h-[120px] w-[90px] flex-shrink-0 overflow-hidden bg-line">
                  <Image src={line.image} alt={line.name} fill className="object-cover" />
                </div>
                <div className="flex flex-1 flex-col">
                  <p className="text-xs font-semibold uppercase tracking-[0.24px]">{line.name}</p>
                  <p className="mt-1 text-xs text-ink/75">{line.color} · {line.size}</p>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex h-[46px] items-center justify-between rounded-full border border-line px-1">
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variantId, line.quantity - 1)}
                        disabled={line.quantity <= 1}
                        aria-label="Adedi azalt"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 hover:bg-line disabled:opacity-30"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-6 text-center text-sm">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => updateQuantity(line.variantId, line.quantity + 1)}
                        aria-label="Adedi artır"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition duration-300 hover:bg-line"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeLine(line.variantId)}
                      className="text-xs uppercase text-ink/50 hover:text-clay"
                    >
                      Kaldır
                    </button>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <p className={`text-sm font-medium ${line.compareAtCents ? "text-sale" : ""}`}>
                    {formatPrice(line.priceCents * line.quantity)}
                  </p>
                  {line.compareAtCents && (
                    <p className="text-xs text-ink/40 line-through">
                      {formatPrice(line.compareAtCents * line.quantity)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {lines.length > 0 && (
          <div className="border-t border-line px-6 py-6">
            <div className="flex items-center justify-between text-[21px] tracking-[-0.84px]">
              <span>Ara Toplam</span>
              <span className="font-semibold tracking-[0.2px]">{formatPrice(totalCents)}</span>
            </div>
            {automaticDiscountCents > 0 && (
              <div className="mt-2 flex items-center justify-between text-sm text-clay">
                <span>{appliedName ? `İndirim (${appliedName})` : "İndirim"}</span>
                <span>-{formatPrice(automaticDiscountCents)}</span>
              </div>
            )}
            {automaticDiscountCents > 0 && (
              <div className="mt-2 flex items-center justify-between text-[21px] tracking-[-0.84px]">
                <span>Toplam</span>
                <span className="font-semibold tracking-[0.2px]">
                  {formatPrice(totalCents - automaticDiscountCents)}
                </span>
              </div>
            )}
            <div className="mt-6 flex gap-3">
              <Link
                href="/sepet"
                onClick={closeDrawer}
                className="flex h-[44px] flex-1 items-center justify-center rounded-[50px] border border-ink text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream"
              >
                Sepeti Görüntüle
              </Link>
              <Link
                href="/odeme"
                onClick={closeDrawer}
                className="flex h-[44px] flex-1 items-center justify-center rounded-[50px] border border-ink bg-ink text-[10px] uppercase tracking-[1px] text-cream transition duration-300 hover:bg-transparent hover:text-ink"
              >
                Ödemeye Geç
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
