import { randomUUID } from "node:crypto";
import { istanbulDateKey } from "@/lib/format";
import type { HepsijetCompanyInfo } from "./config";

// Siparis -> HepsiJET STD (Standart Teslimat) payload'i (bkz. plan bolum 3 ve
// 2.1). Saf fonksiyonlar; DB'ye ve aga dokunmaz. UUID ve "simdi" testte verilir.

export type HjDeliveryPayload = {
  company: { name: string; abbreviationCode: string };
  delivery: {
    customerDeliveryNo: string;
    customerOrderId: string;
    deliveryDateOriginal: string;
    totalParcels: string;
    desi: string;
    deliverySlotOriginal: string;
    deliveryType: "RETAIL";
    product: { productCode: "HX_STD" };
    senderAddress: HjAddress;
    receiver: {
      companyCustomerId: string;
      firstName: string;
      lastName: string;
      phone1: string;
      phone2: string;
      email: string;
    };
    recipientAddress: HjAddress;
    recipientPerson: string;
    recipientPersonPhone1: string;
  };
  // Dokumana gore kok seviyede (delivery icinde degil).
  currentXDock: { abbreviationCode: string };
  deliveryContent: HjContentItem[];
};

type HjAddress = {
  companyAddressId: string;
  country: { name: string };
  city: { name: string };
  town: { name: string };
  district: { name: string };
  addressLine1: string;
};

type HjContentItem = {
  sku: string;
  description: string;
  desi: number;
  quantity: number;
  indivisibleQuantity: boolean;
};

export type HjOrder = {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  shippingAddress: string;
  city: string;
  district: string; // Bollmark'ta "district" = ilce (HepsiJET town)
};

export type HjOrderItem = {
  sku: string;
  name: string;
  variantLabel: string; // "Siyah / M" ya da ""
  quantity: number;
};

export const COUNTRY_NAME = "Türkiye";
export const MAX_DELIVERY_NO = 19; // K-barkod "_2" eki icin 21'den 2 eksik
const MAX_ORDER_ID = 25; // etikette tasmamasi icin
const MAX_DESCRIPTION = 200;

function collapse(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

// Cep telefonu "05xxxxxxxxx" (kurye SMS'i icin cep zorunlu). Olmazsa null.
export function normalizeHjPhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("90")) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^5\d{9}$/.test(digits) ? `0${digits}` : null;
}

// Son kelime soyad, oncesi ad. Tek kelimeyse null (ikisi de zorunlu).
export function splitName(input: string): { firstName: string; lastName: string } | null {
  const parts = collapse(input).split(" ").filter(Boolean);
  if (parts.length < 2) return null;
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

// Siparis numaralari zaten onekle basliyor (BLM261105-9473); onek bir daha
// eklenmez. Iptal edilip yeniden gonderilirse -2, -3 ...
export function deliveryNoFor(prefix: string, orderNumber: string, attempt: number): string {
  const p = prefix.trim().toUpperCase();
  const base = orderNumber.toUpperCase().startsWith(p) ? orderNumber : `${p}${orderNumber}`;
  const no = attempt <= 1 ? base : `${base}-${attempt}`;
  if (no.length > MAX_DELIVERY_NO) throw new Error(`HepsiJET gönderi no ${MAX_DELIVERY_NO} karakteri geçiyor: ${no}`);
  return no;
}

export type HjBuildResult =
  | { ok: true; payload: HjDeliveryPayload; warnings: string[] }
  | { ok: false; errors: string[] };

export function buildHjPayload(
  order: HjOrder,
  items: HjOrderItem[],
  company: HepsijetCompanyInfo,
  opts: { deliveryNo: string; now?: Date; uuid?: () => string }
): HjBuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const uuid = opts.uuid ?? randomUUID;

  const name = splitName(order.customerName);
  if (!name) errors.push("Alıcı adı ve soyadı birlikte yazılmalı.");

  const phone = normalizeHjPhone(order.customerPhone);
  if (!phone) errors.push("Alıcı telefonu cep numarası olmalı (05xx xxx xx xx).");

  const address = collapse(order.shippingAddress);
  if (address.length < 10) errors.push("Adres en az 10 karakter olmalı.");

  const city = collapse(order.city);
  const town = collapse(order.district);
  if (!city || !town) errors.push("İl ve ilçe dolu olmalı.");

  if (!opts.deliveryNo || opts.deliveryNo.length > MAX_DELIVERY_NO) {
    errors.push(`Gönderi no boş ya da ${MAX_DELIVERY_NO} karakterden uzun.`);
  }

  const content = items
    .filter((i) => i.quantity > 0)
    .map((i) => ({
      sku: collapse(i.sku),
      description: collapse([i.name, i.variantLabel].filter((s) => collapse(s)).join(" - ")).slice(0, MAX_DESCRIPTION),
      desi: 1,
      quantity: Math.trunc(i.quantity),
      indivisibleQuantity: false
    }));
  if (content.length === 0) errors.push("Siparişte gönderilecek ürün yok.");
  if (content.some((c) => !c.sku || !c.description)) errors.push("Her ürünün stok kodu ve adı dolu olmalı.");

  if (errors.length) return { ok: false, errors };

  const customerOrderId = order.orderNumber.slice(0, MAX_ORDER_ID);
  if (customerOrderId !== order.orderNumber) warnings.push("Sipariş no etikette 25 karakterle kırpıldı.");
  const fullName = `${name!.firstName} ${name!.lastName}`;

  return {
    ok: true,
    warnings,
    payload: {
      company: { name: company.companyName, abbreviationCode: company.companyCode },
      delivery: {
        customerDeliveryNo: opts.deliveryNo,
        customerOrderId,
        deliveryDateOriginal: istanbulDateKey(opts.now ?? new Date()),
        totalParcels: "1",
        desi: "1",
        deliverySlotOriginal: "0",
        deliveryType: "RETAIL",
        product: { productCode: "HX_STD" },
        senderAddress: {
          companyAddressId: company.sender.addressId,
          country: { name: COUNTRY_NAME },
          city: { name: company.sender.city },
          town: { name: company.sender.town },
          district: { name: company.sender.district },
          addressLine1: company.sender.addressLine
        },
        receiver: {
          companyCustomerId: uuid(),
          firstName: name!.firstName,
          lastName: name!.lastName,
          phone1: phone!,
          phone2: "",
          email: collapse(order.customerEmail)
        },
        recipientAddress: {
          companyAddressId: uuid(),
          country: { name: COUNTRY_NAME },
          city: { name: city },
          town: { name: town },
          // Bollmark'ta mahalle ayri tutulmuyor; acik adresin icinde.
          district: { name: "" },
          addressLine1: address
        },
        recipientPerson: fullName,
        recipientPersonPhone1: phone!
      },
      currentXDock: { abbreviationCode: company.xdockCode },
      deliveryContent: content
    }
  };
}
