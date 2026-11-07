import { ACCENT, INK, MUTED, button, escapeHtml, heading, paragraph, renderEmail, type RenderedEmail } from "./layout";

// E-posta dogrulama e-postalari (MAIL_TASARIMLARI_PLANI.md 06, 14, 15). Saf
// fonksiyonlar: veriyi lib/kalp-topla/email-verification.ts okur. Sayilar
// (esik, indirim, kupon suresi, davet bonusu) her zaman ayarlardan gelir.

export type VerificationPurpose = "KAYIT" | "KALP";
export type VerificationTemplate = "SADE" | "KALP_KAMPANYA" | "UYELIK_KAMPANYA";

// Tek yeni kural: kampanya bu uye icin acikken (campaignStateFrom === "ACTIVE")
// amaca gore kampanya tasarimi, degilse sade tasarim.
export function pickVerificationTemplate(campaignActive: boolean, purpose: VerificationPurpose): VerificationTemplate {
  if (!campaignActive) return "SADE";
  return purpose === "KALP" ? "KALP_KAMPANYA" : "UYELIK_KAMPANYA";
}

export type ScenarioRow = { friends: number; bonus: number; total: number; unlocked: boolean };

const MAX_SCENARIO_ROWS = 4;

// "Tek basina, 1, 2, 3 arkadas" satirlari: base kalbe her arkadas inviteBonus
// ekler. Kilit acilan satirda ya da en fazla 4 satirda durur. Bonus yoksa tek satir.
export function friendScenarios(base: number, threshold: number, inviteBonus: number): ScenarioRow[] {
  const rows: ScenarioRow[] = [];
  for (let friends = 0; friends < MAX_SCENARIO_ROWS; friends += 1) {
    const bonus = friends * inviteBonus;
    const total = base + bonus;
    rows.push({ friends, bonus, total, unlocked: total >= threshold });
    if (total >= threshold || inviteBonus <= 0) break;
  }
  return rows;
}

// Uyelik e-postasindaki ornek senaryo: kilit 3 arkadasla acilacak sekilde
// ayarlardan hesaplanir (10 esik, +2 bonus -> 4 kalp: senin kalbin + 3 kalp).
export function exampleBase(threshold: number, inviteBonus: number): number {
  return Math.min(Math.max(threshold - (MAX_SCENARIO_ROWS - 1) * inviteBonus, 1), threshold);
}

export type CampaignNumbers = { threshold: number; discountPercent: number; couponHours: number; inviteBonus: number };

export type VerificationCommon = { siteUrl: string; firstName: string; verifyUrl: string; tokenHours: number };

export type HeartProduct = { name: string; imageUrl: string | null; url: string; points: number; threshold: number };

// Kalp sirasi: once diger kalpler, sonra senin bekleyen kalbin, arkadas bonusu, bos.
// 20'den buyuk esikte emoji yerine yalniz sayi yazilir (notification-emails.ts heartsRow gibi).
const HEARTS_MAX = 20;

function hearts(threshold: number, parts: { red: number; pink?: number; orange?: number }): string | null {
  if (threshold > HEARTS_MAX) return null;
  let left = threshold;
  const take = (n = 0) => {
    const used = Math.max(Math.min(n, left), 0);
    left -= used;
    return used;
  };
  const red = take(parts.red);
  const pink = take(parts.pink);
  const orange = take(parts.orange);
  return "❤️".repeat(red) + "🩷".repeat(pink) + "🧡".repeat(orange) + "🤍".repeat(left);
}

