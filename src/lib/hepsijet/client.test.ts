import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { HepsijetError, hjErrorMessage, hjRequest, resetHepsijetToken, TOKEN_TTL_MS } from "./client";
import { getHepsijetCompanyInfo, getHepsijetConnection, getHepsijetMode, isHepsijetSyncEnabled, isHepsijetTestMode } from "./config";

// Sahte kimlik bilgileri; gercek degerler yalniz .env'de.
const conn = { baseUrl: "https://hj.test", username: "sahte-kullanici", password: "sahte-sifre" };

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
let calls: Call[] = [];
const realFetch = globalThis.fetch;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Siradaki yanitlari sirayla dondurur, her cagriyi kaydeder.
function fakeFetch(...responses: (Response | Error)[]) {
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      method: init.method || "GET",
      headers: init.headers as Record<string, string>,
      body: init.body ? JSON.parse(init.body as string) : undefined
    });
    const next = responses.shift();
    if (!next) throw new Error("beklenmeyen istek");
    if (next instanceof Error) throw next;
    return next;
  }) as typeof fetch;
}

const tokenOk = (token: string) => json(200, { status: "OK", data: { token } });

beforeEach(() => {
  calls = [];
  resetHepsijetToken();
});
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("mod: tanimsiz = off; mock/test uyari modu; SYNC=off kapatir", () => {
  const prev = { ...process.env };
  delete process.env.HEPSIJET_MODE;
  assert.equal(getHepsijetMode(), "off");
  assert.equal(isHepsijetSyncEnabled(), false);
  process.env.HEPSIJET_MODE = " LIVE ";
  assert.equal(getHepsijetMode(), "live");
  assert.equal(isHepsijetTestMode(), false);
  process.env.HEPSIJET_MODE = "test";
  assert.equal(isHepsijetTestMode(), true);
  assert.equal(isHepsijetSyncEnabled(), true);
  process.env.HEPSIJET_SYNC = "OFF";
  assert.equal(isHepsijetSyncEnabled(), false);
  process.env.HEPSIJET_MODE = "acik";
  assert.equal(getHepsijetMode(), "off");
  process.env = prev;
});

test("baglanti: test/live adresleri, eksik env adlariyla hata (deger yazilmaz)", () => {
  const prev = { ...process.env };
  process.env.HEPSIJET_USERNAME = "sahte-kullanici";
  process.env.HEPSIJET_PASSWORD = "sahte-sifre";
  assert.equal(getHepsijetConnection("test").baseUrl, "https://integration-apitest.hepsijet.com");
  assert.equal(getHepsijetConnection("live").baseUrl, "https://integration.hepsijet.com");
  assert.throws(() => getHepsijetConnection("mock"));
  delete process.env.HEPSIJET_PASSWORD;
  assert.throws(() => getHepsijetConnection("test"), /HEPSIJET_PASSWORD/);
  for (const k of Object.keys(process.env)) if (k.startsWith("HEPSIJET_")) delete process.env[k];
  process.env.HEPSIJET_COMPANY_NAME = "SAHTE";
  assert.throws(() => getHepsijetCompanyInfo(), (e: Error) => e.message.includes("HEPSIJET_XDOCK_CODE") && !e.message.includes("SAHTE"));
  process.env = prev;
});

test("token alinir, ortak header'lar gider, token onbellekten kullanilir", async () => {
  fakeFetch(tokenOk("tok-1"), json(200, { status: "OK" }), json(200, { status: "OK" }));
  await hjRequest({ method: "POST", path: "/a", body: { x: 1 } }, conn);
  await hjRequest({ method: "POST", path: "/b" }, conn);
  assert.equal(calls.length, 3); // tek token istegi
  assert.equal(calls[0].url, "https://hj.test/auth/token");
  assert.deepEqual(calls[0].body, { username: "sahte-kullanici", password: "sahte-sifre" });
  for (const c of calls) {
    assert.equal(c.headers["Content-Type"], "application/json");
    assert.equal(c.headers["X-Origin"], "integration");
    assert.equal(c.headers["X-ClientId"], "hj-integration");
    assert.equal(c.headers["X-Client-Id"], "hj-integration");
  }
  assert.equal(calls[0].headers["X-Auth-Token"], undefined);
  assert.equal(calls[1].headers["X-Auth-Token"], "tok-1");
  assert.deepEqual(calls[1].body, { x: 1 });
  assert.equal(calls[2].headers["X-Auth-Token"], "tok-1");
});

