import { test } from "node:test";
import assert from "node:assert/strict";
import { RETURN_INFO, STORE_INFO } from "@/lib/store-info";
import { returnStatusNotifiable } from "@/lib/status";
import { returnAdminNewEmail, returnReceivedEmail, returnReplyEmail, returnStatusEmail, type ReturnEmailData } from "./order-emails";
import { pickReturnMail, sendReturnCreatedMails } from "./return-mails";
import { returnGuideFor } from "@/lib/return-guide";

const CODE = RETURN_INFO.returnCarrierCode;
const ADDRESS = RETURN_INFO.returnAddress;

const data: ReturnEmailData = {
  siteUrl: "https://bollmark.com",
  customerName: "Ayşe Yılmaz",
  orderNumber: "BLM261120-1234",
  type: "IADE",
  items: [{ name: "Simli Kazak", variant: "Siyah · S", quantity: 1, totalCents: 89990, imageUrl: null }],
  reason: "Beden uymadı",
  customerNote: "M beden <istiyorum>",
  customerReply: null,
  viewUrl: "https://bollmark.com/hesap/iade-taleplerim"
};

test("sabitler istenen degerlerde", () => {
  assert.equal(CODE, "1287643200");
  assert.equal(ADDRESS, "Runguçpaşa Mh. 75.Sk No:6/A Karacabey Bursa");
  assert.equal(RETURN_INFO.returnRecipient, "Bollmark (Oğuzhan Leventoğlu)");
});

test("onay maili: anlasma kodu, adres ve alici birebir html ve metinde", () => {
  const mail = returnStatusEmail(data, "ONAYLANDI");
  for (const part of [mail.html, mail.text]) {
    assert.ok(part.includes(CODE), "kod yok");
    assert.ok(part.includes(ADDRESS), "adres yok");
    assert.ok(part.includes(RETURN_INFO.returnRecipient), "alici yok");
    assert.ok(part.includes(STORE_INFO.returnCarrier), "kargo firmasi yok");
  }
  assert.ok(!mail.text.includes("sana iletilen iade kodu"), "eski ifade kalmis");
  assert.ok(mail.text.includes(`${CODE} numaralı anlaşmalı iade kodumuzu`), "siradaki adimda gercek kod yok");
});

test("kod ve adres yalniz onay mailinde: diger durumlar, 16, 17 ve 18'de yok", () => {
  const others = [
    returnStatusEmail(data, "REDDEDILDI"),
    returnStatusEmail(data, "KARGODA"),
    returnStatusEmail(data, "TAMAMLANDI"),
    returnReceivedEmail(data),
    returnAdminNewEmail(data, "https://bollmark.com/admin/iadeler"),
    returnReplyEmail({ ...data, customerReply: "Fotoğraf rica ediyoruz." }, "ONAYLANDI")
  ];
  for (const mail of others) {
    assert.ok(!mail.html.includes(CODE) && !mail.text.includes(CODE), `${mail.subject}: kod var`);
    assert.ok(!mail.html.includes(ADDRESS) && !mail.text.includes(ADDRESS), `${mail.subject}: adres var`);
  }
});

test("KARGODA: mail atilan durumlar listesinde ve 'kargon yolda' metni", () => {
  assert.ok(returnStatusNotifiable.includes("KARGODA"));
  const mail = returnStatusEmail(data, "KARGODA");
  assert.match(mail.subject, /Kargoda/);
  assert.ok(mail.text.includes("Kargon yolda, ürün bize ulaşınca haber vereceğiz."));
  assert.ok(mail.html.includes("TALEBİN KARGODA"));
});

test("yanit kutusu: varsa durum mailinde ve 18'de, kacislanmis ve satir sonlari korunmus", () => {
  const reply = "Merhaba <b>Ayşe</b>,\nkodla gönderebilirsin.";
  const status = returnStatusEmail({ ...data, customerReply: reply }, "ONAYLANDI");
  const answer = returnReplyEmail({ ...data, customerReply: reply }, "TALEP_EDILDI");
  for (const mail of [status, answer]) {
    assert.ok(mail.html.includes("Bollmark yanıtı"));
    assert.ok(mail.html.includes("Merhaba &lt;b&gt;Ayşe&lt;/b&gt;,<br>kodla gönderebilirsin."));
    assert.ok(!mail.html.includes("<b>Ayşe</b>"));
    assert.ok(mail.text.includes(`Bollmark yanıtı: ${reply}`));
  }
  assert.ok(!returnStatusEmail(data, "ONAYLANDI").html.includes("Bollmark yanıtı"), "yanit yokken kutu cikmamali");
});