function hero(label: string, title: string, bodyHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="background:${ACCENT};padding:34px 32px 30px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="96" height="96" align="center" valign="middle" style="width:96px;height:96px;border-radius:999px;background:#ffffff;font-size:48px;line-height:96px">❤️</td></tr></table>
<div style="margin:14px 0 0;font-size:12px;font-weight:700;letter-spacing:2px;color:#ffe1e7">${escapeHtml(label)}</div>
<h1 style="margin:14px 0 0;font-size:30px;line-height:1.2;font-weight:700;color:#ffffff;text-align:center">${title}</h1>
<p style="margin:14px auto 0;max-width:450px;font-size:16px;line-height:1.55;color:#ffeef1;text-align:center">${bodyHtml}</p>
</td></tr></table>`;
}

function smallNote(html: string, margin = "12px 0 30px"): string {
  return `<p style="margin:${margin};font-size:13px;line-height:1.5;color:${MUTED};text-align:center">${html}</p>`;
}

function scenarioBox(input: {
  rows: ScenarioRow[];
  threshold: number;
  inviteBonus: number;
  // Satirdaki kalpler: kirmizi (verilen) + pembe (senin bekleyen kalbin) + turuncu (bonus).
  red: number;
  pink: number;
  intro: string;
  legend: string;
}): string {
  const rows = input.rows
    .map((row) => {
      const icons = hearts(input.threshold, { red: input.red, pink: input.pink, orange: row.bonus });
      const result = row.unlocked
        ? `<span style="color:#1f6b3a">Kilit açıldı!</span>`
        : row.friends === 0
          ? "Bekliyorsun"
          : `${Math.min(row.total, input.threshold)}/${input.threshold}`;
      return `<tr><td style="padding:0 0 8px"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px"><tr>
<td width="96" style="padding:12px 0 12px 14px"><div style="font-size:14px;font-weight:700;color:${INK}">${row.friends === 0 ? "Tek başına" : `${row.friends} arkadaş`}</div><div style="margin-top:2px;font-size:12px;color:${MUTED}">+${row.bonus} kalp</div></td>
<td align="center" style="padding:12px 6px;font-size:13px;line-height:1.3;letter-spacing:1px">${icons ?? `${Math.min(row.total, input.threshold)}/${input.threshold}`}</td>
<td width="92" align="right" style="padding:12px 14px 12px 0;font-size:13px;font-weight:700;color:${INK}">${result}</td>
</tr></table></td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 28px"><tr><td style="background:#fff6e8;border-radius:16px;padding:24px 18px">
<div style="font-size:12px;font-weight:700;letter-spacing:1.5px;color:#9a5b00;text-align:center">EN HIZLI YOL</div>
<h2 style="margin:8px 0;font-size:22px;line-height:1.3;color:${INK};text-align:center">Ne kadar çok arkadaş, o kadar hızlı kilit!</h2>
<p style="margin:0 0 18px;font-size:15px;line-height:1.55;color:${INK};text-align:center">Senin linkinle üye olan <strong>her arkadaşın barına +${input.inviteBonus} kalp</strong> ekler. ${input.intro}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:6px 0 0;font-size:12px;color:${MUTED};text-align:center">${input.legend}</p>
</td></tr></table>`;
}

function howItWorks(steps: { title: string; body: string }[]): string {
  const rows = steps
    .map(
      (step, i) => `<tr><td width="34" valign="top" style="padding:0 14px 16px 0"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="34" height="34" align="center" valign="middle" style="width:34px;height:34px;border-radius:999px;background:${INK};color:#ffffff;font-size:15px;font-weight:700;line-height:34px">${i + 1}</td></tr></table></td>
<td valign="top" style="padding:0 0 16px"><div style="font-size:15px;font-weight:700;color:${INK}">${escapeHtml(step.title)}</div><div style="margin-top:3px;font-size:14px;line-height:1.5;color:${MUTED}">${escapeHtml(step.body)}</div></td></tr>`
    )
    .join("");
  return `<h3 style="margin:0 0 16px;font-size:18px;color:${INK}">Nasıl çalışır?</h3>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px">${rows}</table>`;
}

