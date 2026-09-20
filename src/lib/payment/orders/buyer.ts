// iyzico alici/adres alanlarinin olusturulmasi (bkz. plan 5.A). Saf fonksiyonlar.

export class BuyerError extends Error {
  constructor(
    message: string,
    public readonly field: "phone" | "name"
  ) {
    super(message);
  }
}

// TCKN toplanmaz (KVKK); iyzico "zorunlu" dedigi icin sabit yer tutucu gonderilir.
// Canlida kabul edilip edilmedigi iyzico entegrasyon destegiyle teyit edilecek (plan 1.9/1).
export const IDENTITY_NUMBER_PLACEHOLDER = "11111111111";

// "Ali" -> Ali/Ali (tek kelimelik ad: soyad = ad), "Ayse Nur Yilmaz" -> "Ayse Nur"/"Yilmaz".
export function splitName(fullName: string): { name: string; surname: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new BuyerError("Ad soyad boş.", "name");
  if (parts.length === 1) return { name: parts[0], surname: parts[0] };
  return { name: parts.slice(0, -1).join(" "), surname: parts[parts.length - 1] };
}

// 0555 123 45 67, +90 555 123 45 67, 555 123 45 67, 905551234567 -> +905551234567
export function normalizePhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("90") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0") && digits.length === 11) digits = digits.slice(1);
  if (!/^[1-9]\d{9}$/.test(digits)) {
    throw new BuyerError("Telefon numarası geçersiz.", "phone");
  }
  return `+90${digits}`;
}

// x-forwarded-for'un ilk degeri, yoksa x-real-ip. IPv4-mapped IPv6 sadelestirilir,
// yerel gelistirmedeki ::1 -> 127.0.0.1.
export function extractIp(headers: { get(name: string): string | null }): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  let ip = forwarded || headers.get("x-real-ip")?.trim() || "127.0.0.1";
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1") ip = "127.0.0.1";
  return ip;
}

export type BuyerOrder = {
  id: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  district: string;
  postalCode: string | null;
};

export function buildBuyerAndAddresses(order: BuyerOrder, ip: string) {
  const { name, surname } = splitName(order.customerName);
  const address = `${order.shippingAddress}, ${order.district}`;
  const zipCode = order.postalCode?.trim() || undefined;

  const buyer = {
    id: order.customerId ?? `guest-${order.id}`,
    name,
    surname,
    identityNumber: IDENTITY_NUMBER_PLACEHOLDER,
    email: order.customerEmail,
    gsmNumber: normalizePhone(order.customerPhone),
    registrationAddress: address,
    city: order.city,
    country: "Turkey",
    ip,
    ...(zipCode ? { zipCode } : {})
  };
  const addressBlock = {
    contactName: order.customerName.trim(),
    city: order.city,
    country: "Turkey",
    address,
    ...(zipCode ? { zipCode } : {})
  };
  return { buyer, shippingAddress: addressBlock, billingAddress: addressBlock };
}
