import { MessageSquare } from "lucide-react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { reviewStatuses, type ReviewStatus } from "@/lib/review-constants";
import { EmptyState } from "@/components/admin/empty-state";
import { ReviewsTable, type ReviewRow } from "@/components/admin/reviews-table";
import { ReviewFeedback } from "@/components/admin/review-feedback";

async function updateReviewStatus(formData: FormData) {
  "use server";
  const reviewId = String(formData.get("reviewId") || "");
  const statusRaw = String(formData.get("status") || "");
  const status = (reviewStatuses as readonly string[]).includes(statusRaw) ? (statusRaw as ReviewStatus) : "BEKLIYOR";

  try {
    await prisma.productReview.update({ where: { id: reviewId }, data: { status } });
  } catch {
    redirect("/admin/yorumlar?hata=guncellenemedi");
  }
  redirect("/admin/yorumlar?basarili=guncellendi");
}

export default async function AdminYorumlarPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;

  const totalCount = await prisma.productReview.count();
  if (totalCount === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-admin-text">Yorumlar</h1>
        <div className="mt-8 rounded-lg border border-admin-border bg-admin-surface">
          <EmptyState icon={MessageSquare} title="Henüz ürün yorumu yok" description="Bir müşteri yorum yaptığında burada görünecek." />
        </div>
      </div>
    );
  }

  const reviews = await prisma.productReview.findMany({
    include: { product: { select: { name: true } } },
    orderBy: { createdAt: "desc" }
  });

  const rows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    productName: r.product.name,
    customerName: r.customerName,
    rating: r.rating,
    comment: r.comment,
    hasImages: Boolean(r.imageUrls),
    status: r.status,
    createdAtLabel: r.createdAt.toLocaleDateString("tr-TR")
  }));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-admin-text">Yorumlar</h1>

      <ReviewFeedback basarili={basarili} hata={hata} />

      <div className="mt-6">
        <ReviewsTable reviews={rows} updateAction={updateReviewStatus} />
      </div>
    </div>
  );
}
