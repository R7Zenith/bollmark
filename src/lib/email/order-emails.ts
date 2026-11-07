import { formatDate, formatExactPrice } from "@/lib/format";
import { returnStatusLabel, returnTypeLabel, type ReturnStatus, type ReturnType } from "@/lib/status";
import { STORE_INFO } from "@/lib/store-info";
import {
  badge,
  button,
  escapeHtml,
  heading,
  infoBox,
  infoGrid,
  paragraph,
  productRows,
  renderEmail,
  secondaryLink,
  spacer,
  stepper,
  totals,
  type ProductLine,
  type RenderedEmail
} from "./layout";

// Siparis, kargo, iade e-postalari (MAIL_TASARIMLARI_PLANI.md 01-05). Saf
// fonksiyonlar: veriyi order-notifications.ts okur, test betigi de bunlari
// dogrudan cagirir. Konu satirlari onceki e-postalarla ayni.

export type OrderEmailItem = { id?: string; name: string; variant: string; quantity: number; totalCents: number; imageUrl: string | null };

export type OrderEmailData = {
  siteUrl: string;
  customerName: string;
  orderNumber: string;
  createdAt: Date;
  items: OrderEmailItem[];
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  totalCents: number;
  address: { line: string; district: string; city: string; postalCode: string | null };
  shipment: { carrier: string; trackingCode: string | null } | null;
};

const ORDER_STEPS = ["Sipariş alındı", "Hazırlanıyor", "Kargoda", "Teslim edildi"];

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? "";
}

function daysRange(range: { min: number; max: number }): string {
  return range.min === range.max ? `${range.min}` : `${range.min}-${range.max}`;
}

function itemLines(items: OrderEmailItem[]): ProductLine[] {
  return items.map((item) => ({
    name: item.name,
    detail: [item.variant, `${item.quantity} adet`].filter(Boolean).join(" · "),
    priceLabel: formatExactPrice(item.totalCents),
    imageUrl: item.imageUrl
  }));
}

function itemText(items: OrderEmailItem[]): string[] {
  return items.map((item) => `- ${item.name}${item.variant ? ` (${item.variant})` : ""} × ${item.quantity}: ${formatExactPrice(item.totalCents)}`);
}

function statusUrl(siteUrl: string) {
  return `${siteUrl}/siparis-durumu`;
}

export function orderReceivedEmail(data: OrderEmailData): RenderedEmail {
  const name = firstName(data.customerName);
  const handling = `${daysRange(STORE_INFO.handlingDays)} iş günü`;
  const a = data.address;
  const addressHtml = `${escapeHtml(data.customerName)}<br>${escapeHtml(a.line)}, ${escapeHtml(a.district)} / ${escapeHtml(a.city)}${a.postalCode ? ` ${escapeHtml(a.postalCode)}` : ""}`;
  const totalRows = [
    { label: "Ara toplam", value: formatExactPrice(data.subtotalCents) },
    ...(data.discountCents > 0 ? [{ label: "İndirim", value: `-${formatExactPrice(data.discountCents)}` }] : []),
    { label: "Kargo", value: data.shippingCents > 0 ? formatExactPrice(data.shippingCents) : "Ücretsiz" },
    { label: "Toplam", value: formatExactPrice(data.totalCents) }
  ];
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `Siparişiniz alındı, ödemeniz onaylandı - ${data.orderNumber}`,
    preheader: "Ödemen onaylandı, siparişini hazırlamaya başladık.",
    footer: "transactional",
    blocks: [
      badge("ÖDEMEN ONAYLANDI", "green", "✓"),
      heading(`Teşekkürler ${escapeHtml(name)}, siparişin bizde!`),
      paragraph("Siparişini aldık ve hazırlamaya başlıyoruz. Kargoya verdiğimizde sana haber vereceğiz."),
      infoGrid([
        { label: "SİPARİŞ NO", value: data.orderNumber },
        { label: "TARİH", value: formatDate(data.createdAt, { day: "numeric", month: "long", year: "numeric" }) },
        { label: "TAHMİNİ KARGO", value: handling }
      ]),
      productRows(itemLines(data.items)),
      totals(totalRows),
      spacer(18),
      infoBox("🏠", "Teslimat adresi", addressHtml),
      button("Siparişimi takip et", statusUrl(data.siteUrl)),
      secondaryLink("Siparişinde değişiklik mi istiyorsun? Bize yaz", `${data.siteUrl}/iletisim`)
    ],
    textLines: [
      `Teşekkürler ${name}, siparişin bizde!`,
      `Sipariş no: ${data.orderNumber}. Ödemen onaylandı, siparişini hazırlamaya başlıyoruz.`,
      "",
      ...itemText(data.items),
      ...totalRows.map((r) => `${r.label}: ${r.value}`),
      "",
      `Teslimat adresi: ${data.customerName}, ${a.line}, ${a.district} / ${a.city}${a.postalCode ? ` ${a.postalCode}` : ""}`,
      `Siparişimi takip et: ${statusUrl(data.siteUrl)}`
    ]
  });
}

