import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildShippingOrder,
  cargoKeyFor,
  mapYkStatus,
  normalizeAddress,
  normalizeReceiverName,
  normalizeYkPhone,
  parseYkDateTime
} from "./map";

test("telefon: alan koduyla 10 rakam, basinda 0/90 yok", () => {
  for (const input of ["+905321234567", "905321234567", "05321234567", "0532 123 45 67", "(0532) 123-45-67", "5321234567"]) {
    assert.equal(normalizeYkPhone(input), "5321234567", input);
  }
  assert.equal(normalizeYkPhone("0224 323 01 21"), "2243230121"); // sabit hat da gecer
  for (const input of ["", "532 123 45 6", "0532 123 45 678", "0012345678", "+1 532 123 45 67 8"]) {
    assert.equal(normalizeYkPhone(input), null, input);
  }
});

test("alici adi: en az 5 karakter ve 4 harf", () => {
  assert.equal(normalizeReceiverName("  Ayşe   Yılmaz "), "Ayşe Yılmaz");
  assert.equal(normalizeReceiverName("Ali A"), "Ali A");
  assert.equal(normalizeReceiverName("Ali"), null);
  assert.equal(normalizeReceiverName("A1 B2 C3"), null);
});

test("adres: bosluk toplanir, 10 alti reddedilir, 200 ustu kirpilir", () => {
  assert.deepEqual(normalizeAddress("Cumhuriyet Mah.\n  Atatürk Cad. No:5"), {
    value: "Cumhuriyet Mah. Atatürk Cad. No:5",
    truncated: false
  });
  assert.equal(normalizeAddress("Kısa adr"), null);
  const long = "Çok uzun adres kelimesi ".repeat(12);
  const r = normalizeAddress(long)!;
  assert.equal(r.truncated, true);
  assert.ok(r.value.length <= 200 && r.value.length > 160);
  assert.ok(!r.value.endsWith(" "));
});

test("kargo anahtari: ilk deneme siparis no, sonra -2, -3", () => {
  assert.equal(cargoKeyFor("BLM261105-9473", 1), "BLM261105-9473");
  assert.equal(cargoKeyFor("BLM261105-9473", 2), "BLM261105-9473-2");
  assert.throws(() => cargoKeyFor("BLM261105-9473-UZUN", 3));
});

const order = {
  orderNumber: "BLM261105-9473",
  customerName: "Ayşe Yılmaz",
  customerPhone: "+905321234567",
  customerEmail: " ayse@example.com ",
  shippingAddress: "Cumhuriyet Mah. Atatürk Cad. No:5 D:3",
  city: "Bursa",
  district: "Karacabey"
};

test("siparis -> ShippingOrderVO", () => {
  const r = buildShippingOrder(order, { cargoKey: "BLM261105-9473", cargoCount: 2 });
  assert.ok(r.ok);
  assert.deepEqual(r.vo, {
    cargoKey: "BLM261105-9473",
    invoiceKey: "BLM261105-9473",
    receiverCustName: "Ayşe Yılmaz",
    receiverAddress: "Cumhuriyet Mah. Atatürk Cad. No:5 D:3",
    cityName: "Bursa",
    townName: "Karacabey",
    receiverPhone1: "5321234567",
    emailAddress: "ayse@example.com",
    cargoCount: 2,
    description: "Bollmark sipariş BLM261105-9473"
  });
});

test("kurala uymayan siparis gonderilmez, hatalar listelenir", () => {
  const r = buildShippingOrder({ ...order, customerPhone: "123", customerName: "Al", shippingAddress: "x" }, { cargoKey: "K" });
  assert.equal(r.ok, false);
  if (!r.ok) assert.equal(r.errors.length, 3);
  const c = buildShippingOrder(order, { cargoKey: "K", cargoCount: 0 });
  assert.equal(c.ok, false);
});

