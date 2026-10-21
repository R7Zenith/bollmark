import { test } from "node:test";
import assert from "node:assert/strict";
import { groupExcelRows, type ExcelImportRow } from "./excel-import";

function row(overrides: Partial<ExcelImportRow>): ExcelImportRow {
  return {
    rowNumber: 2,
    productCode: "7WKB00018TW",
    productName: "Kapşonlu Mont",
    barcode: "8680000000001",
    genderRaw: "KIDS",
    categoryRaw: "COATS",
    seasonRaw: "2026 KIŞ",
    color: "SİYAH",
    size: "910",
    costCents: null,
    priceCents: 199900,
    stock: 1,
    brandName: "KOTON",
    ...overrides
  };
}

test("çocuk satırı: cinsiyet koddan tahmin edilir, beden düzeltilir, SKU için ham beden kalır", () => {
  const [group] = groupExcelRows([row({}), row({ barcode: "8680000000002", size: "XL" })]);
  assert.equal(group.gender, "Erkek Çocuk");
  assert.equal(group.genderUncertain, false);
  assert.deepEqual(group.variants.map((v) => v.size), ["9-10 Yaş", "XL"]);
  assert.deepEqual(group.variants.map((v) => v.sizeRaw), ["910", "XL"]);
  assert.deepEqual(group.sizeWarnings, ["XL"]);
});

test("çocuk satırı: ipucu yoksa Çocuk kalır ve belirsiz işaretlenir", () => {
  const [group] = groupExcelRows([row({ productCode: "7WAM00001TW" })]);
  assert.equal(group.gender, "Çocuk");
  assert.equal(group.genderUncertain, true);
});

test("yetişkin bedenlerine dokunulmaz", () => {
  const groups = groupExcelRows([
    row({ productCode: "A1", productName: "Jean Pantolon", genderRaw: "MEN", size: "3032" }),
    row({ productCode: "A2", productName: "Elbise", genderRaw: "WOMEN", size: "56", barcode: "8680000000003" })
  ]);
  assert.deepEqual(groups.map((g) => g.variants[0].size), ["3032", "56"]);
  assert.deepEqual(groups.map((g) => g.sizeWarnings.length), [0, 0]);
  assert.deepEqual(groups.map((g) => g.gender), ["Erkek", "Kadın"]);
});
