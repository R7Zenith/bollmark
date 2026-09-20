import "server-only";
import { randomBytes } from "node:crypto";
import { IYZICO_BASE_URLS, type PaymentMode } from "./mode";
import { buildAuthHeaders } from "./signature";

// Ince, tip guvenli iyzico istemcisi (resmi npm paketi yerine, bkz. plan 3/3):
// sadece fetch + node:crypto. Yalnizca sunucu tarafinda calisir - Secret Key
// istemci paketine asla girmemeli. Istek/yanit govdeleri loglanmaz.

export type IyzicoCredentials = { apiKey: string; secretKey: string };

export interface IyzicoBaseResponse {
  status?: string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
  conversationId?: string;
}

export type IyzicoResult<T> = { httpStatus: number; data: T & IyzicoBaseResponse };

// Ag hatasi, zaman asimi veya JSON olmayan yanit. Mesaj kasitli olarak genel:
// istek/yanit icerigi (kart, anahtar) hata metnine sizmaz.
export class IyzicoTransportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IyzicoTransportError";
  }
}

const REQUEST_TIMEOUT_MS = 20_000;

function newRandomKey(): string {
  return `${Date.now()}${randomBytes(6).toString("hex")}`;
}

export async function iyzicoPost<T extends object = Record<string, unknown>>(
  mode: PaymentMode,
  credentials: IyzicoCredentials,
  uriPath: string,
  payload: Record<string, unknown>
): Promise<IyzicoResult<T>> {
  // Imzalanan govde ile gonderilen govde birebir ayni metin olmali.
  const body = JSON.stringify(payload);
  const headers = buildAuthHeaders({
    apiKey: credentials.apiKey,
    secretKey: credentials.secretKey,
    uriPath,
    body,
    randomKey: newRandomKey()
  });

  let response: Response;
  try {
    response = await fetch(`${IYZICO_BASE_URLS[mode]}${uriPath}`, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
    });
  } catch {
    throw new IyzicoTransportError("iyzico'ya ulaşılamadı (ağ hatası veya zaman aşımı).");
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    throw new IyzicoTransportError(`iyzico geçersiz yanıt döndürdü (HTTP ${response.status}).`);
  }
  if (typeof data !== "object" || data === null) {
    throw new IyzicoTransportError(`iyzico geçersiz yanıt döndürdü (HTTP ${response.status}).`);
  }
  return { httpStatus: response.status, data: data as T & IyzicoBaseResponse };
}

// Yan etkisiz baglanti/kimlik dogrulama testi: ornek bir BIN sorgular, para
// hareketi veya kayit olusturmaz (bkz. plan 6/3).
const TEST_BIN_NUMBER = "554960";

export function binCheck(mode: PaymentMode, credentials: IyzicoCredentials) {
  return iyzicoPost(mode, credentials, "/payment/bin/check", {
    locale: "tr",
    conversationId: `bin-test-${Date.now()}`,
    binNumber: TEST_BIN_NUMBER
  });
}
