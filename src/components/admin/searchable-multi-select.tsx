"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";

export type SearchableOption = {
  id: string;
  value: string;
  hexColor?: string | null;
};

function normalize(text: string): string {
  return text.toLocaleLowerCase("tr-TR");
}

function OptionDot({ hexColor }: { hexColor: string }) {
  return (
    <span
      className="h-3.5 w-3.5 shrink-0 rounded-full border border-admin-border"
      style={{ backgroundColor: hexColor }}
    />
  );
}

// Aranabilir, coklu secimli combobox. Buyuk deger listelerinde (ornegin 20+ beden)
// duz buton listesinin yerini alir; secim mantigi disariya (selectedIds/onToggle) birakilir.
export function SearchableMultiSelect({
  options,
  selectedIds,
  onToggle,
  placeholder = "Ara veya seç..."
}: {
  options: SearchableOption[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const trimmed = query.trim();
  const filtered = trimmed
    ? options.filter((o) => normalize(o.value).includes(normalize(trimmed)))
    : options;

  useEffect(() => {
    setActiveIndex(0);
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[activeIndex];
      if (opt) onToggle(opt.id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const selectedOptions = options.filter((o) => selectedIds.has(o.id));

  return (
    <div ref={containerRef} className="relative">
      <div className="flex flex-wrap items-center gap-1.5 rounded border border-admin-border bg-admin-surface px-2 py-1.5 focus-within:border-admin-accent focus-within:ring-1 focus-within:ring-admin-accent">
        {selectedOptions.map((opt) => (
          <span
            key={opt.id}
            className="flex items-center gap-1 rounded-full border border-admin-accent bg-indigo-50 px-2 py-0.5 text-xs text-admin-accent"
          >
            {opt.hexColor && <OptionDot hexColor={opt.hexColor} />}
            {opt.value}
            <button
              type="button"
              onClick={() => onToggle(opt.id)}
              className="ml-0.5 text-admin-accent hover:text-red-600"
              aria-label={`${opt.value} kaldır`}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={selectedOptions.length === 0 ? placeholder : ""}
          className="min-w-[6rem] flex-1 bg-transparent text-sm text-admin-text outline-none"
        />
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded border border-admin-border bg-admin-surface shadow-lg">
          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-sm text-admin-text-muted">Eşleşen değer yok.</p>
          ) : (
            filtered.map((opt, index) => {
              const isSelected = selectedIds.has(opt.id);
              return (
                <button
                  key={opt.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onToggle(opt.id)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm ${
                    index === activeIndex ? "bg-admin-bg" : ""
                  } ${isSelected ? "text-admin-accent" : "text-admin-text"}`}
                >
                  {opt.hexColor && <OptionDot hexColor={opt.hexColor} />}
                  <span className="flex-1">{opt.value}</span>
                  {isSelected && <Check size={14} />}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
