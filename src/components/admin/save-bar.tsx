"use client";

import { useEffect, useRef, useState } from "react";

export function SaveBar({ formId }: { formId: string }) {
  const [dirty, setDirty] = useState(false);
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!(form instanceof HTMLFormElement)) return;
    formRef.current = form;

    const handleChange = () => setDirty(true);
    form.addEventListener("input", handleChange);
    form.addEventListener("change", handleChange);
    return () => {
      form.removeEventListener("input", handleChange);
      form.removeEventListener("change", handleChange);
    };
  }, [formId]);

  if (!dirty) return null;

  return (
    <div className="sticky bottom-4 z-40 mt-6 flex items-center justify-between rounded-lg border border-admin-accent bg-admin-surface px-5 py-3 shadow-lg">
      <p className="text-sm font-medium text-admin-text">Kaydedilmemiş değişiklikler var</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            formRef.current?.reset();
            setDirty(false);
          }}
          className="rounded-md border border-admin-border px-4 py-2 text-sm font-medium text-admin-text hover:bg-admin-bg"
        >
          Vazgeç
        </button>
        <button
          type="submit"
          form={formId}
          className="rounded-md bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          Kaydet
        </button>
      </div>
    </div>
  );
}
