// Kampanya e-posta sablonlari (KALP_TOPLA_PLANI.md 7.4): 600px tek sutun, urun
// gorseli, tek ana buton, HTML + duz metin. E-posta istemcileri icin tablo ve
// satir ici stil. Logo sabit canli adresten: yerel testte de gorunsun diye.

const LOGO_URL = "https://bollmark.com/logo.png";
const INK = "#111111";
const ACCENT = "#c0392b";
const HEARTS_MAX = 20;

export type EmailCommon = {
  siteUrl: string;
  unsubscribeUrl: string;
  firstName: string;
};

export type RenderedEmail = { subject: string; html: string; text: string };

type Body = {
  subject: string;
  preheader: string;
  blocks: string[];
  button: { label: string; url: string };
  secondary?: { label: string; url: string };
  note?: string;
  textLines: string[];
};

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

const paragraph = (html: string) => `<p style="margin:0 0 16px;font-size:16px;line-height:1.55;color:${INK}">${html}</p>`;
const heading = (html: string) => `<h1 style="margin:0 0 16px;font-size:26px;line-height:1.25;font-weight:700;color:${INK}">${html}</h1>`;

function productImage(imageUrl: string | null, name: string): string {
  if (!imageUrl) return "";
  return `<img src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name)}" width="340" style="display:block;width:100%;max-width:340px;height:auto;margin:0 auto 20px;border-radius:12px">`;
}

function heartsRow(points: number, threshold: number): string {
  if (threshold > HEARTS_MAX) return paragraph(`<strong>${points}/${threshold}</strong> kalp`);
  const hearts = "❤️".repeat(points) + "🤍".repeat(Math.max(threshold - points, 0));
  return `<p style="margin:0 0 6px;font-size:20px;line-height:1.4;text-align:center">${hearts}</p>
    <p style="margin:0 0 20px;font-size:14px;color:${INK};text-align:center"><strong>${points}/${threshold}</strong> kalp</p>`;
}

function couponBox(code: string, untilLabel: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px"><tr><td align="center" style="padding:18px;background:#FFF1F4;border:2px dashed ${ACCENT};border-radius:12px">
    <div style="font-size:12px;letter-spacing:1px;color:${INK}">KUPON KODUN</div>
    <div style="margin-top:6px;font-size:24px;font-weight:700;letter-spacing:2px;color:${INK}">${escapeHtml(code)}</div>
    <div style="margin-top:8px;font-size:14px;color:${ACCENT}">⏳ Son kullanım: ${escapeHtml(untilLabel)}</div>
  </td></tr></table>`;
}

function layout(body: Body, common: EmailCommon): RenderedEmail {
  const { siteUrl, unsubscribeUrl } = common;
  const termsUrl = `${siteUrl}/sayfa/kalp-topla-kosullari`;
  const secondary = body.secondary
    ? `<p style="margin:14px 0 0;text-align:center"><a href="${escapeHtml(body.secondary.url)}" style="font-size:14px;color:${INK}">${escapeHtml(body.secondary.label)}</a></p>`
    : "";
  const note = body.note ? `<p style="margin:20px 0 0;font-size:13px;line-height:1.5;color:#666666">${body.note}</p>` : "";

  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(body.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:Arial,Helvetica,sans-serif">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(body.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border-radius:16px">
<tr><td align="center" style="padding:28px 24px 8px"><a href="${escapeHtml(siteUrl)}"><img src="${LOGO_URL}" alt="Bollmark" width="144" style="display:block;width:144px;height:auto"></a></td></tr>
<tr><td style="padding:20px 28px 32px">
${body.blocks.join("\n")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${escapeHtml(body.button.url)}" style="display:inline-block;padding:16px 32px;background:${INK};border-radius:999px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(body.button.label)}</a>
</td></tr></table>
${secondary}${note}
</td></tr></table>
<p style="max-width:560px;margin:18px auto 0;font-size:12px;line-height:1.6;color:#777777;text-align:center">
<a href="${escapeHtml(termsUrl)}" style="color:#777777">Kampanya koşulları</a> · <a href="${escapeHtml(unsubscribeUrl)}" style="color:#777777">Bu bildirimleri almak istemiyorum</a><br>
Bu e-postayı Kalp Topla bildirimlerine onay verdiğin için aldın.
</p>
</td></tr></table></body></html>`;

  const text = [
    ...body.textLines,
    "",
    `${body.button.label}: ${body.button.url}`,
    ...(body.secondary ? [`${body.secondary.label}: ${body.secondary.url}`] : []),
    "",
    `Kampanya koşulları: ${termsUrl}`,
    `Bu bildirimleri almak istemiyorum: ${unsubscribeUrl}`
  ].join("\n");

  return { subject: body.subject, html, text };
}

