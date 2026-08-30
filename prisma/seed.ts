import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import bcrypt from "bcryptjs";
import { resolveOptionValueIds } from "../src/lib/variant-attributes";

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@bollmark.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "degistirin-123";

  const passwordHash = await bcrypt.hash(adminPassword, 10);
  await prisma.adminUser.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      name: "Yonetici",
      email: adminEmail,
      passwordHash,
      role: "ADMIN"
    }
  });

  const category = await prisma.category.upsert({
    where: { slug: "outerwear" },
    update: {},
    create: { name: "Dis Giyim", slug: "outerwear" }
  });

  const existing = await prisma.product.findUnique({ where: { slug: "bollmark-oversize-mont" } });
  if (!existing) {
    const product = await prisma.product.create({
      data: {
        name: "Bollmark Oversize Mont",
        slug: "bollmark-oversize-mont",
        description:
          "Agir gramajli kumas, su itici yuzey ve rahat oversize kesim. Bollmark imzali dokuma etiket ile.",
        priceCents: 189900,
        compareAtCents: 229900,
        status: "PUBLISHED",
        categoryId: category.id,
        images: {
          create: [
            { url: "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=1200", alt: "Bollmark mont on", position: 0 },
            { url: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=1200", alt: "Bollmark mont arka", position: 1 }
          ]
        }
      }
    });

    const seedVariants = [
      { size: "S", color: "Siyah", sku: "BLM-MONT-S-SYH", stock: 8 },
      { size: "M", color: "Siyah", sku: "BLM-MONT-M-SYH", stock: 12 },
      { size: "L", color: "Siyah", sku: "BLM-MONT-L-SYH", stock: 10 },
      { size: "M", color: "Bej", sku: "BLM-MONT-M-BEJ", stock: 6 }
    ];
    for (const v of seedVariants) {
      const optionValueIds = await resolveOptionValueIds(prisma, [
        { attributeName: "Beden", value: v.size },
        { attributeName: "Renk", value: v.color }
      ]);
      await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: v.sku,
          stock: v.stock,
          options: { create: optionValueIds.map((valueId) => ({ valueId })) }
        }
      });
    }
  }

  console.log("Tohumlama tamamlandi. Admin girisi:", adminEmail);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
