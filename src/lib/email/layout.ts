import { getSiteUrl } from "@/lib/site-url";
import { jpegCopyUrl } from "@/lib/image-storage";
import { INSTAGRAM_URL, STORE_INFO, whatsappHref } from "@/lib/store-info";

// Musteri e-postalari icin ortak sablon (docs/mail-tasarimlari/MAIL_TASARIMLARI_PLANI.md).
// E-posta istemcileri icin: tablo + satir ici stil, en fazla 600px tek sutun,
// SVG/flex yok, ikonlar emoji. Gorsel dil Kalp Topla e-postalariyla ayni
// (lib/kalp-topla/notification-emails.ts).

export const LIVE_SITE_URL = "https://bollmark.com";
const LOGO_URL = `${LIVE_SITE_URL}/logo.png`;

export const INK = "#111111";
export const MUTED = "#5f5f5f";
export const LINE = "#ece7e2";
export const SOFT = "#faf8f6";
export const ACCENT = "#c0392b";
const FONT = "Arial,Helvetica,sans-serif";

export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "127.0.0.1" || hostname === "[::1]";
}

// Maile yerel adres girmez: SITE_URL yerelde localhost ise canli adrese duser.
export function emailSiteUrl(): string {
  const url = getSiteUrl();
  try {
    return isLocalHost(new URL(url).hostname) ? LIVE_SITE_URL : url;
  } catch {
    return LIVE_SITE_URL;
  }
}

// Yalniz canli Bollmark alan adlarindaki (sitenin kendisi, img.bollmark.com R2)
// https gorseller maile girer; WebP'nin JPEG kopyasi tercih edilir (Outlook
// WebP gostermez). Uymayan adres null: satir gorselsiz cikar.
export function emailImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const absolute = url.startsWith("/") && !url.startsWith("//") ? `${LIVE_SITE_URL}${url}` : url;
  try {
    const { protocol, hostname } = new URL(absolute);
    if (protocol !== "https:" || !(hostname === "bollmark.com" || hostname.endsWith(".bollmark.com"))) return null;
  } catch {
    return null;
  }
  return jpegCopyUrl(absolute) ?? absolute;
}

// --- Bloklar (HTML parcasi dondurur; metin girdileri cagiran tarafta kacislanmis olmali) ---

type Tone = "green" | "blue" | "red";
const TONES: Record<Tone, { bg: string; fg: string }> = {
  green: { bg: "#eef7f0", fg: "#1f6b3a" },
  blue: { bg: "#eef3fb", fg: "#1d4f91" },
  red: { bg: "#fbf0ee", fg: ACCENT }
};

export function badge(label: string, tone: Tone, icon = ""): string {
  const { bg, fg } = TONES[tone];
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 18px"><tr><td style="padding:8px 14px;background:${bg};border-radius:999px;font-size:13px;font-weight:700;letter-spacing:0.3px;color:${fg}">${icon ? `${icon}&nbsp;` : ""}${escapeHtml(label)}</td></tr></table>`;
}

export function heading(html: string, align: "left" | "center" = "left"): string {
  return `<h1 style="margin:0 0 12px;font-size:26px;line-height:1.25;font-weight:700;color:${INK};text-align:${align}">${html}</h1>`;
}

export function paragraph(html: string, opts: { align?: "left" | "center"; size?: number; color?: string; margin?: string } = {}): string {
  const { align = "left", size = 15, color = MUTED, margin = "0 0 20px" } = opts;
  return `<p style="margin:${margin};font-size:${size}px;line-height:1.55;color:${color};text-align:${align}">${html}</p>`;
}

export function button(label: string, url: string, color = INK): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0"><tr><td align="center">
<a href="${escapeHtml(url)}" style="display:inline-block;padding:16px 34px;background:${color};border-radius:999px;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">${escapeHtml(label)}</a>
</td></tr></table>`;
}

export function secondaryLink(label: string, url: string): string {
  return `<p style="margin:14px 0 0;text-align:center"><a href="${escapeHtml(url)}" style="font-size:14px;color:${INK}">${escapeHtml(label)}</a></p>`;
}

export function spacer(height: number): string {
  return `<div style="height:${height}px;line-height:${height}px;font-size:0">&nbsp;</div>`;
}

// Gri kutuda yan yana etiket/deger (SIPARIS NO, TARIH ...). Degerler kacislanir.
export function infoGrid(items: { label: string; value: string }[]): string {
  const cells = items
    .map(
      (item) => `<td valign="top" style="padding:0 28px 0 0">