export function couponWonEmail(
  common: EmailCommon,
  input: {
    productName: string;
    imageUrl: string | null;
    threshold: number;
    discountPercent: number;
    couponHours: number;
    code: string;
    untilLabel: string;
  }
): RenderedEmail {
  const name = escapeHtml(input.productName);
  return layout(
    {
      subject: `🎉 Kilit açıldı! %${input.discountPercent} kuponun hazır`,
      preheader: `${input.couponHours} saat içinde istediğin ürünü %${input.discountPercent} indirimle al.`,
      blocks: [
        heading(`Tebrikler ${escapeHtml(common.firstName)}, kilidi birlikte açtınız! ❤️`),
        paragraph(`Kalp verdiğin <strong>${name}</strong> ${input.threshold} kalbe ulaştı. %${input.discountPercent} indirim kuponun hesabında seni bekliyor.`),
        productImage(input.imageUrl, input.productName),
        couponBox(input.code, input.untilLabel),
        paragraph("Kuponunu sepetinde en çok kazandıran ürüne otomatik uygularız. Dilersen başka bir ürün de seçebilirsin.")
      ],
      button: { label: "Alışverişe başla", url: `${common.siteUrl}/urunler` },
      note: "Kupon tek ürünün tek adedinde geçerlidir, başka kampanyalarla birleşmez.",
      textLines: [
        `Tebrikler ${common.firstName}, kilidi birlikte açtınız!`,
        `${input.productName} ${input.threshold} kalbe ulaştı. %${input.discountPercent} indirim kuponun hesabında.`,
        `Kupon kodun: ${input.code}`,
        `Son kullanım: ${input.untilLabel}`,
        "Kupon tek ürünün tek adedinde geçerlidir, başka kampanyalarla birleşmez."
      ]
    },
    common
  );
}

export function barNearEmail(
  common: EmailCommon,
  input: {
    productName: string;
    imageUrl: string | null;
    points: number;
    threshold: number;
    left: number;
    discountPercent: number;
    inviteBonus: number;
    whatsappUrl: string;
    kalplerimUrl: string;
  }
): RenderedEmail {
  const name = escapeHtml(input.productName);
  return layout(
    {
      subject: `❤️ Son ${input.left} kalp kaldı! Arkadaşını çağır`,
      preheader: `${input.productName} %${input.discountPercent} indirime çok yakın.`,
      blocks: [
        heading(`Son ${input.left} kalp! 🔥`),
        paragraph(`<strong>${name}</strong> barı <strong>${input.points}/${input.threshold}</strong>. Kilidin açılmasına sadece <strong>${input.left} kalp</strong> kaldı!`),
        productImage(input.imageUrl, input.productName),
        heartsRow(input.points, input.threshold),
        paragraph(`Senin linkinle üye olan her arkadaşın barına <strong>+${input.inviteBonus} kalp</strong> ekler. Bir mesaj uzağındasın.`)
      ],
      button: { label: "WhatsApp'ta paylaş", url: input.whatsappUrl },
      secondary: { label: "Davet linkimi gör", url: input.kalplerimUrl },
      textLines: [
        `${input.productName} barı ${input.points}/${input.threshold}. Kilidin açılmasına sadece ${input.left} kalp kaldı!`,
        `Senin linkinle üye olan her arkadaşın barına +${input.inviteBonus} kalp ekler.`
      ]
    },
    common
  );
}

