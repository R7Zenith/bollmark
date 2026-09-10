"use client";

function dispatch(open: boolean) {
  window.dispatchEvent(new CustomEvent("varyant-ozellikleri:hepsi", { detail: { open } }));
}

export function VariantAttributesToggleAll() {
  return (
    <div className="flex items-center gap-3 text-xs">
      <button type="button" onClick={() => dispatch(true)} className="text-admin-accent hover:underline">
        Tümünü Aç
      </button>
      <button type="button" onClick={() => dispatch(false)} className="text-admin-accent hover:underline">
        Tümünü Kapat
      </button>
    </div>
  );
}
