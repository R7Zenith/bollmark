import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  trend
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down"; label: string };
}) {
  return (
    <div className="rounded-lg border border-admin-border bg-admin-surface p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">{label}</p>
        {Icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-50 text-admin-accent">
            <Icon size={16} />
          </div>
        )}
      </div>
      <p className="mt-3 text-2xl font-semibold text-admin-text">{value}</p>
      {trend && (
        <p
          className={`mt-1 flex items-center gap-1 text-xs font-medium ${
            trend.direction === "up" ? "text-green-600" : "text-red-600"
          }`}
        >
          {trend.direction === "up" ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {trend.label}
        </p>
      )}
    </div>
  );
}
