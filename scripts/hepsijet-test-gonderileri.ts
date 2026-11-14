// HepsiJET Faz 5: test ortaminda STD test gonderileri (bkz.
// docs/planlar/HEPSIJET_ENTEGRASYON_PLANI.md bolum 5). DB'ye YAZMAZ: 3 "TEST
// ALICI" siparisi bellekte kurulur, payload uygulamanin kendi map.ts'iyle uretilir.
//
// Adimlar: 3 gonderi olustur -> her birinin etiket PDF'i -> toplu takip ->
// 3. gonderiyi iptal et -> tekrar takip. Dokumanda olmayan noktalar (takip yolu,
// silme metodu) burada denenir ve rapora yazilir.
//
// Guvenlik: yalniz HEPSIJET_MODE=test (ya da kuru deneme icin mock). Giris
// hatasinda (401/423) hemen durur; hesap tekrar kilitlenmesin. Kimlik
// bilgileri ve token hicbir ciktiya yazilmaz; gonderici adres ID'si maskelenir.
//
// Calistir: npx tsx scripts/hepsijet-test-gonderileri.ts [--cikti <klasor>]
import fs from "node:fs";
import path from "node:path";
import { getHepsijetCompanyInfo, getHepsijetMode } from "../src/lib/hepsijet/config";
import { HepsijetError, hjRequest } from "../src/lib/hepsijet/client";
import { buildHjPayload, type HjDeliveryPayload } from "../src/lib/hepsijet/map";
import { deletePath, getLabelPdf, parseTracking, sendDelivery, TRACK_PATH, DELETE_METHOD } from "../src/lib/hepsijet/shipments";
import { mockDelete, mockTrack } from "../src/lib/hepsijet/mock";
import { istanbulDateKey } from "../src/lib/format";

try {
  process.loadEnvFile();
} catch {}

const argIndex = process.argv.indexOf("--cikti");
const OUT = argIndex > 0 ? process.argv[argIndex + 1] : path.join("Claude outputs", "hepsijet-test");

// Dokumanda yok; sirayla denenir, ilk 404 olmayan kabul edilir.
const TRACK_CANDIDATES = [TRACK_PATH, "/delivery/getDeliveryTracking", "/deliveryTransaction/getDeliveryTracking", "/integration/getDeliveryTracking"].filter(
  (p, i, a) => a.indexOf(p) === i
);
const DELETE_METHODS: ("POST" | "DELETE")[] = DELETE_METHOD === "POST" ? ["POST", "DELETE"] : ["DELETE", "POST"];

const TEST_ORDERS = [
  { suffix: "1", name: "TEST ALICI Bir", phone: "05320000001", city: "Bursa", district: "Karacabey", address: "Runguşpaşa Mah. Test Sk. No:1 D:1" },
  { suffix: "2", name: "TEST ALICI İki", phone: "05320000002", city: "İstanbul", district: "Kadıköy", address: "Caferağa Mah. Test Cad. No:2 D:3" },
  { suffix: "3", name: "TEST ALICI Üç", phone: "05320000003", city: "Ankara", district: "Çankaya", address: "Kızılay Mah. Test Sk. No:3 D:5" }
];

type Step = { adim: string; no?: string; ok: boolean; sonuc: unknown };
const log: Step[] = [];

function record(step: Step) {
  log.push(step);
  console.log(`${step.ok ? "OK  " : "HATA"} ${step.adim}${step.no ? ` ${step.no}` : ""}: ${typeof step.sonuc === "string" ? step.sonuc : JSON.stringify(step.sonuc).slice(0, 300)}`);
}

function isAuthError(error: unknown) {
  return error instanceof HepsijetError && (error.httpStatus === 423 || /kullanıcı adı veya şifresi|askıya/i.test(error.message));
}

function errInfo(error: unknown) {
  return error instanceof HepsijetError ? { http: error.httpStatus, mesaj: error.message } : { mesaj: String(error) };
}

function masked(payload: HjDeliveryPayload) {
  return { ...payload, delivery: { ...payload.delivery, senderAddress: { ...payload.delivery.senderAddress, companyAddressId: "***" } } };
}

async function track(nos: string[], mode: string): Promise<{ path: string | null; body: unknown }> {
  if (mode === "mock") return { path: TRACK_PATH, body: mockTrack(nos) };
  for (const p of TRACK_CANDIDATES) {
    try {
      const res = await hjRequest({ method: "POST", path: p, body: { deliveries: nos.map((customerDeliveryNo) => ({ customerDeliveryNo })) } });
      return { path: p, body: res.body };
    } catch (error) {
      if (isAuthError(error)) throw error;
      record({ adim: `takip yolu dene ${p}`, ok: false, sonuc: errInfo(error) });
      if (!(error instanceof HepsijetError && (error.httpStatus === 404 || error.httpStatus === 405))) return { path: p, body: errInfo(error) };
    }
  }
  return { path: null, body: null };
}

