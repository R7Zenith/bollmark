import { formatDate } from "@/lib/format";
import type { OrderAddress } from "./data";

export function OrderAddressesList({ addresses, emptyText }: { addresses: OrderAddress[]; emptyText: string }) {
  if (addresses.length === 0) return <p className="text-sm text-admin-text-muted">{emptyText}</p>;
  return (
    <ul className="divide-y divide-admin-border text-sm">
      {addresses.map((a) => (
        <li key={a.key} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <p className="break-words text-admin-text">
            {a.address}, {a.district} / {a.city} {a.postalCode}
          </p>
          <p className="shrink-0 text-xs text-admin-text-muted">
            {a.orderCount} sipariş · son {formatDate(a.lastUsedAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
