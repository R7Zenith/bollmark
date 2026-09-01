"use client";

import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";

export type CouponResult = { discountCents: number; freeShipping: boolean } | null;

// Sepet ve odeme sayfalarinin ikisinde de kullanilan "indirim kodu" alani -
// kod cart context'te (localStorage) tutulur, burada sadece dogrulanip
// gosterilir. Bu ONIZLEME amaclidir, baglayici degildir - nihai/gecerli
// hesaplama siparis olusturulurken orders/route.ts icinde sunucuda tekrar
// yapilir (bkz. lib/coupons.ts).
export function CouponField({
  subtotalCents,
  onDiscountChange
}: {
  subtotalCents: number;
  onDiscountChange: (result: CouponResult) => void;
}) {
  const { couponCode, setCouponCode } = useCart();
  const [input, setInput] = useState(couponCode ?? "");
  const [status, setStatus] = useState<"idle" | "loading" | "applied" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const applyCode = async (code: string) => {
    if (!code.trim()) return;
    setStatus("loading");
    setMessage(null);
    try {
      const res = await fetch("/api/kuponlar/dogrula", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotalCents })
      });
      const data = await res.json();
      if (!data.valid) {
        setStatus("error");
        setMessage(data.message ?? "Kupon geçersiz.");
        onDiscountChange(null);
        return;
      }
      setStatus("applied");
      setMessage(data.message ?? "Kupon uygulandı.");
      setCouponCode(code.trim().toUpperCase());
      onDiscountChange({ discountCents: data.discountCents, freeShipping: data.freeShipping });
    } catch {
      setStatus("error");
      setMessage("Kupon kontrol edilemedi, tekrar deneyin.");
      onDiscountChange(null);
    }
  };

  // Sepette daha once uygulanmis bir kupon tasindiysa (cart context) sayfa
  // acildiginda veya sepet icerigi degistiginde otomatik yeniden dogrulanir
  // - subtotal degismis olabilir, gecerlilik/tutar guncel kalsin.
  useEffect(() => {
    if (couponCode && subtotalCents > 0) {
      applyCode(couponCode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotalCents]);

  const handleRemove = () => {
    setCouponCode(null);
    setInput("");
    setStatus("idle");
    setMessage(null);
    onDiscountChange(null);
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="İndirim kodu"
          className="w-full border border-line px-3 py-2 text-sm uppercase focus:border-ink focus:outline-none"
        />
        {status === "applied" ? (
          <button
            type="button"
            onClick={handleRemove}
            className="shrink-0 border border-line px-4 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper"
          >
            Kaldır
          </button>
        ) : (
          <button
            type="button"
            onClick={() => applyCode(input)}
            disabled={status === "loading"}
            className="shrink-0 border border-ink px-4 py-2 text-sm uppercase tracking-wide hover:bg-ink hover:text-paper disabled:opacity-40"
          >
            Uygula
          </button>
        )}
      </div>
      {message && <p className={`text-sm ${status === "applied" ? "text-ink/70" : "text-red-600"}`}>{message}</p>}
    </div>
  );
}
