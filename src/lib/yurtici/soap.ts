import { fetch, ProxyAgent } from "undici";
import type { ShippingOrderVO } from "./map";
import { childText, findAll, findFirst, parseXml, xmlEscape } from "./xml";

// Yurtici ShippingOrderDispatcherServices SOAP govdeleri ve cevap ayrıstırma.
// Govde bicimi teknik dokuman V3'e gore; Faz 5'te WSDL ile dogrulanacak.

const NS = "http://yurticikargo.com.tr/ShippingOrderDispatcherServices";
const TIMEOUT_MS = 15_000;

export type Credentials = { username: string; password: string };

function el(name: string, value: string | number): string {
  return `<${name}>${xmlEscape(String(value))}</${name}>`;
}

function envelope(operation: string, inner: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?>` +
    `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ship="${NS}">` +
    `<soapenv:Header/><soapenv:Body><ship:${operation}>${inner}</ship:${operation}></soapenv:Body></soapenv:Envelope>`
  );
}

// --- Istek govdeleri ---

export function buildCreateShipmentXml(creds: Credentials, orders: ShippingOrderVO[]): string {
  const vos = orders
    .map(
      (o) =>
        "<ShippingOrderVO>" +
        el("cargoKey", o.cargoKey) +
        el("invoiceKey", o.invoiceKey) +
        el("receiverCustName", o.receiverCustName) +
        el("receiverAddress", o.receiverAddress) +
        el("cityName", o.cityName) +
        el("townName", o.townName) +
        el("receiverPhone1", o.receiverPhone1) +
        el("emailAddress", o.emailAddress) +
        el("cargoCount", o.cargoCount) +
        el("description", o.description) +
        "</ShippingOrderVO>"
    )
    .join("");
  return envelope(
    "createShipment",
    el("wsUserName", creds.username) + el("wsPassword", creds.password) + el("userLanguage", "TR") + vos
  );
}

export function buildQueryShipmentXml(creds: Credentials, keys: string[]): string {
  return envelope(
    "queryShipment",
    el("wsUserName", creds.username) +
      el("wsPassword", creds.password) +
      el("wsLanguage", "TR") +
      keys.map((k) => el("keys", k)).join("") +
      el("keyType", 0) +
      el("addHistoricalData", "false") +
      el("onlyTracking", "false")
  );
}

export function buildCancelShipmentXml(creds: Credentials, keys: string[]): string {
  return envelope(
    "cancelShipment",
    el("wsUserName", creds.username) +
      el("wsPassword", creds.password) +
      el("userLanguage", "TR") +
      keys.map((k) => el("cargoKeys", k)).join("")
  );
}

// --- Cevaplar ---

export type CreateRow = { cargoKey: string; errCode: string; errMessage: string };
export type CreateResult = { outFlag: string; outResult: string; jobId: string; rows: CreateRow[] };

export type QueryRow = {
  cargoKey: string;
  operationStatus: string;
  operationMessage: string;
  errCode: string;
  errMessage: string;
  docId: string;
  trackingUrl: string;
  deliveryDate: string;
  deliveryTime: string;
  rejectStatus: string;
};
export type QueryResult = { outFlag: string; outResult: string; rows: QueryRow[] };

export type CancelRow = {
  cargoKey: string;
  operationStatus: string;
  operationMessage: string;
  errCode: string;
  errMessage: string;
};
export type CancelResult = { outFlag: string; outResult: string; rows: CancelRow[] };

export class YurticiFault extends Error {}

function throwIfFault(root: ReturnType<typeof parseXml>) {
  const fault = findFirst(root, "Fault");
  if (fault) throw new YurticiFault(childText(fault, "faultstring") || "SOAP hatası");
}

export function parseCreateResponse(xml: string): CreateResult {
  const root = parseXml(xml);
  throwIfFault(root);
  const result = findFirst(root, "ShippingOrderResultVO") ?? root;
  return {
    outFlag: childText(result, "outFlag"),
    outResult: childText(result, "outResult"),
    jobId: childText(result, "jobId"),
    rows: findAll(result, "shippingOrderDetailVO").map((r) => ({
      cargoKey: childText(r, "cargoKey"),
      errCode: childText(r, "errCode") || "0",
      errMessage: childText(r, "errMessage")
    }))
  };
}

export function parseQueryResponse(xml: string): QueryResult {
  const root = parseXml(xml);
  throwIfFault(root);
  const result = findFirst(root, "ShippingDeliveryVO") ?? root;
  return {
    outFlag: childText(result, "outFlag"),
    outResult: childText(result, "outResult"),
    rows: findAll(result, "shippingDeliveryDetailVO").map((r) => {
      const item = r.children.find((c) => c.name === "shippingDeliveryItemDetailVO") ?? null;
      return {
        cargoKey: childText(r, "cargoKey"),
        operationStatus: childText(r, "operationStatus"),
        operationMessage: childText(r, "operationMessage"),
        errCode: childText(r, "errCode") || "0",
        errMessage: childText(r, "errMessage"),
        docId: childText(item, "docId"),
        trackingUrl: childText(item, "trackingUrl"),
        deliveryDate: childText(item, "deliveryDate"),
        deliveryTime: childText(item, "deliveryTime"),
        rejectStatus: childText(item, "rejectStatus")
      };
    })
  };
}

export function parseCancelResponse(xml: string): CancelResult {
  const root = parseXml(xml);
  throwIfFault(root);
  const result = findFirst(root, "ShippingOrderResultVO") ?? root;
  return {
    outFlag: childText(result, "outFlag"),
    outResult: childText(result, "outResult"),
    rows: findAll(result, "shippingCancelDetailVO").map((r) => ({
      cargoKey: childText(r, "cargoKey"),
      operationStatus: childText(r, "operationStatus"),
      operationMessage: childText(r, "operationMessage"),
      errCode: childText(r, "errCode") || "0",
      errMessage: childText(r, "errMessage")
    }))
  };
}

// --- Gonderim ---

export const CONNECTION_REFUSED_MESSAGE =
  "Yurtiçi bağlantıyı reddetti; bu bilgisayarın IP'si Yurtiçi'de tanımlı olmayabilir.";

export class YurticiConnectionError extends Error {}

const REFUSAL_CODES = new Set([
  "ECONNREFUSED",
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "UND_ERR_SOCKET",
  "UND_ERR_CLOSED"
]);

function errorCode(error: unknown): string {
  let e: unknown = error;
  for (let i = 0; i < 4 && e && typeof e === "object"; i++) {
    const obj = e as { code?: unknown; name?: unknown; cause?: unknown };
    if (typeof obj.code === "string") return obj.code;
    if (obj.name === "TimeoutError" || obj.name === "AbortError") return "ETIMEDOUT";
    e = obj.cause;
  }
  return "";
}

// Hata mesajlarina proxy adresi (icinde sifre var) asla yazilmaz.
export function toConnectionError(error: unknown): YurticiConnectionError {
  const code = errorCode(error);
  if (code === "UND_ERR_PROXY_AUTH" || /407/.test(String((error as Error)?.message ?? ""))) {
    return new YurticiConnectionError("Proxy (Fixie) kimlik doğrulaması başarısız; YURTICI_PROXY_URL'yi kontrol et.");
  }
  if (REFUSAL_CODES.has(code)) return new YurticiConnectionError(CONNECTION_REFUSED_MESSAGE);
  return new YurticiConnectionError(`Yurtiçi'ye bağlanılamadı${code ? ` (${code})` : ""}.`);
}