function bigButton(label: string, url: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:18px 36px;background:${INK};border-radius:999px;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

function expiryNote(tokenHours: number): string {
  return smallNote(`Bağlantı ${tokenHours} saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma.`, "24px 0 0");
}

function couponStep(n: CampaignNumbers) {
  return { title: `%${n.discountPercent} kuponunu kap`, body: `Bar ${n.threshold} kalbe ulaşınca kuponun hesabına gelir, ${n.couponHours} saat içinde kullan.` };
}

// 06: kampanya kapaliyken (iki amac icin de).
export function verificationPlainEmail(c: VerificationCommon): RenderedEmail {
  return renderEmail({
    siteUrl: c.siteUrl,
    subject: "Bollmark: e-posta adresini doğrula",
    preheader: "Hesabını tamamlamak için tek bir adım kaldı.",
    footer: "transactional",
    blocks: [
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:6px 0 18px"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="64" height="64" align="center" valign="middle" style="width:64px;height:64px;border-radius:999px;background:#faf8f6;font-size:28px;line-height:64px">✉️</td></tr></table></td></tr></table>`,
      heading("E-posta adresini doğrula", "center"),
      paragraph(`Merhaba ${escapeHtml(c.firstName)}, Bollmark'a hoş geldin! Hesabını tamamlamak için tek bir adım kaldı.`, { align: "center", margin: "0 0 26px" }),
      button("E-postamı doğrula", c.verifyUrl),
      expiryNote(c.tokenHours)
    ],
    textLines: [
      `Merhaba ${c.firstName}, Bollmark'a hoş geldin! Hesabını tamamlamak için e-posta adresini doğrula:`,
      c.verifyUrl,
      `Bağlantı ${c.tokenHours} saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma.`
    ]
  });
}

// 14: dogrulanmamis uye kalp verince, kampanya acikken. product yoksa kart gizlenir.
export function verificationKalpEmail(c: VerificationCommon, n: CampaignNumbers, product: HeartProduct | null): RenderedEmail {
  const threshold = product?.threshold ?? n.threshold;
  const nums = { ...n, threshold };
  const points = product?.points ?? 0;
  const card = product
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:16px;border:1px solid #efe7e2;border-radius:14px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${product.imageUrl ? `<td width="96" valign="middle" style="padding:0 18px 0 0"><a href="${escapeHtml(product.url)}"><img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" width="96" style="display:block;width:96px;height:auto;border-radius:10px"></a></td>` : ""}
<td valign="middle"><div style="font-size:12px;letter-spacing:1px;color:${MUTED}">KALP VERDİĞİN ÜRÜN</div>
<div style="margin-top:8px;font-size:17px;font-weight:700;color:${INK}"><a href="${escapeHtml(product.url)}" style="color:${INK};text-decoration:none">${escapeHtml(product.name)}</a></div>
${(() => {
  const row = hearts(threshold, { red: points, pink: 1 });
  return row ? `<div style="margin-top:8px;font-size:15px;line-height:1.3;letter-spacing:1px">${row}</div>` : "";
})()}
<div style="margin-top:8px;font-size:13px;color:${INK}"><strong>${Math.min(points, threshold)}/${threshold}</strong> kalp · <span style="color:#e0245e;font-weight:700">🩷 senin kalbin onay bekliyor</span></div>
</td></tr></table></td></tr></table>`
    : "";
  const rows = friendScenarios(points + 1, threshold, n.inviteBonus);
  const steps = [
    { title: "E-postanı doğrula", body: "Kalbin hemen bara eklenir." },
    ...(n.inviteBonus > 0
      ? [{ title: "Arkadaşlarını çağır", body: `Doğruladıktan sonra davet linkin hazır olur. WhatsApp'tan paylaş, her üye +${n.inviteBonus} kalp.` }]
      : []),
    couponStep(nums)
  ];
  return renderEmail({
    siteUrl: c.siteUrl,
    subject: "❤️ Kalbin sayılmayı bekliyor! Tek tıkla doğrula",
    preheader: "Doğrula, kalbin bara eklensin. Arkadaşlarını çağır, kilit daha hızlı açılsın.",
    footer: "campaign",
    hero: hero(
      "KALP TOPLA",
      `Kalbin sayılmayı bekliyor, ${escapeHtml(c.firstName)}!`,
      "Verdiğin kalbin bara eklenmesi için tek bir adım kaldı: e-posta adresini doğrula."
    ),
    blocks: [
      card,
      bigButton("E-postamı doğrula, kalbim sayılsın", c.verifyUrl),
      smallNote(`Bar ${threshold} kalbe ulaşınca %${n.discountPercent} indirim kuponu kazanırsın.`),
      n.inviteBonus > 0
        ? scenarioBox({
            rows,
            threshold,
            inviteBonus: n.inviteBonus,
            red: points,
            pink: 1,
            intro: "Beklemek yerine çağır, kilidi günler değil saatler içinde aç.",
            legend: "❤️ Verilen kalpler &nbsp;·&nbsp; 🩷 Senin kalbin &nbsp;·&nbsp; 🧡 Arkadaş bonusu"
          })
        : "",
      howItWorks(steps),
      button("Doğrula ve arkadaşlarını çağır", c.verifyUrl, ACCENT),
      expiryNote(c.tokenHours)
    ],
    textLines: [
      `Kalbin sayılmayı bekliyor, ${c.firstName}!`,
      ...(product ? [`Kalp verdiğin ürün: ${product.name} (${Math.min(points, threshold)}/${threshold} kalp, senin kalbin onay bekliyor)`] : []),
      `E-postamı doğrula, kalbim sayılsın: ${c.verifyUrl}`,
      `Bar ${threshold} kalbe ulaşınca %${n.discountPercent} indirim kuponu kazanırsın.`,
      ...(n.inviteBonus > 0 ? [`Senin linkinle üye olan her arkadaşın barına +${n.inviteBonus} kalp ekler.`] : []),
      `Kupon ${n.couponHours} saat içinde kullanılır.`,
      `Bağlantı ${c.tokenHours} saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma.`
    ]
  });
}

