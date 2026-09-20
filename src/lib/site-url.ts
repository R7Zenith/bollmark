// Sitenin kanonik adresi (sonunda "/" olmadan). Vercel'de SITE_URL env'i birincil
// alan adiyla birebir ayni olmali - www <-> ciplak alan yonlendirmesi iyzico
// callback POST'unu GET'e cevirip bozar (bkz. IYZICO_SANAL_POS_PLANI.md 3/9).
// Env tanimli degilse (ornegin yerel gelistirme) eski sabit adrese duser.
const FALLBACK_SITE_URL = "https://bollmark.com";

export function getSiteUrl(): string {
  const configured = process.env.SITE_URL?.trim();
  return (configured || FALLBACK_SITE_URL).replace(/\/+$/, "");
}
