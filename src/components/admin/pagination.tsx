import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Pagination({
  page,
  totalPages,
  baseUrl
}: {
  page: number;
  totalPages: number;
  /** "?page=" parametresi eklenecek taban adres, örn. "/admin/urunler?durum=yayinda" */
  baseUrl: string;
}) {
  if (totalPages <= 1) return null;

  const hasParams = baseUrl.includes("?");
  const linkFor = (p: number) => `${baseUrl}${hasParams ? "&" : "?"}page=${p}`;

  return (
    <div className="flex items-center justify-between border-t border-admin-border px-5 py-3">
      <p className="text-xs text-admin-text-muted">
        Sayfa {page} / {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <Link
          href={linkFor(Math.max(1, page - 1))}
          aria-disabled={page <= 1}
          className={`flex h-8 w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:bg-admin-bg ${
            page <= 1 ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronLeft size={16} />
        </Link>
        <Link
          href={linkFor(Math.min(totalPages, page + 1))}
          aria-disabled={page >= totalPages}
          className={`flex h-8 w-8 items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:bg-admin-bg ${
            page >= totalPages ? "pointer-events-none opacity-40" : ""
          }`}
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
