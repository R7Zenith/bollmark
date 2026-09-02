import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LegalPageView({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await prisma.legalPage.findUnique({ where: { slug } });
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">{page.title}</h1>
      <p className="mt-8 whitespace-pre-line text-sm leading-relaxed text-ink/80">{page.content}</p>
    </div>
  );
}
