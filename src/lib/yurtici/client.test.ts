import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cancelShipments, createShipments, queryShipments, ykErrorMessage } from "./client";
import { getYurticiConnection, getYurticiMode, isYurticiSyncEnabled, isYurticiTestMode } from "./config";
import { resetYurticiMock } from "./mock";

const vo = (cargoKey: string, phone = "5321234567") => ({
  cargoKey,
  invoiceKey: cargoKey,
  receiverCustName: "Ayşe Yılmaz",
  receiverAddress: "Cumhuriyet Mah. Atatürk Cad. No:5",
  cityName: "Bursa",
  townName: "Karacabey",
  receiverPhone1: phone,
  emailAddress: "a@b.com",
  cargoCount: 1,
  description: "Bollmark sipariş " + cargoKey
});

beforeEach(() => {
  process.env.YURTICI_MODE = "mock";
  delete process.env.YURTICI_SYNC;
  resetYurticiMock();
});

test("mod: tanimsiz = off; mock/test uyari modudur", () => {
  delete process.env.YURTICI_MODE;
  assert.equal(getYurticiMode(), "off");
  assert.equal(isYurticiSyncEnabled(), false);
  process.env.YURTICI_MODE = "LIVE";
  assert.equal(getYurticiMode(), "live");
  assert.equal(isYurticiTestMode(), false);
  process.env.YURTICI_MODE = "mock";
  assert.equal(isYurticiTestMode(), true);
  assert.equal(isYurticiSyncEnabled(), true);
  process.env.YURTICI_SYNC = "off";
  assert.equal(isYurticiSyncEnabled(), false);
});

test("test modu ortak test kullanicisini, live modu env'i kullanir", () => {
  const saved = { u: process.env.YURTICI_GO_USERNAME, p: process.env.YURTICI_GO_PASSWORD };
  try {
    assert.equal(getYurticiConnection("test").username, "YKTEST");
    assert.match(getYurticiConnection("test").url, /testwebservices/);
    delete process.env.YURTICI_GO_USERNAME;
    assert.throws(() => getYurticiConnection("live"));
    assert.throws(() => getYurticiConnection("mock"));
  } finally {
    if (saved.u !== undefined) process.env.YURTICI_GO_USERNAME = saved.u;
    if (saved.p !== undefined) process.env.YURTICI_GO_PASSWORD = saved.p;
  }
});

test("off modunda istemci calismaz", async () => {
  process.env.YURTICI_MODE = "off";
  await assert.rejects(createShipments([vo("A")]));
});

test("mock: toplu olusturma, 60020 ve 82516", async () => {
  const r = await createShipments([vo("A"), vo("B", "5320000000")]);
  assert.equal(r.mode, "mock");
  assert.equal(r.outFlag, "0");
  assert.ok(r.jobId);
  assert.deepEqual(
    r.rows.map((x) => [x.cargoKey, x.ok, x.errCode]),
    [
      ["A", true, "0"],
      ["B", false, "82516"]
    ]
  );
  assert.equal(r.rows[1].message, ykErrorMessage("82516"));
  const again = await createShipments([vo("A")]);
  assert.equal(again.outFlag, "1");
  assert.equal(again.rows[0].errCode, "60020");
  assert.match(again.rows[0].message, /zaten var/);
});

test("mock: 'Anahtar Var' alicisi ilk anahtarda 60020, ekli anahtarda basarili", async () => {
  const named = (key: string) => ({ ...vo(key), receiverCustName: "TEST ALICI Anahtar Var" });
  assert.equal((await createShipments([named("BLMTEST-0004")])).rows[0].errCode, "60020");
  assert.equal((await createShipments([named("BLMTEST-0004-2")])).rows[0].errCode, "0");
});

test("mock: her sorgu bir adim ilerler NOP -> ISR -> IND -> DLV", async () => {
  await createShipments([vo("A")]);
  const seen: string[] = [];
  for (let i = 0; i < 4; i++) {
    const r = await queryShipments(["A"]);
    seen.push(r.rows[0].operationStatus);
  }
  assert.deepEqual(seen, ["ISR", "IND", "DLV", "DLV"]);
  const last = (await queryShipments(["A"])).rows[0];
  assert.ok(last.docId && last.trackingUrl && last.deliveryDate);
});

test("bos anahtar listesiyle istek atilmaz", async () => {
  const r = await queryShipments([]);
  assert.deepEqual(r.rows, []);
});

test("mock iptal: NOP iken CNL, ilerlemis gonderide iade istegi", async () => {
  await createShipments([vo("A"), vo("B")]);
  await queryShipments(["B"]); // B -> ISR
  const r = await cancelShipments(["A", "B"]);
  assert.deepEqual(
    r.rows.map((x) => [x.cargoKey, x.ok, x.operationStatus]),
    [
      ["A", true, "CNL"],
      ["B", false, "IND"]
    ]
  );
  assert.equal((await queryShipments(["A"])).rows[0].operationStatus, "CNL");
  // iptal edilen anahtar yeniden kullanilamaz (gercek serviste de 60020)
  assert.equal((await createShipments([vo("A")])).rows[0].errCode, "60020");
});
