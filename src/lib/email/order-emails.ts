import { formatDate, formatExactPrice } from "@/lib/format";
import { returnStatusLabel, returnTypeLabel, type ReturnStatus, type ReturnType } from "@/lib/status";
import { openingHoursLines, RETURN_INFO, STORE_INFO } from "@/lib/store-info";
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

// Siparis, kargo, iade e-postalari (MAIL_TASARIMLARI_PLANI.md 01-05, IADE_TALEBI_SISTEMI_PLANI.md 16-18). Saf
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
  reason: string;
  customerNote: string | null;
  // Musteriye gorunen yanit (adminNote ic nottur, maile girmez).
  customerReply: string | null;
  // Uye ise /hesap/iade-taleplerim, misafirse /siparis-durumu.
  viewUrl: string;
};

const RETURN_STEPS: ReturnStatus[] = ["TALEP_EDILDI", "ONAYLANDI", "KARGODA", "TAMAMLANDI"];

function multiline(value: string): string {
  return escapeHtml(value).replace(/\r?\n/g, "<br>");
}

function returnWord(type: ReturnType | null): string {
  return type ? returnTypeLabel[type] : "İade/değişim";
}

function replyBox(reply: string | null): string {
  return reply ? infoBox("💬", "Bollmark yanıtı", multiline(reply)) : "";
}

// "Urunu nasil gonderirim?" adimlari (hesaptaki rehber kutusuyla ayni sira).
export function returnGuideSteps(orderNumber: string): string[] {
  const r = RETURN_INFO;
  return [
    "Ürünü kullanılmamış, etiketleri sökülmemiş, orijinal ambalajında ve faturasıyla paketle.",
    `Paketin üstüne veya içine sipariş numaranı (${orderNumber}) yaz.`,
    `Paketi en yakın ${STORE_INFO.returnCarrier} şubesine götür.`,
    `Görevliye anlaşmalı iade kodumuzu söyle: ${r.returnCarrierCode}. Gönderim ücretsizdir.`,
    `Alıcı: ${r.returnRecipient}, ${r.returnAddress}.`,
    "Kargo fişindeki takip numarasını sakla."
  ];
}

export function returnGuideWarning(): string {
  return `${STORE_INFO.returnCarrier} dışındaki kargo firmalarıyla yapılan gönderimlerde iade kargo ücreti alıcıya aittir. Ürünü ${STORE_INFO.address.addressLocality} mağazamıza elden de getirebilirsin (${openingHoursLines().join(", ")}).`;
}

function returnGuideBlocks(orderNumber: string): string[] {
  const steps = returnGuideSteps(orderNumber)
    .map((step, i) => `<div style="margin-top:${i === 0 ? 0 : 6}px">${i + 1}. ${escapeHtml(step)}</div>`)
    .join("");
  return [
    infoGrid([
      { label: "ANLAŞMALI İADE KODU", value: RETURN_INFO.returnCarrierCode },
      { label: "KARGO FİRMASI", value: STORE_INFO.returnCarrier }
    ]),
    infoBox("📍", "İade adresi", `${escapeHtml(RETURN_INFO.returnRecipient)}<br>${escapeHtml(RETURN_INFO.returnAddress)}`),
    infoBox("📦", "Ürünü nasıl gönderirim?", `${steps}<div style="margin-top:10px">${escapeHtml(returnGuideWarning())}</div>`)
  ];
}

// Sitedeki "Iade Kosullari" sayfasindaki adimlardan. Uygun metni olmayan durumda null (kutu gizlenir).
function returnNextStep(status: ReturnStatus, type: ReturnType | null): string | null {
  const r = RETURN_INFO;
  if (status === "ONAYLANDI") {
    return `Ürünü faturası, orijinal ambalajı ve etiketleriyle birlikte, kullanılmamış şekilde paketleyip ${r.returnAddress} adresine gönderebilir ya da ${STORE_INFO.address.addressLocality} mağazamıza getirebilirsin. İade için anlaşmalı kargo firmamız: ${STORE_INFO.returnCarrier}. Ürünü bu firma ile, ${r.returnCarrierCode} numaralı anlaşmalı iade kodumuzu kullanarak ücretsiz gönderebilirsin. Anlaşmalı kargo firmamız dışında bir kargo firmasıyla yapılan gönderimlerde iade kargo ücreti alıcıya aittir.`;
  }
  if (status === "KARGODA") {
    return "Kargon yolda, ürün bize ulaşınca haber vereceğiz.";
  }
  if (status === "TAMAMLANDI" && type === "IADE") {
    return `Ürün elimize ulaştı ve kontrolü tamamlandı. Bedeli en geç ${STORE_INFO.returnDays} gün içinde ödemeyi yaptığın yönteme iade edilir.`;
  }
  return null;
}