test("Yurtici durumu -> Shipment.status", () => {
  assert.equal(mapYkStatus("NOP").shipmentStatus, "HAZIRLANIYOR");
  assert.equal(mapYkStatus("ISR").shipmentStatus, "KARGOYA_VERILDI");
  assert.equal(mapYkStatus("IND").shipmentStatus, "DAGITIMDA");
  const dlv = mapYkStatus("DLV");
  assert.equal(dlv.shipmentStatus, "TESLIM_EDILDI");
  assert.equal(dlv.final, true);
  for (const s of ["CNL", "ISC"]) {
    const m = mapYkStatus(s);
    assert.equal(m.cancelled, true);
    assert.equal(m.shipmentStatus, null);
  }
  const bi = mapYkStatus("BI");
  assert.equal(bi.shipmentStatus, null);
  assert.ok(bi.attention);
  const iade = mapYkStatus("IND", "1");
  assert.equal(iade.shipmentStatus, "IADE");
  assert.ok(iade.attention);
  assert.equal(mapYkStatus("IND", "").shipmentStatus, "DAGITIMDA");
  assert.equal(mapYkStatus("XYZ").shipmentStatus, null);
});

test("Yurtici tarih/saat Turkiye saatiyle okunur", () => {
  assert.equal(parseYkDateTime("20261110", "143005")?.toISOString(), "2026-11-10T11:30:05.000Z");
  assert.equal(parseYkDateTime("20261110")?.toISOString(), "2026-11-09T21:00:00.000Z");
  assert.equal(parseYkDateTime(""), null);
});

test("sonraki kargo anahtari", async () => {
  const { nextCargoKey } = await import("./map");
  const o = "BLM261105-9473";
  const none = { cargoKey: null, ykCancelledAt: null, ykLastError: null };
  assert.equal(nextCargoKey(o, none), o);
  assert.equal(nextCargoKey(o, { ...none, cargoKey: o, ykLastError: "[82516] Telefon" }), o);
  assert.equal(nextCargoKey(o, { ...none, cargoKey: o, ykLastError: "[60020] Var" }), `${o}-2`);
  assert.equal(nextCargoKey(o, { ...none, cargoKey: `${o}-2`, ykCancelledAt: new Date() }), `${o}-3`);
});

test("gonderilebilirlik ve test alici kilidi", async () => {
  const { sendBlockReason, isTestReceiver } = await import("./map");
  assert.equal(isTestReceiver("Test Alıcı 1"), true);
  assert.equal(isTestReceiver("test alici"), true);
  assert.equal(isTestReceiver("Ayşe Yılmaz"), false);
  const order = { status: "PAID", customerName: "TEST ALICI Bir", deletedAt: null };
  const sh = { status: "HAZIRLANIYOR", provider: null, ykSentAt: null, ykCancelledAt: null };
  assert.equal(sendBlockReason(order, sh, "mock"), null);
  assert.match(sendBlockReason({ ...order, customerName: "Ayşe Yılmaz" }, sh, "mock")!, /TEST ALICI/);
  assert.equal(sendBlockReason({ ...order, customerName: "Ayşe Yılmaz" }, sh, "live"), null);
  assert.ok(sendBlockReason({ ...order, status: "PENDING_PAYMENT" }, sh, "mock"));
  assert.ok(sendBlockReason(order, { ...sh, status: "KARGOYA_VERILDI" }, "mock"));
  assert.ok(sendBlockReason(order, { ...sh, provider: "YURTICI", ykSentAt: new Date() }, "mock"));
  // iptal edilmis gonderi yeniden gonderilebilir
  assert.equal(sendBlockReason(order, { ...sh, provider: "YURTICI", ykSentAt: new Date(), ykCancelledAt: new Date() }, "mock"), null);
  assert.ok(sendBlockReason(order, sh, "off"));
});

test("60 sn sorgu kilidi", async () => {
  const { syncLockRemainingMs } = await import("./map");
  const now = Date.parse("2026-11-10T10:00:00Z");
  assert.equal(syncLockRemainingMs(null, now), 0);
  assert.equal(syncLockRemainingMs(new Date(now - 20_000), now), 40_000);
  assert.equal(syncLockRemainingMs(new Date(now - 61_000), now), 0);
});

