// Tarayici tarafi push (KALP_TOPLA_PLANI.md 6.5, 7.5, T15). Destek ozellik tespitiyle
// belirlenir: iPhone/iPad Safari'de PushManager olmadigi icin tercih satiri hic cikmaz.
const API = "/api/bildirimler/push";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

function vapidKey(): Uint8Array<ArrayBuffer> {
  const base64 = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

export async function currentPushSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
}

export async function subscribePush(): Promise<"ok" | "denied" | "error"> {
  try {
    if ((await Notification.requestPermission()) !== "granted") return "denied";
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: vapidKey() });
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subscription: subscription.toJSON() })
    });
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

export async function unsubscribePush(): Promise<void> {
  const subscription = await currentPushSubscription();
  if (!subscription) return;
  await fetch(API, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: subscription.endpoint })
  });
  await subscription.unsubscribe();
}
