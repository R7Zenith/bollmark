import { test } from "node:test";
import assert from "node:assert/strict";
import { buildBuyerAndAddresses, extractIp, normalizePhone, splitName, BuyerError } from "./buyer";

test("telefon biçimleri +90XXXXXXXXXX'e normalize edilir", () => {
  for (const raw of ["0555 123 45 67", "+90 555 123 45 67", "555 123 45 67", "905551234567", "0(555)123-45-67", "05551234567", "00905551234567"]) {
    assert.equal(normalizePhone(raw), "+905551234567", raw);
  }
});

test("geçersiz telefon reddedilir", () => {
  for (const raw of ["", "123", "0555 123 45", "+1 202 555 0100", "abcdefghij", "0000000000"]) {
    assert.throws(() => normalizePhone(raw), BuyerError, raw);
  }
});

test("ad soyad bölme: tek kelime, çok kelime, Türkçe karakter, fazla boşluk", () => {
  assert.deepEqual(splitName("Ali"), { name: "Ali", surname: "Ali" });
  assert.deepEqual(splitName("Ayşe Yılmaz"), { name: "Ayşe", surname: "Yılmaz" });
  assert.deepEqual(splitName("  Ayşe   Nur   Çelik  "), { name: "Ayşe Nur", surname: "Çelik" });
  assert.throws(() => splitName("   "), BuyerError);
});

test("IP çıkarımı: x-forwarded-for ilk değer, x-real-ip, IPv6 sadeleştirme", () => {
  const h = (map: Record<string, string>) => ({ get: (n: string) => map[n] ?? null });
  assert.equal(extractIp(h({ "x-forwarded-for": "85.1.2.3, 10.0.0.1" })), "85.1.2.3");
  assert.equal(extractIp(h({ "x-real-ip": "85.9.9.9" })), "85.9.9.9");
  assert.equal(extractIp(h({ "x-forwarded-for": "::ffff:85.1.2.3" })), "85.1.2.3");
  assert.equal(extractIp(h({ "x-forwarded-for": "::1" })), "127.0.0.1");
  assert.equal(extractIp(h({})), "127.0.0.1");
});

test("alıcı ve adres bloğu iyzico alanlarını üretir", () => {
  const { buyer, shippingAddress, billingAddress } = buildBuyerAndAddresses(
    {
      id: "ord1",
      customerId: null,
      customerName: "Şule Öztürk",
      customerEmail: "sule@example.com",
      customerPhone: "0555 123 45 67",
      shippingAddress: "Atatürk Cad. No:5",
      city: "İstanbul",
      district: "Kadıköy",
      postalCode: "34700"
    },
    "85.1.2.3"
  );
  assert.equal(buyer.id, "guest-ord1");
  assert.equal(buyer.name, "Şule");
  assert.equal(buyer.surname, "Öztürk");
  assert.equal(buyer.gsmNumber, "+905551234567");
  assert.equal(buyer.identityNumber, "11111111111");
  assert.equal(buyer.country, "Turkey");
  assert.equal(buyer.ip, "85.1.2.3");
  assert.equal(buyer.zipCode, "34700");
  assert.equal(shippingAddress.contactName, "Şule Öztürk");
  assert.deepEqual(shippingAddress, billingAddress);
  assert.equal(shippingAddress.address, "Atatürk Cad. No:5, Kadıköy");
});

test("giriş yapmış müşteride buyer.id müşteri id'si, posta kodu yoksa zipCode gönderilmez", () => {
  const { buyer, shippingAddress } = buildBuyerAndAddresses(
    {
      id: "ord2",
      customerId: "cust9",
      customerName: "Ali",
      customerEmail: "a@example.com",
      customerPhone: "5551234567",
      shippingAddress: "Adres 1",
      city: "Ankara",
      district: "Çankaya",
      postalCode: "  "
    },
    "1.1.1.1"
  );
  assert.equal(buyer.id, "cust9");
  assert.equal("zipCode" in buyer, false);
  assert.equal("zipCode" in shippingAddress, false);
});
