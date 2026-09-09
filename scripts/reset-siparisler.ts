// Tek seferlik "siparişleri sıfırla" scripti. Amaç: Product -> OrderItem
// ilişkisinde cascade olmadığı için, herhangi bir siparişte geçen ürünler
// arşivden silinemiyor (/api/admin/urunler/bulk 409 veriyor). Bu script
// tüm siparişleri (ve ReturnRequest kayıtlarını) kalıcı olarak temizler,
// böylece arşivdeki ürünler admin panelden normal şekilde silinebilir.
// Varsayılan dry-run; gerçek silme için --confirm gerekir.
// Bkz. SIPARIS_VE_ARSIV_URUN_SIFIRLAMA_PLANI.md
import "dotenv/config";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/lib/prisma";

async function main() {
  const confirm = process.argv.includes("--confirm");

  const [orderCount, orderItemCount, shipmentCount, returnRequestCount] =
    await Promise.all([
      prisma.order.count(),
      prisma.orderItem.count(),
      prisma.shipment.count(),
      prisma.returnRequest.count()
    ]);

  console.log("Silinecek kayıtlar:");
  console.log(`  Order: ${orderCount}`);
  console.log(`  OrderItem: ${orderItemCount}`);
  console.log(`  Shipment: ${shipmentCount}`);
  console.log(`  ReturnRequest: ${returnRequestCount}`);

  if (!confirm) {
    console.log(
      "\nDry-run modu (varsayılan). Hiçbir şey silinmedi. Gerçekten silmek için:"
    );
    console.log("  npx tsx scripts/reset-siparisler.ts --confirm");
    return;
  }

  const backupsDir = join(process.cwd(), "backups");
  if (!existsSync(backupsDir)) {
    mkdirSync(backupsDir, { recursive: true });
  }

  const [orders, returnRequests] = await Promise.all([
    prisma.order.findMany({ include: { items: true, shipment: true } }),
    prisma.returnRequest.findMany()
  ]);

  const timestamp = new Date()
    .toISOString()
    .replace(/[:.]/g, "-")
    .replace("T", "-")
    .slice(0, 19);
  const backupPath = join(backupsDir, `siparisler-${timestamp}.json`);
  writeFileSync(
    backupPath,
    JSON.stringify({ takenAt: new Date().toISOString(), orders, returnRequests }, null, 2),
    "utf-8"
  );
  console.log(`\nYedek yazıldı: ${backupPath}`);

  const result = await prisma.$transaction(async (tx) => {
    const deletedReturnRequests = await tx.returnRequest.deleteMany();
    const deletedOrders = await tx.order.deleteMany();
    return { deletedReturnRequests, deletedOrders };
  });

  console.log("\nSilme tamamlandı:");
  console.log(`  Order: ${result.deletedOrders.count}`);
  console.log(`  OrderItem: ${orderItemCount} (cascade ile silindi)`);
  console.log(`  Shipment: ${shipmentCount} (cascade ile silindi)`);
  console.log(`  ReturnRequest: ${result.deletedReturnRequests.count}`);
  console.log(`  Yedek dosyası: ${backupPath}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
