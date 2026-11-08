import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import type { EmailKind } from "@/lib/email/log";

/**
 * Tum e-posta gonderimleri (sepet hatirlatma, stok bildirimi vb.) bu tek
 * fonksiyon uzerinden yapilir. Gonderim basarisiz olsa bile (API anahtari
 * eksik, Resend hatasi vb.) cagiran taraftaki asil islemi (siparis, stok
 * guncelleme vb.) ASLA engellememeli - hata sadece loglanir, yoksayilir.
 * `deleteBlobUrls` (src/lib/blob.ts) ile ayni "temizlik/yan etki asil islemi
 * durdurmaz" prensibi.
 *
 * Onemli: Resend istemcisi burada, fonksiyon cagrildigi anda (lazy) olusturulur.
 * Modul yuklenirken (import edilirken) olusturulursa, RESEND_API_KEY tanimli
 * olmadan yapilan bir `npm run build` (ornegin Vercel'de env eklenmeden once)
 * bu dosyayi import eden HER sayfanin build'ini kirar - bu gercekten yasandi
 * (bkz. DEPLOY_STATUS.md, 2026-09-01: "/admin/urunler/[id]" build hatasi).
 */
export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  headers?: Record<string, string>;
  // Verilirse gonderim (basarili ya da hatali) EmailLog'a yazilir: yalniz musteriye giden e-postalar.
  log?: { kind: EmailKind };
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("E-posta gonderilemedi (RESEND_API_KEY tanimli degil, yoksayildi).");
    await logEmail(params, false, "RESEND_API_KEY tanımlı değil");
    return false;
  }
  // Yerel gelistirme guvenligi (Kalp Topla Faz 0): yerel .env'de tanimliysa
  // TUM e-postalar bu adrese gider, asil alici konuya yazilir. Vercel'de
  // tanimli olmadigi icin canli davranis degismez.
  const devRedirect = process.env.MAIL_DEV_REDIRECT;
  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM ?? "Bollmark <onboarding@resend.dev>",
      to: devRedirect || params.to,
      subject: devRedirect ? `[TEST → asıl alıcı: ${params.to}] ${params.subject}` : params.subject,
      html: params.html,
      text: params.text,
      replyTo: params.replyTo,
      headers: params.headers
    });
    if (error) console.error("E-posta gonderilemedi (yoksayildi):", error);
    await logEmail(params, !error, error ? errorText(error) : null);
    return !error;
  } catch (error) {
    console.error("E-posta gonderilemedi (yoksayildi):", error);
    await logEmail(params, false, errorText(error));
    return false;
  }
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error) return String((error as { message: unknown }).message);
  return String(error);
}

// Kayit hatasi gonderimi ya da cagiran islemi asla bozmaz. Asil alici yazilir
// (MAIL_DEV_REDIRECT yerelde yonlendirse de).
async function logEmail(
  params: { to: string; subject: string; html: string; text?: string; log?: { kind: EmailKind } },
  sent: boolean,
  error: string | null
): Promise<void> {
  if (!params.log) return;
  try {
    await prisma.emailLog.create({
      data: { kind: params.log.kind, to: params.to, subject: params.subject, html: params.html, text: params.text ?? null, sent, error }
    });
  } catch (logError) {
    console.error("E-posta kaydi yazilamadi (yoksayildi):", logError);
  }
}
