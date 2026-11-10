"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/admin/button";

// "Durumu şimdi sorgula": Yurtici ayni sorguyu 1 dakikada bir kabul ettigi icin
// son sorgudan sonra 60 sn pasif kalir, kalan sure butonda yazar.
export function YurticiSyncButton({ remainingMs }: { remainingMs: number }) {
  const [left, setLeft] = useState(Math.ceil(remainingMs / 1000));

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  return (
    <Button type="submit" variant="secondary" size="sm" disabled={left > 0} className="tabular-nums">
      {left > 0 ? `Tekrar sorgulamak için ${left} sn` : "Durumu şimdi sorgula"}
    </Button>
  );
}
