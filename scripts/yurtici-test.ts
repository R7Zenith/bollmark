// Yurtici test ortami denemeleri (plan bolum 6). Veritabanina HIC yazmaz,
// gercek siparislere dokunmaz; her zaman TEST ortamini ve dokumandaki ortak
// test kullanicisini (YKTEST) kullanir. Cikis yolu .env'deki YURTICI_PROXY_URL'ye
// gore: doluysa Fixie, bossa dogrudan. --dogrudan proxy'yi bu calisma icin kapatir.
// --canli: CANLI ortam + .env'deki GO kullanicisi. Olusturulan gonderi subeye
// verilmeden "iptal" ile kapatilmali (NOP -> CNL), yoksa gercek gonderi kalir.
//
//   npx tsx scripts/yurtici-test.ts wsdl [--dogrudan]       servis tanimini indirir
//   npx tsx scripts/yurtici-test.ts olustur [--dogrudan]    "TEST ALICI" adina test gonderisi
//   npx tsx scripts/yurtici-test.ts sorgula <anahtar> [--dogrudan]
//   npx tsx scripts/yurtici-test.ts iptal <anahtar> [--dogrudan]
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fetch, ProxyAgent } from "undici";
import { cancelShipments, createShipments, queryShipments } from "../src/lib/yurtici/client";
import { toConnectionError } from "../src/lib/yurtici/soap";

const args = process.argv.slice(2);
const direct = args.includes("--dogrudan");
const live = args.includes("--canli");
const [command, key] = args.filter((a) => !a.startsWith("--"));

process.env.YURTICI_MODE = live ? "live" : "test";
if (direct) process.env.YURTICI_PROXY_URL = "";
const egress = process.env.YURTICI_PROXY_URL ? "proxy (Fixie)" : "doğrudan";

const TEST_URL = "https://testwebservices.yurticikargo.com/KOPSWebServices/ShippingOrderDispatcherServices";

async function getText(url: string): Promise<{ status: number; text: string }> {
  const proxy = process.env.YURTICI_PROXY_URL;
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      dispatcher: proxy ? new ProxyAgent(proxy) : undefined
    });
    return { status: res.status, text: await res.text() };
  } catch (error) {
    throw toConnectionError(error);
  }
}

// WSDL ve bagli XSD'leri scripts/output/yurtici-wsdl/ altina kaydeder (gizli bilgi icermez).
async function wsdl() {
  const out = join("scripts", "output", "yurtici-wsdl");
  mkdirSync(out, { recursive: true });
  const main = await getText(`${TEST_URL}?wsdl`);
  console.log(`WSDL: HTTP ${main.status}, ${main.text.length} karakter`);
  writeFileSync(join(out, "service.wsdl"), main.text);
  const imports = [...main.text.matchAll(/schemaLocation="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  for (const [i, url] of imports.entries()) {
    const xsd = await getText(url);
    console.log(`XSD ${i + 1}: HTTP ${xsd.status}, ${xsd.text.length} karakter (${url.replace(/^.*\?/, "?")})`);
    writeFileSync(join(out, `schema-${i + 1}.xsd`), xsd.text);
  }
  console.log(`Kaydedildi: ${out}`);
}

function testKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `BLMTEST${String(d.getFullYear()).slice(2)}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

async function main() {
  console.log(`Ortam: ${live ? "CANLI" : "TEST"}, çıkış: ${egress}`);
  if (command === "wsdl") return wsdl();
  if (command === "olustur") {
    const cargoKey = testKey();
    const r = await createShipments([
      {
        cargoKey,
        invoiceKey: cargoKey,
        receiverCustName: "TEST ALICI Bollmark",
        receiverAddress: "Runguçpaşa Mah. 75. Sk. No:6/A Test Gönderisi",
        cityName: "Bursa",
        townName: "Karacabey",
        receiverPhone1: "5321234567",
        emailAddress: "",
        cargoCount: 1,
        description: "Bollmark entegrasyon testi"
      }
    ]);
    console.log(JSON.stringify({ outFlag: r.outFlag, jobId: r.jobId, rows: r.rows }, null, 2));
    if (live) console.log(`UNUTMA: şubeye vermeden iptal et -> iptal ${cargoKey} --canli`);
    return;
  }
  if ((command === "sorgula" || command === "iptal") && key) {
    const r = command === "sorgula" ? await queryShipments([key]) : await cancelShipments([key]);
    console.log(JSON.stringify(r.rows, null, 2));
    return;
  }
  console.log("Kullanım: wsdl | olustur | sorgula <anahtar> | iptal <anahtar>  [--dogrudan] [--canli]");
}

main().catch((e) => {
  console.error("Hata:", e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
