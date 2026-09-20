"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Pano erisimi yoksa kullanici metni elle secip kopyalayabilir.
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="inline-flex flex-shrink-0 items-center gap-1.5 rounded-md border border-admin-border px-2.5 py-1.5 text-xs font-medium text-admin-text hover:bg-admin-bg"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Kopyalandı" : "Kopyala"}
    </button>
  );
}
