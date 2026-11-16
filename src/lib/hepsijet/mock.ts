import { HepsijetError } from "./client";
import type { HjDeliveryPayload } from "./map";

// HEPSIJET_MODE=mock: hicbir dis istek atilmaz. Yanitlar shipments.ts'in
// gercek servisten bekledigi JSON bicimiyle uretilir ve ayni ayristiricidan gecer.
//
// Davranis:
// - Olusturma basarili; ayni no zaten varsa (silinmemisse) FAIL.
// - Her takip sorgusu gonderiyi bir adim ilerletir: (hareket yok) -> ACCEPTED -> DELIVERING -> DELIVERED.
// - Silme yalniz hareket yokken; zaten silinmisse ya da toplanmissa FAIL.
// Durum sunucu bellegindedir; sunucu yeniden baslarsa bilinmeyen no "hareket yok"tan baslar.

const STEPS = [null, "ACCEPTED", "DELIVERING", "DELIVERED"] as const;

type MockDelivery = { step: number; deleted: boolean };
const g = globalThis as unknown as { __hepsijetMock?: Map<string, MockDelivery> };
const store = (g.__hepsijetMock ??= new Map());

export function resetHepsijetMock() {
  store.clear();
}

export function mockSendDelivery(payload: HjDeliveryPayload): unknown {
  const no = payload.delivery.customerDeliveryNo;
  const existing = store.get(no);
  if (existing && !existing.deleted) throw new HepsijetError(`HepsiJET: ${no} numaralı gönderi zaten mevcut.`, 400);
  store.set(no, { step: 0, deleted: false });
  return { status: "OK" };
}

export function mockTrack(nos: string[], now = new Date()): unknown {
  return {
    status: "OK",
    data: nos.map((no) => {
      let d = store.get(no);
      if (!d) {
        d = { step: 0, deleted: false };
        store.set(no, d);
      } else if (!d.deleted && d.step < STEPS.length - 1) {
        d.step++;
      }
      const status = d.deleted ? "DELETED" : STEPS[d.step];
      return {
        customerDeliveryNo: no,
        transactions: status ? [{ deliveryStatus: status, statusDescription: status, transactionDate: now.toISOString() }] : []
      };
    })
  };
}

export function mockDelete(no: string): unknown {
  const d = store.get(no);
  if (!d) throw new HepsijetError("HepsiJET: Gönderi bulunamadı.", 400);
  if (d.deleted) throw new HepsijetError("HepsiJET: Bu gönderi sistemimizde zaten silinmiş durumda", 400);
  if (d.step > 0) throw new HepsijetError("HepsiJET: Gönderi statüsü uygun değildir", 400);
  d.deleted = true;
  return { status: "OK", message: "Gönderi başarıyla silindi" };
}

// Gecerli, tek sayfalik (10x8 cm) bir PDF; icinde gonderi numaralari yazar.
export function mockLabelPdf(nos: string[]): Uint8Array {
  const text = nos.map((n, i) => `BT /F1 14 Tf 20 ${180 - i * 20} Td (MOCK HEPSIJET ${n.replace(/[()\\]/g, "")}) Tj ET`).join("\n");
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 283 227] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${text.length} >>\nstream\n${text}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((body, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${body}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(pdf);
}
