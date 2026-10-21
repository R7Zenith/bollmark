import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeChildSize } from "./child-size";

const value = (size: string) => normalizeChildSize(size).value;

test("tireli bedenler Yaş biçimine gelir", () => {
  assert.equal(value("5-6"), "5-6 Yaş");
  assert.equal(value("5-6Y"), "5-6 Yaş");
  assert.equal(value("5-6 yas"), "5-6 Yaş");
  assert.equal(value(" 9 - 10 "), "9-10 Yaş");
});

test("bitişik ardışık sayılar ikiye bölünür", () => {
  assert.equal(value("56"), "5-6 Yaş");
  assert.equal(value("910"), "9-10 Yaş");
  assert.equal(value("112"), "11-12 Yaş");
  assert.equal(value("134"), "13-14 Yaş");
  assert.equal(value("1314"), "13-14 Yaş");
});

test("zaten Yaş içerenlere dokunulmaz", () => {
  assert.deepEqual(normalizeChildSize("5-6 Yaş"), { value: "5-6 Yaş", ok: true });
  assert.deepEqual(normalizeChildSize("7-8 YAŞ"), { value: "7-8 YAŞ", ok: true });
});

test("bölünemeyen değer olduğu gibi kalır ve uyarı verir", () => {
  assert.deepEqual(normalizeChildSize("120"), { value: "120", ok: false });
  assert.deepEqual(normalizeChildSize("7"), { value: "7", ok: false });
  assert.deepEqual(normalizeChildSize("XS"), { value: "XS", ok: false });
  assert.deepEqual(normalizeChildSize("58"), { value: "58", ok: false });
});
