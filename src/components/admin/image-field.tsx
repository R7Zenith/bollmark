"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";

// Tek bir gorsel icin hem URL yapistirma hem PC'den yukleme sunan ortak bilesen.
// Kucuk onizleme + "Degistir"/"Kaldir" + bir URL metin girisi (blur/enter'da
// onChange tetikler) + dosya yukleme butonu bir arada.
export function ImageField({
  value,
  onChange,
  placeholder = "https://... (gorsel URL'i yapistirin)"
}: {
  value: string;
  onChange: (url: string) => void;
  placeholder?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [urlDraft, setUrlDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUrlDraft(value);
  }, [value]);

  async function handleFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Yükleme başarısız oldu.");
        return;
      }
      setUrlDraft(data.url);
      onChange(data.url);
    } catch {
      setError("Yükleme başarısız oldu.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function commitUrl() {
    const trimmed = urlDraft.trim();
    if (trimmed !== value) onChange(trimmed);
  }

  return (
    <div className="flex items-center gap-2">
      {value ? (
        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded border border-admin-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="" className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => {
              setUrlDraft("");
              onChange("");
            }}
            className="absolute right-0 top-0 rounded-bl bg-black/60 p-0.5 text-white hover:bg-black/80"
            aria-label="Görseli kaldır"
          >
            <X size={10} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded border border-dashed border-admin-border text-admin-text-muted hover:border-admin-accent hover:text-admin-accent disabled:opacity-50"
          aria-label="Görsel yükle"
        >
          {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          value={urlDraft}
          onChange={(e) => setUrlDraft(e.target.value)}
          onBlur={commitUrl}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitUrl();
            }
          }}
          placeholder={placeholder}
          className="w-full rounded border border-admin-border px-2 py-1.5 text-xs focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
        />
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="text-xs text-admin-accent hover:underline disabled:opacity-50"
          >
            {uploading ? "Yükleniyor..." : value ? "Değiştir" : "Bilgisayardan yükle"}
          </button>
          {error && <span className="text-xs text-red-600">{error}</span>}
        </div>
      </div>
    </div>
  );
}
