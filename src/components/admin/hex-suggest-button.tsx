"use client";

import { useRef, useState } from "react";
import { Wand2 } from "lucide-react";
import { suggestHexFromName } from "@/lib/color-name-suggest";

export function HexSuggestButton({
  getName,
  onSuggest,
  disabled = false
}: {
  getName: () => string;
  onSuggest: (hex: string) => void;
  disabled?: boolean;
}) {
  const [warning, setWarning] = useState(false);
  const warningTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleClick() {
    const name = getName();
    const hex = suggestHexFromName(name);
    if (hex) {
      setWarning(false);
      onSuggest(hex);
      return;
    }
    setWarning(true);
    if (warningTimeout.current) clearTimeout(warningTimeout.current);
    warningTimeout.current = setTimeout(() => setWarning(false), 4000);
  }

  return (
    <div className="relative flex items-center">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className="flex shrink-0 items-center gap-1 rounded border border-admin-border px-2 py-1 text-xs font-medium text-admin-text-muted hover:bg-admin-bg hover:text-admin-text disabled:opacity-30 disabled:pointer-events-none"
      >
        <Wand2 size={12} /> Hex Oluştur
      </button>
      {warning && (
        <span className="absolute left-0 top-full z-10 mt-1 w-max max-w-[220px] rounded border border-admin-border bg-admin-surface px-2 py-1 text-xs text-admin-text-muted shadow-sm">
          Bu renk için öneri bulunamadı, paletten seçin
        </span>
      )}
    </div>
  );
}
