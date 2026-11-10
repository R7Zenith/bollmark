import { STORE_INFO, phoneDisplay } from "@/lib/store-info";
import { code128Svg } from "@/lib/yurtici/code128";
import { normalizeYkPhone } from "@/lib/yurtici/map";

// Kargo etiketi (bkz. plan bolum 4.4). Yurtici API etiket vermiyor: pakete
// bu etiket yapistirilir, sube kargo anahtari barkodunu okutur.
// 10x7 (termal, yatay: 100 mm en x 70 mm boy) ya da A4'e 4'lu; olculer mm,
// saf siyah-beyaz.

export type LabelSize = "10x7" | "a4";

export type ShippingLabelData = {
  key: string;
  cargoKey: string;
  orderNumber: string;
  name: string;
  address: string;
  town: string;
  city: string;
  phone: string;
  koli: string;
};

export function labelPhoneText(raw: string) {
  const d = normalizeYkPhone(raw);
  return d ? `0${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}` : raw;
}

export const labelPrintCss = (size: LabelSize) => `
@page { size: ${size === "a4" ? "A4" : "100mm 70mm"}; margin: 0; }
.yk-label { box-sizing: border-box; background: #fff; color: #000; display: flex; flex-direction: column;
  overflow: hidden; font-variant-numeric: tabular-nums; }
.yk-10x7 .yk-label { width: 100mm; height: 70mm; padding: 3mm 4mm; }
.yk-a4 .yk-page { width: 210mm; height: 297mm; display: grid; grid-template-columns: 105mm 105mm;
  grid-template-rows: 148.5mm 148.5mm; background: #fff; }
.yk-a4 .yk-label { width: 105mm; height: 148.5mm; padding: 5mm; outline: 0.2mm dashed #999; outline-offset: -0.1mm; }
@media screen {
  .yk-sheet { display: flex; flex-direction: column; gap: 8mm; align-items: flex-start; }
  .yk-10x7 .yk-label, .yk-a4 .yk-page { box-shadow: 0 0 0 1px #e3e3e5, 0 6px 18px rgba(26,26,26,.08); }
}
@media print {
  /* Admin kabugu (kenar menu, ust bar) yer kaplamasin diye tamamen cikarilir;
     etiketin atalari ise sifirlanir. Boylece sayfa sayisi = etiket sayisi. */
  html, body { background: #fff !important; height: auto !important; min-height: 0 !important; }
  body *:not(:has(.yk-sheet)):not(.yk-sheet):not(.yk-sheet *) { display: none !important; }
  body *:has(.yk-sheet) { display: block !important; position: static !important; margin: 0 !important;
    padding: 0 !important; border: 0 !important; min-height: 0 !important; height: auto !important;
    width: auto !important; background: #fff !important; box-shadow: none !important; }
  .yk-sheet { display: block !important; margin: 0 !important; }
  .yk-10x7 .yk-label, .yk-a4 .yk-page { break-after: page; }
  .yk-10x7 .yk-label:last-child, .yk-a4 .yk-page:last-child { break-after: auto; }
}
`;

function Barcode({ cargoKey, className }: { cargoKey: string; className: string }) {
  // Sunucuda uretilen SVG; yalniz kargo anahtarindan (ASCII) olusur.
  return (
    <div
      className={`mx-auto max-w-full [&>svg]:h-full [&>svg]:w-full ${className}`}
      dangerouslySetInnerHTML={{ __html: code128Svg(cargoKey) }}
    />
  );
}

