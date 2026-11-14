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

const sh = {
  status: "HAZIRLANIYOR",
  provider: null as string | null,
  cargoKey: null as string | null,
  ykSentAt: null as Date | null,
  ykCancelledAt: null as Date | null,
  hjSentAt: null as Date | null,
  hjCancelledAt: null as Date | null
};
const testOrder = { status: "PAID", customerName: "TEST ALICI Bir", deletedAt: null };

test("gonderim kurali: test modu TEST ALICI, Yurtici'de aktifse engel, iptal sonrasi acik", async () => {
  const { hjSendBlockReason, isHepsijetActive } = await import("./map");
  assert.equal(hjSendBlockReason(testOrder, sh, "mock"), null);
  assert.equal(hjSendBlockReason({ ...testOrder, customerName: "test alıcı iki" }, sh, "test"), null);
  assert.match(hjSendBlockReason({ ...testOrder, customerName: "Ayşe Yılmaz" }, sh, "test")!, /TEST ALICI/);
  assert.equal(hjSendBlockReason({ ...testOrder, customerName: "Ayşe Yılmaz" }, sh, "live"), null);
  assert.match(hjSendBlockReason(testOrder, sh, "off")!, /kapalı/);
  assert.ok(hjSendBlockReason({ ...testOrder, status: "CANCELLED" }, sh, "mock"));
  assert.ok(hjSendBlockReason(testOrder, { ...sh, status: "KARGOYA_VERILDI" }, "mock"));
  assert.ok(hjSendBlockReason(testOrder, null, "mock"));
  const ykActive = { ...sh, provider: "YURTICI", ykSentAt: new Date() };
  assert.match(hjSendBlockReason(testOrder, ykActive, "mock")!, /Yurtiçi/);
  assert.equal(hjSendBlockReason(testOrder, { ...ykActive, ykCancelledAt: new Date() }, "mock"), null);
  const hjActive = { ...sh, provider: "HEPSIJET", hjSentAt: new Date() };
  assert.equal(isHepsijetActive(hjActive), true);
  assert.match(hjSendBlockReason(testOrder, hjActive, "mock")!, /zaten HepsiJET/);
  assert.equal(isHepsijetActive({ ...hjActive, hjCancelledAt: new Date() }), false);
});

test("sonraki gonderi no: iptal sonrasi -2, basarisiz denemede ayni, Yurtici nosunda ayni", async () => {
  const { nextDeliveryNo } = await import("./map");
  assert.equal(nextDeliveryNo("BLM", "BLM261105-9473", sh), "BLM261105-9473");
  assert.equal(nextDeliveryNo("BLM", "BLM261105-9473", { cargoKey: "BLM261105-9473", hjCancelledAt: null }), "BLM261105-9473");
  assert.equal(nextDeliveryNo("BLM", "BLM261105-9473", { cargoKey: "BLM261105-9473", hjCancelledAt: new Date() }), "BLM261105-9473-2");
  assert.equal(nextDeliveryNo("BLM", "BLM261105-9473", { cargoKey: "BLM261105-9473-2", hjCancelledAt: new Date() }), "BLM261105-9473-3");
  assert.equal(nextDeliveryNo("BLM", "BLM261105-9473", { cargoKey: "BLM261105-9473-3", hjCancelledAt: null }), "BLM261105-9473-3");
});

test("Yurtici kurali: HepsiJET'te aktif siparis Yurtici'ye gonderilemez", async () => {
  const { sendBlockReason } = await import("@/lib/yurtici/map");
  const ykShipment = { status: "HAZIRLANIYOR", provider: null as string | null, ykSentAt: null, ykCancelledAt: null };
  assert.equal(sendBlockReason(testOrder, ykShipment, "mock"), null);
  assert.match(sendBlockReason(testOrder, { ...ykShipment, provider: "HEPSIJET" }, "mock")!, /HepsiJET/);
});

test("durum eslemesi: bilinen kodlar, silme/iade kaliplari, bilinmeyen = yolda", async () => {
  const { mapHjStatus } = await import("./map");
  assert.deepEqual(mapHjStatus(null), { shipmentStatus: null, cancelled: false, attention: null, final: false });
  assert.equal(mapHjStatus("ACCEPTED").shipmentStatus, "KARGOYA_VERILDI");
  assert.equal(mapHjStatus("IN_TRANSFER").shipmentStatus, "KARGOYA_VERILDI");
  assert.equal(mapHjStatus("delivering").shipmentStatus, "DAGITIMDA");
  assert.deepEqual(mapHjStatus("DELIVERED"), { shipmentStatus: "TESLIM_EDILDI", cancelled: false, attention: null, final: true });
  assert.equal(mapHjStatus("UNDELIVERED").shipmentStatus, "IADE");
  assert.ok(mapHjStatus("UNDELIVERED").attention);
  for (const c of ["DELETED", "CANCELLED", "SİLİNDİ"]) assert.equal(mapHjStatus(c).cancelled, true, c);
});

test("tarih: saat dilimsizse Turkiye, gecersizse null", async () => {
  const { parseHjDate } = await import("./map");
  assert.equal(parseHjDate("2026-11-14 10:30")!.toISOString(), "2026-11-14T07:30:00.000Z");
  assert.equal(parseHjDate("2026-11-14T10:30:05Z")!.toISOString(), "2026-11-14T10:30:05.000Z");
  assert.equal(parseHjDate("14.11.2026"), null);
  assert.equal(parseHjDate(null), null);
});

test("gecis: yolda -> SHIPPED (bir kez), teslim -> DELIVERED + tarih, iptal edilmis sipariste uyari", async () => {
  const { planHjTransition } = await import("./map");
  const now = new Date("2026-11-14T12:00:00Z");
  const base = { orderStatus: "PAID", shippedAt: null, deliveredAt: null, attentionNote: null };
  const none = planHjTransition(base, { statusCode: null, at: null }, now);
  assert.deepEqual([none.shipmentStatus, none.orderStatus, none.setShippedAt], [null, null, false]);
  const acc = planHjTransition(base, { statusCode: "ACCEPTED", at: null }, now);
  assert.equal(acc.shipmentStatus, "KARGOYA_VERILDI");
  assert.equal(acc.setShippedAt, true);
  assert.equal(acc.orderStatus?.to, "SHIPPED");
  const again = planHjTransition({ ...base, orderStatus: "SHIPPED", shippedAt: now }, { statusCode: "DELIVERING", at: null }, now);
  assert.deepEqual([again.orderStatus, again.setShippedAt], [null, false]);
  const dlv = planHjTransition({ ...base, orderStatus: "SHIPPED", shippedAt: now }, { statusCode: "DELIVERED", at: "2026-11-14 10:00" }, now);
  assert.equal(dlv.orderStatus?.to, "DELIVERED");
  assert.equal(dlv.deliveredAt!.toISOString(), "2026-11-14T07:00:00.000Z");
  const cancelled = planHjTransition({ ...base, orderStatus: "CANCELLED" }, { statusCode: "ACCEPTED", at: null }, now);
  assert.equal(cancelled.orderStatus, null);
  assert.match(cancelled.attention!, /iptal/);
  const same = planHjTransition({ ...base, orderStatus: "CANCELLED", attentionNote: cancelled.attention }, { statusCode: "ACCEPTED", at: null }, now);
  assert.equal(same.attention, null);
});
