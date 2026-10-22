import { test } from "node:test";
import assert from "node:assert/strict";
import { captionToAlt, mediaImageUrl, parsePosts } from "./instagram-media";

test("videoda kapak gorseli, gorselde media_url; https olmayan ya da bos atlanir", () => {
  assert.equal(mediaImageUrl({ id: "1", media_type: "VIDEO", media_url: "https://v/x.mp4", thumbnail_url: "https://t/x.jpg" }), "https://t/x.jpg");
  assert.equal(mediaImageUrl({ id: "2", media_type: "IMAGE", media_url: "https://i/x.jpg" }), "https://i/x.jpg");
  assert.equal(mediaImageUrl({ id: "3", media_type: "CAROUSEL_ALBUM", media_url: "https://c/x.jpg" }), "https://c/x.jpg");
  assert.equal(mediaImageUrl({ id: "4", media_type: "VIDEO" }), null);
  assert.equal(mediaImageUrl({ id: "5", media_type: "IMAGE", media_url: "http://i/x.jpg" }), null);
});

test("alt metin: ilk cumle, hashtag/mention/emoji temizlenir", () => {
  assert.equal(captionToAlt("Yeni sezon montlar geldi! Hemen gel 🧥 #koton @bollmark"), "Yeni sezon montlar geldi!");
  assert.equal(captionToAlt("Karacabey mağazamızda 🎉\nikinci satır"), "Karacabey mağazamızda");
  assert.equal(captionToAlt("#sadecehashtag"), "Bollmark Instagram paylaşımı");
  assert.equal(captionToAlt(undefined), "Bollmark Instagram paylaşımı");
  assert.equal(captionToAlt("a".repeat(200)).length, 120);
});

test("kayitli kareler: bozuk JSON ve eksik alanli kayit atilir", () => {
  assert.deepEqual(parsePosts("bozuk"), []);
  const ok = { id: "1", imageUrl: "https://r/x.webp", permalink: "https://instagram.com/p/1", alt: "a" };
  assert.deepEqual(parsePosts(JSON.stringify([ok, { id: "2" }])), [ok]);
});
