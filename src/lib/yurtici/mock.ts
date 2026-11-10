import type { ShippingOrderVO } from "./map";
import { xmlEscape } from "./xml";

// YURTICI_MODE=mock: hicbir dis istek atilmaz. Cevaplar gercek servisin XML
// bicimiyle uretilir ve gercek ayrıstırıcıdan gecer.
//
// Davranis:
// - Olusturma basarili; anahtar daha once kullanildiysa 60020. Arayuzden
//   denemek icin: alici adinda "Anahtar Var" geciyorsa ekli olmayan ilk anahtar
//   (or. BLMTEST-0004) 60020 alir, sonraki deneme (-2) basarili olur.
// - Telefonun son 7 hanesi ayni rakamsa (or. 532 000 00 00) 82516.
// - Her sorgu gonderiyi bir adim ilerletir: NOP -> ISR -> IND -> DLV.
// - Iptal yalniz NOP iken CNL; sonrasinda iade istegi (IND) doner.
// Durum sunucu bellegindedir; sunucu yeniden baslarsa bilinmeyen anahtar NOP'tan baslar.

const STEPS = ["NOP", "ISR", "IND", "DLV"] as const;
const OPERATION_CODES: Record<string, number> = { NOP: 0, IND: 1, ISR: 2, CNL: 3, DLV: 5 };

type MockShipment = { step: number; cancelled: boolean; docId: string };

const g = globalThis as unknown as { __yurticiMock?: Map<string, MockShipment> };
const store = (g.__yurticiMock ??= new Map());

export function resetYurticiMock() {
  store.clear();
}

function docIdFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `9${String(h).padStart(10, "0").slice(0, 10)}`;
}

function wrap(operation: string, inner: string): string {
  return (
    `<?xml version="1.0" encoding="UTF-8"?><env:Envelope xmlns:env="http://schemas.xmlsoap.org/soap/envelope/">` +
    `<env:Body><ns1:${operation}Response xmlns:ns1="http://yurticikargo.com.tr/ShippingOrderDispatcherServices">` +
    inner +
    `</ns1:${operation}Response></env:Body></env:Envelope>`
  );
}

const x = (name: string, value: string | number) => `<${name}>${xmlEscape(String(value))}</${name}>`;

export function mockCreateShipment(vos: ShippingOrderVO[]): string {
  let okCount = 0;
  const rows = vos.map((vo) => {
    let errCode = "0";
    let errMessage = "";
    const forcedDuplicate = /anahtar var/i.test(vo.receiverCustName) && vo.cargoKey.split("-").length === 2;
    if (store.has(vo.cargoKey) || forcedDuplicate) {
      errCode = "60020";
      errMessage = "Kargo anahtarı sistemde mevcut.";
    } else if (/(\d)\1{6}$/.test(vo.receiverPhone1)) {
      errCode = "82516";
      errMessage = "Telefon numarası hatalı.";
    } else {
      store.set(vo.cargoKey, { step: 0, cancelled: false, docId: docIdFor(vo.cargoKey) });
      okCount++;
    }
    return `<shippingOrderDetailVO>${x("cargoKey", vo.cargoKey)}${x("invoiceKey", vo.invoiceKey)}${x("errCode", errCode)}${x("errMessage", errMessage)}</shippingOrderDetailVO>`;
  });
  const outFlag = okCount > 0 ? "0" : "1";
  return wrap(
    "createShipment",
    `<ShippingOrderResultVO>${x("outFlag", outFlag)}${x("outResult", okCount > 0 ? "Başarılı" : "Hatalı")}` +
      `${x("count", vos.length)}${x("jobId", okCount > 0 ? String(Date.now()).slice(-9) : "")}${rows.join("")}</ShippingOrderResultVO>`
  );
}

function istanbulStamp(now: Date): { date: string; time: string } {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).formatToParts(now);
  const get = (t: string) => p.find((x) => x.type === t)!.value;
  return { date: `${get("year")}${get("month")}${get("day")}`, time: `${get("hour")}${get("minute")}${get("second")}` };
}

export function mockQueryShipment(keys: string[], now = new Date()): string {
  const rows = keys.map((key) => {
    let s = store.get(key);
    if (!s) {
      s = { step: 0, cancelled: false, docId: docIdFor(key) };
      store.set(key, s);
    } else if (!s.cancelled && s.step < STEPS.length - 1) {
      s.step++;
    }
    const status = s.cancelled ? "CNL" : STEPS[s.step];
    const delivered = status === "DLV" ? istanbulStamp(now) : { date: "", time: "" };
    const hasDoc = status !== "NOP" && status !== "CNL";
    return (
      `<shippingDeliveryDetailVO>${x("cargoKey", key)}${x("invoiceKey", key)}${x("operationCode", OPERATION_CODES[status])}` +
      `${x("operationMessage", status)}${x("operationStatus", status)}${x("errCode", "0")}${x("errMessage", "")}` +
      `<shippingDeliveryItemDetailVO>${x("docId", hasDoc ? s.docId : "")}` +
      `${x("trackingUrl", hasDoc ? `https://www.yurticikargo.com/tr/online-servisler/gonderi-sorgula?code=${s.docId}` : "")}` +
      `${x("deliveryDate", delivered.date)}${x("deliveryTime", delivered.time)}${x("rejectStatus", "")}${x("returnStatus", "")}` +
      `</shippingDeliveryItemDetailVO></shippingDeliveryDetailVO>`
    );
  });
  return wrap(
    "queryShipment",
    `<ShippingDeliveryVO>${x("outFlag", "0")}${x("outResult", "Başarılı")}${x("count", keys.length)}${rows.join("")}</ShippingDeliveryVO>`
  );
}

export function mockCancelShipment(keys: string[]): string {
  const rows = keys.map((key) => {
    const s = store.get(key);
    let status = "CNL";
    let errCode = "0";
    let message = "İptal edildi.";
    if (!s) {
      errCode = "82500";
      message = "Kargo anahtarı bulunamadı.";
      status = "";
    } else if (s.step > 0 && !s.cancelled) {
      status = "IND";
      message = "Gönderi düzenlenmiş; iade isteği oluşturuldu.";
    } else {
      s.cancelled = true;
    }
    return `<shippingCancelDetailVO>${x("cargoKey", key)}${x("invoiceKey", key)}${x("operationStatus", status)}${x("operationMessage", message)}${x("errCode", errCode)}${x("errMessage", errCode === "0" ? "" : message)}</shippingCancelDetailVO>`;
  });
  return wrap(
    "cancelShipment",
    `<ShippingOrderResultVO>${x("outFlag", "0")}${x("outResult", "Başarılı")}${rows.join("")}</ShippingOrderResultVO>`
  );
}
