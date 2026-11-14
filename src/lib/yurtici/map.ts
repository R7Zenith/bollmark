import type { ShipmentStatus } from "@/lib/status";

// Siparis -> Yurtici ShippingOrderVO ve Yurtici durumu -> Shipment.status
// (bkz. plan bolum 4.1 ve 4.2). Saf fonksiyonlar; DB'ye ve aga dokunmaz.

export type ShippingOrderVO = {
  cargoKey: string;
  invoiceKey: string;
  receiverCustName: string;
  receiverAddress: string;
  cityName: string;
  townName: string;
  receiverPhone1: string;
  emailAddress: string;
  cargoCount: number;
  description: string;
};

export type OrderForShipping = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  district: string;
};

const MAX_KEY = 20;
const MAX_ADDRESS = 200;
const MIN_ADDRESS = 10;
const MAX_CITY = 40;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Alan koduyla 10 rakam, basinda 0 yok (or. 5321234567). Cep ve sabit hat
// ikisi de gecer. Olmazsa null: siparis gonderilmez, admin duzeltir.
export function normalizeYkPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[1-9]\d{9}$/.test(digits) ? digits : null;
}

// En az 5 karakter ve en az 4 harf.
export function normalizeReceiverName(input: string): string | null {
  const name = collapse(input);
  const letters = name.match(/\p{L}/gu)?.length ?? 0;
  return name.length >= 5 && letters >= 4 ? name : null;
}

// 10-200 karakter. Uzunsa son bosluktan kirpilir ve truncated isaretlenir
// (admin gondermeden once uyariyi gorur). Kisaysa null.
export function normalizeAddress(input: string): { value: string; truncated: boolean } | null {
  const address = collapse(input);
  if (address.length < MIN_ADDRESS) return null;
  if (address.length <= MAX_ADDRESS) return { value: address, truncated: false };
  const cut = address.slice(0, MAX_ADDRESS);
  const lastSpace = cut.lastIndexOf(" ");
  return { value: (lastSpace > MAX_ADDRESS - 40 ? cut.slice(0, lastSpace) : cut).trim(), truncated: true };
}

// Ilk gonderimde siparis no; iptal edilip yeniden gonderilirse -2, -3 ...
export function cargoKeyFor(orderNumber: string, attempt: number): string {
  const key = attempt <= 1 ? orderNumber : `${orderNumber}-${attempt}`;
  if (key.length > MAX_KEY) throw new Error(`Kargo anahtarı 20 karakteri geçiyor: ${key}`);
  return key;
}

export type BuildResult =
  | { ok: true; vo: ShippingOrderVO; warnings: string[] }
  | { ok: false; errors: string[] };

export function buildShippingOrder(
  order: OrderForShipping,
  opts: { cargoKey: string; cargoCount?: number }
): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const name = normalizeReceiverName(order.customerName);
  if (!name) errors.push("Alıcı adı en az 5 karakter ve en az 4 harf olmalı.");

  const phone = normalizeYkPhone(order.customerPhone);
  if (!phone) errors.push("Telefon alan koduyla 10 haneye çevrilemedi (örn. 0532 123 45 67).");

  const address = normalizeAddress(order.shippingAddress);
  if (!address) errors.push("Adres en az 10 karakter olmalı.");
  else if (address.truncated) warnings.push("Adres 200 karakteri geçtiği için kırpıldı.");

  const city = collapse(order.city).slice(0, MAX_CITY);
  const town = collapse(order.district).slice(0, MAX_CITY);
  if (!city || !town) errors.push("İl ve ilçe dolu olmalı.");

  const cargoCount = Math.trunc(opts.cargoCount ?? 1);
  if (!(cargoCount >= 1 && cargoCount <= 99)) errors.push("Koli adedi 1 ile 99 arasında olmalı.");

  if (errors.length) return { ok: false, errors };
  return {
    ok: true,
    warnings,
    vo: {
      cargoKey: opts.cargoKey,
      invoiceKey: opts.cargoKey,
      receiverCustName: name!,
      receiverAddress: address!.value,
      cityName: city,
      townName: town,
      receiverPhone1: phone!,
      emailAddress: collapse(order.customerEmail),
      cargoCount,
      description: `Bollmark sipariş ${order.orderNumber}`
    }
  };
}

// --- Durum eslemesi ---

export type YkOperationStatus = "NOP" | "ISR" | "IND" | "DLV" | "CNL" | "ISC" | "BI";

