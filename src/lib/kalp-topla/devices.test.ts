import { test } from "node:test";
import assert from "node:assert/strict";
import { hashIp, resolveDeviceId } from "./devices";

test("geçerli bm_cihaz kimliği korunur, geçersizse yenisi üretilir", () => {
  const id = "3f2b8c1e-9a4d-4b7e-8f21-0c6d5e4a3b2c";
  assert.deepEqual(resolveDeviceId(id), { deviceId: id, isNew: false });
  const fresh = resolveDeviceId("<script>");
  assert.equal(fresh.isNew, true);
  assert.match(fresh.deviceId, /^[0-9a-f-]{36}$/);
  assert.equal(resolveDeviceId(undefined).isNew, true);
});

test("IP özeti tuzlu ve ham IP'yi içermez; tuz ya da IP yoksa null", () => {
  const a = hashIp("85.100.1.2", "tuz-1");
  assert.equal(a?.length, 64);
  assert.ok(!a?.includes("85.100"));
  assert.notEqual(a, hashIp("85.100.1.2", "tuz-2"));
  assert.equal(hashIp(null, "tuz-1"), null);
  assert.equal(hashIp("85.100.1.2", ""), null);
});
