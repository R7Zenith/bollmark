"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

function storageKey(attributeId: string) {
  return `varyant-ozellik-acik:${attributeId}`;
}

export function VariantAttributeCard({
  attributeId,
  title,
  valueCount,
  action,
  children,
  className = ""
}: {
  attributeId: string;
  title: React.ReactNode;
  valueCount: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(valueCount <= 6);
  const contentId = `varyant-ozellik-icerik-${attributeId}`;

  useEffect(() => {
    const stored = window.localStorage.getItem(storageKey(attributeId));
    if (stored !== null) {
      setOpen(stored === "1");
    }
    // Sadece ilk mount'ta localStorage'dan oku; attributeId degismedigi surece tekrar calismasin.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function handleToggleAll(e: Event) {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      setOpen(detail.open);
      window.localStorage.setItem(storageKey(attributeId), detail.open ? "1" : "0");
    }
    window.addEventListener("varyant-ozellikleri:hepsi", handleToggleAll);
    return () => window.removeEventListener("varyant-ozellikleri:hepsi", handleToggleAll);
  }, [attributeId]);

  function toggle() {
    const next = !open;
    setOpen(next);
    window.localStorage.setItem(storageKey(attributeId), next ? "1" : "0");
  }

  return (
    <div className={`rounded-lg border border-admin-border bg-admin-surface ${className}`}>
      <div className="flex items-center justify-between border-b border-admin-border px-5 py-4">
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={contentId}
          className="flex flex-1 items-center gap-2 text-left"
        >
          {open ? (
            <ChevronDown size={16} className="shrink-0 text-admin-text-muted" />
          ) : (
            <ChevronRight size={16} className="shrink-0 text-admin-text-muted" />
          )}
          <h2 className="text-sm font-semibold text-admin-text">{title}</h2>
          <span className="text-xs text-admin-text-muted">{valueCount} değer</span>
        </button>
        {action && (
          <div onClick={(e) => e.stopPropagation()} className="shrink-0">
            {action}
          </div>
        )}
      </div>
      {open && (
        <div id={contentId} className="p-5">
          {children}
        </div>
      )}
    </div>
  );
}
