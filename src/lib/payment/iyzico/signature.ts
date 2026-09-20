import { createHmac, timingSafeEqual } from "node:crypto";
import { trimTrailingZeros } from "./money";

// iyzico kimlik dogrulama ve imza dogrulama yardimcilari (bkz. plan 1.2, 1.4, 1.5).
// Tum karsilastirmalar timingSafeEqual ile yapilir.

export function hmacSha256Hex(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data, "utf8").digest("hex");
}

export function safeEqualHex(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, "utf8");
  const bufferB = Buffer.from(b, "utf8");
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}

// IYZWSv2: payload = randomKey + uriPath + body, imza = HMAC-SHA256 hex,
// Authorization = "IYZWSv2 " + base64("apiKey:..&randomKey:..&signature:..").
export function buildAuthHeaders(params: {
  apiKey: string;
  secretKey: string;
  uriPath: string;
  body: string;
  randomKey: string;
}): { Authorization: string; "x-iyzi-rnd": string; "Content-Type": string } {
  const signature = hmacSha256Hex(params.randomKey + params.uriPath + params.body, params.secretKey);
  const authString = `apiKey:${params.apiKey}&randomKey:${params.randomKey}&signature:${signature}`;
  return {
    Authorization: `IYZWSv2 ${Buffer.from(authString, "utf8").toString("base64")}`,
    "x-iyzi-rnd": params.randomKey,
    "Content-Type": "application/json"
  };
}

// CF baslatma yaniti: conversationId:token
export function verifyInitializeSignature(
  res: { conversationId?: unknown; token?: unknown; signature?: unknown },
  secretKey: string
): boolean {
  if (typeof res.signature !== "string" || !res.signature) return false;
  const expected = hmacSha256Hex(`${String(res.conversationId ?? "")}:${String(res.token ?? "")}`, secretKey);
  return safeEqualHex(expected, res.signature);
}

// CF sorgulama yaniti: paymentStatus:paymentId:currency:basketId:conversationId:paidPrice:price:token
export function verifyRetrieveSignature(
  res: {
    paymentStatus?: unknown;
    paymentId?: unknown;
    currency?: unknown;
    basketId?: unknown;
    conversationId?: unknown;
    paidPrice?: unknown;
    price?: unknown;
    token?: unknown;
    signature?: unknown;
  },
  secretKey: string
): boolean {
  if (typeof res.signature !== "string" || !res.signature) return false;
  const price = (value: unknown) =>
    typeof value === "string" || typeof value === "number" ? trimTrailingZeros(value) : "";
  const data = [
    String(res.paymentStatus ?? ""),
    String(res.paymentId ?? ""),
    String(res.currency ?? ""),
    String(res.basketId ?? ""),
    String(res.conversationId ?? ""),
    price(res.paidPrice),
    price(res.price),
    String(res.token ?? "")
  ].join(":");
  return safeEqualHex(hmacSha256Hex(data, secretKey), res.signature);
}

// Webhook (X-IYZ-SIGNATURE-V3): secretKey + iyziEventType + iyziPaymentId + token +
// paymentConversationId + status birlestirilip HMAC-SHA256 hex alinir.
export function verifyWebhookSignatureV3(
  payload: {
    iyziEventType: string;
    iyziPaymentId: string | number;
    token: string;
    paymentConversationId: string;
    status: string;
  },
  secretKey: string,
  headerValue: string
): boolean {
  const data =
    secretKey +
    payload.iyziEventType +
    String(payload.iyziPaymentId) +
    payload.token +
    payload.paymentConversationId +
    payload.status;
  return safeEqualHex(hmacSha256Hex(data, secretKey), headerValue.trim());
}