test("16 ve 17: konu, sebep, musteri notu (kacislanmis) ve linkler", () => {
  const received = returnReceivedEmail(data);
  assert.equal(received.subject, "İade talebiniz alındı - BLM261120-1234");
  assert.ok(received.html.includes("M beden &lt;istiyorum&gt;"));
  assert.ok(received.html.includes(data.viewUrl));
  assert.ok(received.text.includes("hesabında ve e-postanda görünecek"));

  const admin = returnAdminNewEmail(data, "https://bollmark.com/admin/iadeler?q=BLM261120-1234");
  assert.equal(admin.subject, "Yeni iade talebi: BLM261120-1234");
  assert.ok(admin.html.includes("Ayşe Yılmaz") && admin.html.includes("Beden uymadı"));
  assert.ok(admin.html.includes("https://bollmark.com/admin/iadeler?q=BLM261120-1234"));
});

test("talep acilinca: musteriye 16, admin'e 17 gider (sendMail mock)", async () => {
  const calls: { to: string; subject: string; kind?: string }[] = [];
  const send = async (p: { to: string; subject: string; log?: { kind: string } }) => {
    calls.push({ to: p.to, subject: p.subject, kind: p.log?.kind });
    return true;
  };
  await sendReturnCreatedMails({ customerEmail: "ayse@example.com", data, adminTo: "admin@example.com", adminUrl: "https://x/admin" }, send);
  assert.deepEqual(
    calls.map((c) => [c.to, c.kind]),
    [
      ["ayse@example.com", "RETURN_RECEIVED"],
      ["admin@example.com", "RETURN_ADMIN_NEW"]
    ]
  );
});

test("talep acilinca: admin adresi yoksa yalniz musteriye; gonderim hatasi firlatmaz", async () => {
  const to: string[] = [];
  await sendReturnCreatedMails({ customerEmail: "ayse@example.com", data, adminTo: null, adminUrl: "" }, async (p) => {
    to.push(p.to);
    return true;
  });
  assert.deepEqual(to, ["ayse@example.com"]);

  const original = console.error;
  console.error = () => {};
  try {
    await assert.doesNotReject(
      sendReturnCreatedMails({ customerEmail: "a@example.com", data, adminTo: "b@example.com", adminUrl: "" }, async () => {
        throw new Error("Resend kapali");
      })
    );
  } finally {
    console.error = original;
  }
});

test("admin kaydi: durum degisirse tek durum maili, yalniz yanit degisirse 18, degisiklik yoksa mail yok", () => {
  assert.equal(pickReturnMail({ status: "TALEP_EDILDI", customerReply: null }, { status: "ONAYLANDI", customerReply: "Onaylandı" }), "STATUS");
  assert.equal(pickReturnMail({ status: "ONAYLANDI", customerReply: null }, { status: "ONAYLANDI", customerReply: "Fotoğraf?" }), "REPLY");
  assert.equal(pickReturnMail({ status: "ONAYLANDI", customerReply: "Aynı" }, { status: "ONAYLANDI", customerReply: "Aynı" }), null);
  assert.equal(pickReturnMail({ status: "ONAYLANDI", customerReply: "x" }, { status: "ONAYLANDI", customerReply: null }), null);
  // TALEP_EDILDI'ye geri donus durum maili atmaz; yanit varsa 18 gider.
  assert.equal(pickReturnMail({ status: "ONAYLANDI", customerReply: null }, { status: "TALEP_EDILDI", customerReply: "Yeniden inceliyoruz" }), "REPLY");
});

test("rehber verisi yalniz ONAYLANDI ve KARGODA'da doner", () => {
  for (const status of ["TALEP_EDILDI", "REDDEDILDI", "TAMAMLANDI"]) assert.equal(returnGuideFor(status, "BLM1"), null);
  for (const status of ["ONAYLANDI", "KARGODA"]) {
    const guide = returnGuideFor(status, "BLM1");
    assert.equal(guide?.code, CODE);
    assert.equal(guide?.address, ADDRESS);
    assert.ok(guide?.steps.some((s) => s.includes("BLM1")));
  }
});
