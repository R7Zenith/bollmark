import type { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getHepsijetMode } from "@/lib/hepsijet/config";
import { getHepsijetLabel } from "@/lib/hepsijet/orders";

// HepsiJET etiket PDF'i (barcodes-label?format=PDF), yeni sekmede acilir.
// /admin altinda: proxy.ts girisi ve rolu zaten kontrol eder; burada ikinci katman.
export async function GET(_req: NextRequest, ctx: RouteContext<"/admin/kargolar/hepsijet-etiket/[id]">) {
  const session = await getServerSession(authOptions);
  if (!session) return new Response("Yetkisiz istek.", { status: 401 });
  if (getHepsijetMode() === "off") return new Response("HepsiJET entegrasyonu kapalı.", { status: 404 });

  const { id } = await ctx.params;
  const result = await getHepsijetLabel(id);
  if (!result.ok) {
    return new Response(`Etiket alınamadı: ${result.message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8" }
    });
  }
  return new Response(Buffer.from(result.pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="hepsijet-${result.deliveryNo}.pdf"`,
      "Cache-Control": "no-store"
    }
  });
}
