import Link from "next/link";
import { requireAdmin } from "@/lib/require-admin";
import { BannerForm } from "@/components/admin/banner-form";

export default async function NewBannerPage() {
  await requireAdmin();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/bannerlar" className="text-sm text-admin-text-muted hover:text-admin-text">
          ← Anasayfa Banner&apos;ları
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">Yeni banner</h1>
      </div>
      <BannerForm slide={null} />
    </div>
  );
}
