"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

// Varyant degerinin adini satir icinde duzenler. Yeni ad ayni ozellikteki
// baska bir degerle ayniysa birlestirme onayi istenir (merge=1 gonderilir).
export function VariantValueNameEditor({
  action,
  value,
  siblingValues,
  usageCount,
  iconBtnClass
}: {
  action: (formData: FormData) => void;
  value: string;
  siblingValues: string[];
  usageCount: number;
  iconBtnClass: string;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <div className="flex min-w-[6rem] flex-1 items-center gap-1.5">
        <span className="text-sm text-admin-text">{value}</span>
        <button type="button" className={iconBtnClass} onClick={() => setEditing(true)} aria-label="Adı düzenle">
          <Pencil size={13} />
        </button>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex min-w-[12rem] flex-1 items-center gap-1.5"
      onSubmit={(e) => {
        const form = e.currentTarget;
        const next = String(new FormData(form).get("value") || "").trim();
        const merge = form.elements.namedItem("merge") as HTMLInputElement;
        merge.value = "";
        if (next === value || !siblingValues.includes(next)) return;
        const ok = window.confirm(
          `"${next}" adında bir değer zaten var. İkisini birleştirelim mi?\n\n"${value}" değerini kullanan ${usageCount} varyant "${next}" değerine taşınır ve "${value}" silinir.`
        );
        if (!ok) {
          e.preventDefault();
          return;
        }
        merge.value = "1";
      }}
    >
      <input
        name="value"
        defaultValue={value}
        required
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
        }}
        className="w-full rounded-md border border-admin-border px-2 py-1 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
      />
      <input type="hidden" name="merge" defaultValue="" />
      <button className="shrink-0 rounded-md bg-admin-accent px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700">
        Kaydet
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="shrink-0 rounded-md border border-admin-border px-2.5 py-1 text-xs font-medium text-admin-text hover:bg-admin-bg"
      >
        Vazgeç
      </button>
    </form>
  );
}
