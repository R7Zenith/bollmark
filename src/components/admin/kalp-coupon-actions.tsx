"use client";

import { useState } from "react";
import { Button } from "@/components/admin/button";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-1.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function KalpCouponActions({
  id,
  customerId,
  code,
  expiresLabel,
  defaultExpiry,
  cancelAction,
  extendAction
}: {
  id: string;
  customerId: string;
  code: string;
  expiresLabel: string;
  defaultExpiry: string;
  cancelAction: (formData: FormData) => void;
  extendAction: (formData: FormData) => void;
}) {
  const [open, setOpen] = useState<"cancel" | "extend" | null>(null);
  const titleId = `kalp-kupon-${id}`;
  const hidden = (
    <>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="customerId" value={customerId} />
    </>
  );

  return (
    <>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen("extend")}>
          Süre uzat
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={() => setOpen("cancel")}>
          İptal et
        </Button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <div className="w-full max-w-sm rounded-lg bg-admin-surface p-5 text-left shadow-xl">
            {open === "cancel" ? (
              <>
                <h3 id={titleId} className="text-sm font-semibold text-admin-text">
                  Kuponu iptal et
                </h3>
                <p className="mt-1 text-sm text-admin-text-muted">
                  {code} kuponu iptal edilecek, geri alınamaz. Müşteri bu kuponu artık kullanamaz.
                </p>
                <form action={cancelAction} className="mt-4 flex items-center justify-end gap-2">
                  {hidden}
                  <Button type="button" variant="secondary" size="sm" autoFocus onClick={() => setOpen(null)}>
                    Vazgeç
                  </Button>
                  <Button type="submit" variant="danger" size="sm">
                    Kuponu iptal et
                  </Button>
                </form>
              </>
            ) : (
              <>
                <h3 id={titleId} className="text-sm font-semibold text-admin-text">
                  Kupon süresini uzat
                </h3>
                <p className="mt-1 text-sm text-admin-text-muted">
                  {code} · şu anki bitiş: {expiresLabel}
                </p>
                <form action={extendAction} className="mt-4 space-y-3">
                  {hidden}
                  <label className="block text-xs font-medium text-admin-text">
                    Yeni bitiş (İstanbul saati)
                    <input type="datetime-local" name="expiresAt" required defaultValue={defaultExpiry} className={`mt-1 ${inputClass}`} />
                  </label>
                  <div className="flex items-center justify-end gap-2">
                    <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(null)}>
                      Vazgeç
                    </Button>
                    <Button type="submit" size="sm">
                      Süreyi uzat
                    </Button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
