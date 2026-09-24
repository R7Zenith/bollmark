"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyCodeButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy(e: React.MouseEvent) {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pano erisimi yoksa kullanici kodu elle secip kopyalayabilir.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? "Kopyalandı" : "Kodu Kopyala"}
      aria-label="Kodu Kopyala"
      className="inline-flex -my-1.5 h-7 w-7 items-center justify-center rounded border border-transparent text-admin-text-muted transition-colors hover:border-admin-border hover:bg-admin-bg hover:text-admin-accent md:-my-1 md:h-6 md:w-6"
    >
      {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
    </button>
  );
}
