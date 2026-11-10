// Yurtici Kargo ortam ayarlari (bkz. docs/planlar/YURTICI_KARGO_ENTEGRASYON_PLANI.md
// bolum 5.1). Degerler yalniz sunucuda okunur; hicbiri istemciye gitmez.
//
// YURTICI_MODE: off | mock | test | live. Tanimsiz ya da tanimadik deger = off,
// boylece env eklenmemis bir ortamda (or. Vercel) Yurtici butonlari hic gorunmez.

export type YurticiMode = "off" | "mock" | "test" | "live";
export type YurticiEgress = "proxy" | "direct";

const LIVE_URL = "https://webservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices";
const TEST_URL = "https://testwebservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices";

// Dokumanda herkese acik ortak test kullanicisi (Gonderici Odemeli).
const TEST_USERNAME = "YKTEST";
const TEST_PASSWORD = "YK";

export function getYurticiMode(): YurticiMode {
  const raw = (process.env.YURTICI_MODE || "").trim().toLowerCase();
  return raw === "mock" || raw === "test" || raw === "live" ? raw : "off";
}

// Mock ve test modunda gercek gonderi olusmaz; admin kartinda uyari seridi cikar.
export function isYurticiTestMode(mode: YurticiMode = getYurticiMode()): boolean {
  return mode === "mock" || mode === "test";
}

// Otomatik takip (cron). YURTICI_SYNC=off acil kapatmadir; mod off iken de calismaz.
export function isYurticiSyncEnabled(): boolean {
  if (getYurticiMode() === "off") return false;
  return (process.env.YURTICI_SYNC || "on").trim().toLowerCase() !== "off";
}

export function getYurticiEgress(): YurticiEgress {
  return (process.env.YURTICI_PROXY_URL || "").trim() ? "proxy" : "direct";
}

export type YurticiConnection = {
  url: string;
  username: string;
  password: string;
  proxyUrl: string | null;
};

// Yalniz test/live icin anlamli. Mock ve off modunda cagrilmaz.
export function getYurticiConnection(mode: YurticiMode = getYurticiMode()): YurticiConnection {
  const proxyUrl = (process.env.YURTICI_PROXY_URL || "").trim() || null;
  if (mode === "test") {
    return { url: TEST_URL, username: TEST_USERNAME, password: TEST_PASSWORD, proxyUrl };
  }
  if (mode === "live") {
    const username = (process.env.YURTICI_GO_USERNAME || "").trim();
    const password = (process.env.YURTICI_GO_PASSWORD || "").trim();
    if (!username || !password) {
      throw new Error("YURTICI_GO_USERNAME / YURTICI_GO_PASSWORD tanımlı değil.");
    }
    return { url: LIVE_URL, username, password, proxyUrl };
  }
  throw new Error(`Yurtiçi bağlantısı ${mode} modunda kullanılamaz.`);
}
