import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PrintButton } from "@/components/admin/print-button";
import {
  ShippingLabel,
  labelPhoneText,
  labelPrintCss,
  type LabelSize,
  type ShippingLabelData
} from "@/components/admin/shipping-label";
import { getYurticiMode, isYurticiTestMode } from "@/lib/yurtici/config";
import { buildShippingOrder, isYurticiActive } from "@/lib/yurtici/map";

// /admin/kargolar/etiket?ids=...&boyut=10x7|a4 (varsayilan 10x7 termal, yatay).

export default async function ShippingLabelsPage({
  searchParams
}: {
  searchParams: Promise<{ ids?: string; boyut?: string }>;
}) {
  const { ids = "", boyut } = await searchParams;
  const size: LabelSize = boyut === "a4" ? "a4" : "10x7";
  const idList = ids.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 200);
  const shipments = idList.length
    ? await prisma.shipment.findMany({ where: { id: { in: idList } }, include: { order: true } })
    : [];
  const ordered = idList.flatMap((id) => shipments.filter((s) => s.id === id));

  const labels: ShippingLabelData[] = [];
  const skipped: string[] = [];
  for (const s of ordered) {
    if (!s.cargoKey || !isYurticiActive(s)) {
      skipped.push(s.order.orderNumber);
      continue;
    }
    const built = buildShippingOrder(s.order, { cargoKey: s.cargoKey });
    const vo = built.ok ? built.vo : null;
    for (let n = 1; n <= s.cargoCount; n++) {
      labels.push({
        key: `${s.id}-${n}`,
        cargoKey: s.cargoKey,
        orderNumber: s.order.orderNumber,
        name: vo?.receiverCustName ?? s.order.customerName,
        address: vo?.receiverAddress ?? s.order.shippingAddress,
        town: vo?.townName ?? s.order.district,
        city: vo?.cityName ?? s.order.city,
        phone: labelPhoneText(s.order.customerPhone),
        koli: `${n}/${s.cargoCount}`
      });
    }
  }

  const test = isYurticiTestMode(getYurticiMode());
  const pages = size === "a4" ? Array.from({ length: Math.ceil(labels.length / 4) }, (_, i) => labels.slice(i * 4, i * 4 + 4)) : [];
  const sizeHref = (s: LabelSize) => `/admin/kargolar/etiket?boyut=${s}&ids=${idList.join(",")}`;
  const segment = (s: LabelSize, text: string) => (
    <Link
      href={sizeHref(s)}
      aria-current={size === s ? "page" : undefined}
      className={`px-3 py-1.5 text-xs font-medium transition-colors ${
        size === s ? "bg-admin-accent text-white" : "bg-admin-surface text-admin-text hover:bg-admin-bg"
      }`}
    >
      {text}
    </Link>
  );

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: labelPrintCss(size) }} />

      <div className="yk-noprint mb-6 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-admin-text">Kargo etiketleri</h1>
            <p className="text-sm text-admin-text-muted">
              {labels.length} etiket{size === "a4" && labels.length > 0 ? `, ${pages.length} A4 sayfa` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="inline-flex overflow-hidden rounded-md border border-admin-border" role="group" aria-label="Etiket boyutu">
              {segment("10x7", "10×7 cm termal (yatay)")}
              {segment("a4", "A4, 4'lü")}
            </div>
            {labels.length > 0 && <PrintButton label="Yazdır" />}
          </div>
        </div>
        {test && (
          <p className="rounded-md border border-amber-300 bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-900">
            TEST MODU – gerçek gönderi oluşmaz. Bu etiketleri pakete yapıştırmayın.
          </p>
        )}
        {skipped.length > 0 && (
          <p className="rounded-md border border-admin-border bg-admin-surface px-4 py-2 text-sm text-admin-text-muted">
            Yurtiçi&apos;ye gönderilmediği için etiketi çıkmayanlar: {skipped.join(", ")}
          </p>
        )}
        {labels.length === 0 && (
          <p className="text-sm text-admin-text-muted">
            Yazdırılacak etiket yok. Önce siparişi Yurtiçi&apos;ye gönderin, sonra{" "}
            <Link href="/admin/kargolar" className="text-admin-accent hover:underline">
              Kargolar
            </Link>{" "}
            sayfasından seçip etiket yazdırın.
          </p>
        )}
      </div>

      {labels.length > 0 && (
        <div className={`yk-sheet ${size === "a4" ? "yk-a4" : "yk-10x7"}`}>
          {size === "a4"
            ? pages.map((page, i) => (
                <div key={i} className="yk-page">
                  {page.map((l) => (
                    <ShippingLabel key={l.key} label={l} test={test} size={size} />
                  ))}
                </div>
              ))
            : labels.map((l) => <ShippingLabel key={l.key} label={l} test={test} size={size} />)}
        </div>
      )}
    </div>
  );
}
