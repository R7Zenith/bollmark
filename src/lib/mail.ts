import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

/**
 * Tum e-posta gonderimleri (sepet hatirlatma, stok bildirimi vb.) bu tek
 * fonksiyon uzerinden yapilir. Gonderim basarisiz olsa bile (API anahtari
 * eksik, Resend hatasi vb.) cagiran taraftaki asil islemi (siparis, stok
 * guncelleme vb.) ASLA engellememeli - hata sadece loglanir, yoksayilir.
 * `deleteBlobUrls` (src/lib/blob.ts) ile ayni "temizlik/yan etki asil islemi
 * durdurmaz" prensibi.
 */
export async function sendMail(params: { to: string; subject: string; html: string }): Promise<void> {
  try {
    await resend.emails.send({
      from: process.env.MAIL_FROM ?? "Bollmark <onboarding@resend.dev>",
      to: params.to,
      subject: params.subject,
      html: params.html
    });
  } catch (error) {
    console.error("E-posta gonderilemedi (yoksayildi):", error);
  }
}