export type StatusEmailKind = "PAID" | "SHIPPED" | "DELIVERED";

const STATUS_SUBJECT_LABEL: Record<StatusEmailKind, string> = { PAID: "Ödendi", SHIPPED: "Kargolandı", DELIVERED: "Teslim Edildi" };

export function orderStatusEmail(data: OrderEmailData, kind: StatusEmailKind): RenderedEmail {
  const name = firstName(data.customerName);
  const no = escapeHtml(data.orderNumber);
  const transit = `${daysRange(STORE_INFO.transitDays)} iş günü`;
  const subject = `Siparişiniz ${STATUS_SUBJECT_LABEL[kind]} - ${data.orderNumber}`;
  const url = statusUrl(data.siteUrl);
  const lines = itemLines(data.items);

  if (kind === "PAID") {
    return renderEmail({
      siteUrl: data.siteUrl,
      subject,
      preheader: "Ödemen onaylandı, siparişini hazırlamaya başlıyoruz.",
      footer: "transactional",
      blocks: [
        badge("ÖDEMEN ONAYLANDI", "green", "✓"),
        heading("Ödemen onaylandı"),
        paragraph(`${no} numaralı siparişinin ödemesi onaylandı. Siparişini hazırlamaya başlıyoruz, kargoya verdiğimizde sana haber vereceğiz.`, { margin: "0 0 22px" }),
        stepper(ORDER_STEPS, 0),
        productRows(lines),
        spacer(24),
        button("Siparişimi takip et", url)
      ],
      textLines: [`Merhaba ${name}, ${data.orderNumber} numaralı siparişinin ödemesi onaylandı.`, ...itemText(data.items), "", `Siparişimi takip et: ${url}`]
    });
  }

  if (kind === "SHIPPED") {
    const carrier = data.shipment?.carrier.trim() || null;
    const tracking = data.shipment?.trackingCode?.trim() || null;
    const grid = [
      ...(carrier ? [{ label: "KARGO FİRMASI", value: carrier }] : []),
      ...(tracking ? [{ label: "TAKİP NO", value: tracking }] : [])
    ];
    return renderEmail({
      siteUrl: data.siteUrl,
      subject,
      preheader: tracking ? `Takip numaran hazır, ${transit} içinde kapında.` : `Siparişin kargoya verildi, ${transit} içinde kapında.`,
      footer: "transactional",
      blocks: [
        badge("KARGODA", "blue", "🚚"),
        heading("Siparişin yola çıktı!"),
        paragraph(`${no} numaralı siparişini kargoya verdik. Genellikle ${transit} içinde kapında olur.`, { margin: "0 0 22px" }),
        stepper(ORDER_STEPS, 2),
        grid.length > 0 ? infoGrid(grid) : "",
        productRows(lines),
        spacer(24),
        button("Siparişimi takip et", url)
      ],
      textLines: [
        `Merhaba ${name}, ${data.orderNumber} numaralı siparişini kargoya verdik. Genellikle ${transit} içinde kapında olur.`,
        ...(carrier ? [`Kargo firması: ${carrier}`] : []),
        ...(tracking ? [`Takip no: ${tracking}`] : []),
        ...itemText(data.items),
        "",
        `Siparişimi takip et: ${url}`
      ]
    });
  }

  const days = STORE_INFO.returnDays;
  return renderEmail({
    siteUrl: data.siteUrl,
    subject,
    preheader: `Umarız beğenirsin! Değişim gerekirse ${days} günün var.`,
    footer: "transactional",
    blocks: [
      badge("TESLİM EDİLDİ", "green", "📦"),
      heading("Siparişin teslim edildi"),
      paragraph(`Umarız beğenirsin ${escapeHtml(name)}! Ürünlerinle ilgili bir sorun olursa ya da bedeni olmazsa hiç dert etme.`, { margin: "0 0 22px" }),
      stepper(ORDER_STEPS, 3),
      productRows(lines),
      spacer(22),
      infoBox(
        "🔄",
        `${days} gün içinde kolay değişim`,
        `Beden ya da renk olmadıysa teslimden itibaren ${days} gün içinde değişim talebi oluşturabilir veya ${escapeHtml(STORE_INFO.address.addressLocality)} mağazamıza uğrayabilirsin.`
      ),
      button("Siparişimi görüntüle", url),
      secondaryLink("Değişim / iade talebi oluştur", url)
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişin teslim edildi. Umarız beğenirsin!`,
      ...itemText(data.items),
      "",
      `Beden ya da renk olmadıysa teslimden itibaren ${days} gün içinde değişim talebi oluşturabilirsin.`,
      `Siparişimi görüntüle / değişim talebi: ${url}`
    ]
  });
}

export function refundEmail(
  data: Pick<OrderEmailData, "siteUrl" | "customerName" | "orderNumber">,
  amountCents: number,
  fullyRefunded: boolean
): RenderedEmail {
  const name = firstName(data.customerName);
  const amount = formatExactPrice(amountCents);
  const url = statusUrl(data.siteUrl);
  const kind = fullyRefunded ? "" : "kısmi ";
  const when = "İade tutarının kartına yansıma süresi bankana göre değişir; genellikle birkaç iş günü içinde hesap ekstrende görünür.";
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `${fullyRefunded ? "İadeniz yapıldı" : "Kısmi iadeniz yapıldı"} - ${data.orderNumber}`,
    preheader: `${amount} ${kind}iade tutarın kartına gönderildi.`,
    footer: "transactional",
    blocks: [
      badge(fullyRefunded ? "İADE YAPILDI" : "KISMİ İADE YAPILDI", "green", "💳"),
      heading(`${fullyRefunded ? "İade" : "Kısmi iade"} işlemin başlatıldı`),
      paragraph(`Merhaba ${escapeHtml(name)}, ${escapeHtml(data.orderNumber)} numaralı siparişin için ${amount} tutarında ${kind}iade işlemini başlattık.`, {
        margin: "0 0 22px"
      }),
      `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px"><tr><td align="center" style="padding:26px 18px;background:#faf8f6;border-radius:12px">
<div style="font-size:12px;letter-spacing:1px;color:#5f5f5f">İADE TUTARI</div>
<div style="margin-top:6px;font-size:32px;font-weight:700;color:#111111">${escapeHtml(amount)}</div>
<div style="margin-top:6px;font-size:13px;color:#5f5f5f">Ödemede kullandığın karta</div></td></tr></table>`,
      infoBox("🕒", "Tutar ne zaman yansır?", when),
      button("Siparişimi görüntüle", url),
      secondaryLink("Sorun mu var? Bize yaz", `${data.siteUrl}/iletisim`)
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişin için ${amount} tutarında ${kind}iade işlemini başlattık.`,
      when,
      `Siparişimi görüntüle: ${url}`
    ]
  });
}