test("takip linki yalniz https", async () => {
  const { safeTrackingUrl } = await import("./map");
  assert.equal(safeTrackingUrl("https://selfservis.yurticikargo.com/x?a=1&b=2"), "https://selfservis.yurticikargo.com/x?a=1&b=2");
  assert.equal(safeTrackingUrl("javascript:alert(1)"), null);
  assert.equal(safeTrackingUrl("http://x.com"), null);
  assert.equal(safeTrackingUrl(""), null);
  assert.equal(safeTrackingUrl(null), null);
});

test("durum gecisleri: kargoya verildi ve teslim maili yalniz ilk kez", async () => {
  const { planYkTransition } = await import("./map");
  const now = new Date("2026-11-10T12:00:00Z");
  const base = { orderStatus: "PREPARING", shipmentStatus: "HAZIRLANIYOR", shippedAt: null, deliveredAt: null, attentionNote: null };
  const row = (operationStatus: string, extra: Partial<{ rejectStatus: string; deliveryDate: string; deliveryTime: string }> = {}) => ({
    operationStatus,
    rejectStatus: "",
    deliveryDate: "",
    deliveryTime: "",
    ...extra
  });

  const nop = planYkTransition(base, row("NOP"), now);
  assert.equal(nop.orderStatus, null);
  assert.equal(nop.setShippedAt, false);

  const isr = planYkTransition(base, row("ISR"), now);
  assert.equal(isr.shipmentStatus, "KARGOYA_VERILDI");
  assert.equal(isr.setShippedAt, true);
  assert.deepEqual(isr.orderStatus?.to, "SHIPPED");

  // ikinci kez (siparis artik SHIPPED, shippedAt dolu): mail/gecis yok
  const ind = planYkTransition({ ...base, orderStatus: "SHIPPED", shippedAt: now }, row("IND"), now);
  assert.equal(ind.shipmentStatus, "DAGITIMDA");
  assert.equal(ind.orderStatus, null);
  assert.equal(ind.setShippedAt, false);

  const dlv = planYkTransition({ ...base, orderStatus: "SHIPPED", shippedAt: now }, row("DLV", { deliveryDate: "20261111", deliveryTime: "143000" }), now);
  assert.equal(dlv.orderStatus?.to, "DELIVERED");
  assert.equal(dlv.deliveredAt?.toISOString(), "2026-11-11T11:30:00.000Z");
  assert.ok(dlv.orderStatus?.from.includes("SHIPPED"));

  const again = planYkTransition({ ...base, orderStatus: "DELIVERED", shippedAt: now, deliveredAt: now }, row("DLV"), now);
  assert.equal(again.orderStatus, null);
  assert.equal(again.deliveredAt, null);

  // ISR gorulmeden dogrudan DLV: shippedAt da dolar, yalniz teslim gecisi
  const direct = planYkTransition(base, row("DLV"), now);
  assert.equal(direct.setShippedAt, true);
  assert.equal(direct.orderStatus?.to, "DELIVERED");
  assert.equal(direct.deliveredAt?.getTime(), now.getTime());
});

test("durum gecisleri: iade, BI, iptal ve iptal edilmis siparis", async () => {
  const { planYkTransition } = await import("./map");
  const base = { orderStatus: "SHIPPED", shipmentStatus: "DAGITIMDA", shippedAt: new Date(), deliveredAt: null, attentionNote: null };
  const r = (operationStatus: string, rejectStatus = "") => ({ operationStatus, rejectStatus, deliveryDate: "", deliveryTime: "" });
  const iade = planYkTransition(base, r("IND", "2"));
  assert.equal(iade.shipmentStatus, "IADE");
  assert.ok(iade.attention);
  assert.equal(iade.orderStatus, null);
  // ayni not zaten yazili: tekrar yazilmaz
  assert.equal(planYkTransition({ ...base, attentionNote: iade.attention }, r("IND", "2")).attention, null);
  assert.ok(planYkTransition(base, r("BI")).attention);
  assert.equal(planYkTransition(base, r("CNL")).cancelled, true);
  const cancelledOrder = planYkTransition({ ...base, orderStatus: "CANCELLED" }, r("IND"));
  assert.equal(cancelledOrder.orderStatus, null);
  assert.ok(cancelledOrder.attention);
});
