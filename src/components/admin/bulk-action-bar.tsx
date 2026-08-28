import { Button } from "@/components/admin/button";

export interface BulkAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "secondary" | "danger" | "ghost";
}

export function BulkActionBar({ count, actions }: { count: number; actions: BulkAction[] }) {
  if (count === 0) return null;

  return (
    <div className="flex items-center justify-between rounded-md border border-admin-accent bg-indigo-50 px-4 py-2.5">
      <p className="text-sm font-medium text-admin-accent">{count} secili</p>
      <div className="flex items-center gap-2">
        {actions.map((action) => (
          <Button key={action.label} size="sm" variant={action.variant ?? "secondary"} onClick={action.onClick}>
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