export type ReturnEmailData = {
  siteUrl: string;
  customerName: string;
  orderNumber: string;
  type: ReturnType | null;
  items: OrderEmailItem[];
};

const RETURN_STEPS: ReturnStatus[] = ["TALEP_EDILDI", "ONAYLANDI", "KARGODA", "TAMAMLANDI"];

// Sitedeki "Iade Kosullari" sayfasindaki adimlardan. Uygun metni olmayan durumda null (kutu gizlenir).
function returnNextStep(status: ReturnStatus, type: ReturnType | null): string | null {
  const a = STORE_INFO.address;
  if (status === "ONAYLANDI") {
    return `Ürünü faturası, orijinal ambalajı ve etiketleriyle birlikte, kullanılmamış şekilde paketleyip ${a.streetAddress} ${a.addressLocality}/${a.addressRegion} adresine gönderebilir ya da ${a.addressLocality} mağazamıza getirebilirsin. İade kargo ücreti alıcıya aittir.`;
  }
  if (status === "TAMAMLANDI" && type === "IADE") {
    return `Ürün elimize ulaştı ve kontrolü tamamlandı. Bedeli en geç ${STORE_INFO.returnDays} gün içinde ödemeyi yaptığın yönteme iade edilir.`;
  }
  return null;
}

export function returnStatusEmail(data: ReturnEmailData, status: ReturnStatus): RenderedEmail {
  const name = firstName(data.customerName);
  const label = returnStatusLabel[status];
  const typeWord = data.type ? returnTypeLabel[data.type] : "İade/değişim";
  const url = statusUrl(data.siteUrl);
  const next = returnNextStep(status, data.type);
  const rejected = status === "REDDEDILDI";
  const { items } = data;
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `İade talebiniz ${label} - ${data.orderNumber}`,
    preheader: next ? `Talebin ${label.toLocaleLowerCase("tr")}, sıradaki adım burada.` : `${typeWord} talebinin durumu: ${label}.`,
    footer: "transactional",
    blocks: [
      badge(`TALEBİN ${label.toLocaleUpperCase("tr")}`, rejected ? "red" : "green", rejected ? "" : "✓"),
      heading(`${escapeHtml(typeWord)} talebin ${escapeHtml(label.toLocaleLowerCase("tr"))}`),
      paragraph(
        `Merhaba ${escapeHtml(name)}, ${escapeHtml(data.orderNumber)} numaralı siparişine ait ${escapeHtml(typeWord.toLocaleLowerCase("tr"))} talebinin durumu güncellendi.`,
        { margin: "0 0 22px" }
      ),
      rejected ? "" : stepper(RETURN_STEPS.map((s) => returnStatusLabel[s]), RETURN_STEPS.indexOf(status)),
      productRows(itemLines(items)),
      items.length > 0 ? spacer(22) : "",
      next ? infoBox("➡️", "Sıradaki adım", escapeHtml(next)) : "",
      button("Talebimi görüntüle", url),
      rejected ? secondaryLink("Sorun mu var? Bize yaz", `${data.siteUrl}/iletisim`) : ""
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişine ait ${typeWord.toLocaleLowerCase("tr")} talebinin durumu "${label}" olarak güncellendi.`,
      ...itemText(items),
      ...(next ? ["", `Sıradaki adım: ${next}`] : []),
      `Talebimi görüntüle: ${url}`
    ]
  });
}
