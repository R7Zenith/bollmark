import { test } from "node:test";
import assert from "node:assert/strict";
import { centsToDecimalString, decimalToCents, trimTrailingZeros } from "./money";

test("centsToDecimalString iki ondalıklı metin üretir", () => {
  assert.equal(centsToDecimalString(0), "0.00");
  assert.equal(centsToDecimalString(1), "0.01");
  assert.equal(centsToDecimalString(1050), "10.50");
  assert.equal(centsToDecimalString(1000), "10.00");
  assert.equal(centsToDecimalString(123456789), "1234567.89");
});

test("centsToDecimalString ondalıklı/negatif/NaN girdiyi reddeder", () => {
  assert.throws(() => centsToDecimalString(10.5));
  assert.throws(() => centsToDecimalString(-1));
  assert.throws(() => centsToDecimalString(Number.NaN));
});

test("decimalToCents metin ve sayı girdisini kuruşa çevirir", () => {
  assert.equal(decimalToCents("10.5"), 1050);
  assert.equal(decimalToCents("10.50"), 1050);
  assert.equal(decimalToCents("10"), 1000);
  assert.equal(decimalToCents("0.01"), 1);
  assert.equal(decimalToCents(100.5), 10050);
  assert.equal(decimalToCents(1), 100);
  assert.equal(decimalToCents("105.500000"), 10550);
});

test("decimalToCents float hatası olan değerlerde kayıpsız çalışır", () => {
  // 0.1 + 0.2 tarzı float yuvarlama tuzakları metin üzerinden okunduğu için oluşmaz
  assert.equal(decimalToCents("19.99"), 1999);
  assert.equal(decimalToCents("1.15"), 115);
  assert.equal(decimalToCents(1.15), 115);
});

test("decimalToCents kuruştan küçük hane veya geçersiz metni reddeder", () => {
  assert.throws(() => decimalToCents("10.505"));
  assert.throws(() => decimalToCents("abc"));
  assert.throws(() => decimalToCents("-5"));
  assert.throws(() => decimalToCents(""));
  assert.throws(() => decimalToCents("1e-7"));
});

test("centsToDecimalString ve decimalToCents birbirinin tersidir", () => {
  for (let cents = 0; cents <= 20000; cents += 7) {
    assert.equal(decimalToCents(centsToDecimalString(cents)), cents);
  }
});

test("trimTrailingZeros imza için sondaki sıfırları atar", () => {
  assert.equal(trimTrailingZeros("10.50"), "10.5");
  assert.equal(trimTrailingZeros("10.00"), "10");
  assert.equal(trimTrailingZeros("10"), "10");
  assert.equal(trimTrailingZeros("100"), "100");
  assert.equal(trimTrailingZeros(10.5), "10.5");
  assert.equal(trimTrailingZeros("0.10"), "0.1");
  assert.equal(trimTrailingZeros("105.500000"), "105.5");
});