// Termal yatay etiket (100 x 70 mm): ust satir gonderici, orta alici, alt barkod.
function ThermalLabel({ label, test }: { label: ShippingLabelData; test: boolean }) {
  const a = STORE_INFO.address;
  return (
    <article className="yk-label">
      <header className="flex items-end justify-between gap-2 border-b-[0.6mm] border-black pb-[1mm]">
        <div className="min-w-0">
          <p className="text-[4.2mm] font-black leading-none tracking-tight">BOLLMARK</p>
          <p className="mt-[0.6mm] text-[2.1mm] leading-tight">
            Gönderici: {a.streetAddress}
            <br />
            {a.addressLocality} / {a.addressRegion}
            {STORE_INFO.phone ? `, ${phoneDisplay(STORE_INFO.phone)}` : ""}
          </p>
        </div>
        <div className="shrink-0 text-right leading-tight">
          {test && <p className="border-[0.3mm] border-black px-[1mm] text-[2.2mm] font-bold">TEST – gönderi değil</p>}
          <p className="text-[2.4mm] font-semibold">Yurtiçi Kargo</p>
        </div>
      </header>

      <section className="min-h-0 flex-1 pt-[1.2mm]">
        <p className="truncate text-[3.8mm] font-bold leading-tight">
          <span className="text-[2.2mm] font-normal">Alıcı </span>
          {label.name}
        </p>
        <p className="mt-[0.5mm] line-clamp-3 text-[2.7mm] leading-[1.25]">{label.address}</p>
        <div className="mt-[0.6mm] flex items-baseline justify-between gap-2">
          <p className="truncate text-[3.6mm] font-bold leading-tight">
            {label.town.toLocaleUpperCase("tr-TR")} / {label.city.toLocaleUpperCase("tr-TR")}
          </p>
          <p className="shrink-0 text-[2.8mm]">Tel: {label.phone}</p>
        </div>
      </section>

      <footer className="border-t-[0.3mm] border-black pt-[1mm]">
        <div className="flex items-baseline justify-between text-[2.5mm] leading-none">
          <span>Sipariş {label.orderNumber}</span>
          <span className="text-[3.2mm] font-bold">Koli {label.koli}</span>
        </div>
        <Barcode cargoKey={label.cargoKey} className="mt-[0.8mm] h-[15mm] w-[86mm]" />
        <p className="mt-[0.6mm] text-center text-[3.8mm] font-bold leading-none tracking-[0.06em]">{label.cargoKey}</p>
      </footer>
    </article>
  );
}

export function ShippingLabel({ label, test, size }: { label: ShippingLabelData; test: boolean; size: LabelSize }) {
  if (size === "10x7") return <ThermalLabel label={label} test={test} />;
  const address = STORE_INFO.address;
  return (
    <article className="yk-label">
      <header className="flex items-start justify-between gap-3 border-b-[0.8mm] border-black pb-[2.5mm]">
        <div>
          <p className="text-[6mm] font-black leading-none tracking-tight">BOLLMARK</p>
          <p className="mt-[1.2mm] text-[2.6mm] leading-snug">
            Gönderici: {address.streetAddress}
            <br />
            {address.addressLocality} / {address.addressRegion}
            {STORE_INFO.phone && (
              <>
                <br />
                {phoneDisplay(STORE_INFO.phone)}
              </>
            )}
          </p>
        </div>
        <p className="shrink-0 text-right text-[3mm] font-semibold leading-tight">Yurtiçi Kargo</p>
      </header>

      <section className="flex-1 pt-[3mm]">
        <p className="text-[2.8mm]">Alıcı</p>
        <p className="mt-[0.5mm] text-[5.4mm] font-bold leading-tight">{label.name}</p>
        <p className="mt-[1.5mm] text-[3.5mm] leading-snug">{label.address}</p>
        <p className="mt-[1.5mm] text-[5mm] font-bold leading-tight">
          {label.town.toLocaleUpperCase("tr-TR")} / {label.city.toLocaleUpperCase("tr-TR")}
        </p>
        <p className="mt-[1mm] text-[3.6mm]">Tel: {label.phone}</p>
      </section>

      <div className="flex items-end justify-between border-t-[0.3mm] border-black pt-[2mm] text-[3.2mm]">
        <span>Sipariş {label.orderNumber}</span>
        <span className="text-[4.2mm] font-bold">Koli {label.koli}</span>
      </div>

      <footer className="pt-[2.5mm] text-center">
        <Barcode cargoKey={label.cargoKey} className="h-[22mm] w-[88mm]" />
        <p className="mt-[1.2mm] text-[5.6mm] font-bold leading-none tracking-[0.06em]">{label.cargoKey}</p>
        {test && (
          <p className="mt-[2mm] border-[0.4mm] border-black py-[0.8mm] text-[3mm] font-bold">TEST – gerçek gönderi değil</p>
        )}
      </footer>
    </article>
  );
}
