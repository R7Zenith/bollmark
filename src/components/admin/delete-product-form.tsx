"use client";

export function DeleteProductForm({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Bu ürünü silmek istediğinize emin misiniz? Bu işlem geri alınamaz.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded-md border border-red-600 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white">
        Ürünü Sil
      </button>
    </form>
  );
}
