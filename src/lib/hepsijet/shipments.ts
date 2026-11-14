import { getHepsijetMode, type HepsijetMode } from "./config";
import { HepsijetError, hjRequest } from "./client";
import type { HjDeliveryPayload } from "./map";
import { mockDelete, mockLabelPdf, mockSendDelivery, mockTrack } from "./mock";

// HepsiJET islemleri (gonder / etiket PDF / takip / iptal). Moda gore mock ya da
// gercek API. DB'ye yazmaz; cagiran taraf (admin karti, cron) sonucu isler.
//
// DOGRULANMADI (dokumanda yok, test hesabi acilinca kesinlesecek; bkz. plan 2.1):
export const SEND_PATH = "/delivery/sendDeliveryOrder"; // yalniz Enhanced'in yolu dokumanda var
export const TRACK_PATH = "/deliveryTransaction/getDeliveryTracking"; // tam yol dokumanda yok
export const DELETE_METHOD: "POST" | "DELETE" = "POST"; // metot dokumanda yok

export const LABEL_PATH = "/delivery/barcodes-label?format=PDF";
export const deletePath = (no: string) => `/delivery/deleteDeliveryOrder/${encodeURIComponent(no)}`;

export { HepsijetError } from "./client";

function activeMode(): Exclude<HepsijetMode, "off"> {
  const mode = getHepsijetMode();
  if (mode === "off") throw new HepsijetError("HepsiJET entegrasyonu kapalı (HEPSIJET_MODE=off).");
  return mode;
}

export type HjCallMeta = { mode: Exclude<HepsijetMode, "off"> };

// sendDeliveryOrder yalniz "OK" doner; etiket sonradan getLabelPdf ile alinir.
export async function sendDelivery(payload: HjDeliveryPayload): Promise<HjCallMeta & { body: unknown }> {
  const mode = activeMode();
  if (mode === "mock") return { mode, body: mockSendDelivery(payload) };
  const res = await hjRequest({ method: "POST", path: SEND_PATH, body: payload });
  return { mode, body: res.body };
}

// --- Etiket ---

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

function isPdf(bytes: Uint8Array): boolean {
  return PDF_MAGIC.every((b, i) => bytes[i] === b);
}

// Yanit bicimi dokumanda yok: ham PDF de, JSON icinde base64 ("JVBER..." = "%PDF") de kabul edilir.
export function extractPdf(body: unknown, bytes: Uint8Array | null): Uint8Array | null {
  if (bytes) return isPdf(bytes) ? bytes : null;
  const stack: unknown[] = [body];
  while (stack.length) {
    const v = stack.pop();
    if (typeof v === "string") {
      const s = v.replace(/^data:application\/pdf;base64,/, "");
      if (s.startsWith("JVBER")) {
        const decoded = new Uint8Array(Buffer.from(s, "base64"));
        if (isPdf(decoded)) return decoded;
      }
    } else if (Array.isArray(v)) stack.push(...v);
    else if (v && typeof v === "object") stack.push(...Object.values(v));
  }
  return null;
}

export async function getLabelPdf(nos: string[]): Promise<HjCallMeta & { pdf: Uint8Array }> {
  const mode = activeMode();
  if (nos.length === 0) throw new HepsijetError("Etiket için gönderi no verilmedi.");
  if (mode === "mock") return { mode, pdf: mockLabelPdf(nos) };
  const res = await hjRequest({ method: "POST", path: LABEL_PATH, body: { barcodes: nos }, binary: true });
  const pdf = extractPdf(res.body, res.bytes);
  if (!pdf) throw new HepsijetError(`HepsiJET etiket yanıtında PDF bulunamadı (${res.contentType || "içerik türü yok"}).`);
  return { mode, pdf };
}

// --- Takip ---

export type HjTrackingRow = {
  customerDeliveryNo: string;
  statusCode: string | null; // null = kurye henuz okutmadi (yalniz "OK")
  statusMessage: string;
  at: string | null; // HepsiJET'in verdigi tarih metni
};

const LIST_KEYS = ["transactions", "deliveryTransactions", "trackingList", "histories", "history"];
const STATUS_KEYS = ["deliveryStatus", "status", "statusCode", "transactionType", "lastStatus"];
const MESSAGE_KEYS = ["statusDescription", "description", "statusMessage", "message"];
const DATE_KEYS = ["transactionDate", "date", "createdDate", "statusDate"];

function pick(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

// Gercek yanit bicimi dokumanda yok; ilk gercek yanitla burasi daraltilacak.
// Sorgulanan her no icin bir satir doner; bulunamayan no "hareket yok" sayilir.
export function parseTracking(body: unknown, nos: string[]): HjTrackingRow[] {
  const data = (body as { data?: unknown } | null)?.data;
  const list: Record<string, unknown>[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { deliveries?: unknown })?.deliveries)
      ? (data as { deliveries: Record<string, unknown>[] }).deliveries
      : [];
  return nos.map((no) => {
    const item = list.find((d) => d && d.customerDeliveryNo === no);
    if (!item) return { customerDeliveryNo: no, statusCode: null, statusMessage: "", at: null };
    const historyKey = LIST_KEYS.find((k) => Array.isArray(item[k]));
    const history = historyKey ? (item[historyKey] as Record<string, unknown>[]) : [];
    const latest = history.length ? history[history.length - 1] : item;
    const code = pick(latest, STATUS_KEYS);
    return {
      customerDeliveryNo: no,
      statusCode: code && code !== "OK" ? code.toUpperCase() : null,
      statusMessage: pick(latest, MESSAGE_KEYS),
      at: pick(latest, DATE_KEYS) || null
    };
  });
}

// Tum nolar tek istekte. No yoksa hic istek atilmaz.
export async function trackDeliveries(nos: string[]): Promise<HjCallMeta & { rows: HjTrackingRow[]; body: unknown }> {
  const mode = activeMode();
  if (nos.length === 0) return { mode, rows: [], body: null };
  const body =
    mode === "mock"
      ? mockTrack(nos)
      : (await hjRequest({ method: "POST", path: TRACK_PATH, body: { deliveries: nos.map((customerDeliveryNo) => ({ customerDeliveryNo })) } })).body;
  return { mode, rows: parseTracking(body, nos), body };
}

// --- Iptal (yalniz kurye toplamadan once) ---

export type HjDeleteResult = HjCallMeta & { ok: boolean; alreadyDeleted: boolean; message: string };

export async function deleteDelivery(no: string, reason = "IPTAL"): Promise<HjDeleteResult> {
  const mode = activeMode();
  try {
    const body =
      mode === "mock" ? mockDelete(no) : (await hjRequest({ method: DELETE_METHOD, path: deletePath(no), body: { deleteReason: reason } })).body;
    const message = (body as { message?: unknown } | null)?.message;
    return { mode, ok: true, alreadyDeleted: false, message: typeof message === "string" && message ? message : "Gönderi silindi." };
  } catch (error) {
    // Ayni gonderiyi tekrar silmek FAIL doner ama sonuc olarak silinmistir.
    if (error instanceof HepsijetError && /zaten silinmi/i.test(error.message)) {
      return { mode, ok: true, alreadyDeleted: true, message: "Gönderi HepsiJET'te zaten silinmiş." };
    }
    throw error;
  }
}
