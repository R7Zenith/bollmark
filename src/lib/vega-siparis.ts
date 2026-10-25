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
// Odenmis yeni siparis Ticimax'taki gibi "OnayBekliyor": "Onaylandi" (2)
// gonderilince Vega yalniz "Kargo Bekleyen" sayacini artirdi, listeye almadi
// (canli deneme 2026-10-26).
const DURUMLAR: Record<string, [number, string]> = {
  PAID: [1, "OnayBekliyor"],
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

// Ticimax DataContract alanlarinin TAMAMI (SiparisServis.pdf). Gercek WCF
// cevabi her alani her zaman yazar (deger tipleri varsayilanla, referanslar
// i:nil). Yalniz doldurdugumuz alanlar gidince Vega siparisi okuyup tutarini
// topladi ama listesine kaydetmedi (canli deneme 2026-10-26) - bu yuzden hepsi
// gonderiliyor. Turler: i int, d double, b bool, t datetime, s string, o nesne/liste.
type Kind = "i" | "d" | "b" | "t" | "s" | "o";
const SCHEMAS = {
  WebSiparis: {
    AdiSoyadi: "s", Durum: "i", EntegrasyonAktarildi: "b", FaturaAdresId: "i", FaturaAdresi: "o", FaturaNo: "s",
    FaturaTarihi: "t", HediyeCeki: "s", HediyeCekiTutari: "d", HediyePaketiNotu: "s", HediyePaketiTutari: "d",
    HediyePaketiVar: "b", ID: "i", IPAdresi: "s", IndirimTutari: "d", KargoAdresID: "i", KargoEntegrasyonID: "i",
    KargoEntegrasyonTakipNo: "s", KargoFirmaId: "i", KargoTakipNo: "s", KargoTutari: "d", Kaynak: "i", Kur: "d",
    Mail: "s", Maliyet: "d", Odemeler: "o", ParaBirimi: "s", Referer: "s", ReklamKaynagi: "s",
    // SiparisKodu/SiparisNo PDF tablosunda yok (metin cikariminda dusmus olabilir) ama filtrede var. Yalniz
    // SiparisNo gidince Vega'nin "Siparis No" sutunu bos kaldi (2026-10-26); ikisi de yaziliyor.
    SepetKampanyasiIndirimi: "d", SiparisDurumu: "s", SiparisKaynagi: "s", SiparisKodu: "s", SiparisNo: "s",
    SiparisNotu: "s", SiparisTarihi: "t",
    SiparisToplamTutari: "d", StokDustu: "b", TeslimatAdresi: "o", TeslimatGunu: "t", TeslimatSaati: "s",
    ToplamKdv: "d", ToplamTutar: "d", Tutar: "d", Urunler: "o", UyeAdi: "s", UyeID: "i", UyeMusteriKodu: "s",
    UyeSoyadi: "s"
  },
  // AliciAdi PDF'te yok; gonderilmeyince Vega'da "Fatura Adi" bos kaldi (bilinmeyen alani Vega yok sayar).
  FaturaAdres: {
    Adres: "s", AliciAdi: "s", AliciTelefon: "s", EntegrasyonId: "s", FirmaAdi: "s", ID: "i", Il: "s", IlId: "i", IlKodu: "s",
    Ilce: "s", IlceId: "i", IlceKodu: "s", Ulke: "o", VergiDairesi: "s", VergiNo: "s", isKurumsal: "b"
  },
  TeslimatAdres: {
    Adres: "s", AdresTarifi: "s", AliciAdi: "s", AliciTelefon: "s", ID: "i", Il: "s", IlId: "i", IlKodu: "s",
    Ilce: "s", IlceId: "i", IlceKodu: "s", PostaKodu: "s", Ulke: "o"
  },
  WebUlke: { Alpha2Code: "s", Alpha3Code: "s" },
  WebSiparisOdeme: {
    BankaKomisyonu: "d", CheckSum: "s", HavaleBankaID: "i", HavaleHesapID: "i", ID: "i", KKOdemeBankaID: "i",
    KapidaOdemeTutari: "d", OdemeIndirimi: "d", OdemeNotu: "s", OdemeSecenekID: "i", OdemeTipi: "i",
    Onaylandi: "i", PosReferansID: "s", SiparisID: "i", TaksitSayisi: "i", Tarih: "t", Tutar: "d", UyeID: "i"
  },
  WebSiparisUrun: {
    Adet: "d", Barkod: "s", Durum: "i", DurumAd: "s", ID: "i", IslemAd: "s", IslemID: "i", KampanyaID: "i",
    KampanyaIndirimTutari: "d", KdvOrani: "i", KdvTutari: "d", MagazaAtamaTarihi: "t", MagazaDurum: "i",
    MagazaGonderimTarihi: "t", MagazaID: "i", MagazaKodu: "s", Maliyet: "d", SiparisId: "i", StokKodu: "s",
    TedarikciID: "i", TedarikciKodu: "s", TedarikciKodu2: "s", Tutar: "d", UrunAdi: "s", UrunID: "i", UrunKartiID: "i"
  }
} satisfies Record<string, Record<string, Kind>>;
type SchemaName = keyof typeof SCHEMAS;
type Values<T extends SchemaName> = Partial<Record<keyof (typeof SCHEMAS)[T], string>>;

const DEFAULTS: Record<Kind, string | null> = { i: "0", d: "0", b: "false", t: "0001-01-01T00:00:00", s: null, o: null };

// Alanlar ordinal alfabetik sirada (WCF varsayilani, UrunServis'te dogrulandi).
// Nesne tipindeki alan (orn. TeslimatAdresi) dogrudan alanlarini icerir; tip
// adi etiketi (orn. <a:WebSiparisUrun>) yalniz liste elemanlarinda olur.
function fields<T extends SchemaName>(schema: T, values: Values<T>): string {
  const kinds: Record<string, Kind> = SCHEMAS[schema];
  const given: Record<string, string | undefined> = values;
  return Object.keys(kinds)
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))
    .map((name) => {
      const value = given[name] ?? DEFAULTS[kinds[name]];
      return value === null ? `<a:${name} i:nil="true"/>` : `<a:${name}>${value}</a:${name}>`;
    })
    .join("");
}

