"use client";

import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatPrice } from "@/lib/format";

export interface DailyOrdersPoint {
  date: string;
  orders: number;
  revenueCents: number;
}

function CustomTooltip({
  active,
  payload,
  label
}: {
  active?: boolean;
  payload?: { payload: DailyOrdersPoint }[];
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  const date = new Date(label ?? point.date).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  return (
    <div className="rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-admin-text">{date}</p>
      <p className="mt-1 text-admin-text-muted">Sipariş: {point.orders}</p>
      <p className="text-admin-text-muted">Ciro: {formatPrice(point.revenueCents)}</p>
    </div>
  );
}

export function OrdersChart({ data }: { data: DailyOrdersPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3e5" vertical={false} />
        <XAxis
          dataKey="date"
          tickFormatter={(value: string) => new Date(value).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
          tick={{ fontSize: 11, fill: "#6b6b6f" }}
          axisLine={{ stroke: "#e3e3e5" }}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={20}
        />
        <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#6b6b6f" }} axisLine={false} tickLine={false} width={30} />
        <Tooltip content={<CustomTooltip />} />
        <Line type="monotone" dataKey="orders" stroke="#4f46e5" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
