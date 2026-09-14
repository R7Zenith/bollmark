"use client";

import { useRef, useState } from "react";
import { HexSuggestButton } from "@/components/admin/hex-suggest-button";

const inputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export function VariantValueCreateFields({ isColorAttribute }: { isColorAttribute: boolean }) {
  const nameRef = useRef<HTMLInputElement>(null);
  const colorRef = useRef<HTMLInputElement>(null);
  const [nameEmpty, setNameEmpty] = useState(true);

  return (
    <>
      <input
        ref={nameRef}
        name="value"
        placeholder="Yeni değer"
        required
        className={inputClass}
        onChange={(e) => setNameEmpty(!e.currentTarget.value.trim())}
      />
      {isColorAttribute && (
        <>
          <input
            ref={colorRef}
            type="color"
            name="hexColor"
            defaultValue="#000000"
            className="h-9 w-11 cursor-pointer rounded border border-admin-border p-0.5"
          />
          <HexSuggestButton
            disabled={nameEmpty}
            getName={() => nameRef.current?.value ?? ""}
            onSuggest={(hex) => {
              if (colorRef.current) colorRef.current.value = hex;
            }}
          />
        </>
      )}
    </>
  );
}
