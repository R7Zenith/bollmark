import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import net from "node:net";
import type { AddressInfo } from "node:net";
import {
  buildCancelShipmentXml,
  buildCreateShipmentXml,
  buildQueryShipmentXml,
  CONNECTION_REFUSED_MESSAGE,
  parseCancelResponse,
  parseCreateResponse,
  parseQueryResponse,
  postSoap,
  YurticiFault
} from "./soap";
import { childText, parseXml } from "./xml";

const creds = { username: "U&1", password: "p<w>" };
const vo = {
  cargoKey: "BLM1",
  invoiceKey: "BLM1",
  receiverCustName: "Ayşe & Ali <Yılmaz>",
  receiverAddress: "Cumhuriyet Mah. \"A\" Sok. No:5",
  cityName: "Bursa",
  townName: "Karacabey",
  receiverPhone1: "5321234567",
  emailAddress: "a@b.com",
  cargoCount: 1,
  description: "Bollmark sipariş BLM1"
};

test("createShipment govdesi: ozel karakterler kacirilir, alanlar sirali", () => {
  const xml = buildCreateShipmentXml(creds, [vo, { ...vo, cargoKey: "BLM2", invoiceKey: "BLM2" }]);
  assert.match(xml, /<ship:createShipment><wsUserName>U&amp;1<\/wsUserName><wsPassword>p&lt;w&gt;<\/wsPassword><userLanguage>TR<\/userLanguage><ShippingOrderVO><cargoKey>BLM1</);
  assert.ok(xml.includes("<receiverCustName>Ayşe &amp; Ali &lt;Yılmaz&gt;</receiverCustName>"));
  assert.ok(xml.includes("&quot;A&quot;"));
  assert.equal(xml.match(/<ShippingOrderVO>/g)?.length, 2);
  // gidis-donus: kendi ayrıstırıcımız ayni degerleri geri okur
  const root = parseXml(xml);
  const first = root.children[0].children[1].children[0].children[3];
  assert.equal(first.name, "ShippingOrderVO");
  assert.equal(childText(first, "receiverCustName"), vo.receiverCustName);
});

test("query ve cancel govdeleri birden cok anahtar tasir", () => {
  const q = buildQueryShipmentXml(creds, ["A", "B"]);
  assert.ok(q.includes("<wsLanguage>TR</wsLanguage><keys>A</keys><keys>B</keys><keyType>0</keyType>"));
  const c = buildCancelShipmentXml(creds, ["A", "B"]);
  assert.ok(c.includes("<cargoKeys>A</cargoKeys><cargoKeys>B</cargoKeys>"));
});

// Dokumandaki ornek cevap bicimi (namespace onekli, nil alanli).
const CREATE_RESPONSE = `<?xml version="1.0" encoding="UTF-8"?>
<env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">
  <env:Header/>
  <env:Body>
    <ns1:createShipmentResponse xmlns:ns1="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
      <ShippingOrderResultVO>
        <count>2</count>
        <jobId>123456789</jobId>
        <outFlag>0</outFlag>
        <outResult>Başarılı</outResult>
        <senderCustId>987</senderCustId>
        <shippingOrderDetailVO>
          <cargoKey>BLM1</cargoKey><errCode>0</errCode><errMessage xsi:nil="true" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"/><invoiceKey>BLM1</invoiceKey>
        </shippingOrderDetailVO>
        <shippingOrderDetailVO>
          <cargoKey>BLM2</cargoKey><errCode>60020</errCode><errMessage>Kargo anahtarı &amp; fatura mevcut</errMessage><invoiceKey>BLM2</invoiceKey>
        </shippingOrderDetailVO>
      </ShippingOrderResultVO>
    </ns1:createShipmentResponse>
  </env:Body>
</env:Envelope>`;

test("createShipment cevabi ayrıstırılır", () => {
  const r = parseCreateResponse(CREATE_RESPONSE);
  assert.equal(r.outFlag, "0");
  assert.equal(r.jobId, "123456789");
  assert.deepEqual(r.rows, [
    { cargoKey: "BLM1", errCode: "0", errMessage: "" },
    { cargoKey: "BLM2", errCode: "60020", errMessage: "Kargo anahtarı & fatura mevcut" }
  ]);
});

