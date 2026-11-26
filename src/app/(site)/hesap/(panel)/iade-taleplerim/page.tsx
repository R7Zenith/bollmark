import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { formatDate } from "@/lib/format";
import { firstImageUrl } from "@/lib/catalog";
import { returnStatusLabel, returnTypeLabel, type ReturnStatus, type ReturnType } from "@/lib/status";
import { returnGuideFor } from "@/lib/return-guide";
import { ReturnGuide, ReturnReply, ReturnSteps } from "@/components/return-guide";

function parseItemsJson(raw: string): { orderItemId: string; quantity: number }[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((v) => (v && typeof v.orderItemId === "string" ? [{ orderItemId: v.orderItemId, quantity: Number(v.quantity) || 1 }] : []));
  } catch {
    return [];
  }
}

// IADE_TALEBI_SISTEMI_PLANI.md 4.2: uyenin tum iade/degisim talepleri. Iade
// kodu ve adresi yalniz ONAYLANDI/KARGODA talepte (returnGuideFor) gosterilir.
export default async function IadeTaleplerimPage() {
  const session = await requireCustomer();
  const customerId = session.user!.id!;

  const requests = await prisma.returnRequest.findMany({
    where: { order: { customerId, deletedAt: null } },
    include: {
      order: {
        select: {
          orderNumber: true,
          items: {
            select: {
              id: true,
              product: {
                select: {
                  name: true,
                  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
                  optionImages: { orderBy: { position: "asc" }, take: 1, select: { url: true } }
                }
              }
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" }
  });

  return (
    <div>
      <h2 className="font-display text-xl">İade Taleplerim</h2>

      {requests.length === 0 ? (
        <p className="mt-6 text-sm text-ink/60">
          Henüz iade veya değişim talebin yok. Teslim edilen siparişlerin için talebi{" "}
          <Link href="/hesap/siparislerim" className="underline underline-offset-2 hover:text-ink">
            Siparişlerim
          </Link>{" "}
          sayfasından oluşturabilirsin.
        </p>
      ) : (
        <div className="mt-6 space-y-6">
          {requests.map((rr) => {
            const itemsById = new Map(rr.order.items.map((item) => [item.id, item]));
            const lines = parseItemsJson(rr.itemsJson).flatMap((line) => {
              const item = itemsById.get(line.orderItemId);
              return item ? [{ ...line, name: item.product.name, image: firstImageUrl(item.product) ?? "/gorsel-yakinda.svg" }] : [];
            });
            const guide = returnGuideFor(rr.status, rr.order.orderNumber);
            const statusLabel = returnStatusLabel[rr.status as ReturnStatus] ?? rr.status;
            return (
              <article key={rr.id} id={`talep-${rr.id}`} className="scroll-mt-24 border border-line bg-white p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div>
                    <p className="font-medium">
                      {returnTypeLabel[rr.type as ReturnType] ?? rr.type} talebi · {rr.order.orderNumber}
                    </p>
                    <p className="text-xs text-ink/50">{formatDate(rr.createdAt)}</p>
                  </div>
                  <p className="text-sm text-ink/70">{statusLabel}</p>
                </div>

                <ReturnSteps status={rr.status} />

                <ul className="mt-5 divide-y divide-line border-y border-line">
                  {lines.map((line) => (
                    <li key={line.orderItemId} className="flex items-center gap-4 py-3 text-sm">
                      <Image src={line.image} alt={line.name} width={48} height={64} className="h-16 w-12 shrink-0 object-cover" />
                      <span className="min-w-0 flex-1">{line.name}</span>
                      <span className="shrink-0 text-ink/60">× {line.quantity}</span>
                    </li>
                  ))}
                </ul>

                <dl className="mt-4 space-y-1 text-sm">
                  <div className="flex gap-2">
                    <dt className="text-ink/50">Sebep:</dt>
                    <dd>{rr.reason}</dd>
                  </div>
                  {rr.customerNote && (
                    <div className="flex gap-2">
                      <dt className="shrink-0 text-ink/50">Notun:</dt>
                      <dd className="whitespace-pre-line">{rr.customerNote}</dd>
                    </div>
                  )}
                </dl>

                {rr.customerReply && <ReturnReply reply={rr.customerReply} dateLabel={rr.customerReplyAt ? formatDate(rr.customerReplyAt) : null} />}

                {guide && <ReturnGuide guide={guide} />}

                {rr.status === "TALEP_EDILDI" && (
                  <p className="mt-5 text-sm text-ink/60">
                    Talebini inceliyoruz. Onaylanınca iade kodu ve gönderim adresi burada ve e-postanda görünecek.
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
