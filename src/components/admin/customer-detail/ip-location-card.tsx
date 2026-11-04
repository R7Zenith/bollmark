import { Card } from "@/components/admin/card";
import { formatDate, formatDateTime } from "@/lib/format";
import type { IpEvent, IpEventType } from "./data";

const RECENT_LIMIT = 20;
const TYPE_LABEL: Record<IpEventType, string> = { ORDER: "Sipariş", LOGIN: "Giriş", SIGNUP: "Kayıt" };

function location(e: Pick<IpEvent, "city" | "region" | "country">) {
  const parts = [e.city, e.region, e.country].filter(Boolean);
  return parts.length ? parts.join(", ") : <span className="text-admin-text-muted">Konum bilgisi yok</span>;
}

function Latest({ label, event }: { label: string; event: IpEvent | undefined }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-admin-text-muted">{label}</dt>
      {event ? (
        <dd className="mt-1 space-y-0.5 text-admin-text">
          <p className="break-all font-mono text-xs">{event.ip}</p>
          <p>{location(event)}</p>
          <p className="text-xs text-admin-text-muted">{formatDateTime(event.at)}</p>
        </dd>
      ) : (
        <dd className="mt-1 text-admin-text-muted">Kayıt yok</dd>
      )}
    </div>
  );
}

// events: tarihe gore azalan. Ayni tur + IP tek satirda, sayisiyla.
export function IpLocationCard({
  events,
  withDevices,
  trackingStart
}: {
  events: IpEvent[];
  withDevices: boolean;
  trackingStart: Date | null;
}) {
  if (events.length === 0) {
    return (
      <Card title="IP ve konum">
        <p className="text-sm text-admin-text-muted">
          Bu müşteri için IP kaydı yok.{" "}
          {trackingStart ? `IP kaydı ${formatDate(trackingStart)} itibarıyla tutuluyor.` : "IP kaydı henüz başlamadı."}
        </p>
      </Card>
    );
  }

  const groups = new Map<string, IpEvent & { count: number }>();
  for (const e of events) {
    const key = `${e.type}|${e.ip}`;
    const existing = groups.get(key);
    if (existing) existing.count += 1;
    else groups.set(key, { ...e, count: 1 });
  }
  const recent = [...groups.values()].slice(0, RECENT_LIMIT);

  return (
    <Card title="IP ve konum">
      <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-2">
        <Latest label="Son sipariş" event={events.find((e) => e.type === "ORDER")} />
        {withDevices && <Latest label="Son giriş / kayıt" event={events.find((e) => e.type !== "ORDER")} />}
      </dl>
      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-admin-text-muted">
            <tr>
              <th className="py-2 pr-4">Tür</th>
              <th className="py-2 pr-4">IP</th>
              <th className="py-2 pr-4">Konum</th>
              <th className="py-2">Son tarih</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={`${e.type}|${e.ip}`} className="border-t border-admin-border text-admin-text">
                <td className="whitespace-nowrap py-3 pr-4">
                  {TYPE_LABEL[e.type]}
                  {e.count > 1 && <span className="ml-1 text-xs text-admin-text-muted">×{e.count}</span>}
                </td>
                <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs">{e.ip}</td>
                <td className="py-3 pr-4">{location(e)}</td>
                <td className="whitespace-nowrap py-3">{formatDateTime(e.at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-admin-text-muted">Giriş/kayıt IP&apos;leri 90 gün, sipariş IP&apos;leri 2 yıl saklanır.</p>
    </Card>
  );
}
