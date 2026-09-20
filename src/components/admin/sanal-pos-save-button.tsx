"use client";

// Ayar formunu kaydeden buton. Mod "Canli"ya cevriliyorsa (su an kayitli mod
// Canli degilken) gercek musteri odemesi acilacagi icin onay penceresi sorar.
export function SanalPosSaveButton({ currentMode }: { currentMode: string }) {
  return (
    <button
      type="submit"
      className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
      onClick={(e) => {
        const form = e.currentTarget.form;
        const selectedMode = form ? new FormData(form).get("mode") : null;
        if (selectedMode === "LIVE" && currentMode !== "LIVE") {
          const confirmed = window.confirm(
            "Sanal POS CANLI moda alınacak. Bundan sonra müşterilerin kartından gerçek para çekilir. Devam edilsin mi?"
          );
          if (!confirmed) e.preventDefault();
        }
      }}
    >
      Ayarları Kaydet
    </button>
  );
}
