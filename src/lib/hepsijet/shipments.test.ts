import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { resetHepsijetToken } from "./client";
import { resetHepsijetMock } from "./mock";
import { buildHjPayload } from "./map";
import { deleteDelivery, extractPdf, getLabelPdf, parseTracking, sendDelivery, trackDeliveries, TRACK_PATH } from "./shipments";

const company = {
  companyName: "SAHTE",
  companyCode: "SAHTE",
  deliveryPrefix: "BLM",
  sender: { addressId: "a", city: "c", town: "t", district: "d", addressLine: "l" },
  xdockCode: "x"
};

function payload(no: string) {
  const r = buildHjPayload(
    { orderNumber: no, customerName: "TEST ALICI Bir", customerPhone: "05321234567", customerEmail: "", shippingAddress: "Sahte Mah. Sahte Sk. No:1", city: "Bursa", district: "Karacabey" },
    [{ sku: "S", name: "Ürün", variantLabel: "", quantity: 1 }],
    company,
    { deliveryNo: no }
  );
  assert.ok(r.ok);
  return r.payload;
}

const prevEnv = { ...process.env };
const realFetch = globalThis.fetch;
beforeEach(() => {
  process.env.HEPSIJET_MODE = "mock";
  resetHepsijetMock();
  resetHepsijetToken();
});
afterEach(() => {
  process.env = { ...prevEnv };
  globalThis.fetch = realFetch;
});

test("off modunda hicbir islem yapilmaz", async () => {
  process.env.HEPSIJET_MODE = "off";
  await assert.rejects(sendDelivery(payload("BLM1")), /kapalı/);
  await assert.rejects(trackDeliveries(["BLM1"]), /kapalı/);
});

test("mock: gonder -> etiket -> takip adimlari -> toplanmissa iptal reddi", async () => {
  await sendDelivery(payload("BLM1"));
  await assert.rejects(sendDelivery(payload("BLM1")), /zaten mevcut/);
  const { pdf } = await getLabelPdf(["BLM1"]);
  assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), "%PDF-");
  const seen: (string | null)[] = [];
  for (let i = 0; i < 4; i++) seen.push((await trackDeliveries(["BLM1"])).rows[0].statusCode);
  assert.deepEqual(seen, ["ACCEPTED", "DELIVERING", "DELIVERED", "DELIVERED"]);
  await assert.rejects(deleteDelivery("BLM1"), /statüsü uygun değil/);
});

test("mock: toplanmadan iptal; ikinci iptal 'zaten silinmis' basari sayilir", async () => {
  await sendDelivery(payload("BLM2"));
  const first = await deleteDelivery("BLM2");
  assert.deepEqual([first.ok, first.alreadyDeleted], [true, false]);
  const second = await deleteDelivery("BLM2");
  assert.deepEqual([second.ok, second.alreadyDeleted], [true, true]);
  await sendDelivery(payload("BLM2")); // silinen no yeniden kullanilabilir
});

test("bos listede takip istegi atilmaz", async () => {
  process.env.HEPSIJET_MODE = "test";
  globalThis.fetch = (() => {
    throw new Error("istek atilmamali");
  }) as typeof fetch;
  assert.deepEqual((await trackDeliveries([])).rows, []);
});

test("test modu: takip tek istekte deliveries dizisiyle gider", async () => {
  process.env.HEPSIJET_MODE = "test";
  process.env.HEPSIJET_USERNAME = "sahte";
  process.env.HEPSIJET_PASSWORD = "sahte";
  const bodies: { url: string; body: unknown }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    bodies.push({ url, body: JSON.parse(init.body as string) });
    return new Response(JSON.stringify(url.endsWith("/auth/token") ? { data: { token: "t" } } : { status: "OK" }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  }) as typeof fetch;
  const { rows } = await trackDeliveries(["BLM1", "BLM2"]);
  assert.equal(bodies.length, 2);
  assert.ok(bodies[1].url.endsWith(TRACK_PATH));
  assert.deepEqual(bodies[1].body, { deliveries: [{ customerDeliveryNo: "BLM1" }, { customerDeliveryNo: "BLM2" }] });
  assert.deepEqual(rows.map((r) => r.statusCode), [null, null]); // yalniz "OK" = hareket yok
});

test("extractPdf: ham PDF, JSON icinde base64, PDF olmayan", () => {
  const pdf = new TextEncoder().encode("%PDF-1.4 x");
  assert.deepEqual(extractPdf(null, pdf), pdf);
  assert.equal(extractPdf(null, new TextEncoder().encode("<html>")), null);
  const b64 = Buffer.from(pdf).toString("base64");
  assert.deepEqual(extractPdf({ status: "OK", data: [{ label: b64 }] }, null), pdf);
  assert.deepEqual(extractPdf({ data: `data:application/pdf;base64,${b64}` }, null), pdf);
  assert.equal(extractPdf({ data: "abc" }, null), null);
});

test("parseTracking: son hareket alinir, bulunamayan no hareket yok sayilir", () => {
  const rows = parseTracking(
    {
      status: "OK",
      data: [
        { customerDeliveryNo: "A", transactions: [{ deliveryStatus: "ACCEPTED" }, { deliveryStatus: "delivering", statusDescription: "Dağıtımda", transactionDate: "2026-11-14 10:00" }] }
      ]
    },
    ["A", "B"]
  );
  assert.deepEqual(rows, [
    { customerDeliveryNo: "A", statusCode: "DELIVERING", statusMessage: "Dağıtımda", at: "2026-11-14 10:00" },
    { customerDeliveryNo: "B", statusCode: null, statusMessage: "", at: null }
  ]);
});