test("token 50 dk sonra yenilenir", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_000_000 });
  fakeFetch(tokenOk("tok-1"), json(200, {}), tokenOk("tok-2"), json(200, {}));
  await hjRequest({ method: "GET", path: "/a" }, conn);
  t.mock.timers.tick(TOKEN_TTL_MS + 1);
  await hjRequest({ method: "GET", path: "/a" }, conn);
  assert.equal(calls[3].headers["X-Auth-Token"], "tok-2");
});

test("401'de token bir kez yenilenip tekrar denenir", async () => {
  fakeFetch(tokenOk("eski"), json(401, { status: "FAIL" }), tokenOk("yeni"), json(200, { status: "OK", data: 1 }));
  const res = await hjRequest({ method: "POST", path: "/a" }, conn);
  assert.deepEqual(res.body, { status: "OK", data: 1 });
  assert.equal(calls[3].headers["X-Auth-Token"], "yeni");
});

test("ikinci 401'de durur (sonsuz dongu yok)", async () => {
  fakeFetch(tokenOk("a"), json(401, {}), tokenOk("b"), json(401, { message: "Yetkisiz" }));
  await assert.rejects(hjRequest({ method: "POST", path: "/a" }, conn), /HepsiJET yetki hatası: Yetkisiz/);
  assert.equal(calls.length, 4);
});

test("hatali kullanici/sifre ve askiya alinmis hesap okunur mesaj verir, sifre mesajda yok", async () => {
  fakeFetch(json(401, { status: "FAIL", message: "Kullanıcı Adı veya Parola Hatalı" }));
  await assert.rejects(hjRequest({ method: "GET", path: "/a" }, conn), (e: Error) => {
    assert.ok(e instanceof HepsijetError);
    assert.equal(e.message, "HepsiJET kullanıcı adı veya şifresi hatalı.");
    assert.ok(!e.message.includes("sahte"));
    return true;
  });
  fakeFetch(json(423, { status: "FAIL", message: "Hesabınız askıya alınmıştır!" }));
  await assert.rejects(hjRequest({ method: "GET", path: "/a" }, conn), /askıya alınmış/);
});

test("status FAIL yaniti 200 olsa da hata", async () => {
  fakeFetch(tokenOk("t"), json(200, { status: "FAIL", message: "Ücret tanımı bulunamadı" }));
  await assert.rejects(hjRequest({ method: "POST", path: "/a" }, conn), /HepsiJET: Ücret tanımı bulunamadı/);
});

test("zaman asimi ve baglanti hatasi Turkce", async () => {
  const timeout = Object.assign(new Error("t"), { name: "TimeoutError" });
  fakeFetch(timeout);
  await assert.rejects(hjRequest({ method: "GET", path: "/a" }, conn), /15 sn içinde yanıt vermedi/);
  fakeFetch(Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } }));
  await assert.rejects(hjRequest({ method: "GET", path: "/a" }, conn), /bağlanılamadı \(ENOTFOUND\)/);
});

test("binary istek: JSON degilse ham bayt doner", async () => {
  const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]);
  fakeFetch(tokenOk("t"), new Response(pdf, { status: 200, headers: { "content-type": "application/pdf" } }));
  const res = await hjRequest({ method: "POST", path: "/l", body: {}, binary: true }, conn);
  assert.deepEqual(res.bytes, pdf);
  assert.equal(calls[1].headers.Accept, "*/*");
});

test("hata mesajlari: 5xx, 404, govdesiz", () => {
  assert.match(hjErrorMessage(502, "<html>"), /sunucu hatası \(502\)/);
  assert.match(hjErrorMessage(404, null), /404/);
  assert.equal(hjErrorMessage(400, { message: "Desi hatalı" }), "HepsiJET: Desi hatalı");
  assert.match(hjErrorMessage(400, ""), /HTTP 400/);
});
