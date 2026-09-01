import { Resend } from "resend";

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
export async function sendMail(params: { to: string; subject: string; html: string }): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("E-posta gonderilemedi (RESEND_API_KEY tanimli degil, yoksayildi).");
    return;
  }
  try {
    const resend = new Resend(apiKey);
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
