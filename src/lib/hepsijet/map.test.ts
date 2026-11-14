import { test } from "node:test";
import assert from "node:assert/strict";
import { buildHjPayload, deliveryNoFor, normalizeHjPhone, splitName, type HjOrder, type HjOrderItem } from "./map";
import type { HepsijetCompanyInfo } from "./config";

// Sahte firma bilgileri (gercek degerler yalniz .env'de).
const company: HepsijetCompanyInfo = {
  companyName: "SAHTE FİRMA",
  companyCode: "SAHTEKOD",
  deliveryPrefix: "BLM",
  sender: { addressId: "sahte-adres-1", city: "İl", town: "İLÇE", district: "MAHALLE", addressLine: "SAHTE MH. 1.SK NO:1" },
  xdockCode: "SAHTEXDOCK"
};

const order: HjOrder = {
  orderNumber: "BLM261105-9473",
  customerName: "  Ayşe  Nur   Yılmaz ",
  customerPhone: "+90 532 123 45 67",
  customerEmail: " ayse@example.com ",
  shippingAddress: "Cumhuriyet Mah.\n Atatürk Cad. No:5 D:3",
  city: "Bursa",
  district: "Karacabey"
};

const items: HjOrderItem[] = [
  { sku: "SKU-1", name: "Basic Tişört", variantLabel: "Siyah / M", quantity: 2 },
  { sku: "SKU-2", name: "Kot Pantolon", variantLabel: "", quantity: 1 }
];

function uuidSeq() {
  let i = 0;
  return () => `uuid-${++i}`;
}

test("telefon: yalniz cep, 05xxxxxxxxx", () => {
  for (const input of ["+905321234567", "905321234567", "05321234567", "0532 123 45 67", "(0532) 123-45-67", "5321234567"]) {
    assert.equal(normalizeHjPhone(input), "05321234567", input);
  }
  for (const input of ["", "0224 323 01 21", "532 123 45 6", "0532 123 45 678", "+1 532 123 45 67"]) {
    assert.equal(normalizeHjPhone(input), null, input);
  }
});

test("ad soyad: son kelime soyad, tek kelime reddedilir", () => {
  assert.deepEqual(splitName("  Ayşe  Nur   Yılmaz "), { firstName: "Ayşe Nur", lastName: "Yılmaz" });
  assert.deepEqual(splitName("TEST ALICI Bir"), { firstName: "TEST ALICI", lastName: "Bir" });
  assert.equal(splitName("Ayşe"), null);
  assert.equal(splitName("   "), null);
});

test("gonderi no: onek tekrarlanmaz, -2 eki, en fazla 19 karakter", () => {
  assert.equal(deliveryNoFor("BLM", "BLM261105-9473", 1), "BLM261105-9473");
  assert.equal(deliveryNoFor("blm", "BLM261105-9473", 2), "BLM261105-9473-2");
  assert.equal(deliveryNoFor("BLM", "261105-9473", 1), "BLM261105-9473");
  assert.equal(deliveryNoFor("BLM", "BLM261105-9473", 99), "BLM261105-9473-99"); // 17
  assert.equal(deliveryNoFor("BLM", "BLM261105-9473-ABCD", 1), "BLM261105-9473-ABCD"); // tam 19
  assert.throws(() => deliveryNoFor("BLM", "BLM261105-9473-ABCDE", 1));
});

