import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { buildCategoryOptions } from "@/lib/category-tree";
import { ExcelImportWizard } from "@/components/admin/excel-import-wizard";

export default async function ExcelImportPage() {
  await requireAdmin();
  const categories = await prisma.category.findMany({ orderBy: { name: "asc" } });
  const categoryOptions = buildCategoryOptions(categories).map((c) => ({ id: c.id, label: c.label }));

  return (
    <div className="max-w-5xl">
      <Link href="/admin/urunler" className="inline-flex items-center gap-1 text-sm text-admin-text-muted hover:text-admin-text">
        <ArrowLeft size={14} /> Ürünler
      </Link>
      <h1 className="mt-2 text-2xl font-semibold text-admin-text">Excel'den Toplu Ürün Yükle</h1>
      <p className="mt-1 text-sm text-admin-text-muted">
        Checklist excel'inden ürün ve varyantları içe aktarın. Yeni ürünler için Koton.com'dan renk bazlı
        görseller ve ürün açıklaması otomatik olarak bulunur.
      </p>

      <div className="mt-6">
        <ExcelImportWizard categories={categoryOptions} />
      </div>
    </div>
  );
}
