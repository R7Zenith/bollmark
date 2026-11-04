import Link from "next/link";

export function CustomerHeader({
  name,
  badge,
  action,
  children
}: {
  name: string;
  badge: React.ReactNode;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div>
      <Link href="/admin/musteriler" className="text-sm text-admin-text-muted hover:underline">
        ← Müşteriler
      </Link>
      <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 break-words text-2xl font-semibold text-admin-text">
            {name} {badge}
          </h1>
          {children}
        </div>
        {action}
      </div>
    </div>
  );
}

export function InfoItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-admin-text-muted">{label}</dt>
      <dd className="mt-1 break-words text-admin-text">{children}</dd>
    </div>
  );
}
