import { prisma } from "@/lib/prisma";

export async function getProductReviewSummary(productId: string) {
  const [aggregate, reviews] = await Promise.all([
    prisma.productReview.aggregate({
      _avg: { rating: true },
      _count: true,
      where: { productId, status: "ONAYLANDI" }
    }),
    prisma.productReview.findMany({
      where: { productId, status: "ONAYLANDI" },
      orderBy: { createdAt: "desc" }
    })
  ]);

  // Fotografli yorumlar one cikar - stabil siralama tarih sirasini
  // fotografli/fotografsiz gruplar icinde korur.
  const sortedReviews = [...reviews].sort((a, b) => {
    const aHasImage = a.imageUrls ? 1 : 0;
    const bHasImage = b.imageUrls ? 1 : 0;
    return bHasImage - aHasImage;
  });

  return {
    avgRating: aggregate._avg.rating,
    count: aggregate._count,
    reviews: sortedReviews
  };
}