async function remove(no: string, mode: string): Promise<{ method: string | null; body: unknown }> {
  if (mode === "mock") return { method: DELETE_METHOD, body: mockDelete(no) };
  for (const method of DELETE_METHODS) {
    try {
      const res = await hjRequest({ method, path: deletePath(no), body: { deleteReason: "IPTAL" } });
      return { method, body: res.body };
    } catch (error) {
      if (isAuthError(error)) throw error;
      record({ adim: `silme metodu dene ${method}`, no, ok: false, sonuc: errInfo(error) });
      if (!(error instanceof HepsijetError && (error.httpStatus === 404 || error.httpStatus === 405))) return { method, body: errInfo(error) };
    }
  }
  return { method: null, body: null };
}

async function main() {
  const mode = getHepsijetMode();
  if (mode !== "test" && mode !== "mock") throw new Error(`Bu betik yalnız HEPSIJET_MODE=test (ya da mock) ile çalışır; şu an: ${mode}.`);
  const company = getHepsijetCompanyInfo();
  fs.mkdirSync(OUT, { recursive: true });

  // Benzersiz no: BLM + yymmdd + -T + HHmm + sira (en fazla 19 karakter).
  const stamp = istanbulDateKey(new Date()).slice(2).replace(/-/g, "");
  const hhmm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()).replace(":", "");
  const created: string[] = [];

  for (const t of TEST_ORDERS) {
    const no = `${company.deliveryPrefix}${stamp}-T${hhmm}${t.suffix}`;
    const built = buildHjPayload(
      { orderNumber: no, customerName: t.name, customerPhone: t.phone, customerEmail: "", shippingAddress: t.address, city: t.city, district: t.district },
      [{ sku: `TEST-SKU-${t.suffix}`, name: "Test Ürünü", variantLabel: "Siyah / M", quantity: 1 }],
      company,
      { deliveryNo: no }
    );
    if (!built.ok) throw new Error(`Payload kurulamadı: ${built.errors.join(" ")}`);
    fs.writeFileSync(path.join(OUT, `${no}-istek.json`), JSON.stringify(masked(built.payload), null, 2));
    try {
      const res = await sendDelivery(built.payload);
      record({ adim: "gönderi oluştur", no, ok: true, sonuc: res.body });
      created.push(no);
    } catch (error) {
      record({ adim: "gönderi oluştur", no, ok: false, sonuc: errInfo(error) });
      if (isAuthError(error)) throw new Error("Giriş hatası; hesap tekrar kilitlenmesin diye durduruldu.");
    }
  }
  if (created.length === 0) return;

  for (const no of created) {
    try {
      const { pdf } = await getLabelPdf([no]);
      const file = path.join(OUT, `${no}-etiket.pdf`);
      fs.writeFileSync(file, pdf);
      record({ adim: "etiket PDF", no, ok: true, sonuc: `${pdf.length} bayt -> ${file}` });
    } catch (error) {
      record({ adim: "etiket PDF", no, ok: false, sonuc: errInfo(error) });
    }
  }

  const t1 = await track(created, mode);
  record({ adim: `takip (${t1.path ?? "yol bulunamadı"})`, ok: t1.path !== null, sonuc: t1.body });
  if (t1.path) record({ adim: "takip ayrıştırma", ok: true, sonuc: parseTracking(t1.body, created) });

  const toCancel = created[created.length - 1];
  try {
    const d = await remove(toCancel, mode);
    record({ adim: `iptal (${d.method ?? "metot bulunamadı"})`, no: toCancel, ok: d.method !== null, sonuc: d.body });
  } catch (error) {
    if (isAuthError(error)) throw error;
    record({ adim: "iptal", no: toCancel, ok: false, sonuc: errInfo(error) });
  }

  const t2 = await track(created, mode);
  record({ adim: "iptal sonrası takip", ok: t2.path !== null, sonuc: t2.body });
}

main()
  .catch((error) => record({ adim: "durdu", ok: false, sonuc: error instanceof Error ? error.message : String(error) }))
  .finally(() => {
    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(path.join(OUT, "rapor.json"), JSON.stringify({ tarih: new Date().toISOString(), mod: getHepsijetMode(), adimlar: log }, null, 2));
    console.log(`Rapor: ${path.join(OUT, "rapor.json")}`);
  });