function element<T extends SchemaName>(schema: T, values: Values<T>): string {
  return `<a:${schema}>${fields(schema, values)}</a:${schema}>`;
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
  // Vega'nin onayladigi (SetSiparisDurum "Onaylandi") odenmis siparis Ticimax'taki gibi Onaylandi gorunur.
  const [durum, durumAdi] =
    order.status === "PAID" && order.vegaFetchedAt ? [2, "Onaylandi"] : (DURUMLAR[order.status] ?? DURUMLAR.PAID);
  const ulke = fields("WebUlke", { Alpha2Code: "TR", Alpha3Code: "TUR" });

  let toplamKdv = vatFromGrossCents(order.shippingCents, SHIPPING_VAT_RATE);
  const urunler = order.items
    .map((item, index) => {
      // Vega fatura tutarini Tutar + KdvTutari olarak hesapliyor: KDV dahil
      // Tutar gonderilince 1.390 TL'lik satir 1.516,36 faturalandi (2026-10-26).
      // Bu yuzden birim fiyat KDV haric; net + KDV kurusu kurusuna KDV dahil birim fiyata esit.
      const birimBrut = Math.round(linePaidCents(order, item) / item.quantity);
      const kdvOrani = resolveVatRate(item.product);
      const birimKdv = Math.round(vatFromGrossCents(birimBrut, kdvOrani));
      toplamKdv += birimKdv * item.quantity;
      return element("WebSiparisUrun", {
        Adet: String(item.quantity),
        Barkod: xmlEscape(item.variant ? (item.variant.barcode ?? item.variant.sku) : ""),
        // Satir kimligi siparisler arasi tekil olsun diye siparis ID'sinden turetiliyor.
        ID: String(order.vegaId * 1000 + index + 1),
        KdvOrani: String(kdvOrani),
        // Birim basina (adet > 1'de Vega'nin carpip carpmadigi ilk cok adetli sipariste dogrulanacak).
        KdvTutari: money(birimKdv),
        SiparisId: String(order.vegaId),
        StokKodu: xmlEscape(item.variant?.sku ?? ""),
        Tutar: money(birimBrut - birimKdv),
        UrunAdi: xmlEscape(item.product.name),
        UrunID: String(item.variant?.vegaId ?? 0),
        UrunKartiID: String(item.product.vegaId)
      });
    })
    .join("");

  const odeme = element("WebSiparisOdeme", {
    ID: String(order.vegaId),
    OdemeTipi: "0", // 0 = KrediKarti (iyzico); Vega eslemesi acik soru
    Onaylandi: "1",
    SiparisID: String(order.vegaId),
    TaksitSayisi: String(order.installment ?? 1),
    // Vega bu tarihi (SiparisTarihi'nin aksine) UTC sayip yerel saate ceviriyor: Istanbul
    // saati gidince 3 saat ileri gorundu (2026-10-26). Bu yuzden UTC, ekisiz.
    Tarih: (order.paidAt ?? order.createdAt).toISOString().slice(0, 19),
    Tutar: money(order.totalCents),
    UyeID: String(order.vegaId)
  });

  const adres = xmlEscape(order.shippingAddress);
  const il = xmlEscape(order.city);
  const ilce = xmlEscape(order.district);
  const telefon = xmlEscape(order.customerPhone);

  return element("WebSiparis", {
    AdiSoyadi: xmlEscape(order.customerName),
    Durum: String(durum),
    // Vega SetSiparisAktarildi cagirmiyor; Ticimax'ta da bu durumda hep false kalirdi.
    EntegrasyonAktarildi: "false",
    FaturaAdresId: String(order.vegaId),
    FaturaAdresi: fields("FaturaAdres", {
      Adres: adres,
      AliciAdi: xmlEscape(order.customerName),
      AliciTelefon: telefon,
      ID: String(order.vegaId),
      Il: il,
      Ilce: ilce,
      Ulke: ulke,
      // Bireysel fatura: Ticimax doneminde de TC yerine 11111111111 yaziliyordu.
      VergiNo: "11111111111",
      isKurumsal: "false"
    }),
    ID: String(order.vegaId),
    KargoAdresID: String(order.vegaId),
    KargoTutari: money(order.shippingCents),
    Kur: "1",
    Mail: xmlEscape(order.customerEmail),
    Odemeler: odeme,
    ParaBirimi: "TL",
    SiparisDurumu: durumAdi,
    SiparisKodu: xmlEscape(order.orderNumber),
    SiparisNo: xmlEscape(order.orderNumber),
    SiparisNotu: xmlEscape(order.note ?? ""),
    SiparisTarihi: formatVegaDate(order.createdAt),
    SiparisToplamTutari: money(order.totalCents),
    StokDustu: "true",
    TeslimatAdresi: fields("TeslimatAdres", {
      Adres: adres,
      AliciAdi: xmlEscape(order.customerName),
      AliciTelefon: telefon,
      ID: String(order.vegaId),
      Il: il,
      Ilce: ilce,
      PostaKodu: xmlEscape(order.postalCode ?? ""),
      Ulke: ulke
    }),
    ToplamKdv: money(toplamKdv),
    ToplamTutar: money(order.totalCents),
    Tutar: money(order.totalCents),
    Urunler: urunler,
    UyeAdi: xmlEscape(ad),
    // Vega "Musteri Kodu"nu buradan uretiyor olabilir; 0 tum siparisleri tek
    // cariye toplardi. Hesap zorunlu olmadigi icin siparis basina tekil deger.
    UyeID: String(order.vegaId),
    UyeSoyadi: xmlEscape(soyad)
  });
}