export const ykOperationStatusLabel: Record<string, string> = {
  NOP: "Şubeye ulaşmadı (veri gönderildi)",
  ISR: "Şube işlem yaptı",
  IND: "Yolda / teslimatta",
  DLV: "Teslim edildi",
  CNL: "İptal edildi",
  ISC: "Önceden iptal edilmiş",
  BI: "Faturayı şube iptal etti"
};

// rejectStatus bu degerlerden biriyse gonderi iade surecinde.
const REJECT_STATUSES = new Set(["0", "1", "2", "3", "9", "10"]);

export type StatusMapping = {
  shipmentStatus: ShipmentStatus | null; // null = Shipment.status degismez
  cancelled: boolean; // Yurtici kaydi iptal oldu
  attention: string | null; // siparise needsAttention + not
  final: boolean; // artik takip edilmez
};

export function mapYkStatus(operationStatus: string, rejectStatus = ""): StatusMapping {
  const reject = rejectStatus.trim();
  if (reject && REJECT_STATUSES.has(reject)) {
    return { shipmentStatus: "IADE", cancelled: false, attention: "Yurtiçi: gönderi iade sürecinde.", final: false };
  }
  switch (operationStatus.trim().toUpperCase()) {
    case "NOP":
      return { shipmentStatus: "HAZIRLANIYOR", cancelled: false, attention: null, final: false };
    case "ISR":
      return { shipmentStatus: "KARGOYA_VERILDI", cancelled: false, attention: null, final: false };
    case "IND":
      return { shipmentStatus: "DAGITIMDA", cancelled: false, attention: null, final: false };
    case "DLV":
      return { shipmentStatus: "TESLIM_EDILDI", cancelled: false, attention: null, final: true };
    case "CNL":
    case "ISC":
      return { shipmentStatus: null, cancelled: true, attention: null, final: true };
    case "BI":
      return { shipmentStatus: null, cancelled: false, attention: "Yurtiçi: faturayı şube iptal etti.", final: false };
    default:
      return { shipmentStatus: null, cancelled: false, attention: null, final: false };
  }
}

// Yurtici tarih/saat: "20261110" + "143005" (Turkiye saati) -> Date.
export function parseYkDateTime(date: string, time = ""): Date | null {
  const d = date.replace(/\D/g, "");
  if (d.length !== 8) return null;
  const t = time.replace(/\D/g, "").padEnd(6, "0").slice(0, 6);
  const iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}T${t.slice(0, 2)}:${t.slice(2, 4)}:${t.slice(4, 6)}+03:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// --- Gonderim kararlari ---

// Basarisiz gonderimde ykLastError "[kod] mesaj" bicimiyle yazilir.
export function errorWithCode(code: string, message: string): string {
  return code ? `[${code}] ${message}` : message;
}

function attemptOf(orderNumber: string, cargoKey: string): number {
  if (cargoKey === orderNumber) return 1;
  const m = cargoKey.slice(orderNumber.length).match(/^-(\d+)$/);
  return m ? Number(m[1]) : 1;
}

// Onceki anahtar iptal edildiyse ya da Yurtici "zaten var" (60020) dediyse bir
// sonraki ek; baska hatada ayni anahtar yeniden denenir.
export function nextCargoKey(
  orderNumber: string,
  prev: { cargoKey: string | null; ykCancelledAt: Date | null; ykLastError: string | null }
): string {
  if (!prev.cargoKey) return cargoKeyFor(orderNumber, 1);
  const attempt = attemptOf(orderNumber, prev.cargoKey);
  const bump = prev.ykCancelledAt !== null || (prev.ykLastError ?? "").startsWith("[60020]");
  return cargoKeyFor(orderNumber, bump ? attempt + 1 : attempt);
}

// Mock ve test modunda gercek siparisler kirletilmesin diye Yurtici islemleri
// yalniz "TEST ALICI" adli siparislerde acilir (canli DB ortak).
export function isTestReceiver(customerName: string): boolean {
  return customerName.trim().toLocaleUpperCase("tr-TR").replace(/İ/g, "I").startsWith("TEST ALICI");
}

export type ShipmentYkState = {
  status: string;
  provider: string | null;
  ykSentAt: Date | null;
  ykCancelledAt: Date | null;
};

// Yurtici'de aktif (gonderilmis ve iptal edilmemis) kayit mi?
export function isYurticiActive(s: ShipmentYkState): boolean {
  return s.provider === "YURTICI" && s.ykSentAt !== null && s.ykCancelledAt === null;
}