const QUERY_RESPONSE = `<S:Envelope xmlns:S="http://schemas.xmlsoap.org/soap/envelope/"><S:Body>
<ns2:queryShipmentResponse xmlns:ns2="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">
<ShippingDeliveryVO><count>1</count><outFlag>0</outFlag><outResult>Başarılı</outResult>
<shippingDeliveryDetailVO>
  <cargoKey>BLM1</cargoKey><errCode>0</errCode><invoiceKey>BLM1</invoiceKey><jobId>1</jobId>
  <operationCode>5</operationCode><operationMessage>Kargo teslim edilmiştir.</operationMessage><operationStatus>DLV</operationStatus>
  <shippingDeliveryItemDetailVO>
    <docId>110123456789</docId>
    <deliveryDate>20261110</deliveryDate><deliveryTime>143005</deliveryTime>
    <trackingUrl><![CDATA[https://selfservis.yurticikargo.com/x?a=1&b=2]]></trackingUrl>
    <rejectStatus/>
    <invDocCargoVOArray><docId>HAREKET-ICI</docId><eventName>Teslim</eventName></invDocCargoVOArray>
  </shippingDeliveryItemDetailVO>
</shippingDeliveryDetailVO>
</ShippingDeliveryVO></ns2:queryShipmentResponse></S:Body></S:Envelope>`;

test("queryShipment cevabi: hareket listesindeki ayni adli alanlar karismaz", () => {
  const r = parseQueryResponse(QUERY_RESPONSE);
  assert.equal(r.rows.length, 1);
  assert.deepEqual(r.rows[0], {
    cargoKey: "BLM1",
    operationStatus: "DLV",
    operationMessage: "Kargo teslim edilmiştir.",
    errCode: "0",
    errMessage: "",
    docId: "110123456789",
    trackingUrl: "https://selfservis.yurticikargo.com/x?a=1&b=2",
    deliveryDate: "20261110",
    deliveryTime: "143005",
    rejectStatus: ""
  });
});

test("cancelShipment cevabi ayrıstırılır", () => {
  const xml = `<env:Envelope xmlns:env="x"><env:Body><ns1:cancelShipmentResponse xmlns:ns1="y"><ShippingOrderResultVO><outFlag>0</outFlag>
  <shippingCancelDetailVO><cargoKey>BLM1</cargoKey><errCode>0</errCode><operationStatus>CNL</operationStatus><operationMessage>İptal</operationMessage></shippingCancelDetailVO>
  </ShippingOrderResultVO></ns1:cancelShipmentResponse></env:Body></env:Envelope>`;
  assert.deepEqual(parseCancelResponse(xml).rows, [
    { cargoKey: "BLM1", operationStatus: "CNL", operationMessage: "İptal", errCode: "0", errMessage: "" }
  ]);
});

test("SOAP Fault hata olarak firlatilir; bozuk XML reddedilir", () => {
  const fault = `<S:Envelope xmlns:S="x"><S:Body><S:Fault><faultcode>S:Server</faultcode><faultstring>Kullanıcı adı veya şifre hatalı</faultstring></S:Fault></S:Body></S:Envelope>`;
  assert.throws(() => parseQueryResponse(fault), (e: unknown) => e instanceof YurticiFault && e.message === "Kullanıcı adı veya şifre hatalı");
  assert.throws(() => parseXml("<a><b></a>"));
  assert.throws(() => parseXml("<a>"));
});

// --- Ag yolu (yalniz 127.0.0.1; dis istek yok) ---

function listen(server: http.Server | net.Server): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve((server.address() as AddressInfo).port)));
}

test("proxy bossa dogrudan gider", async () => {
  const target = http.createServer((req, res) => res.end(CREATE_RESPONSE));
  const port = await listen(target);
  try {
    const text = await postSoap(`http://127.0.0.1:${port}/svc`, "<x/>", null);
    assert.equal(parseCreateResponse(text).jobId, "123456789");
  } finally {
    target.close();
  }
});

