"use client";

import { useState, useTransition, type ReactNode } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";

// Varyant degerlerini ekranda yukari/asagi tasir; sayfa yenilenmez.
// Sira degisince "Siralamayi Kaydet" ile tek seferde kaydedilir.
export function VariantValueSortList({
  items,
  saveOrder,
  iconBtnClass
}: {
  items: { id: string; content: ReactNode; actions: ReactNode }[];
  saveOrder: (ids: string[]) => Promise<void>;
  iconBtnClass: string;
}) {
  const initial = items.map((i) => i.id);
  const [order, setOrder] = useState(initial);
  const [pending, startTransition] = useTransition();
  const byId = new Map(items.map((i) => [i.id, i]));
  const dirty = order.some((id, i) => id !== initial[i]);

  function move(index: number, delta: number) {
    const next = [...order];
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    setOrder(next);
  }

  return (
    <>
      {order.map((id, index) => {
        const item = byId.get(id)!;
        return (
          <div
            key={id}
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-admin-border px-3 py-2"
          >
            {item.content}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                className={iconBtnClass}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                aria-label="Yukarı taşı"
              >
                <ArrowUp size={13} />
              </button>
              <button
                type="button"
                className={iconBtnClass}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
                aria-label="Aşağı taşı"
              >
                <ArrowDown size={13} />
              </button>
              {item.actions}
            </div>
          </div>
        );
      })}

      {dirty && (
        <div className="sticky bottom-4 z-10 flex items-center justify-end gap-2 rounded-md border border-admin-accent bg-white px-3 py-2 shadow-md">
          <span className="mr-auto text-sm text-admin-text">
            Sıralama değişti, kaydedilmedi.
          </span>
          <button
            type="button"
            disabled={pending}
            onClick={() => setOrder(initial)}
            className="rounded-md border border-admin-border px-3 py-1.5 text-sm text-admin-text hover:bg-admin-bg disabled:opacity-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(() => saveOrder(order))}
            className="rounded-md bg-admin-accent px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pending ? "Kaydediliyor…" : "Sıralamayı Kaydet"}
          </button>
        </div>
      )}
    </>
  );
}
