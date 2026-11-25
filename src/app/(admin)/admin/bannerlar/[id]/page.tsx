import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/require-admin";
import { prisma } from "@/lib/prisma";
import { toSlideData } from "@/lib/home-slides-server";
import { BannerForm } from "@/components/admin/banner-form";

export default async function EditBannerPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const row = await prisma.homeSlide.findUnique({ where: { id } });
  if (!row || row.kind === "KALP_TOPLA") notFound();
  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/bannerlar" className="text-sm text-admin-text-muted hover:text-admin-text">
          ← Anasayfa Banner&apos;ları
        </Link>
        <h1 className="mt-2 text-2xl font-semibold">{row.name}</h1>
      </div>
      <BannerForm slide={toSlideData(row)} />
    </div>
  );
}
