import { Users } from "lucide-react";
import { EmptyState } from "@/components/admin/empty-state";

export default function AdminCustomersPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Musteriler</h1>
      <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
        <EmptyState
          icon={Users}
          title="Yakinda"
          description="Musteri listesi ve detaylari yakinda bu sayfada gorunecek."
        />
      </div>
    </div>
  );
}
