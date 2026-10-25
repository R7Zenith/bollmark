import { test } from "node:test";
import assert from "node:assert/strict";
import { buildWebSiparisXml, formatVegaDate, parseVegaDate, type VegaOrderInput } from "./vega-siparis";

function order(overrides: Partial<VegaOrderInput> = {}): VegaOrderInput {
  return {
    vegaId: 7,
    orderNumber: "BLM261026-1234",
    status: "PAID",
    customerName: "Ayşe Nur Yılmaz",
    customerEmail: "ayse@example.com",
    customerPhone: "05551112233",
    shippingAddress: "Atatürk Cad. No:1 <Daire 2>",
    city: "İzmir",
    district: "Karşıyaka",
    postalCode: null,
    note: null,
    shippingCents: 35000,
    totalCents: 135000,
    installment: 1,
    createdAt: new Date("2026-10-26T09:00:00Z"),
    paidAt: new Date("2026-10-26T09:02:00Z"),
    vegaFetchedAt: null,
    items: [
      {
        quantity: 2,
        totalCents: 120000,
        paidCents: 100000,
        variant: { vegaId: 758, sku: "SKU-1", barcode: "8690000000001" },
        product: { vegaId: 42, name: "Bluz & Etek", vatRate: null, category: { vatRate: 10, parent: null } }
      }
    ],
    ...overrides
  };
}

test("parseVegaDate: Z ekine ragmen Istanbul saati olarak okunur", () => {
  assert.equal(parseVegaDate("2026-10-25T23:40:55Z")?.toISOString(), "2026-10-25T20:40:55.000Z");
  assert.equal(parseVegaDate(null), null);
  assert.equal(parseVegaDate("gecersiz"), null);
});

test("formatVegaDate: Istanbul saati, ek yok", () => {
  assert.equal(formatVegaDate(new Date("2026-10-26T09:02:00Z")), "2026-10-26T12:02:00");
});

test("alanlar ordinal alfabetik sirada", () => {
  const xml = buildWebSiparisXml(order());
  // Ust duzey alanlar: ic nesnelerde de ayni adlar (ID, UyeID) var, once onlar cikarilir.
  const flat = xml.replace(/<a:(FaturaAdresi|TeslimatAdresi|Odemeler|Urunler)>.*?<\/a:\1>/g, "<a:$1>");
  const top = [...flat.matchAll(/<a:(\w+)[ >]/g)].map((m) => m[1]);
  const idx = (name: string) => top.indexOf(name);
  assert.ok(idx("AdiSoyadi") < idx("Durum"));
  assert.ok(idx("ID") < idx("KargoTutari"));
  assert.ok(idx("UyeAdi") < idx("UyeID") && idx("UyeID") < idx("UyeSoyadi"));
  // Fatura adresinde isKurumsal (kucuk harf) en sonda
  const fatura = /<a:FaturaAdresi>(.*?)<\/a:FaturaAdresi>/.exec(xml)![1];
  assert.match(fatura, /<a:VergiNo>11111111111<\/a:VergiNo><a:isKurumsal>false<\/a:isKurumsal>$/);
});

test("satir: indirimli birim fiyat, barkod, kimlikler, KDV", () => {
  const xml = buildWebSiparisXml(order());
  const urun = /<a:WebSiparisUrun>(.*?)<\/a:WebSiparisUrun>/.exec(xml)![1];
  assert.match(urun, /<a:Adet>2<\/a:Adet>/);
  assert.match(urun, /<a:Barkod>8690000000001<\/a:Barkod>/);
  assert.match(urun, /<a:Tutar>500\.00<\/a:Tutar>/);
  assert.match(urun, /<a:KdvOrani>10<\/a:KdvOrani>/);
  assert.match(urun, /<a:KdvTutari>90\.91<\/a:KdvTutari>/);
  assert.match(urun, /<a:UrunID>758<\/a:UrunID><a:UrunKartiID>42<\/a:UrunKartiID>/);
  assert.match(urun, /<a:UrunAdi>Bluz &amp; Etek<\/a:UrunAdi>/);
});

test("baslik: ad/soyad, tutarlar, durum, kacisli adres, nesne alanlarinda tip etiketi yok", () => {
  const xml = buildWebSiparisXml(order());
  assert.match(xml, /^<a:WebSiparis>/);
  assert.match(xml, /<a:UyeAdi>Ayşe Nur<\/a:UyeAdi>/);
  assert.match(xml, /<a:UyeSoyadi>Yılmaz<\/a:UyeSoyadi>/);
  assert.match(xml, /<a:Durum>1<\/a:Durum>/);
  assert.match(xml, /<a:SiparisDurumu>OnayBekliyor<\/a:SiparisDurumu>/);
  assert.match(xml, /<a:EntegrasyonAktarildi>false<\/a:EntegrasyonAktarildi>/);
  assert.match(xml, /<a:KargoTutari>350\.00<\/a:KargoTutari>/);
  assert.match(xml, /<a:ToplamTutar>1350\.00<\/a:ToplamTutar>/);
  assert.match(xml, /<a:SiparisTarihi>2026-10-26T12:00:00<\/a:SiparisTarihi>/);
  assert.match(xml, /<a:SiparisKodu>BLM261026-1234<\/a:SiparisKodu><a:SiparisNo>BLM261026-1234<\/a:SiparisNo>/);
  assert.match(xml, /<a:Tarih>2026-10-26T09:02:00<\/a:Tarih>/);
  assert.match(xml, /&lt;Daire 2&gt;/);
  assert.match(xml, /<a:Ulke><a:Alpha2Code>TR<\/a:Alpha2Code>/);
  assert.doesNotMatch(xml, /<a:TeslimatAdres>|<a:FaturaAdres>/);
  assert.match(xml, /<a:Odemeler><a:WebSiparisOdeme>.*<a:Tutar>1350\.00<\/a:Tutar><a:UyeID>7<\/a:UyeID><\/a:WebSiparisOdeme><\/a:Odemeler>/);
});

test("doldurulmayan alanlar WCF varsayilaniyla yazilir", () => {
  const xml = buildWebSiparisXml(order());
  assert.match(xml, /<a:FaturaTarihi>0001-01-01T00:00:00<\/a:FaturaTarihi>/);
  assert.match(xml, /<a:FaturaNo i:nil="true"\/>/);
  assert.match(xml, /<a:HediyePaketiVar>false<\/a:HediyePaketiVar>/);
  assert.match(xml, /<a:MagazaAtamaTarihi>0001-01-01T00:00:00<\/a:MagazaAtamaTarihi>/);
  assert.equal((xml.match(/<a:WebSiparisUrun>/g) ?? []).length, 1);
});

test("Vega onayladiysa Onaylandi", () => {
  const xml = buildWebSiparisXml(order({ vegaFetchedAt: new Date("2026-10-26T09:05:00Z") }));
  assert.match(xml, /<a:Durum>2<\/a:Durum><a:EntegrasyonAktarildi>false<\/a:EntegrasyonAktarildi>/);
});

test("tutari 0 olan siparis: satir 0, iptal durumu", () => {
  const xml = buildWebSiparisXml(
    order({ totalCents: 0, shippingCents: 0, status: "CANCELLED", items: [{ ...order().items[0], paidCents: null }] })
  );
  assert.match(xml, /<a:Durum>8<\/a:Durum>/);
  const urun = /<a:WebSiparisUrun>(.*?)<\/a:WebSiparisUrun>/.exec(xml)![1];
  assert.match(urun, /<a:Tutar>0\.00<\/a:Tutar>/);
});
