// Yurtici mock/test denemesi icin GECICI test siparisleri (kullanici onayi
// 2026-11-10). Canli DB ortak oldugu icin gercek siparislere sahte kargo
// anahtari yazilmasin diye; kod mock/test modunda Yurtici islemlerini yalniz
// alici adi "TEST ALICI" ile baslayan siparislerde acar.
//
// Siparisler: durum PREPARING, odeme UNPAID (Vega yalniz odenmis siparis alir),
// kalem yok (stok etkilenmez), olustururken mail gonderilmez. Faz 4 durum
// gecislerindeki "kargolandi/teslim edildi" mailleri test adresine gider
// (yerelde MAIL_DEV_REDIRECT'e yonlenir). --sil bu siparislerin denetim
// kayitlarini ve test adresine giden mail kayitlarini da siler.
//
// Olustur: npx tsx scripts/yurtici-test-siparisleri.ts --olustur
// Sil:     npx tsx scripts/yurtici-test-siparisleri.ts --sil
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const PREFIX = "BLMTEST-";
const TEST_EMAIL = "test.alici@example.com";

const ORDERS = [
  {
    orderNumber: `${PREFIX}0001`,
    customerName: "TEST ALICI Bir",
    customerPhone: "+905321234567",
    shippingAddress: "Runguçpaşa Mah. Atatürk Cad. No:12 D:3",
    city: "Bursa",
    district: "Karacabey"
  },
  {
    orderNumber: `${PREFIX}0002`,
    customerName: "TEST ALICI İki",
    customerPhone: "+905339876543",
    shippingAddress: "Cumhuriyet Mah. Gazi Bulvarı No:45 Kat:2 Daire:5, Apartman girişi arka sokaktan",
    city: "İzmir",
    district: "Konak"
  },
  {
    // Telefonun son 7 hanesi ayni: mock 82516 (telefon hatali) dondurur.
    orderNumber: `${PREFIX}0003`,
    customerName: "TEST ALICI Telefon Hatası",
    customerPhone: "+905320000000",
    shippingAddress: "Bahçelievler Mah. 7. Sokak No:8",
    city: "Ankara",
    district: "Çankaya"
  },
  {
    // Mock ilk denemede 60020 (anahtar zaten var) dondurur, ikinci deneme -2 ile gider.
    orderNumber: `${PREFIX}0004`,
    customerName: "TEST ALICI Anahtar Var",
    customerPhone: "+905051112233",
    shippingAddress: "Osmangazi Mah. İnönü Cad. No:21",
    city: "Bursa",
    district: "Osmangazi"
  }
];

async function create() {
  for (const o of ORDERS) {
    const exists = await prisma.order.findUnique({ where: { orderNumber: o.orderNumber } });
    if (exists) {
      console.log(`${o.orderNumber} zaten var (${exists.id})`);
      continue;
    }
    const order = await prisma.order.create({
      data: {
        ...o,
        status: "PREPARING",
        paymentStatus: "UNPAID",
        customerEmail: TEST_EMAIL,
        note: "Yurtiçi mock denemesi - geçici test siparişi, silinecek",
        subtotalCents: 0,
        totalCents: 0,
        shipment: { create: {} }
      }
    });
    console.log(`${o.orderNumber} oluşturuldu: /admin/siparisler/${order.id}`);
  }
}

async function remove() {
  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: PREFIX }, customerName: { startsWith: "TEST ALICI" } },
    select: { id: true, orderNumber: true }
  });
  const ids = orders.map((o) => o.id);
  const audit = await prisma.auditLog.deleteMany({ where: { targetType: "Order", targetId: { in: ids } } });
  const deleted = await prisma.order.deleteMany({ where: { id: { in: ids } } }); // Shipment cascade
  // Faz 4 denemesinde giden "kargolandi/teslim edildi" maillerinin kaydi (asil alici test adresi).
  const mails = await prisma.emailLog.deleteMany({ where: { to: TEST_EMAIL } });
  console.log(
    `Silinen sipariş: ${deleted.count} (${orders.map((o) => o.orderNumber).join(", ") || "-"}), denetim kaydı: ${audit.count}, mail kaydı: ${mails.count}`
  );
}

const arg = process.argv[2];
(arg === "--olustur" ? create() : arg === "--sil" ? remove() : Promise.reject(new Error("--olustur ya da --sil")))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
