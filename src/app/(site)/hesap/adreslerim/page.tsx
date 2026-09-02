import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { HesapNav } from "@/components/hesap-nav";
import { HesapAddressRow } from "@/components/hesap-address-row";

const PATH = "/hesap/adreslerim";

async function addAddress(customerId: string, formData: FormData) {
  "use server";
  const label = String(formData.get("label") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const district = String(formData.get("district") || "").trim();
  const postalCode = String(formData.get("postalCode") || "").trim() || null;
  if (!label || !name || !phone || !address || !city || !district) redirect(`${PATH}?hata=eksik-alan`);

  const existingCount = await prisma.customerAddress.count({ where: { customerId } });
  await prisma.customerAddress.create({
    data: { customerId, label, name, phone, address, city, district, postalCode, isDefault: existingCount === 0 }
  });
  revalidatePath(PATH);
  redirect(`${PATH}?basarili=eklendi`);
}

async function updateAddress(id: string, customerId: string, formData: FormData) {
  "use server";
  const existing = await prisma.customerAddress.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customerId) redirect(`${PATH}?hata=bulunamadi`);

  const label = String(formData.get("label") || "").trim();
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const address = String(formData.get("address") || "").trim();
  const city = String(formData.get("city") || "").trim();
  const district = String(formData.get("district") || "").trim();
  const postalCode = String(formData.get("postalCode") || "").trim() || null;
  if (!label || !name || !phone || !address || !city || !district) redirect(`${PATH}?hata=eksik-alan`);

  await prisma.customerAddress.update({ where: { id }, data: { label, name, phone, address, city, district, postalCode } });
  revalidatePath(PATH);
  redirect(`${PATH}?basarili=guncellendi`);
}

async function deleteAddress(id: string, customerId: string) {
  "use server";
  const existing = await prisma.customerAddress.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customerId) redirect(`${PATH}?hata=bulunamadi`);

  await prisma.customerAddress.delete({ where: { id } });
  if (existing.isDefault) {
    const next = await prisma.customerAddress.findFirst({ where: { customerId }, orderBy: { createdAt: "asc" } });
    if (next) await prisma.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  }
  revalidatePath(PATH);
  redirect(`${PATH}?basarili=silindi`);
}

async function setDefaultAddress(id: string, customerId: string) {
  "use server";
  const existing = await prisma.customerAddress.findUnique({ where: { id } });
  if (!existing || existing.customerId !== customerId) redirect(`${PATH}?hata=bulunamadi`);

  await prisma.$transaction([
    prisma.customerAddress.updateMany({ where: { customerId }, data: { isDefault: false } }),
    prisma.customerAddress.update({ where: { id }, data: { isDefault: true } })
  ]);
  revalidatePath(PATH);
  redirect(`${PATH}?basarili=varsayilan-guncellendi`);
}

export default async function HesapAdreslerimPage({
  searchParams
}: {
  searchParams: Promise<{ basarili?: string; hata?: string }>;
}) {
  const session = await requireCustomer();
  const customerId = session.user!.id!;
  const { basarili, hata } = await searchParams;

  const addresses = await prisma.customerAddress.findMany({ where: { customerId }, orderBy: { createdAt: "asc" } });

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Adreslerim</h1>
      <div className="mt-8">
        <HesapNav />
      </div>

      {(basarili || hata) && (
        <p className={`mt-4 text-sm ${hata ? "text-red-600" : "text-ink/70"}`}>
          {hata ? "İşlem gerçekleştirilemedi, lütfen alanları kontrol edin." : "İşlem başarılı."}
        </p>
      )}

      <div className="mt-8 border border-line bg-white p-6">
        <h2 className="font-display text-lg">Yeni Adres Ekle</h2>
        <form action={addAddress.bind(null, customerId)} className="mt-4 grid grid-cols-2 gap-3">
          <input name="label" required placeholder="Etiket (Ev, İş...)" className="border border-line px-3 py-2 text-sm" />
          <input name="name" required placeholder="Ad Soyad" className="border border-line px-3 py-2 text-sm" />
          <input name="phone" required placeholder="Telefon" className="border border-line px-3 py-2 text-sm" />
          <input name="postalCode" placeholder="Posta Kodu" className="border border-line px-3 py-2 text-sm" />
          <input name="address" required placeholder="Adres" className="col-span-2 border border-line px-3 py-2 text-sm" />
          <input name="city" required placeholder="İl" className="border border-line px-3 py-2 text-sm" />
          <input name="district" required placeholder="İlçe" className="border border-line px-3 py-2 text-sm" />
          <button className="col-span-2 bg-ink py-2.5 text-sm uppercase tracking-wide text-paper hover:bg-accent">
            Adres Ekle
          </button>
        </form>
      </div>

      <ul className="mt-6 divide-y divide-line border border-line bg-white">
        {addresses.map((a) => (
          <HesapAddressRow
            key={a.id}
            address={a}
            updateAction={updateAddress.bind(null, a.id, customerId)}
            deleteAction={deleteAddress.bind(null, a.id, customerId)}
            setDefaultAction={setDefaultAddress.bind(null, a.id, customerId)}
          />
        ))}
        {addresses.length === 0 && <li className="px-4 py-6 text-center text-sm text-ink/50">Henüz kayıtlı adres yok.</li>}
      </ul>
    </div>
  );
}
