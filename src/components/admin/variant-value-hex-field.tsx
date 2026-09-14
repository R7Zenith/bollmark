"use client";

import { useRef } from "react";
import { HexSuggestButton } from "@/components/admin/hex-suggest-button";

export function VariantValueHexField({
  name,
  colorName,
  defaultValue
}: {
  name: string;
  colorName: string;
  defaultValue: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-1.5">
      <input
        ref={inputRef}
        type="color"
        name={name}
        defaultValue={defaultValue}
        className="h-7 w-9 cursor-pointer rounded border border-admin-border p-0.5"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      />
      <HexSuggestButton
        getName={() => colorName}
        onSuggest={(hex) => {
          if (!inputRef.current) return;
          inputRef.current.value = hex;
          inputRef.current.form?.requestSubmit();
        }}
      />
    </div>
  );
}
