// Bollmark siparisi -> Ticimax SiparisServis "WebSiparis" XML'i (Vega bunu
// cekip kendi siparisine ceviriyor, bkz. VEGA_SIPARIS_AKTARIM_PLANI.md).
// Saf fonksiyonlar: veritabanina dokunmaz, birim testlidir.
import { resolveVatRate, SHIPPING_VAT_RATE, vatFromGrossCents } from "@/lib/vat";

// Bu andan once odenmis siparisler Vega'ya gitmez (Vega "Entegrasyon
// Baslangici" 2022'den beri hepsini istiyor). 2026-10-26 00:00 Istanbul.
export const VEGA_SIPARIS_BASLANGIC = new Date("2026-10-25T21:00:00Z");

// Odenmis ve suren siparis durumlari: Vega'ya yeni siparis olarak bunlar gider.
export const VEGA_AKTIF_DURUMLAR = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"];

// Ticimax WebSiparisDurumlari (PDF + PHP istemcisi): Durum (int) ve SiparisDurumu (ad).
const DURUMLAR: Record<string, [number, string]> = {
  PAID: [2, "Onaylandi"],
  PREPARING: [4, "Paketleniyor"],
  SHIPPED: [6, "KargoyaVerildi"],
  DELIVERED: [7, "TeslimEdildi"],
  CANCELLED: [8, "Iptal"],
  REFUNDED: [9, "Iade"]
};

const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

export function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Vega tarihleri "2026-10-25T23:40:55Z" gibi gonderiyor: sonunda Z olsa da
// deger Istanbul saati (canli yakalamayla dogrulandi). Turkiye'de yaz saati yok.
export function parseVegaDate(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  const asUtc = new Date(`${match[1]}Z`);
  return Number.isNaN(asUtc.getTime()) ? null : new Date(asUtc.getTime() - ISTANBUL_OFFSET_MS);
}

// Vega'ya ayni bicimde (Istanbul saati, saat dilimi eki yok) geri yazilir.
export function formatVegaDate(value: Date): string {
  return new Date(value.getTime() + ISTANBUL_OFFSET_MS).toISOString().slice(0, 19);
}

function money(cents: number): string {
  return (cents / 100).toFixed(2);
}

// WCF DataContract alanlari ordinal alfabetik sirada olmali (UrunServis'te
// dogrulandi). Sirayi elle tutmak yerine burada siralaniyor. Nesne tipindeki
// alan (orn. TeslimatAdresi) dogrudan alanlarini icerir; tip adi etiketi
// (orn. <a:WebSiparisUrun>) yalniz liste elemanlarinda olur.
function fields(list: [string, string][]): string {
  const sorted = [...list].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  return sorted.map(([name, value]) => `<a:${name}>${value}</a:${name}>`).join("");
}

function element(tag: string, list: [string, string][]): string {
  return `<a:${tag}>${fields(list)}</a:${tag}>`;
}

export type VegaOrderInput = {
  vegaId: number;
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  city: string;
  district: string;
  postalCode: string | null;
  note: string | null;
  shippingCents: number;
  totalCents: number;
  installment: number | null;
  createdAt: Date;
  paidAt: Date | null;
  vegaFetchedAt: Date | null;
  items: {
    quantity: number;
    totalCents: number;
    paidCents: number | null;
    variant: { vegaId: number; sku: string; barcode: string | null } | null;
    product: {
      vegaId: number;
      name: string;
      vatRate: number | null;
      category: { vatRate: number | null; parent: { vatRate: number | null } | null } | null;
    };
  }[];
};

// Satir tutari: odeme sirasinda kupon/paket/puan indirimi satirlara dagitilmis
// tutar (OrderItem.paidCents). Tutari 0 olan sipariste paidCents bos kalir.
// Indirim ayrica gonderilmez: satirlar + kargo = siparis toplami (cift dusum
// riskine karsi).
function linePaidCents(order: VegaOrderInput, item: VegaOrderInput["items"][number]): number {
  if (item.paidCents !== null) return item.paidCents;
  return order.totalCents === 0 ? 0 : item.totalCents;
}

function splitName(fullName: string): [string, string] {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length < 2) return [parts[0] ?? "", ""];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1]];
}