export function inviteJoinedEmail(
  common: EmailCommon,
  input: {
    productName: string | null;
    imageUrl: string | null;
    bonus: number;
    points: number | null;
    threshold: number | null;
    waitingDays: number;
    barUrl: string;
    catalogUrl: string;
    kalplerimUrl: string;
  }
): RenderedEmail {
  const placed = input.points !== null && input.threshold !== null && input.productName !== null;
  const left = placed ? input.threshold! - input.points! : 0;
  const barLine = placed ? `${input.productName} barı şimdi ${input.points}/${input.threshold}.` : "";
  return layout(
    {
      subject: placed ? `🙌 Arkadaşın katıldı, barına +${input.bonus} kalp eklendi` : `🙌 Arkadaşın katıldı, +${input.bonus} kalbin hazır`,
      preheader: placed ? barLine : `+${input.bonus} kalbin ilk kalbini bekliyor.`,
      blocks: placed
        ? [
            heading("Arkadaşın katıldı! 🎉"),
            paragraph(`Davet ettiğin arkadaşın Bollmark'a katıldı, <strong>${escapeHtml(input.productName!)}</strong> barına <strong>+${input.bonus} kalp</strong> eklendi.`),
            productImage(input.imageUrl, input.productName!),
            heartsRow(input.points!, input.threshold!),
            paragraph(left > 0 ? `<strong>${left} kalp</strong> daha, kilit açılsın!` : "Bar doldu, kilit açıldı! 🔓")
          ]
        : [
            heading("Arkadaşın katıldı! 🎉"),
            paragraph(`Davet ettiğin arkadaşın Bollmark'a katıldı. Şu an aktif bir kalbin yok. <strong>+${input.bonus} kalbin</strong> ${input.waitingDays} gün içinde vereceğin ilk kalbin barına eklenecek.`)
          ],
      button: placed ? { label: "Barı gör", url: input.barUrl } : { label: "Kalp vermeye başla", url: input.catalogUrl },
      secondary: placed ? { label: "Bir arkadaşını daha çağır", url: input.kalplerimUrl } : undefined,
      textLines: placed
        ? [`Arkadaşın katıldı, ${input.productName} barına +${input.bonus} kalp eklendi.`, barLine]
        : [`Arkadaşın katıldı. +${input.bonus} kalbin ${input.waitingDays} gün içinde vereceğin ilk kalbin barına eklenecek.`]
    },
    common
  );
}

export function couponExpiringEmail(
  common: EmailCommon,
  input: { code: string; discountPercent: number; untilLabel: string }
): RenderedEmail {
  return layout(
    {
      subject: "⏰ Kuponunun son 6 saati!",
      preheader: `%${input.discountPercent} kuponun ${input.untilLabel} tarihinde sona eriyor.`,
      blocks: [
        heading(`${escapeHtml(common.firstName)}, kuponun bitmek üzere! ⏰`),
        paragraph(`%${input.discountPercent} Kalp Topla kuponunun süresi dolmadan kullan, emeğin boşa gitmesin.`),
        couponBox(input.code, input.untilLabel),
        paragraph("Sepetinde en çok kazandıran ürüne otomatik uygulanır.")
      ],
      button: { label: "Alışverişe başla", url: `${common.siteUrl}/urunler` },
      textLines: [
        `${common.firstName}, %${input.discountPercent} Kalp Topla kuponunun süresi doluyor.`,
        `Kupon kodun: ${input.code}`,
        `Son kullanım: ${input.untilLabel}`
      ]
    },
    common
  );
}
