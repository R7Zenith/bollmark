"use client";

import { openConsentPreferences } from "@/lib/consent";

// Sunucu bilesenlerinden (orn. /cerez-politikasi) tercih panelini acmak icin.
export function ConsentPreferencesButton({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={openConsentPreferences} className={className}>
      {children}
    </button>
  );
}