export function buildWebSiparisXml(order: VegaOrderInput): string {
  const [ad, soyad] = splitName(order.customerName);
  const [durum, durumAdi] = DURUMLAR[order.status] ?? DURUMLAR.PAID;
  const ulke = fields([
    ["Alpha2Code", "TR"],
    ["Alpha3Code", "TUR"]
  ]);

  let toplamKdv = vatFromGrossCents(order.shippingCents, SHIPPING_VAT_RATE);
  const urunler = order.items
    .map((item, index) => {
      const paid = linePaidCents(order, item);
      const kdvOrani = resolveVatRate(item.product);
      const kdv = vatFromGrossCents(paid, kdvOrani);
      toplamKdv += kdv;
      return element("WebSiparisUrun", [
        ["Adet", String(item.quantity)],
        ["Barkod", xmlEscape(item.variant ? (item.variant.barcode ?? item.variant.sku) : "")],
        // Satir kimligi siparisler arasi tekil olsun diye siparis ID'sinden turetiliyor.
        ["ID", String(order.vegaId * 1000 + index + 1)],
        ["KdvOrani", String(kdvOrani)],
        ["KdvTutari", money(kdv)],
        ["SiparisId", String(order.vegaId)],
        ["StokKodu", xmlEscape(item.variant?.sku ?? "")],
        // Birim fiyat (KDV dahil); satir toplami = Tutar x Adet varsayimi (planda acik soru).
        ["Tutar", money(paid / item.quantity)],
        ["UrunAdi", xmlEscape(item.product.name)],
        ["UrunID", String(item.variant?.vegaId ?? 0)],
        ["UrunKartiID", String(item.product.vegaId)]
      ]);
    })
    .join("");

  const odemeTarihi = formatVegaDate(order.paidAt ?? order.createdAt);
  const odeme = element("WebSiparisOdeme", [
    ["ID", String(order.vegaId)],
    ["OdemeTipi", "0"], // 0 = KrediKarti (iyzico); Vega eslemesi acik soru
    ["Onaylandi", "1"],
    ["SiparisID", String(order.vegaId)],
    ["TaksitSayisi", String(order.installment ?? 1)],
    ["Tarih", odemeTarihi],
    ["Tutar", money(order.totalCents)]
  ]);

  const adres = xmlEscape(order.shippingAddress);
  const il = xmlEscape(order.city);
  const ilce = xmlEscape(order.district);
  const telefon = xmlEscape(order.customerPhone);

  return element("WebSiparis", [
    ["AdiSoyadi", xmlEscape(order.customerName)],
    ["Durum", String(durum)],
    ["EntegrasyonAktarildi", order.vegaFetchedAt ? "true" : "false"],
    [
      "FaturaAdresi",
      fields([
        ["Adres", adres],
        ["AliciTelefon", telefon],
        ["FirmaAdi", ""],
        ["ID", String(order.vegaId)],
        ["Il", il],
        ["Ilce", ilce],
        ["Ulke", ulke],
        ["VergiDairesi", ""],
        // Bireysel fatura: Ticimax doneminde de TC yerine 11111111111 yaziliyordu.
        ["VergiNo", "11111111111"],
        ["isKurumsal", "false"]
      ])
    ],
    ["ID", String(order.vegaId)],
    ["KargoTutari", money(order.shippingCents)],
    ["Kur", "1"],
    ["Mail", xmlEscape(order.customerEmail)],
    ["Odemeler", odeme],
    ["ParaBirimi", "TL"],
    ["SiparisDurumu", durumAdi],
    ["SiparisNo", xmlEscape(order.orderNumber)],
    ["SiparisNotu", xmlEscape(order.note ?? "")],
    ["SiparisTarihi", formatVegaDate(order.createdAt)],
    ["SiparisToplamTutari", money(order.totalCents)],
    ["StokDustu", "true"],
    [
      "TeslimatAdresi",
      fields([
        ["Adres", adres],
        ["AliciAdi", xmlEscape(order.customerName)],
        ["AliciTelefon", telefon],
        ["ID", String(order.vegaId)],
        ["Il", il],
        ["Ilce", ilce],
        ["PostaKodu", xmlEscape(order.postalCode ?? "")],
        ["Ulke", ulke]
      ])
    ],
    ["ToplamKdv", money(toplamKdv)],
    ["ToplamTutar", money(order.totalCents)],
    ["Tutar", money(order.totalCents)],
    ["Urunler", urunler],
    ["UyeAdi", xmlEscape(ad)],
    // Vega "Musteri Kodu"nu buradan uretiyor olabilir; 0 tum siparisleri tek
    // cariye toplardi. Hesap zorunlu olmadigi icin siparis basina tekil deger.
    ["UyeID", String(order.vegaId)],
    ["UyeSoyadi", xmlEscape(soyad)]
  ]);
}
