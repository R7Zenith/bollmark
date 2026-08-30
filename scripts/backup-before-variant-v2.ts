// Faz A (Varyant Ozellikleri V2) sema degisikliginden once tum tablolarin
// JSON yedegini alir. pg_dump/psql bu makinede kurulu olmadigi icin Prisma
// uzerinden satir bazli yedek aliniyor. Tek seferlik kullanim icin yazildi.
import { writeFileSync } from "fs";
import { prisma } from "../src/lib/prisma";

async function main() {
  const [
    adminUsers,
    categories,
    products,
    productImages,
    productVariants,
    orders,
    orderItems,
    storeSettings,
    shipments
  ] = await Promise.all([
    prisma.adminUser.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany(),
    prisma.productImage.findMany(),
    prisma.productVariant.findMany(),
    prisma.order.findMany(),
    prisma.orderItem.findMany(),
    prisma.storeSettings.findMany(),
    prisma.shipment.findMany()
  ]);

  const backup = {
    takenAt: new Date().toISOString(),
    adminUsers,
    categories,
    products,
    productImages,
    productVariants,
    orders,
    orderItems,
    storeSettings,
    shipments
  };

  const outPath = process.argv[2] || "backup.json";
  writeFileSync(outPath, JSON.stringify(backup, null, 2), "utf-8");
  console.log(`Yedek yazildi: ${outPath}`);
  console.log(
    `Satir sayilari - urun:${products.length} varyant:${productVariants.length} siparis:${orders.length}`
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
