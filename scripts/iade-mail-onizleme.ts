// docs/mail-tasarimlari/ icindeki iade maili onizlemelerini (05, 16, 17, 18)
// GERCEK sablonlardan uretir (IADE_TALEBI_SISTEMI_PLANI.md 4.4). Ornek veriyle
// calisir, DB'ye ve mail servisine dokunmaz. Gorseller tarayicida yerel acilsin
// diye img/ klasorunden.
//
// Calistirma: npx tsx scripts/iade-mail-onizleme.ts
import { writeFileSync } from "node:fs";
import path from "node:path";
import {
  returnAdminNewEmail,
  returnReceivedEmail,
  returnReplyEmail,
  returnStatusEmail,
  type ReturnEmailData
} from "../src/lib/email/order-emails";
import { LIVE_SITE_URL, type RenderedEmail } from "../src/lib/email/layout";

const DIR = path.join(__dirname, "..", "docs", "mail-tasarimlari");
const SITE = LIVE_SITE_URL;

const base: ReturnEmailData = {
  siteUrl: SITE,
  customerName: "Ayşe Yılmaz",
  orderNumber: "BLM261120-1234",
  type: "DEGISIM",
  items: [{ name: "Simli Triko Kazak", variant: "Siyah · S", quantity: 1, totalCents: 89990, imageUrl: "img/kazak.jpg" }],
  reason: "Beden uymadı",
  customerNote: "M beden ile değiştirmek istiyorum.",
  customerReply: null,
  viewUrl: `${SITE}/hesap/iade-taleplerim`
};

const reply = "Talebini onayladık. Ürünü en yakın Yurtiçi Kargo şubesinden anlaşmalı iade kodumuzla ücretsiz gönderebilirsin.";

function preview(file: string, title: string, mail: RenderedEmail, preheader: string) {
  const html = mail.html
    .replace(`${SITE}/logo.png`, "img/logo.png")
    .replace(
      /(<body[^>]*>)/,
      `$1\n<!-- ONIZLEME: scripts/iade-mail-onizleme.ts ile gercek sablondan uretildi; elle duzenlemeyin. -->\n<p style="margin:0;padding:14px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#6b6b6b;text-align:center;background:#f4f1ee">Konu: ${mail.subject} · Önizleme metni: ${preheader}</p>`
    )
    .replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`);
  writeFileSync(path.join(DIR, file), html);
  console.log("yazildi:", file);
}

function preheaderOf(mail: RenderedEmail): string {
  return mail.html.match(/<div style="display:none[^>]*>([^<]*)<\/div>/)?.[1] ?? "";
}

const mails: [string, string, RenderedEmail][] = [
  ["05-iade-talebi-durumu.html", "5 · İade/değişim talebi durumu (onaylandı)", returnStatusEmail({ ...base, customerReply: reply }, "ONAYLANDI")],
  ["16-iade-talebi-alindi.html", "16 · İade talebin alındı (müşteri)", returnReceivedEmail(base)],
  ["17-yeni-iade-talebi-admin.html", "17 · Yeni iade/değişim talebi (admin)", returnAdminNewEmail(base, `${SITE}/admin/iadeler?q=${base.orderNumber}`)],
  [
    "18-iade-talebine-yanit.html",
    "18 · Talebine yanıt var (müşteri)",
    returnReplyEmail(
      { ...base, customerReply: "Talebini değerlendirebilmemiz için ürünün ve sorunun net göründüğü birkaç fotoğrafı sipariş numaranla birlikte bilgi@bollmark.com adresine gönderebilir misin?" },
      "TALEP_EDILDI"
    )
  ]
];

for (const [file, title, mail] of mails) preview(file, title, mail, preheaderOf(mail));
