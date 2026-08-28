"use client";

export function DeleteProductForm({ action }: { action: () => void }) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!window.confirm("Bu urunu silmek istediginize emin misiniz? Bu islem geri alinamaz.")) {
          e.preventDefault();
        }
      }}
    >
      <button className="rounded-md border border-red-600 px-5 py-2 text-sm font-medium text-red-600 hover:bg-red-600 hover:text-white">
        Urunu Sil
      </button>
    </form>
  );
}