// Gonderilemiyorsa nedeni (Turkce), gonderilebiliyorsa null.
export function sendBlockReason(
  order: { status: string; customerName: string; deletedAt: Date | null },
  shipment: ShipmentYkState | null,
  mode: "off" | "mock" | "test" | "live"
): string | null {
  if (mode === "off") return "Yurtiçi entegrasyonu kapalı.";
  if (order.deletedAt) return "Silinmiş sipariş gönderilemez.";
  if (!shipment) return "Siparişin kargo kaydı yok.";
  if (isYurticiActive(shipment)) return "Bu sipariş zaten Yurtiçi'ye gönderildi.";
  // HepsiJET iptalinde provider bosalir; doluysa gonderi HepsiJET'te aktiftir.
  if (shipment.provider === "HEPSIJET") return "Bu sipariş HepsiJET'e gönderildi; önce HepsiJET'te iptal edin.";
  if (order.status !== "PAID" && order.status !== "PREPARING") {
    return "Yalnız ödenmiş ya da hazırlanan siparişler gönderilebilir.";
  }
  if (shipment.status !== "HAZIRLANIYOR") return "Kargo durumu elle değiştirilmiş; önce 'Hazırlanıyor' yapın.";
  if (mode !== "live" && !isTestReceiver(order.customerName)) {
    return "Test modunda yalnız alıcı adı 'TEST ALICI' ile başlayan siparişler gönderilebilir.";
  }
  return null;
}

export const SYNC_LOCK_MS = 60_000;

// Yurtici ayni sorgunun 1 dakika icinde tekrarini reddediyor.
export function syncLockRemainingMs(lastSyncAt: Date | null, now = Date.now()): number {
  if (!lastSyncAt) return 0;
  return Math.max(0, SYNC_LOCK_MS - (now - lastSyncAt.getTime()));
}

// --- Durum gecisleri (Faz 4) ---

// Yurtici'den gelen takip linki yalniz https ise kullanilir (musteri sayfasinda link olur).
export function safeTrackingUrl(url: string | null | undefined): string | null {
  const value = (url ?? "").trim();
  return /^https:\/\/[^\s"'<>]+$/i.test(value) ? value : null;
}

export type TransitionInput = {
  orderStatus: string;
  shipmentStatus: string;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  attentionNote: string | null;
};

export type TransitionRow = {
  operationStatus: string;
  rejectStatus: string;
  deliveryDate: string;
  deliveryTime: string;
};

export type TransitionPlan = {
  shipmentStatus: ShipmentStatus | null;
  cancelled: boolean;
  setShippedAt: boolean;
  deliveredAt: Date | null; // doluysa yazilir
  // Siparis durumu yalniz bu "onceki durumlardan" biriyse degisir; mail bu
  // kosullu guncelleme gerceklesirse gider (tek sefer).
  orderStatus: { to: "SHIPPED" | "DELIVERED"; from: string[] } | null;
  attention: string | null; // yeni not (ayni not zaten varsa null)
};

const SHIPPABLE_FROM = ["PAID", "PREPARING"];
const DELIVERABLE_FROM = ["PAID", "PREPARING", "SHIPPED"];

export function planYkTransition(prev: TransitionInput, row: TransitionRow, now = new Date()): TransitionPlan {
  const mapped = mapYkStatus(row.operationStatus, row.rejectStatus);
  const plan: TransitionPlan = {
    shipmentStatus: mapped.shipmentStatus,
    cancelled: mapped.cancelled,
    setShippedAt: false,
    deliveredAt: null,
    orderStatus: null,
    attention: null
  };
  const moving = mapped.shipmentStatus === "KARGOYA_VERILDI" || mapped.shipmentStatus === "DAGITIMDA";
  if (moving || mapped.shipmentStatus === "TESLIM_EDILDI") plan.setShippedAt = prev.shippedAt === null;
  if (moving && SHIPPABLE_FROM.includes(prev.orderStatus)) {
    plan.orderStatus = { to: "SHIPPED", from: SHIPPABLE_FROM };
  }
  if (mapped.shipmentStatus === "TESLIM_EDILDI") {
    if (prev.deliveredAt === null) plan.deliveredAt = parseYkDateTime(row.deliveryDate, row.deliveryTime) ?? now;
    if (DELIVERABLE_FROM.includes(prev.orderStatus)) plan.orderStatus = { to: "DELIVERED", from: DELIVERABLE_FROM };
  }
  let attention = mapped.attention;
  if (!attention && (moving || mapped.shipmentStatus === "TESLIM_EDILDI") && (prev.orderStatus === "CANCELLED" || prev.orderStatus === "REFUNDED")) {
    attention = "Yurtiçi: sipariş iptal/iade durumunda ama kargo hareket ediyor.";
  }
  plan.attention = attention && attention !== prev.attentionNote ? attention : null;
  return plan;
}
