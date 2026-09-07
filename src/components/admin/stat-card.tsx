import type { LucideIcon } from "lucide-react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { StatSparkline } from "@/components/admin/stat-sparkline";

export function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  sparkline
}: {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  trend?: { direction: "up" | "down"; label: string };
  /** Dönem içindeki günlük değerler - en az 2 nokta varsa kartın altında küçük bir alan grafiği çizilir. */
  sparkline?: number[];
}) {
  const strokeColor = trend?.direction === "down" ? "#dc2626" : "#4f46e5";

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
      {sparkline && sparkline.length > 1 && (
        <StatSparkline
          data={sparkline}
          color={strokeColor}
          gradientId={`sparkline-${label.replace(/[^a-zA-Z0-9]/g, "")}`}
        />
      )}
    </div>
  );
}
