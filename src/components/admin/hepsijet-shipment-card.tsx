import { Printer } from "lucide-react";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { formatDate, formatTime } from "@/lib/format";
import type { HepsijetCompanyInfo, HepsijetMode } from "@/lib/hepsijet/config";
import {
  buildHjPayload,
  hjSendBlockReason,
  isHepsijetActive,
  nextDeliveryNo,
  type HjOrder,
  type HjOrderItem,
  type ShipmentHjState
} from "@/lib/hepsijet/map";

type Shipment = ShipmentHjState & {
  id: string;
  trackingUrl: string | null;
  hjStatus: string | null;
  hjStatusMessage: string | null;
  hjLastSyncAt: Date | null;
  hjLastError: string | null;
};

type Order = HjOrder & { status: string; deletedAt: Date | null };

// Dokumanda gecen kodlar; digerleri ham haliyle gosterilir.
const statusLabel: Record<string, string> = {
  ACCEPTED: "Kurye teslim aldı",
  DELIVERING: "Dağıtımda",
  DELIVERED: "Teslim edildi",
  UNDELIVERED: "Teslim edilemedi / iade sürecinde"
};

function when(date: Date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

const secondaryButton =
  "inline-flex items-center gap-2 rounded-md border border-admin-border px-3 py-1.5 text-xs font-medium text-admin-text transition-colors hover:bg-admin-bg";

export function HepsijetShipmentCard({
  order,
  items,
  shipment,
  mode,
  company,
  companyError,
  sendAction,
  syncAction,
  cancelAction,
  manualForm
}: {
  order: Order;
  items: HjOrderItem[];
  shipment: Shipment;
  mode: Exclude<HepsijetMode, "off">;
  company: HepsijetCompanyInfo | null;
  companyError: string | null;
  sendAction: () => void;
  syncAction: () => void;
  cancelAction: () => void;
  manualForm: React.ReactNode;
}) {
  const active = isHepsijetActive(shipment);
  const blocked = active ? null : (companyError ?? hjSendBlockReason(order, shipment, mode));
  const deliveryNo = !active && !blocked && company ? nextDeliveryNo(company.deliveryPrefix, order.orderNumber, shipment) : null;
  const preview = deliveryNo && company ? buildHjPayload(order, items, company, { deliveryNo }) : null;

  return (
    <div className="space-y-4">
      {mode !== "live" && (
        <div className="-mx-5 -mt-5 border-b border-amber-300 bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-900">
          TEST MODU – gerçek gönderi oluşmaz
          <span className="block text-xs font-normal">
            {mode === "mock" ? "Mock: HepsiJET'e istek atılmaz, cevaplar sahte." : "HepsiJET test ortamı."} Yalnız
            alıcı adı &quot;TEST ALICI&quot; ile başlayan siparişler.
          </span>
        </div>
      )}

      {shipment.hjLastError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{shipment.hjLastError}</p>
      )}

      {active ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-admin-text-muted">Gönderi no</dt>
            <dd className="font-medium tabular-nums text-admin-text">{shipment.cargoKey}</dd>
            <dt className="text-admin-text-muted">HepsiJET durumu</dt>
            <dd className="text-admin-text">
              {shipment.hjStatus ? (statusLabel[shipment.hjStatus] ?? shipment.hjStatus) : "Kurye henüz teslim almadı"}
              {shipment.hjStatusMessage && shipment.hjStatusMessage !== shipment.hjStatus && (
                <span className="block text-xs text-admin-text-muted">{shipment.hjStatusMessage}</span>
              )}
            </dd>
            <dt className="text-admin-text-muted">Gönderildi</dt>
            <dd className="text-admin-text">{shipment.hjSentAt ? when(shipment.hjSentAt) : "-"}</dd>
            <dt className="text-admin-text-muted">Son sorgu</dt>
            <dd className="text-admin-text">{shipment.hjLastSyncAt ? when(shipment.hjLastSyncAt) : "Henüz sorgulanmadı"}</dd>
          </dl>
          {shipment.trackingUrl && mode === "live" && (
            <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-admin-accent hover:underline">
              HepsiJET takip sayfasını aç
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            <a
              href={`/admin/kargolar/hepsijet-etiket/${shipment.id}`}
              target="_blank"
              rel="noopener"
              className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Printer size={14} aria-hidden /> Etiket yazdır
            </a>
            <form action={syncAction}>
              <button type="submit" className={secondaryButton}>
                Durumu yenile
              </button>
            </form>
            {!shipment.hjStatus && (
              <form action={cancelAction}>
                <ConfirmSubmitButton
                  confirmMessage={`${shipment.cargoKey} HepsiJET'te iptal edilsin mi? Kurye teslim almadan önce iptal olur; sonra yeniden gönderebilirsiniz.`}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  İptal et
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        </>
      ) : blocked ? (
        <p className="text-sm text-admin-text-muted">{blocked}</p>
      ) : preview && !preview.ok ? (
        <div className="text-sm">
          <p className="font-medium text-red-700">HepsiJET&apos;e gönderilemez, önce düzeltin:</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-red-700">
            {preview.errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : preview?.ok ? (
        <form action={sendAction} className="space-y-3">
          <dl className="space-y-0.5 rounded-md bg-admin-bg px-3 py-2 text-sm">
            <dt className="sr-only">Alıcı</dt>
            <dd className="font-medium text-admin-text">{preview.payload.delivery.recipientPerson}</dd>
            <dd className="text-admin-text-muted">{preview.payload.delivery.recipientAddress.addressLine1}</dd>
            <dd className="text-admin-text-muted">
              {preview.payload.delivery.recipientAddress.town.name} / {preview.payload.delivery.recipientAddress.city.name}
            </dd>
            <dd className="tabular-nums text-admin-text-muted">{preview.payload.delivery.receiver.phone1}</dd>
            <dd className="pt-1 text-xs text-admin-text-muted">
              Gönderi no <span className="tabular-nums">{deliveryNo}</span> · {preview.payload.deliveryContent.length} kalem · 1 koli
            </dd>
          </dl>
          {preview.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700">
              {w}
            </p>
          ))}
          <Button type="submit" size="sm" className="w-full justify-center">
            HepsiJET&apos;e gönder
          </Button>
        </form>
      ) : null}

      <details className="border-t border-admin-border pt-3">
        <summary className="cursor-pointer text-sm font-medium text-admin-text">Elle düzenle</summary>
        <div className="mt-3">{manualForm}</div>
      </details>
    </div>
  );
}
