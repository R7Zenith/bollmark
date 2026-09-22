"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";

export type CouponResult = { discountCents: number; freeShipping: boolean; appliedName: string | null } | null;

// Sepet ve odeme sayfalarinin ikisinde de kullanilan "indirim kodu" alani -
// kod cart context'te (localStorage) tutulur, burada sadece dogrulanip
// gosterilir. Bu ONIZLEME amaclidir, baglayici degildir - nihai/gecerli
// hesaplama siparis olusturulurken orders/route.ts icinde sunucuda tekrar
// yapilir (bkz. lib/coupons.ts). Kod hic girilmemis olsa bile sepete uyan
// aktif bir OTOMATIK kampanya varsa yine burada gosterilir - bu yuzden
// dogrula her zaman (kod bos olsa dahi) cagrilir.
export function CouponField({
  onDiscountChange,
  variant = "default"
}: {
  onDiscountChange: (result: CouponResult) => void;
  /** "segmented": odeme sayfasinin birlesik input+buton gorunumu icin - sepet sayfasindaki varsayilan stili etkilemez. */
  variant?: "default" | "segmented";
}) {
  const { lines, couponCode, setCouponCode } = useCart();
  const [input, setInput] = useState(couponCode ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "applied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const checkDiscount = async (code: string, isExplicitApply: boolean) => {
    if (lines.length === 0) return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/kuponlar/dogrula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          lines: lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }))
        })
      });
      const data = await res.json();
      if (!data.valid) {
        setStatus(isExplicitApply ? "error" : "idle");
        setMessage(isExplicitApply ? data.message ?? "Kupon geçersiz." : null);
        onDiscountChange(null);
        return;
      }
      setStatus(code.trim() ? "applied" : "idle");
      setMessage(data.message ?? null);
      if (isExplicitApply) setCouponCode(code.trim().toUpperCase());
      onDiscountChange({
        discountCents: data.discountCents,
        freeShipping: data.freeShipping,
        appliedName: data.appliedName ?? null
      });
    } catch {
      if (isExplicitApply) {
        setStatus("error");
        setMessage("Kupon kontrol edilemedi, tekrar deneyin.");
      }
      onDiscountChange(null);
    }
  };

  // Sayfa acildiginda veya sepet icerigi degistiginde her zaman yeniden
  // sorgulanir - sepette daha once uygulanmis bir kod tasindiysa onunla,
  // yoksa bos kodla (sadece otomatik kampanyalari yakalamak icin).
  useEffect(() => {
    if (lines.length > 0) {
      checkDiscount(couponCode ?? "", false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines]);

  const handleRemove = () => {
    setCouponCode(null);
    setInput("");
    setStatus("idle");
    setMessage(null);
    checkDiscount("", false);
  };

  const segmented = variant === "segmented";

  return (
    <div className="space-y-2">
      <div className={segmented ? "flex" : "flex gap-2"}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="İndirim kodu"
          className={
            segmented
              ? "w-full rounded-l-xl border border-r-0 border-line px-4 py-3.5 text-sm uppercase focus:border-ink focus:outline-none"
              : "w-full border border-line px-3 py-2 text-sm uppercase focus:border-ink focus:outline-none"
          }
        />
        {couponCode ? (
          <button
            type="button"
            onClick={handleRemove}
            className={
              segmented
                ? "shrink-0 rounded-r-xl border border-l-0 border-line bg-ink/5 px-4 py-3.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-cream"
                : "shrink-0 border border-line px-4 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream"
            }
          >
            Kaldır
          </button>
        ) : (
          <button
            type="button"
            onClick={() => checkDiscount(input, true)}
            disabled={status === "loading"}
            className={
              segmented
                ? "shrink-0 rounded-r-xl border border-l-0 border-line bg-ink/5 px-4 py-3.5 text-sm font-semibold uppercase tracking-wide hover:bg-ink hover:text-cream disabled:opacity-40"
                : "shrink-0 border border-ink px-4 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-cream disabled:opacity-40"
            }
          >
            Uygula
          </button>
        )}
      </div>
      {message && <p className={`text-sm ${status === "error" ? "text-red-600" : "text-ink/70"}`}>{message}</p>}
    </div>
  );
}