let cachedAgent: { url: string; agent: ProxyAgent } | null = null;

// ProxyAgent yalniz bu istege dispatcher olarak verilir; global dispatcher
// degismez (iyzico/Neon/R2 istekleri proxy'den gecmez).
function proxyAgentFor(proxyUrl: string): ProxyAgent {
  if (cachedAgent?.url !== proxyUrl) cachedAgent = { url: proxyUrl, agent: new ProxyAgent(proxyUrl) };
  return cachedAgent.agent;
}

export async function postSoap(url: string, body: string, proxyUrl: string | null): Promise<string> {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/xml; charset=UTF-8", SOAPAction: '""' },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      dispatcher: proxyUrl ? proxyAgentFor(proxyUrl) : undefined
    });
  } catch (error) {
    throw toConnectionError(error);
  }
  const text = await response.text();
  // SOAP hatasi 500 ile doner ama govdesi Fault icerir; onu cagiran ayrıstırır.
  if (response.status === 403) throw new YurticiConnectionError(CONNECTION_REFUSED_MESSAGE);
  if (response.status === 407) throw toConnectionError(new Error("407"));
  if (!response.ok && !text.includes("Fault>")) {
    throw new YurticiConnectionError(`Yurtiçi beklenmeyen cevap verdi (HTTP ${response.status}).`);
  }
  return text;
}
