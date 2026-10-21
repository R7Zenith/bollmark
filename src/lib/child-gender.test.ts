import { test } from "node:test";
import assert from "node:assert/strict";
import { guessChildGender } from "./child-gender";

test("adda Kız / Erkek geçiyorsa ondan karar verilir", () => {
  assert.equal(guessChildGender("Kız Çocuk Fırfırlı Elbise", null).gender, "Kız Çocuk");
  assert.equal(guessChildGender("Erkek Çocuk Kapşonlu Mont", "7WKG00001TW").gender, "Erkek Çocuk");
  assert.equal(guessChildGender("ERKEK ÇOCUK MONT", null).gender, "Erkek Çocuk");
});

test("kelimenin parçası sayılmaz", () => {
  assert.equal(guessChildGender("Kızıl Desenli Sweatshirt", null).gender, null);
  assert.equal(guessChildGender("Erkeksi Kesim Gömlek", null).gender, null);
});

test("adda ipucu yoksa Koton kodu: KB erkek, KG kız", () => {
  assert.deepEqual(guessChildGender("Kapşonlu Mont", "7WKB00018TW"), {
    gender: "Erkek Çocuk",
    reason: "ürün kodu KB ile başlıyor"
  });
  assert.equal(guessChildGender("Fırfırlı Elbise", "4SKG80012AK").gender, "Kız Çocuk");
  assert.equal(guessChildGender("Fırfırlı Elbise", " 4skg80012ak ").gender, "Kız Çocuk");
});

test("tahmin edilemeyenler belirsiz kalır", () => {
  assert.equal(guessChildGender("Kapşonlu Mont", null).gender, null);
  assert.equal(guessChildGender("Kapşonlu Mont", "7WAM00018TW").gender, null);
  assert.equal(guessChildGender("Kız Erkek Unisex Tişört", "7WKB00018TW").gender, "Erkek Çocuk");
});
