import { test } from "node:test";
import assert from "node:assert/strict";
import { newestProductImage } from "./home-products";

type Product = Parameters<typeof newestProductImage>[0][number];

// newestProductImage'in baktigi alanlar kadar sahte urun.
function product(id: string, day: number): Product {
  return {
    id,
    isFeatured: false,
    createdAt: new Date(2026, 9, day),
    images: [{ url: `https://img.example/${id}.jpg` }],
    optionImages: [],
    brand: null
  } as unknown as Product;
}

test("ayni urun iki gruba dustugunde ikinci kutu farkli urun secer", () => {
  const canta = product("canta", 20);
  const elbise = product("elbise", 10);
  const kemer = product("kemer", 5);
  const used = { productIds: new Set<string>(), urls: new Set<string>() };

  const kadin = newestProductImage([canta, elbise], true, used);
  assert.equal(kadin?.productId, "canta");
  used.productIds.add(kadin!.productId);
  used.urls.add(kadin!.url);

  const aksesuar = newestProductImage([canta, kemer], true, used);
  assert.equal(aksesuar?.productId, "kemer");
});

test("ayni gorsel URL'i farkli urunde olsa da atlanir", () => {
  const used = { productIds: new Set<string>(), urls: new Set(["https://img.example/a.jpg"]) };
  const kopya = { ...product("b", 20), images: [{ url: "https://img.example/a.jpg" }] } as unknown as Product;
  assert.equal(newestProductImage([kopya, product("c", 1)], true, used)?.productId, "c");
});

test("tekrarsiz aday yoksa null yerine tekrar eden gorsele duser", () => {
  const used = { productIds: new Set(["canta"]), urls: new Set<string>() };
  const image = newestProductImage([product("canta", 20)], true, used);
  assert.equal(image?.productId, "canta");
  assert.equal(image?.url, "https://img.example/canta.jpg");
});

test("exclude verilmezse eski davranis: en yeni urun", () => {
  assert.equal(newestProductImage([product("eski", 1), product("yeni", 9)])?.productId, "yeni");
  assert.equal(newestProductImage([]), null);
});
