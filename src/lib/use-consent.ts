"use client";

import { useMemo, useSyncExternalStore } from "react";
import { CONSENT_CHANGE_EVENT, parseConsent, readConsentCookie, type StoredConsent } from "@/lib/consent";

function subscribe(onChange: () => void) {
  window.addEventListener(CONSENT_CHANGE_EVENT, onChange);
  return () => window.removeEventListener(CONSENT_CHANGE_EVENT, onChange);
}

// consent: gecerli tercih (yoksa null). ready: istemcide cerez okundu mu -
// sunucuda ve hidrasyon sirasinda false (bant SSR'da hic render edilmez).
export function useConsent(): { consent: StoredConsent | null; ready: boolean } {
  const raw = useSyncExternalStore<string | null>(subscribe, readConsentCookie, () => null);
  const consent = useMemo(() => (raw === null ? null : parseConsent(raw)), [raw]);
  return { consent, ready: raw !== null };
}
