import Link from "next/link";
import { Printer } from "lucide-react";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { YurticiSyncButton } from "@/components/admin/yurtici-sync-button";
import { formatDate, formatTime } from "@/lib/format";
import { formatTrMobile } from "@/lib/phone";
import type { YurticiEgress, YurticiMode } from "@/lib/yurtici/config";
import {
  buildShippingOrder,
  isYurticiActive,
  nextCargoKey,
  sendBlockReason,
  syncLockRemainingMs,
  ykOperationStatusLabel,
  type OrderForShipping,
  type ShipmentYkState
} from "@/lib/yurtici/map";

type Shipment = ShipmentYkState & {
  id: string;
  cargoKey: string | null;
  ykDocId: string | null;
  ykOperationStatus: string | null;
  ykOperationMessage: string | null;
  trackingUrl: string | null;
  cargoCount: number;
  ykLastSyncAt: Date | null;
  ykLastError: string | null;
};

type Order = OrderForShipping & { status: string; deletedAt: Date | null };

const labelClass = "text-xs font-medium uppercase tracking-wide text-admin-text-muted";
const inputClass =
  "w-20 rounded-md border border-admin-border px-2 py-1.5 text-sm tabular-nums focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

function when(date: Date) {
  return `${formatDate(date)} ${formatTime(date)}`;
}

// ykLastError "[kod] mesaj" bicimindedir; admin'e yalniz mesaj gosterilir.
function errorText(value: string) {
  return value.replace(/^\[\d+\]\s*/, "");
}

export function YurticiShipmentCard({
  order,
  shipment,
  mode,
  egress,
  sendAction,
  syncAction,
  cancelAction,
  manualForm
}: {
  order: Order;
  shipment: Shipment;
  mode: YurticiMode;
  egress: YurticiEgress;
  sendAction: (formData: FormData) => void;
  syncAction: () => void;
  cancelAction: () => void;
  manualForm: React.ReactNode;
}) {
  const active = isYurticiActive(shipment);
  const blocked = active ? null : sendBlockReason(order, shipment, mode);
  const preview = active || blocked ? null : buildShippingOrder(order, { cargoKey: nextCargoKey(order.orderNumber, shipment) });
  const statusLabel = shipment.ykOperationStatus
    ? (ykOperationStatusLabel[shipment.ykOperationStatus] ?? shipment.ykOperationStatus)
    : "-";

  return (
    <div className="space-y-4">
      {mode !== "live" && (
        <div className="-mx-5 -mt-5 border-b border-amber-300 bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-900">
          TEST MODU – gerçek gönderi oluşmaz
          <span className="block text-xs font-normal">
            {mode === "mock" ? "Mock: Yurtiçi'ye istek atılmaz, cevaplar sahte." : "Yurtiçi test ortamı (ortak test kullanıcısı)."}
          </span>
        </div>
      )}

      {shipment.ykLastError && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{errorText(shipment.ykLastError)}</p>
      )}

      {active ? (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-sm">
            <dt className="text-admin-text-muted">Kargo anahtarı</dt>
            <dd className="font-medium tabular-nums text-admin-text">{shipment.cargoKey}</dd>
            <dt className="text-admin-text-muted">Yurtiçi durumu</dt>
            <dd className="text-admin-text">{statusLabel}</dd>
            <dt className="text-admin-text-muted">Gönderi no</dt>
            <dd className="tabular-nums text-admin-text">{shipment.ykDocId ?? "Şube işleyince gelir"}</dd>
            <dt className="text-admin-text-muted">Koli</dt>
            <dd className="tabular-nums text-admin-text">{shipment.cargoCount}</dd>
            <dt className="text-admin-text-muted">Gönderildi</dt>
            <dd className="text-admin-text">{shipment.ykSentAt ? when(shipment.ykSentAt) : "-"}</dd>
            <dt className="text-admin-text-muted">Son sorgu</dt>
            <dd className="text-admin-text">{shipment.ykLastSyncAt ? when(shipment.ykLastSyncAt) : "Henüz sorgulanmadı"}</dd>
          </dl>
          {shipment.trackingUrl && (
            <a href={shipment.trackingUrl} target="_blank" rel="noopener noreferrer" className="block text-sm text-admin-accent hover:underline">
              Yurtiçi takip sayfasını aç
            </a>
          )}
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/admin/kargolar/etiket?ids=${shipment.id}`}
              target="_blank"
              className="inline-flex items-center gap-2 rounded-md bg-admin-accent px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-indigo-700"
            >
              <Printer size={14} aria-hidden /> Etiketi yazdır
            </Link>
            <form action={syncAction}>
              <YurticiSyncButton remainingMs={syncLockRemainingMs(shipment.ykLastSyncAt)} />
            </form>
            {shipment.ykOperationStatus === "NOP" && (
              <form action={cancelAction}>
                <ConfirmSubmitButton
                  confirmMessage={`${shipment.cargoKey} Yurtiçi'de iptal edilsin mi? Şube işleme almadan önce iptal olur; sonra yeniden gönderebilirsiniz.`}
                  className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-50"
                >
                  Gönderiyi iptal et
                </ConfirmSubmitButton>
              </form>
            )}
          </div>
        </>
      ) : blocked ? (
        <p className="text-sm text-admin-text-muted">{blocked}</p>
      ) : preview && !preview.ok ? (
        <div className="text-sm">
          <p className="font-medium text-red-700">Yurtiçi&apos;ye gönderilemez, önce düzeltin:</p>
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
            <dd className="font-medium text-admin-text">{preview.vo.receiverCustName}</dd>
            <dd className="text-admin-text-muted">{preview.vo.receiverAddress}</dd>
            <dd className="text-admin-text-muted">
              {preview.vo.townName} / {preview.vo.cityName}
            </dd>
            <dd className="tabular-nums text-admin-text-muted">{formatTrMobile(preview.vo.receiverPhone1)}</dd>
            <dd className="pt-1 text-xs text-admin-text-muted">
              Kargo anahtarı <span className="tabular-nums">{preview.vo.cargoKey}</span>
            </dd>
          </dl>
          {preview.warnings.map((w) => (
            <p key={w} className="text-xs text-amber-700">
              {w}
            </p>
          ))}
          <div className="flex items-end gap-3">
            <label className="block">
              <span className={labelClass}>Koli adedi</span>
              <input name="cargoCount" type="number" min={1} max={99} defaultValue={1} required className={`mt-1 block ${inputClass}`} />
            </label>
            <Button type="submit" size="sm" className="flex-1 justify-center">
              Yurtiçi&apos;ye gönder
            </Button>
          </div>
        </form>
      ) : null}

      <p className="text-xs text-admin-text-muted">
        Çıkış: {egress === "proxy" ? "proxy" : "doğrudan"}
        {mode === "mock" && " (mock modda istek atılmaz)"}
      </p>

      <details className="border-t border-admin-border pt-3">
        <summary className="cursor-pointer text-sm font-medium text-admin-text">Elle düzenle</summary>
        <div className="mt-3">{manualForm}</div>
      </details>
    </div>
  );
}
