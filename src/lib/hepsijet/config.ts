// HepsiJET ortam ayarlari (bkz. docs/planlar/HEPSIJET_ENTEGRASYON_PLANI.md
// bolum 4 ve 6). Degerler yalniz sunucuda okunur; hicbiri istemciye gitmez.
//
// HEPSIJET_MODE: off | mock | test | live. Tanimsiz ya da tanimadik deger = off,
// boylece env eklenmemis bir ortamda (or. Vercel) HepsiJET ogeleri hic gorunmez.

export type HepsijetMode = "off" | "mock" | "test" | "live";

const LIVE_URL = "https://integration.hepsijet.com";
// Dokumandaki tiresiz "integrationapitest" DNS'te yok; tireli olan dogru.
const TEST_URL = "https://integration-apitest.hepsijet.com";

export function getHepsijetMode(): HepsijetMode {
  const raw = (process.env.HEPSIJET_MODE || "").trim().toLowerCase();
  return raw === "mock" || raw === "test" || raw === "live" ? raw : "off";
}

// Mock ve test modunda gercek gonderi olusmaz; admin kartinda uyari seridi cikar.
export function isHepsijetTestMode(mode: HepsijetMode = getHepsijetMode()): boolean {
  return mode === "mock" || mode === "test";
}

// Otomatik takip. HEPSIJET_SYNC=off acil kapatmadir; mod off iken de calismaz.
export function isHepsijetSyncEnabled(): boolean {
  if (getHepsijetMode() === "off") return false;
  return (process.env.HEPSIJET_SYNC || "on").trim().toLowerCase() !== "off";
}

// Gonderi payload'ina giren sabit firma/adres bilgileri (HepsiJET'in yazdigi gibi).
export type HepsijetCompanyInfo = {
  companyName: string;
  companyCode: string;
  deliveryPrefix: string;
  sender: {
    addressId: string;
    city: string;
    town: string;
    district: string;
    addressLine: string;
  };
  xdockCode: string;
};

export type HepsijetConnection = {
  baseUrl: string;
  username: string;
  password: string;
};

function required(names: string[]): Record<string, string> {
  const values: Record<string, string> = {};
  const missing: string[] = [];
  for (const name of names) {
    const value = (process.env[name] || "").trim();
    if (!value) missing.push(name);
    values[name] = value;
  }
  if (missing.length) throw new Error(`HepsiJET ayarı eksik: ${missing.join(", ")}`);
  return values;
}

// Yalniz test/live icin. Mock ve off modunda cagrilmaz.
export function getHepsijetConnection(mode: HepsijetMode = getHepsijetMode()): HepsijetConnection {
  if (mode !== "test" && mode !== "live") throw new Error(`HepsiJET bağlantısı ${mode} modunda kullanılamaz.`);
  const v = required(["HEPSIJET_USERNAME", "HEPSIJET_PASSWORD"]);
  return { baseUrl: mode === "live" ? LIVE_URL : TEST_URL, username: v.HEPSIJET_USERNAME, password: v.HEPSIJET_PASSWORD };
}

export function getHepsijetCompanyInfo(): HepsijetCompanyInfo {
  const v = required([
    "HEPSIJET_COMPANY_NAME",
    "HEPSIJET_COMPANY_CODE",
    "HEPSIJET_DELIVERY_PREFIX",
    "HEPSIJET_SENDER_ADDRESS_ID",
    "HEPSIJET_SENDER_CITY",
    "HEPSIJET_SENDER_TOWN",
    "HEPSIJET_SENDER_DISTRICT",
    "HEPSIJET_SENDER_ADDRESS_LINE",
    "HEPSIJET_XDOCK_CODE"
  ]);
  return {
    companyName: v.HEPSIJET_COMPANY_NAME,
    companyCode: v.HEPSIJET_COMPANY_CODE,
    deliveryPrefix: v.HEPSIJET_DELIVERY_PREFIX,
    sender: {
      addressId: v.HEPSIJET_SENDER_ADDRESS_ID,
      city: v.HEPSIJET_SENDER_CITY,
      town: v.HEPSIJET_SENDER_TOWN,
      district: v.HEPSIJET_SENDER_DISTRICT,
      addressLine: v.HEPSIJET_SENDER_ADDRESS_LINE
    },
    xdockCode: v.HEPSIJET_XDOCK_CODE
  };
}