test("siparis -> STD payload", () => {
  const r = buildHjPayload(order, items, company, {
    deliveryNo: "BLM261105-9473",
    now: new Date("2026-11-13T22:30:00Z"), // Istanbul'da 14 Kasim 01:30
    uuid: uuidSeq()
  });
  assert.ok(r.ok);
  const p = r.payload;
  assert.deepEqual(p.company, { name: "SAHTE FİRMA", abbreviationCode: "SAHTEKOD" });
  assert.equal(p.delivery.customerDeliveryNo, "BLM261105-9473");
  assert.equal(p.delivery.customerOrderId, "BLM261105-9473");
  assert.equal(p.delivery.deliveryDateOriginal, "2026-11-14");
  assert.equal(p.delivery.totalParcels, "1");
  assert.equal(p.delivery.desi, "1");
  assert.equal(p.delivery.deliverySlotOriginal, "0");
  assert.equal(p.delivery.deliveryType, "RETAIL");
  assert.deepEqual(p.delivery.product, { productCode: "HX_STD" });
  assert.deepEqual(p.delivery.senderAddress, {
    companyAddressId: "sahte-adres-1",
    country: { name: "Türkiye" },
    city: { name: "İl" },
    town: { name: "İLÇE" },
    district: { name: "MAHALLE" },
    addressLine1: "SAHTE MH. 1.SK NO:1"
  });
  assert.deepEqual(p.delivery.receiver, {
    companyCustomerId: "uuid-1",
    firstName: "Ayşe Nur",
    lastName: "Yılmaz",
    phone1: "05321234567",
    phone2: "",
    email: "ayse@example.com"
  });
  assert.deepEqual(p.delivery.recipientAddress, {
    companyAddressId: "uuid-2",
    country: { name: "Türkiye" },
    city: { name: "Bursa" },
    town: { name: "Karacabey" },
    district: { name: "" },
    addressLine1: "Cumhuriyet Mah. Atatürk Cad. No:5 D:3"
  });
  assert.equal(p.delivery.recipientPerson, "Ayşe Nur Yılmaz");
  assert.equal(p.delivery.recipientPersonPhone1, "05321234567");
  assert.deepEqual(p.currentXDock, { abbreviationCode: "SAHTEXDOCK" });
  assert.deepEqual(p.deliveryContent, [
    { sku: "SKU-1", description: "Basic Tişört - Siyah / M", desi: 1, quantity: 2, indivisibleQuantity: false },
    { sku: "SKU-2", description: "Kot Pantolon", desi: 1, quantity: 1, indivisibleQuantity: false }
  ]);
  assert.deepEqual(r.warnings, []);
});

test("bos alanlar silinmez, \"\" olarak gider", () => {
  const r = buildHjPayload({ ...order, customerEmail: "" }, items, company, { deliveryNo: "BLM1", uuid: uuidSeq() });
  assert.ok(r.ok);
  const json = JSON.parse(JSON.stringify(r.payload));
  assert.equal(json.delivery.receiver.email, "");
  assert.equal(json.delivery.receiver.phone2, "");
  assert.equal(json.delivery.recipientAddress.district.name, "");
});

test("her gonderide yeni UUID (varsayilan randomUUID)", () => {
  const a = buildHjPayload(order, items, company, { deliveryNo: "BLM1" });
  const b = buildHjPayload(order, items, company, { deliveryNo: "BLM1" });
  assert.ok(a.ok && b.ok);
  const ids = [
    a.payload.delivery.receiver.companyCustomerId,
    a.payload.delivery.recipientAddress.companyAddressId,
    b.payload.delivery.receiver.companyCustomerId,
    b.payload.delivery.recipientAddress.companyAddressId
  ];
  assert.equal(new Set(ids).size, 4);
  for (const id of ids) assert.match(id, /^[0-9a-f-]{36}$/);
});

test("eksik bilgide gonderilmez, tum hatalar birlikte doner", () => {
  const r = buildHjPayload(
    { ...order, customerName: "Ayşe", customerPhone: "0224 323 01 21", shippingAddress: "kısa", city: "", district: "" },
    [],
    company,
    { deliveryNo: "BLM12345678901234567" }
  );
  assert.ok(!r.ok);
  assert.equal(r.errors.length, 6);
});

test("adet 0 olan kalem atlanir, stok kodu bos kalem reddedilir", () => {
  const r = buildHjPayload(order, [...items, { sku: "X", name: "Y", variantLabel: "", quantity: 0 }], company, { deliveryNo: "BLM1" });
  assert.ok(r.ok);
  assert.equal(r.payload.deliveryContent.length, 2);
  const bad = buildHjPayload(order, [{ sku: " ", name: "Y", variantLabel: "", quantity: 1 }], company, { deliveryNo: "BLM1" });
  assert.ok(!bad.ok);
});
