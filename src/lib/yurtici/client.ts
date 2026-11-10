import { getYurticiConnection, getYurticiEgress, getYurticiMode, type YurticiEgress, type YurticiMode } from "./config";
import type { ShippingOrderVO } from "./map";
import { mockCancelShipment, mockCreateShipment, mockQueryShipment } from "./mock";
import {
  buildCancelShipmentXml,
  buildCreateShipmentXml,
  buildQueryShipmentXml,
  parseCancelResponse,
  parseCreateResponse,
  parseQueryResponse,
  postSoap,
  YurticiFault,
  type CancelRow,
  type CreateRow,
  type QueryRow
} from "./soap";

// Yurtici istemcisi: moda gore mock ya da gercek SOAP. Cagiran taraf DB'ye
// yazar; burasi yalniz Yurtici ile konusur. Her basarili/basarisiz cagri bir
// istek sayilir (Fixie butcesi: bkz. plan bolum 2 "Istek butcesi").

export { CONNECTION_REFUSED_MESSAGE, YurticiConnectionError, YurticiFault } from "./soap";

export type CallMeta = { mode: YurticiMode; egress: YurticiEgress };

const ERROR_MESSAGES: Record<string, string> = {
  "60020": "Bu kargo anahtarı Yurtiçi'de zaten var; tekrar gönderirseniz yeni anahtarla (-2, -3) gider.",
  "82516": "Alıcı telefonu Yurtiçi tarafından hatalı bulundu.",
  "82515": "Alıcı e-posta adresi Yurtiçi tarafından hatalı bulundu.",
  "82502": "Adres uzunluğu Yurtiçi kuralına uymuyor (10–200 karakter).",
  "936": "Yurtiçi'de beklenmeyen bir hata oluştu; biraz sonra tekrar dene."
};

export function ykErrorMessage(code: string, fallback = ""): string {
  if (!code || code === "0") return "";
  return ERROR_MESSAGES[code] ?? (fallback ? `Yurtiçi: ${fallback} (kod ${code})` : `Yurtiçi hata kodu ${code}.`);
}

// Kayit donmeden sonuc seviyesinde hata (or. kullanici/sifre hatali): outResult ile firlatilir.
function throwIfResultError(r: { outFlag: string; outResult: string; errCode: string; rows: unknown[] }) {
  if (r.rows.length > 0) return;
  if ((r.outFlag && r.outFlag !== "0") || (r.errCode && r.errCode !== "0")) {
    throw new YurticiFault(r.outResult ? `Yurtiçi: ${r.outResult}` : `Yurtiçi hata kodu ${r.errCode || r.outFlag}.`);
  }
}

function activeMode(): Exclude<YurticiMode, "off"> {
  const mode = getYurticiMode();
  if (mode === "off") throw new Error("Yurtiçi entegrasyonu kapalı (YURTICI_MODE=off).");
  return mode;
}

async function call(
  mode: Exclude<YurticiMode, "off">,
  mock: () => string,
  real: (creds: { username: string; password: string }) => string
): Promise<string> {
  if (mode === "mock") return mock();
  const conn = getYurticiConnection(mode);
  return postSoap(conn.url, real(conn), conn.proxyUrl);
}

export type CreateShipmentResult = CallMeta & {
  jobId: string;
  outFlag: string;
  rows: (CreateRow & { ok: boolean; message: string })[];
};

// Birden cok siparis tek cagrida gider.
export async function createShipments(vos: ShippingOrderVO[]): Promise<CreateShipmentResult> {
  const mode = activeMode();
  const xml = await call(
    mode,
    () => mockCreateShipment(vos),
    (creds) => buildCreateShipmentXml(creds, vos)
  );
  const parsed = parseCreateResponse(xml);
  throwIfResultError(parsed);
  return {
    mode,
    egress: getYurticiEgress(),
    jobId: parsed.jobId,
    outFlag: parsed.outFlag,
    rows: parsed.rows.map((r) => ({ ...r, ok: r.errCode === "0", message: ykErrorMessage(r.errCode, r.errMessage) }))
  };
}

export type QueryShipmentResult = CallMeta & { rows: QueryRow[] };

// Anahtar yoksa hic istek atilmaz.
export async function queryShipments(keys: string[]): Promise<QueryShipmentResult> {
  const mode = activeMode();
  const egress = getYurticiEgress();
  if (keys.length === 0) return { mode, egress, rows: [] };
  const xml = await call(
    mode,
    () => mockQueryShipment(keys),
    (creds) => buildQueryShipmentXml(creds, keys)
  );
  const parsed = parseQueryResponse(xml);
  throwIfResultError(parsed);
  return { mode, egress, rows: parsed.rows };
}

export type CancelShipmentResult = CallMeta & { rows: (CancelRow & { ok: boolean; message: string })[] };

export async function cancelShipments(keys: string[]): Promise<CancelShipmentResult> {
  const mode = activeMode();
  const egress = getYurticiEgress();
  if (keys.length === 0) return { mode, egress, rows: [] };
  const xml = await call(
    mode,
    () => mockCancelShipment(keys),
    (creds) => buildCancelShipmentXml(creds, keys)
  );
  const parsed = parseCancelResponse(xml);
  throwIfResultError(parsed);
  return {
    mode,
    egress,
    rows: parsed.rows.map((r) => ({
      ...r,
      ok: r.errCode === "0" && r.operationStatus === "CNL",
      message: r.errCode === "0" ? r.operationMessage : ykErrorMessage(r.errCode, r.errMessage)
    }))
  };
}
