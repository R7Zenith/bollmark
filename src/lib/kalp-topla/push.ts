import webpush from "web-push";

// Web push gonderimi (KALP_TOPLA_PLANI.md 7.5). Anahtar yoksa push kapali sayilir.
export type PushTarget = { endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; link: string | null };
// ok: gonderildi. Aksi halde status: servisin HTTP kodu (ag hatasinda undefined).
export type PushResult = { ok: true } | { ok: false; status: number | undefined };
export type PushSender = (target: PushTarget, message: PushMessage) => Promise<PushResult>;

export function pushConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export const sendWebPush: PushSender = async (target, message) => {
  try {
    await webpush.sendNotification(
      { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
      JSON.stringify(message),
      {
        TTL: 24 * 60 * 60,
        vapidDetails: {
          subject: "mailto:bilgi@bollmark.com",
          publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
          privateKey: process.env.VAPID_PRIVATE_KEY!
        }
      }
    );
    return { ok: true };
  } catch (error) {
    const status = (error as { statusCode?: number }).statusCode;
    console.error("Push gonderilemedi:", status ?? error);
    return { ok: false, status };
  }
};
