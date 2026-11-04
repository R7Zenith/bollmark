import { test } from "node:test";
import assert from "node:assert/strict";
import { getClientIpInfo } from "./client-ip";

test("IP: x-real-ip, yoksa x-forwarded-for'un ilk değeri; konum başlıkları çözülür", async () => {
  const vercel = new Headers({
    "x-real-ip": "85.1.2.3",
    "x-forwarded-for": "10.0.0.1",
    "x-vercel-ip-city": encodeURIComponent("Kadıköy"),
    "x-vercel-ip-country-region": "34",
    "x-vercel-ip-country": "TR"
  });
  assert.deepEqual(await getClientIpInfo(vercel), { ip: "85.1.2.3", city: "Kadıköy", region: "34", country: "TR" });
  assert.equal((await getClientIpInfo(new Headers({ "x-forwarded-for": "85.9.9.9, 10.0.0.1" }))).ip, "85.9.9.9");
});

test("localhost: konum yok, başlık yoksa hepsi null", async () => {
  assert.deepEqual(await getClientIpInfo(new Headers({ "x-forwarded-for": "::1" })), { ip: "::1", city: null, region: null, country: null });
  assert.deepEqual(await getClientIpInfo(new Headers()), { ip: null, city: null, region: null, country: null });
});
