import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action
}: {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
      {Icon && (
        <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-admin-bg text-admin-text-muted">
          <Icon size={22} />
        </div>
      )}
      <p className="text-sm font-medium text-admin-text">{title}</p>
      {description && <p className="max-w-sm text-sm text-admin-text-muted">{description}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
