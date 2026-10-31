import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatInviteValue,
  INVITE_COOKIE_OPTIONS,
  inviteHistoryLabel,
  maskName,
  parseInviteValue,
  reviewReasons,
  whatsappShareUrl
} from "./invite-rules";

test("bm_davet: 7 gün, SameSite=Lax, form okuyabilir", () => {
  assert.equal(INVITE_COOKIE_OPTIONS.maxAge, 7 * 24 * 60 * 60);
  assert.equal(INVITE_COOKIE_OPTIONS.sameSite, "lax");
  assert.equal(INVITE_COOKIE_OPTIONS.httpOnly, false);
});

test("davet değeri yazılır, okunur; bozuk değer reddedilir", () => {
  assert.deepEqual(parseInviteValue(formatInviteValue("ABCD2345", "cmabc123")), { code: "ABCD2345", productId: "cmabc123" });
  assert.deepEqual(parseInviteValue("ABCD2345"), { code: "ABCD2345", productId: null });
  for (const bad of ["", null, undefined, "abcd2345", "ABCD234", "ABCD2345.<script>", "ABCD2345.a.b", "OOOO1111"]) {
    assert.equal(parseInviteValue(bad), null, String(bad));
  }
});

test("yalnız cihaz incelemeye düşürür, eşik ayardan gelir", () => {
  const base = { otherAccountsOnDevice: 0, sameDeviceMaxAccounts: 1, inviterSeenOnDevice: false };
  assert.deepEqual(reviewReasons(base), []);
  assert.deepEqual(reviewReasons({ ...base, otherAccountsOnDevice: 1 }), ["SAME_DEVICE"]);
  assert.deepEqual(reviewReasons({ ...base, otherAccountsOnDevice: 1, sameDeviceMaxAccounts: 2 }), []);
  assert.deepEqual(reviewReasons({ ...base, otherAccountsOnDevice: 2, sameDeviceMaxAccounts: 2 }), ["SAME_DEVICE"]);
  assert.deepEqual(reviewReasons({ ...base, inviterSeenOnDevice: true }), ["SAME_DEVICE_AS_INVITER"]);
});

test("ad maskelenir", () => {
  assert.equal(maskName("Ayşe Kaya"), "A*** K.");
  assert.equal(maskName("Ayşe Nur Kaya"), "A*** K.");
  assert.equal(maskName("Ayşe"), "A***");
  assert.equal(maskName("  "), "Üye");
});

test("davet geçmişi etiketi", () => {
  assert.equal(inviteHistoryLabel("PENDING_VERIFICATION", []), "Doğrulama bekliyor");
  assert.equal(inviteHistoryLabel("UNDER_REVIEW", []), "İncelemede");
  assert.equal(inviteHistoryLabel("CREDITED", [{ status: "WAITING", points: 2 }]), "Bekleyen bonus");
  assert.equal(inviteHistoryLabel("CREDITED", [{ status: "APPLIED", points: 2 }]), "+2 eklendi");
  assert.equal(
    inviteHistoryLabel("CREDITED", [{ status: "ROUND_CLOSED", points: 1 }, { status: "WAITING", points: 1 }]),
    "+1 eklendi, +1 bekliyor"
  );
  assert.equal(inviteHistoryLabel("CREDITED", [{ status: "VOID_WITHDRAWN", points: 2 }]), "Düştü");
  assert.equal(inviteHistoryLabel("CREDITED", [{ status: "EXPIRED", points: 2 }]), "Süresi doldu");
});

test("WhatsApp yalnız resmi wa.me linki", () => {
  const url = whatsappShareUrl("https://bollmark.com/davet/ABCD2345");
  assert.ok(url.startsWith("https://wa.me/?text="));
  assert.ok(decodeURIComponent(url).includes("https://bollmark.com/davet/ABCD2345"));
});
