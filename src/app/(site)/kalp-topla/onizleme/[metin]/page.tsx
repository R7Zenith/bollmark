import { notFound } from "next/navigation";
import { legalPagesContent } from "../../../../../../prisma/legal-pages-content";

// Yalniz yerel onizleme: Gizlilik ve Kampanya Kosullari metinleri canli DB'ye
// yazilmadan /sayfa ile ayni gorunumde okunur. Production'da 404 (plan 9.1/3).
const SLUGS: Record<string, string> = { gizlilik: "gizlilik-politikasi", kosullar: "kalp-topla-kosullari" };

export const metadata = { robots: { index: false } };

export default async function KalpToplaMetinOnizleme({ params }: { params: Promise<{ metin: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { metin } = await params;
  const page = legalPagesContent.find((p) => p.slug === SLUGS[metin]);
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">{page.title}</h1>
      <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-ink/80">{page.content}</p>
    </div>
  );
}
