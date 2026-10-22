import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getPublishedProducts } from "@/lib/catalog";
import { getActiveAutomaticPercentCampaigns } from "@/lib/coupons";
import { pickHomeBundles } from "@/lib/home-products";
import { prisma } from "@/lib/prisma";
import { CompleteLook } from "@/components/home/complete-the-look";

// Urun sayfasindaki "Kombini gör" kutusunun actigi sayfa (bkz.
// product-viewer.tsx). Anasayfadaki "Kombini Tamamla" gorunumunun buyuk hali;
// "Anasayfada göster" isaretinden bagimsiz, aktif her kombin icin acilir.
// Fotografsiz kombin yalniz listeyle gosterilir. Urun degisince
// revalidateCatalog bu sayfalari da tazeler.
export const revalidate = 3600;

const getBundle = cache((id: string) =>
  prisma.bundle.findFirst({
    where: { id, isActive: true },
    select: {
      id: true,
      name: true,
      discountPercent: true,
      imageUrl: true,
      hotspotsJson: true,
      productOrderJson: true,
      products: { select: { id: true } }
    }
  })
);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const bundle = await getBundle(id);
  if (!bundle) return {};
  return {
    title: `${bundle.name} | Kombin`,
    description: `Kombindeki ürünleri birlikte al, %${bundle.discountPercent} indirim kazan.`,
    alternates: { canonical: `/kombin/${id}` },
    // Ayni urunler kendi sayfalarinda zaten indeksleniyor.
    robots: { index: false, follow: true }
  };
}

export default async function KombinPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [bundle, products, automaticCampaigns] = await Promise.all([
    getBundle(id),
    getPublishedProducts(),
    getActiveAutomaticPercentCampaigns(prisma)
  ]);
  if (!bundle) notFound();

  // Urunlerinden biri yayinda degilse ya da stoklu rengi yoksa kombin eksik
  // kalir (sepete eklenemez, indirim tetiklenmez) - sayfa acilmaz.
  const [look] = pickHomeBundles([bundle], products, automaticCampaigns, { requireImage: false });
  if (!look) notFound();

  return (
    <div className="px-4 pb-section pt-8 md:px-6 md:pt-12 xl:px-9">
      <CompleteLook
        large
        bundle={look}
        header={
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-ink/60">Kombin</p>
            <h1 className="mt-2 font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl">{look.name}</h1>
            <p className="mt-3 text-sm text-ink/70">
              Tüm parçaları birlikte al, <span className="font-medium text-ink">%{look.discountPercent} indirim</span>{" "}
              kazan.
            </p>
            <Link
              href="/urunler"
              className="link-shrink-underline mt-4 inline-block text-[10px] font-medium uppercase tracking-[0.1em] text-ink"
            >
              Tüm ürünler
            </Link>
          </div>
        }
      />
    </div>
  );
}