test("proxy doluysa istek CONNECT tuneliyle proxy'den ve kimlikle gider", async () => {
  const target = http.createServer((req, res) => res.end(CREATE_RESPONSE));
  const targetPort = await listen(target);
  let proxyAuth = "";
  let connectTarget = "";
  const proxy = http.createServer();
  proxy.on("connect", (req, socket, head) => {
    proxyAuth = String(req.headers["proxy-authorization"] || "");
    connectTarget = req.url || "";
    const upstream = net.connect(targetPort, "127.0.0.1", () => {
      socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
      upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
  });
  const proxyPort = await listen(proxy);
  try {
    const text = await postSoap(`http://127.0.0.1:${targetPort}/svc`, "<x/>", `http://fixie:gizli@127.0.0.1:${proxyPort}`);
    assert.equal(parseCreateResponse(text).jobId, "123456789");
    assert.equal(connectTarget, `127.0.0.1:${targetPort}`);
    assert.equal(proxyAuth, `Basic ${Buffer.from("fixie:gizli").toString("base64")}`);
  } finally {
    proxy.close();
    target.close();
    proxy.closeAllConnections();
    target.closeAllConnections();
  }
});

test("baglanti reddi ve 403 anlasilir Turkce mesaj verir; proxy adresi mesaja yazilmaz", async () => {
  const closed = net.createServer();
  const closedPort = await listen(closed);
  closed.close();
  await assert.rejects(postSoap(`http://127.0.0.1:${closedPort}/`, "<x/>", null), { message: CONNECTION_REFUSED_MESSAGE });
  await assert.rejects(
    postSoap("http://127.0.0.1:9/", "<x/>", `http://fixie:cokgizli@127.0.0.1:${closedPort}`),
    (e: unknown) => e instanceof Error && !e.message.includes("cokgizli")
  );
  const forbidden = http.createServer((req, res) => {
    res.statusCode = 403;
    res.end("Forbidden");
  });
  const port = await listen(forbidden);
  try {
    await assert.rejects(postSoap(`http://127.0.0.1:${port}/`, "<x/>", null), { message: CONNECTION_REFUSED_MESSAGE });
  } finally {
    forbidden.close();
  }
});

test("ShippingOrderVO alan sirasi test WSDL'indeki sirayla ayni, zorunlu sayisal alanlar var", () => {
  // WSDL ShippingOrderVO dizisi (2026-11-10, testwebservices), bizim gonderdiklerimiz:
  const wsdlOrder = [
    "cargoKey", "invoiceKey", "receiverCustName", "receiverAddress", "cityName", "townName", "receiverPhone1",
    "receiverPhone2", "receiverPhone3", "emailAddress", "taxOfficeId", "taxNumber", "taxOfficeName", "desi", "kg",
    "cargoCount", "waybillNo", "specialField1", "specialField2", "specialField3", "ttInvoiceAmount", "ttDocumentId",
    "ttCollectionType", "ttDocumentSaveType", "dcSelectedCredit", "dcCreditRule", "description"
  ];
  const xml = buildCreateShipmentXml(creds, [vo]);
  const sent = [...xml.slice(xml.indexOf("<ShippingOrderVO>") + 17, xml.indexOf("</ShippingOrderVO>")).matchAll(/<([A-Za-z0-9]+)>/g)].map((m) => m[1]);
  const positions = sent.map((n) => wsdlOrder.indexOf(n));
  assert.ok(positions.every((p) => p >= 0), `bilinmeyen alan: ${sent}`);
  assert.deepEqual(positions, [...positions].sort((a, b) => a - b));
  for (const required of ["taxOfficeId", "cargoCount", "ttDocumentId", "dcSelectedCredit", "dcCreditRule"]) {
    assert.ok(sent.includes(required), required);
  }
});

test("sonuc seviyesindeki errCode okunur", () => {
  const xml = `<S:Envelope xmlns:S="x"><S:Body><ns2:queryShipmentResponse xmlns:ns2="y"><ShippingDeliveryVO><outFlag>2</outFlag><outResult>Kullanıcı adı veya şifre hatalı</outResult><errCode>60001</errCode><count>0</count></ShippingDeliveryVO></ns2:queryShipmentResponse></S:Body></S:Envelope>`;
  const r = parseQueryResponse(xml);
  assert.equal(r.errCode, "60001");
  assert.equal(r.outFlag, "2");
  assert.equal(r.rows.length, 0);
});