<div style="font-size:12px;letter-spacing:0.5px;color:${MUTED}">${escapeHtml(item.label)}</div>
<div style="margin-top:4px;font-size:15px;font-weight:700;color:${INK}">${escapeHtml(item.value)}</div></td>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:16px 18px;background:${SOFT};border-radius:12px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>${cells}</tr></table></td></tr></table>`;
}

export type ProductLine = { name: string; detail: string; priceLabel: string; imageUrl: string | null };

// Kucuk fotografli urun satiri; gorsel yoksa satir gorselsiz cikar.
export function productRows(lines: ProductLine[]): string {
  return lines
    .map((line) => {
      const image = line.imageUrl
        ? `<td width="72" valign="middle" style="padding:0 16px 0 0"><img src="${escapeHtml(line.imageUrl)}" alt="${escapeHtml(line.name)}" width="72" style="display:block;width:72px;height:auto;border-radius:8px"></td>`
        : "";
      return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-bottom:1px solid ${LINE}"><tr><td style="padding:14px 0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${image}
<td valign="middle"><div style="font-size:15px;font-weight:700;color:${INK}">${escapeHtml(line.name)}</div>${
        line.detail ? `<div style="margin-top:4px;font-size:13px;color:${MUTED}">${escapeHtml(line.detail)}</div>` : ""
      }</td>
<td valign="middle" align="right" style="padding:0 0 0 12px;font-size:15px;font-weight:700;color:${INK};white-space:nowrap">${escapeHtml(line.priceLabel)}</td>
</tr></table></td></tr></table>`;
    })
    .join("\n");
}

