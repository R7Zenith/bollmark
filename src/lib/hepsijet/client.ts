import { getHepsijetConnection, type HepsijetConnection } from "./config";

// HepsiJET REST istemcisi: token alma/onbellek, ortak header'lar, zaman asimi
// ve okunur Turkce hatalar. Yalniz test/live modunda kullanilir (mock icin
// bkz. mock.ts). Kimlik bilgileri ve token hicbir hata mesajina/log'a yazilmaz.

export const TOKEN_TTL_MS = 50 * 60 * 1000; // HepsiJET TTL 60 dk; 10 dk pay
export const REQUEST_TIMEOUT_MS = 15_000;

export class HepsijetError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number | null = null
  ) {
    super(message);
    this.name = "HepsijetError";
  }
}

// Dokumanin tablosu "X-ClientId", cURL ornegi "X-Client-Id" diyor; ikisi de gider.
const BASE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "X-Origin": "integration",
  "X-ClientId": "hj-integration",
  "X-Client-Id": "hj-integration"
};

type CachedToken = { token: string; expiresAt: number; key: string };
const g = globalThis as unknown as { __hepsijetToken?: CachedToken | null };

export function resetHepsijetToken() {
  g.__hepsijetToken = null;
}

function cacheKey(conn: HepsijetConnection) {
  return `${conn.baseUrl}|${conn.username}`;
}

async function rawFetch(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (error) {
    const name = (error as { name?: string })?.name;
    if (name === "TimeoutError" || name === "AbortError") {
      throw new HepsijetError(`HepsiJET ${REQUEST_TIMEOUT_MS / 1000} sn içinde yanıt vermedi; biraz sonra tekrar dene.`);
    }
    const code = (error as { cause?: { code?: string } })?.cause?.code;
    throw new HepsijetError(`HepsiJET'e bağlanılamadı${code ? ` (${code})` : ""}.`);
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function messageOf(body: unknown): string {
  if (body && typeof body === "object" && "message" in body) {
    const m = (body as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m.trim();
  }
  if (typeof body === "string" && body.trim() && body.length < 300 && !body.trim().startsWith("<")) return body.trim();
  return "";
}

// HTTP durumu + govdeden okunur hata.
export function hjErrorMessage(httpStatus: number, body: unknown): string {
  const m = messageOf(body);
  if (httpStatus === 423) return "HepsiJET hesabı askıya alınmış; HepsiJET'in yeniden aktif etmesi gerekiyor.";
  if (httpStatus === 401) return m ? `HepsiJET yetki hatası: ${m}` : "HepsiJET yetki hatası (401).";
  if (httpStatus === 404) return m ? `HepsiJET: ${m}` : "HepsiJET servis adresi bulunamadı (404).";
  if (httpStatus >= 500) return m ? `HepsiJET sunucu hatası: ${m}` : `HepsiJET sunucu hatası (${httpStatus}); biraz sonra tekrar dene.`;
  return m ? `HepsiJET: ${m}` : `HepsiJET beklenmeyen yanıt verdi (HTTP ${httpStatus}).`;
}

async function fetchToken(conn: HepsijetConnection): Promise<string> {
  const res = await rawFetch(`${conn.baseUrl}/auth/token`, {
    method: "POST",
    headers: BASE_HEADERS,
    body: JSON.stringify({ username: conn.username, password: conn.password })
  });
  const body = await readJson(res);
  const token = (body as { data?: { token?: unknown } } | null)?.data?.token;
  if (res.ok && typeof token === "string" && token) return token;
  if (res.status === 401) throw new HepsijetError("HepsiJET kullanıcı adı veya şifresi hatalı.", 401);
  throw new HepsijetError(hjErrorMessage(res.status, body), res.status);
}

async function getToken(conn: HepsijetConnection, force: boolean, now: number): Promise<string> {
  const cached = g.__hepsijetToken;
  if (!force && cached && cached.key === cacheKey(conn) && cached.expiresAt > now) return cached.token;
  const token = await fetchToken(conn);
  g.__hepsijetToken = { token, expiresAt: now + TOKEN_TTL_MS, key: cacheKey(conn) };
  return token;
}

export type HjResponse = { status: number; contentType: string; body: unknown; bytes: Uint8Array | null };

export type HjRequest = {
  method: "GET" | "POST" | "DELETE";
  path: string; // "/delivery/..." (query dahil)
  body?: unknown;
  binary?: boolean; // true: JSON degilse ham bayt olarak dondur (etiket PDF'i)
};

// Token'li istek. 401 gelirse token bir kez yenilenip tekrar denenir.
// 2xx disi ya da {"status":"FAIL"} yanit HepsijetError firlatir.
export async function hjRequest(req: HjRequest, conn: HepsijetConnection = getHepsijetConnection()): Promise<HjResponse> {
  const send = async (token: string) =>
    rawFetch(`${conn.baseUrl}${req.path}`, {
      method: req.method,
      headers: req.binary ? { ...BASE_HEADERS, Accept: "*/*", "X-Auth-Token": token } : { ...BASE_HEADERS, "X-Auth-Token": token },
      body: req.body === undefined ? undefined : JSON.stringify(req.body)
    });

  let res = await send(await getToken(conn, false, Date.now()));
  if (res.status === 401) {
    await res.body?.cancel();
    res = await send(await getToken(conn, true, Date.now()));
  }

  const contentType = res.headers.get("content-type") || "";
  if (req.binary && res.ok && !contentType.includes("json")) {
    return { status: res.status, contentType, body: null, bytes: new Uint8Array(await res.arrayBuffer()) };
  }
  const body = await readJson(res);
  if (!res.ok) throw new HepsijetError(hjErrorMessage(res.status, body), res.status);
  if (body && typeof body === "object" && (body as { status?: unknown }).status === "FAIL") {
    throw new HepsijetError(hjErrorMessage(res.status, body), res.status);
  }
  return { status: res.status, contentType, body, bytes: null };
}
