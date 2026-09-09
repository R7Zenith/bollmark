"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/admin/button";
import { useToast } from "@/components/admin/toast";

async function bulkRequest(body: Record<string, unknown>) {
  const res = await fetch("/api/admin/siparisler/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, error: data?.error as string | undefined };
}

export function OrderDeleteButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleDelete() {
    if (!window.confirm("Bu siparişi silmek istediğinize emin misiniz?")) return;
    setPending(true);
    const { ok, error } = await bulkRequest({ ids: [orderId], action: "DELETE" });
    setPending(false);
    if (ok) {
      showToast("Sipariş silindi.", "success");
      router.push("/admin/siparisler");
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  return (
    <Button type="button" variant="danger" size="sm" onClick={handleDelete} disabled={pending}>
      Sil
    </Button>
  );
}

export function OrderRestoreButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleRestore() {
    setPending(true);
    const { ok, error } = await bulkRequest({ ids: [orderId], action: "RESTORE" });
    setPending(false);
    if (ok) {
      showToast("Sipariş geri yüklendi.", "success");
      router.refresh();
    } else {
      showToast(error ?? "Bir hata oluştu.", "error");
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={handleRestore} disabled={pending}>
      Geri Yükle
    </Button>
  );
}