// 05 - durum mailleri (ONAYLANDI, REDDEDILDI, KARGODA, TAMAMLANDI).
export function returnStatusEmail(data: ReturnEmailData, status: ReturnStatus): RenderedEmail {
  const name = firstName(data.customerName);
  const label = returnStatusLabel[status];
  const typeWord = returnWord(data.type);
  const url = data.viewUrl;
  const next = returnNextStep(status, data.type);
  const rejected = status === "REDDEDILDI";
  const shipping = status === "KARGODA";
  const guide = status === "ONAYLANDI";
  const { items } = data;
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `İade talebiniz ${label} - ${data.orderNumber}`,
    preheader: guide
      ? "Talebin onaylandı, iade kodun ve gönderim adresi bu mailde."
      : next
        ? `Talebin ${label.toLocaleLowerCase("tr")}, sıradaki adım burada.`
        : `${typeWord} talebinin durumu: ${label}.`,
    footer: "transactional",
    blocks: [
      badge(`TALEBİN ${label.toLocaleUpperCase("tr")}`, rejected ? "red" : shipping ? "blue" : "green", rejected ? "" : shipping ? "🚚" : "✓"),
      heading(`${escapeHtml(typeWord)} talebin ${escapeHtml(label.toLocaleLowerCase("tr"))}`),
      paragraph(
        `Merhaba ${escapeHtml(name)}, ${escapeHtml(data.orderNumber)} numaralı siparişine ait ${escapeHtml(typeWord.toLocaleLowerCase("tr"))} talebinin durumu güncellendi.`,
        { margin: "0 0 22px" }
      ),
      rejected ? "" : stepper(RETURN_STEPS.map((s) => returnStatusLabel[s]), RETURN_STEPS.indexOf(status)),
      replyBox(data.customerReply),
      productRows(itemLines(items)),
      items.length > 0 ? spacer(22) : "",
      next ? infoBox("➡️", "Sıradaki adım", escapeHtml(next)) : "",
      ...(guide ? returnGuideBlocks(data.orderNumber) : []),
      button("Talebimi görüntüle", url),
      rejected ? secondaryLink("Sorun mu var? Bize yaz", `${data.siteUrl}/iletisim`) : ""
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişine ait ${typeWord.toLocaleLowerCase("tr")} talebinin durumu "${label}" olarak güncellendi.`,
      ...(data.customerReply ? ["", `Bollmark yanıtı: ${data.customerReply}`] : []),
      ...itemText(items),
      ...(next ? ["", `Sıradaki adım: ${next}`] : []),
      ...(guide
        ? [
            "",
            `Anlaşmalı iade kodu: ${RETURN_INFO.returnCarrierCode} (${STORE_INFO.returnCarrier})`,
            `İade adresi: ${RETURN_INFO.returnRecipient}, ${RETURN_INFO.returnAddress}`,
            "Ürünü nasıl gönderirim?",
            ...returnGuideSteps(data.orderNumber).map((step, i) => `${i + 1}. ${step}`),
            returnGuideWarning()
          ]
        : []),
      `Talebimi görüntüle: ${url}`
    ]
  });
}

// 16 - talep acilinca musteriye.
export function returnReceivedEmail(data: ReturnEmailData): RenderedEmail {
  const name = firstName(data.customerName);
  const typeWord = returnWord(data.type);
  const lower = typeWord.toLocaleLowerCase("tr");
  const after = "Talebin onaylanınca iade kodu ve gönderim adresi hesabında ve e-postanda görünecek. O zamana kadar ürünü kullanmadan, etiketleriyle sakla.";
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `İade talebiniz alındı - ${data.orderNumber}`,
    preheader: `${typeWord} talebini aldık, inceleyip sana döneceğiz.`,
    footer: "transactional",
    blocks: [
      badge("TALEBİN ALINDI", "blue", "📨"),
      heading(`${escapeHtml(typeWord)} talebini aldık`),
      paragraph(
        `Merhaba ${escapeHtml(name)}, ${escapeHtml(data.orderNumber)} numaralı siparişin için ${escapeHtml(lower)} talebini aldık. İnceleyip en kısa sürede e-postayla dönüş yapacağız.`,
        { margin: "0 0 22px" }
      ),
      stepper(RETURN_STEPS.map((s) => returnStatusLabel[s]), 0),
      infoGrid([
        { label: "SİPARİŞ NO", value: data.orderNumber },
        { label: "TALEP", value: typeWord },
        { label: "SEBEP", value: data.reason }
      ]),
      productRows(itemLines(data.items)),
      data.items.length > 0 ? spacer(22) : "",
      data.customerNote ? infoBox("📝", "Notun", multiline(data.customerNote)) : "",
      infoBox("➡️", "Sırada ne var?", escapeHtml(after)),
      button("Talebimi görüntüle", data.viewUrl)
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişin için ${lower} talebini aldık. İnceleyip en kısa sürede e-postayla dönüş yapacağız.`,
      `Sebep: ${data.reason}`,
      ...(data.customerNote ? [`Notun: ${data.customerNote}`] : []),
      ...itemText(data.items),
      "",
      after,
      `Talebimi görüntüle: ${data.viewUrl}`
    ]
  });
}