// Ara toplam / kargo / toplam. Son satir kalin ve ustu cizgili.
export function totals(rows: { label: string; value: string }[]): string {
  const body = rows
    .map((row, i) => {
      const last = i === rows.length - 1;
      const top = last && rows.length > 1 ? `padding-top:10px;border-top:1px solid ${LINE};` : "padding-top:8px;";
      return `<tr><td style="${top}font-size:${last ? 16 : 14}px;${last ? "font-weight:700;" : ""}color:${last ? INK : MUTED}">${escapeHtml(row.label)}</td>
<td align="right" style="${top}font-size:${last ? 18 : 14}px;${last ? "font-weight:700;" : ""}color:${INK}">${escapeHtml(row.value)}</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 6px">${body}</table>`;
}

// Cizgili bilgi kutusu: emoji ikon, kalin baslik, aciklama (bodyHtml kacislanmis olmali).
export function infoBox(icon: string, title: string, bodyHtml: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td style="padding:16px 18px;border:1px solid ${LINE};border-radius:12px">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="padding:0 12px 0 0;font-size:18px;line-height:1.2">${icon}</td>
<td valign="top"><div style="font-size:13px;font-weight:700;color:${INK}">${escapeHtml(title)}</div>
<div style="margin-top:4px;font-size:14px;line-height:1.5;color:${MUTED}">${bodyHtml}</div></td>
</tr></table></td></tr></table>`;
}

// Durum adimlari: active dahil oncekiler dolu (✓), sonrakiler bos daire.
export function stepper(labels: string[], active: number): string {
  const width = Math.floor(100 / labels.length);
  const line = (on: boolean, visible: boolean) =>
    `<td valign="middle">${visible ? `<div style="height:2px;line-height:2px;font-size:0;background:${on ? INK : "#d9d3cd"}">&nbsp;</div>` : "&nbsp;"}</td>`;
  const cells = labels
    .map((label, i) => {
      const done = i <= active;
      const circle = done
        ? `<td width="28" height="28" align="center" valign="middle" style="width:28px;min-width:28px;height:28px;border-radius:999px;background:${INK};color:#ffffff;font-size:14px;font-weight:700;line-height:28px">✓</td>`
        : `<td width="24" height="24" style="width:24px;min-width:24px;height:24px;border-radius:999px;border:2px solid #d9d3cd;background:#ffffff;font-size:0;line-height:0">&nbsp;</td>`;
      return `<td width="${width}%" valign="top" align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${line(done, i > 0)}${circle}${line(i + 1 <= active, i < labels.length - 1)}</tr></table>
<div style="margin-top:8px;font-size:12px;text-align:center;color:${done ? INK : "#8a8a8a"};font-weight:${i === active ? 700 : 400}">${escapeHtml(label)}</div></td>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 26px"><tr>${cells}</tr></table>`;
}

// --- Cerceve ---

type Footer = "transactional" | "campaign";

export type LayoutInput = {
  siteUrl: string;
  subject: string;
  preheader: string;
  // Logo ile icerik arasina tam genislikte giren bant (kampanya e-postalari).
  hero?: string;
  blocks: string[];
  footer: Footer;
  textLines: string[];
};

function addressLine(): string {
  const a = STORE_INFO.address;
  return `${a.streetAddress}, ${a.addressLocality} / ${a.addressRegion}`;
}

function footerLinks(siteUrl: string, footer: Footer): { label: string; url: string }[] {
  if (footer === "campaign") {
    return [
      { label: "Kampanya koşulları", url: `${siteUrl}/sayfa/kalp-topla-kosullari` },
      { label: "İletişim", url: `${siteUrl}/iletisim` }
    ];
  }
  return [
    { label: "Sipariş durumu", url: `${siteUrl}/siparis-durumu` },
    { label: "İade ve değişim", url: `${siteUrl}/sayfa/iade-kosullari` },
    { label: "İletişim", url: `${siteUrl}/iletisim` },
    { label: "Instagram", url: INSTAGRAM_URL }
  ];
}

function whatsappPhone(): string | null {
  return STORE_INFO.whatsappActive && STORE_INFO.phone ? STORE_INFO.phone : null;
}

// WhatsApp aktifse sohbet linki, degilse null (blok gizlenir).
export function whatsappUrl(): string | null {
  const phone = whatsappPhone();
  return phone ? whatsappHref(phone) : null;
}

function footerHtml(siteUrl: string, footer: Footer): string {
  const links = footerLinks(siteUrl, footer)
    .map((l) => `<a href="${escapeHtml(l.url)}" style="font-size:13px;color:#444444">${escapeHtml(l.label)}</a>`)
    .join(footer === "campaign" ? " · " : "&nbsp;&nbsp;&nbsp;&nbsp;");
  const phone = whatsappPhone();
  const contact =
    footer === "transactional"
      ? `${phone ? `Soruların için WhatsApp: <a href="${escapeHtml(whatsappHref(phone))}" style="color:#6b6b6b">${escapeHtml(phone)}</a> · ` : ""}<a href="mailto:${STORE_INFO.email}" style="color:#6b6b6b">${STORE_INFO.email}</a><br>${escapeHtml(STORE_INFO.brandName)} · ${escapeHtml(addressLine())}`
      : `${escapeHtml(STORE_INFO.brandName)} · ${escapeHtml(STORE_INFO.address.addressLocality)} / ${escapeHtml(STORE_INFO.address.addressRegion)}`;
  return `<tr><td align="center" style="padding:22px 20px 0">
<p style="margin:0 0 10px;text-align:center">${links}</p>
<p style="margin:0;font-size:12px;line-height:1.7;color:#6b6b6b;text-align:center">${contact}</p></td></tr>`;
}

function footerText(siteUrl: string, footer: Footer): string[] {
  const links = footerLinks(siteUrl, footer).map((l) => `${l.label}: ${l.url}`);
  if (footer === "campaign") return [...links, `${STORE_INFO.brandName} · ${STORE_INFO.address.addressLocality} / ${STORE_INFO.address.addressRegion}`];
  const phone = whatsappPhone();
  return [...links, ...(phone ? [`WhatsApp: ${phone}`] : []), STORE_INFO.email, `${STORE_INFO.brandName} · ${addressLine()}`];
}

export function renderEmail(input: LayoutInput): RenderedEmail {
  const { siteUrl } = input;
  const hero = input.hero ? `<tr><td>${input.hero}</td></tr>` : "";
  const html = `<!DOCTYPE html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(input.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ee;font-family:${FONT}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(input.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ee"><tr><td align="center" style="padding:24px 12px 28px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;font-family:${FONT}">
<tr><td style="background:#ffffff;border-radius:16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
<tr><td align="center" style="padding:28px 24px ${input.hero ? 18 : 10}px"><a href="${escapeHtml(siteUrl)}"><img src="${LOGO_URL}" alt="Bollmark" width="144" style="display:block;width:144px;height:auto"></a></td></tr>
${hero}
<tr><td style="padding:${input.hero ? "28px" : "18px"} 28px 34px">
${input.blocks.filter(Boolean).join("\n")}
</td></tr></table></td></tr>
${footerHtml(siteUrl, input.footer)}
</table></td></tr></table></body></html>`;

  const text = [...input.textLines, "", ...footerText(siteUrl, input.footer)].join("\n");
  return { subject: input.subject, html, text };
}
