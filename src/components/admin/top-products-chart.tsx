"use client";

import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { formatPrice } from "@/lib/format";

export interface TopProductPoint {
  name: string;
  revenueCents: number;
}

function CustomTooltip({
  active,
  payload
}: {
  active?: boolean;
  payload?: { payload: TopProductPoint }[];
}) {
  if (!active || !payload || payload.length === 0) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-md border border-admin-border bg-admin-surface px-3 py-2 text-xs shadow-sm">
      <p className="font-medium text-admin-text">{point.name}</p>
      <p className="mt-1 text-admin-text-muted">Ciro: {formatPrice(point.revenueCents)}</p>
    </div>
  );
}

export function TopProductsChart({ data }: { data: TopProductPoint[] }) {
  const height = Math.max(200, data.length * 40);
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e3e3e5" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatPrice(v)}
          tick={{ fontSize: 11, fill: "#6b6b6f" }}
          axisLine={{ stroke: "#e3e3e5" }}
          tickLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          tick={{ fontSize: 11, fill: "#6b6b6f" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar dataKey="revenueCents" fill="#4f46e5" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