// 17 - talep acilinca bize (admin).
export function returnAdminNewEmail(data: ReturnEmailData, adminUrl: string): RenderedEmail {
  const typeWord = returnWord(data.type);
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `Yeni ${typeWord.toLocaleLowerCase("tr")} talebi: ${data.orderNumber}`,
    preheader: `${data.customerName} · ${data.reason}`,
    footer: "transactional",
    blocks: [
      badge(`YENİ ${typeWord.toLocaleUpperCase("tr")} TALEBİ`, "blue", "📨"),
      heading(`${escapeHtml(data.orderNumber)} için ${escapeHtml(typeWord.toLocaleLowerCase("tr"))} talebi`),
      infoGrid([
        { label: "MÜŞTERİ", value: data.customerName },
        { label: "TALEP", value: typeWord },
        { label: "SEBEP", value: data.reason }
      ]),
      productRows(itemLines(data.items)),
      data.items.length > 0 ? spacer(22) : "",
      data.customerNote ? infoBox("📝", "Müşteri notu", multiline(data.customerNote)) : "",
      button("Talebi panelde aç", adminUrl)
    ],
    textLines: [
      `Yeni ${typeWord.toLocaleLowerCase("tr")} talebi: ${data.orderNumber}`,
      `Müşteri: ${data.customerName}`,
      `Sebep: ${data.reason}`,
      ...(data.customerNote ? [`Müşteri notu: ${data.customerNote}`] : []),
      ...itemText(data.items),
      "",
      `Talebi panelde aç: ${adminUrl}`
    ]
  });
}

// 18 - admin yanit yazdiginda (durum maili gitmiyorsa) musteriye.
export function returnReplyEmail(data: ReturnEmailData, status: ReturnStatus): RenderedEmail {
  const name = firstName(data.customerName);
  const lower = returnWord(data.type).toLocaleLowerCase("tr");
  const reply = data.customerReply ?? "";
  return renderEmail({
    siteUrl: data.siteUrl,
    subject: `İade talebinize yanıt var - ${data.orderNumber}`,
    preheader: reply.length > 90 ? `${reply.slice(0, 90)}…` : reply,
    footer: "transactional",
    blocks: [
      badge("YANITIMIZ VAR", "blue", "💬"),
      heading("Talebine yanıt verdik"),
      paragraph(`Merhaba ${escapeHtml(name)}, ${escapeHtml(data.orderNumber)} numaralı siparişine ait ${escapeHtml(lower)} talebine yanıt yazdık.`, {
        margin: "0 0 22px"
      }),
      status === "REDDEDILDI" ? "" : stepper(RETURN_STEPS.map((s) => returnStatusLabel[s]), Math.max(0, RETURN_STEPS.indexOf(status))),
      replyBox(reply),
      productRows(itemLines(data.items)),
      data.items.length > 0 ? spacer(22) : "",
      button("Talebimi görüntüle", data.viewUrl),
      secondaryLink("Sorun mu var? Bize yaz", `${data.siteUrl}/iletisim`)
    ],
    textLines: [
      `Merhaba ${name}, ${data.orderNumber} numaralı siparişine ait ${lower} talebine yanıt yazdık.`,
      "",
      `Bollmark yanıtı: ${reply}`,
      ...itemText(data.items),
      "",
      `Talebimi görüntüle: ${data.viewUrl}`
    ]
  });
}
