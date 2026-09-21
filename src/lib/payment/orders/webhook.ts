import { z } from "zod";
import { verifyWebhookSignatureV3 } from "@/lib/payment/iyzico/signature";

// iyzico webhook govdesi (bkz. plan 1.5/5.D). Yalnizca CF/HPP bicimi (CHECKOUT_FORM_AUTH) islenir;
// digerleri gecerli govde olarak kabul edilip loglanir. Alanlar iyzico'da metin ya da sayi gelebilir.
const idLike = z.union([z.string(), z.number()]).transform(String);

export const webhookSchema = z.object({
  iyziEventType: z.string().min(1),
  iyziEventTime: idLike.optional(),
  iyziReferenceCode: idLike.optional(),
  iyziPaymentId: idLike.optional().default(""),
  paymentConversationId: idLike.optional().default(""),
  token: idLike.optional().default(""),
  status: z.string().optional().default(""),
  merchantId: idLike.optional()
});

export type WebhookPayload = z.infer<typeof webhookSchema>;

export const CHECKOUT_FORM_EVENT = "CHECKOUT_FORM_AUTH";

export type SignatureVerdict = "valid" | "invalid" | "missing";

// Imza basligi yoksa (ozellik hesapta henuz acilmamis olabilir) "missing" doner: cagiran taraf
// yine de islem yapar, cunku aksiyon govdedeki hicbir alana degil retrieve(token) sonucuna dayanir.
export function checkWebhookSignature(payload: WebhookPayload, secretKey: string, headerValue: string | null): SignatureVerdict {
  if (!headerValue || !headerValue.trim()) return "missing";
  const valid = verifyWebhookSignatureV3(
    {
      iyziEventType: payload.iyziEventType,
      iyziPaymentId: payload.iyziPaymentId,
      token: payload.token,
      paymentConversationId: payload.paymentConversationId,
      status: payload.status
    },
    secretKey,
    headerValue
  );
  return valid ? "valid" : "invalid";
}
