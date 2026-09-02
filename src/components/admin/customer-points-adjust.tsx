"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

export function CustomerPointsAdjust({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [points, setPoints] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = Math.trunc(Number(points));
    if (!value) {
      setError("Geçerli bir puan miktarı girin.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/musteriler/puan-duzelt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, points: value, note: note.trim() || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "İşlem başarısız.");
        return;
      }
      setOpen(false);
      setPoints("");
      setNote("");
      router.refresh();
    } catch {
      setError("Bir sorun oluştu, tekrar deneyin.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 rounded-md p-1.5 text-admin-text-muted hover:bg-admin-bg"
        title="Puan Ekle/Çıkar"
      >
        <Plus size={15} />
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="number"
        value={points}
        onChange={(e) => setPoints(e.target.value)}
        placeholder="+/-"
        autoFocus
        className="w-16 rounded-md border border-admin-border px-2 py-1 text-xs focus:border-admin-accent focus:outline-none"
      />
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Not"
        className="w-24 rounded-md border border-admin-border px-2 py-1 text-xs focus:border-admin-accent focus:outline-none"
      />
      <button type="submit" disabled={submitting} className="rounded-md bg-admin-accent px-2 py-1 text-xs text-white hover:bg-indigo-700">
        Kaydet
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-xs text-admin-text-muted hover:text-admin-text">
        Vazgeç
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </form>
  );
}