function productCards(products: HeartProduct[]): string {
  const width = Math.floor(100 / products.length);
  const cells = products
    .map((p, i) => {
      const row = hearts(p.threshold, { red: p.points });
      const pad = i === 0 ? "0 7px 0 0" : i === products.length - 1 ? "0 0 0 7px" : "0 7px";
      return `<td width="${width}%" valign="top" style="padding:${pad}">
${p.imageUrl ? `<a href="${escapeHtml(p.url)}"><img src="${escapeHtml(p.imageUrl)}" alt="${escapeHtml(p.name)}" width="170" style="display:block;width:100%;max-width:170px;height:auto;border-radius:10px"></a>` : ""}
<div style="margin-top:8px;font-size:13px;font-weight:700;line-height:1.35;color:${INK}"><a href="${escapeHtml(p.url)}" style="color:${INK};text-decoration:none">${escapeHtml(p.name)}</a></div>
<div style="margin-top:6px;font-size:10px;line-height:1.3">${row ?? `<span style="font-size:12px;color:${MUTED}">${Math.min(p.points, p.threshold)}/${p.threshold} kalp</span>`}</div>
<div style="margin-top:6px"><a href="${escapeHtml(p.url)}" style="font-size:12px;font-weight:700;color:${ACCENT};text-decoration:none">❤️ Kalp ver</a></div></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px"><tr>${cells}</tr></table>`;
}

// 15: normal uyelik dogrulamasi, kampanya acikken. products bossa urun bolumu gizlenir.
export function verificationSignupEmail(c: VerificationCommon, n: CampaignNumbers, products: HeartProduct[]): RenderedEmail {
  const base = exampleBase(n.threshold, n.inviteBonus);
  const rows = friendScenarios(base, n.threshold, n.inviteBonus);
  const steps = [
    { title: "E-postanı doğrula", body: "Hesabın aktif olur, kalplerin bara sayılmaya başlar." },
    { title: "Beğendiğin ürüne kalp ver", body: "Ürün sayfasındaki kalbe dokunman yeterli." },
    ...(n.inviteBonus > 0 ? [{ title: "Arkadaşlarını çağır", body: `Davet linkini WhatsApp'tan paylaş, her üye +${n.inviteBonus} kalp.` }] : []),
    couponStep(n)
  ];
  return renderEmail({
    siteUrl: c.siteUrl,
    subject: "🎉 Hoş geldin! Kalp Topla başladı, e-postanı doğrula",
    preheader: `Beğendiğin ürüne kalp ver, bar dolunca %${n.discountPercent} indirim senin.`,
    footer: "campaign",
    hero: hero(
      "KALP TOPLA BAŞLADI",
      `Hoş geldin ${escapeHtml(c.firstName)}!`,
      `Bollmark'a katıldığın için teşekkürler. E-postanı doğrula, hemen kalp vermeye başla ve <strong style="color:#ffffff">%${n.discountPercent} indirim</strong> kazanma şansını yakala.`
    ),
    blocks: [
      products.length > 0
        ? `<h2 style="margin:0 0 6px;font-size:20px;color:${INK};text-align:center">Beğen, kalp ver, indirimi kap</h2>` +
          paragraph(`Beğendiğin ürünün üzerindeki kalbe dokun. O ürünün barı ${n.threshold} kalbe ulaşınca kilit açılır, %${n.discountPercent} kuponun hesabına gelir.`, {
            align: "center",
            size: 14,
            margin: "0 0 18px"
          }) +
          productCards(products)
        : "",
      bigButton("E-postamı doğrula", c.verifyUrl),
      // Kod: dogrulanmamis uyenin kalbi PENDING bekler, dogrulayinca bara sayilir (bar.ts activatePendingHearts).
      smallNote("Verdiğin kalpler, e-postanı doğruladığında bara sayılır."),
      n.inviteBonus > 0
        ? scenarioBox({
            rows,
            threshold: n.threshold,
            inviteBonus: n.inviteBonus,
            red: base,
            pink: 0,
            intro: "Beklemek yerine çağır, kilidi çok daha hızlı aç.",
            legend: "❤️ Senin ve diğer kalpler &nbsp;·&nbsp; 🧡 Arkadaş bonusu"
          })
        : "",
      howItWorks(steps),
      button("Doğrula ve kalp vermeye başla", c.verifyUrl, ACCENT),
      expiryNote(c.tokenHours)
    ],
    textLines: [
      `Hoş geldin ${c.firstName}! Kalp Topla başladı.`,
      `E-postanı doğrula, beğendiğin ürüne kalp ver. Bar ${n.threshold} kalbe ulaşınca %${n.discountPercent} indirim kuponu kazanırsın (${n.couponHours} saat içinde kullan).`,
      ...products.map((p) => `- ${p.name}: ${p.url}`),
      `E-postamı doğrula: ${c.verifyUrl}`,
      "Verdiğin kalpler, e-postanı doğruladığında bara sayılır.",
      ...(n.inviteBonus > 0 ? [`Senin linkinle üye olan her arkadaşın barına +${n.inviteBonus} kalp ekler.`] : []),
      `Bağlantı ${c.tokenHours} saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma.`
    ]
  });
}
