import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { Card } from "@/components/admin/card";
import { YasalSayfalarFeedback } from "@/components/admin/yasal-sayfalar-feedback";

const PATH = "/admin/yasal-sayfalar";

// Sabit 5 sayfa - v1'de yeni sayfa ekleme/silme yok, sadece icerik duzenleme.
const legalPageSlugs = [
  "hakkimizda",
  "kargo-bilgisi",
  "iade-kosullari",
  "gizlilik-politikasi",
  "mesafeli-satis-sozlesmesi"
] as const;

async function updateLegalPage(slug: string, formData: FormData) {
  "use server";
  const title = String(formData.get("title") || "").trim();
  const content = String(formData.get("content") || "").trim();
  if (!title || !content) redirect(`${PATH}?hata=eksik-alan`);

  await prisma.legalPage.update({ where: { slug }, data: { title, content } });
  revalidatePath(`/sayfa/${slug}`);
  redirect(`${PATH}?basarili=guncellendi`);
}

export default async function AdminYasalSayfalarPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  await requireAdmin();
  const { basarili, hata } = await searchParams;

  const pages = await prisma.legalPage.findMany({ where: { slug: { in: [...legalPageSlugs] } } });
  const pageBySlug = new Map(pages.map((p) => [p.slug, p]));

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold text-admin-text">Yasal Sayfalar</h1>

      <YasalSayfalarFeedback basarili={basarili} hata={hata} />

      {legalPageSlugs.map((slug) => {
        const page = pageBySlug.get(slug);
        if (!page) return null;
        return (
          <Card key={slug} title={page.title}>
            <form action={updateLegalPage.bind(null, slug)} className="space-y-3">
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">Başlık</label>
                <input
                  name="title"
                  defaultValue={page.title}
                  required
                  className="mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wide text-admin-text-muted">İçerik</label>
                <textarea
                  name="content"
                  defaultValue={page.content}
                  required
                  rows={8}
                  className="mt-1 w-full rounded-md border border-admin-border px-4 py-2.5 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent"
                />
              </div>
              <button className="rounded-md bg-admin-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">
                Kaydet
              </button>
            </form>
          </Card>
        );
      })}
    </div>
  );
}
