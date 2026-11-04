"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { logAudit } from "@/lib/audit-log";
import { normalizeTrMobile } from "@/lib/phone";
import { cancelCoupon, extendCoupon } from "@/lib/kalp-topla/admin-coupons";

function actor(session: Awaited<ReturnType<typeof requireAdmin>>) {
  return { actorEmail: session.user?.email ?? "", actorRole: session.user?.role ?? "ADMIN" };
}

function back(customerId: string, result: string): never {
  const page = `/admin/musteriler/${customerId}`;
  revalidatePath(page);
  redirect(`${page}?sonuc=${result}`);
}

export async function cancelCouponAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const done = await cancelCoupon(String(formData.get("id") ?? ""), customerId, actor(session));
  back(customerId, done ? "iptal" : "degismis");
}

export async function extendCouponAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = String(formData.get("customerId") ?? "");
  const value = String(formData.get("expiresAt") ?? "");
  back(customerId, await extendCoupon(String(formData.get("id") ?? ""), customerId, value, actor(session)));
}

// --- Musteri ve adres duzenleme. Gecmis siparislerdeki ad/telefon/adres
// (Order satirlari) bilerek degistirilmez; passwordHash'e dokunulmaz.

function editBack(customerId: string, result: string): never {
  revalidatePath(`/admin/musteriler/${customerId}`);
  revalidatePath(`/admin/musteriler/${customerId}/duzenle`);
  redirect(`/admin/musteriler/${customerId}/duzenle?sonuc=${result}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isUniqueViolation(error: unknown) {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

// "alan: eski -> yeni" parcalari; degismeyen alan yazilmaz.
function diff(fields: [label: string, before: string | null, after: string | null][]) {
  return fields.filter(([, before, after]) => before !== after).map(([label, before, after]) => `${label}: ${before || "-"} -> ${after || "-"}`);
}

const emailSchema = z.string().email();

export async function updateCustomerAction(formData: FormData) {
  const session = await requireAdmin();
  const id = text(formData, "customerId");
  const customer = await prisma.customer.findUnique({ where: { id }, select: { name: true, email: true, phone: true } });
  if (!customer) redirect("/admin/musteriler");

  const name = text(formData, "name");
  const email = text(formData, "email").toLowerCase();
  const phoneInput = text(formData, "phone");
  if (!name) editBack(id, "ad-gerekli");
  if (!emailSchema.safeParse(email).success) editBack(id, "eposta-gecersiz");
  // Bos telefon yalniz zaten kayitli telefonu olmayan eski hesaplarda kabul edilir.
  const phone = phoneInput ? normalizeTrMobile(phoneInput) : null;
  if (phoneInput ? !phone : customer.phone) editBack(id, "telefon-gecersiz");

  const emailChanged = email !== customer.email;
  const changes = diff([
    ["ad", customer.name, name],
    ["telefon", customer.phone, phone],
    ["e-posta", customer.email, email]
  ]);
  if (changes.length === 0) editBack(id, "degisiklik-yok");

  if (emailChanged) {
    const other = await prisma.customer.findUnique({ where: { email }, select: { id: true } });
    if (other) editBack(id, "eposta-kullanimda");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // E-posta degisince dogrulama sifirlanir (yeni adres kanitlanmadi). Eski
      // adrese gitmis kullanilmamis linkler musteri id'sine bagli oldugu icin silinir.
      await tx.customer.update({ where: { id }, data: { name, phone, email, ...(emailChanged && { emailVerifiedAt: null }) } });
      if (emailChanged) await tx.emailVerificationToken.deleteMany({ where: { customerId: id, usedAt: null } });
    });
  } catch (error) {
    if (isUniqueViolation(error)) editBack(id, "eposta-kullanimda");
    throw error;
  }

  await logAudit({
    ...actor(session),
    action: "CUSTOMER_UPDATED",
    targetType: "Customer",
    targetId: id,
    detail: changes.join("; ") + (emailChanged ? " (e-posta doğrulaması sıfırlandı)" : "")
  });
  editBack(id, "guncellendi");
}

function addressInput(formData: FormData) {
  const data = {
    label: text(formData, "label"),
    name: text(formData, "name"),
    phone: text(formData, "phone"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    district: text(formData, "district"),
    postalCode: text(formData, "postalCode") || null
  };
  const complete = data.label && data.name && data.phone && data.address && data.city && data.district;
  return complete ? data : null;
}

type AddressData = NonNullable<ReturnType<typeof addressInput>>;

function addressSummary(a: AddressData) {
  return `${a.label}: ${a.name}, ${a.phone}, ${a.address}, ${a.district} / ${a.city} ${a.postalCode ?? ""}`.trim();
}

async function ownedAddress(customerId: string, addressId: string) {
  const address = await prisma.customerAddress.findUnique({ where: { id: addressId } });
  if (!address || address.customerId !== customerId) editBack(customerId, "adres-bulunamadi");
  return address;
}

export async function createAddressAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = text(formData, "customerId");
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) redirect("/admin/musteriler");
  const data = addressInput(formData);
  if (!data) editBack(customerId, "adres-eksik");

  const existingCount = await prisma.customerAddress.count({ where: { customerId } });
  const created = await prisma.customerAddress.create({ data: { customerId, ...data, isDefault: existingCount === 0 } });
  await logAudit({
    ...actor(session),
    action: "CUSTOMER_ADDRESS_CREATED",
    targetType: "Customer",
    targetId: customerId,
    detail: `${addressSummary(data)}${created.isDefault ? " (varsayılan)" : ""}`
  });
  editBack(customerId, "adres-eklendi");
}

export async function updateAddressAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = text(formData, "customerId");
  const existing = await ownedAddress(customerId, text(formData, "addressId"));
  const data = addressInput(formData);
  if (!data) editBack(customerId, "adres-eksik");

  const changes = diff([
    ["etiket", existing.label, data.label],
    ["alıcı", existing.name, data.name],
    ["telefon", existing.phone, data.phone],
    ["adres", existing.address, data.address],
    ["ilçe", existing.district, data.district],
    ["il", existing.city, data.city],
    ["posta kodu", existing.postalCode, data.postalCode]
  ]);
  if (changes.length === 0) editBack(customerId, "degisiklik-yok");

  await prisma.customerAddress.update({ where: { id: existing.id }, data });
  await logAudit({
    ...actor(session),
    action: "CUSTOMER_ADDRESS_UPDATED",
    targetType: "Customer",
    targetId: customerId,
    detail: `${existing.label}: ${changes.join("; ")}`
  });
  editBack(customerId, "adres-guncellendi");
}

export async function deleteAddressAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = text(formData, "customerId");
  const existing = await ownedAddress(customerId, text(formData, "addressId"));

  // Varsayilan silinirse en eski kalan adres varsayilan olur (Hesabim > Adreslerim ile ayni).
  await prisma.$transaction(async (tx) => {
    await tx.customerAddress.delete({ where: { id: existing.id } });
    if (!existing.isDefault) return;
    const next = await tx.customerAddress.findFirst({ where: { customerId }, orderBy: { createdAt: "asc" } });
    if (next) await tx.customerAddress.update({ where: { id: next.id }, data: { isDefault: true } });
  });
  await logAudit({
    ...actor(session),
    action: "CUSTOMER_ADDRESS_DELETED",
    targetType: "Customer",
    targetId: customerId,
    detail: addressSummary(existing) + (existing.isDefault ? " (varsayılandı)" : "")
  });
  editBack(customerId, "adres-silindi");
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await requireAdmin();
  const customerId = text(formData, "customerId");
  const existing = await ownedAddress(customerId, text(formData, "addressId"));
  if (existing.isDefault) editBack(customerId, "degisiklik-yok");

  const previous = await prisma.customerAddress.findFirst({ where: { customerId, isDefault: true }, select: { label: true } });
  await prisma.$transaction([
    prisma.customerAddress.updateMany({ where: { customerId, id: { not: existing.id } }, data: { isDefault: false } }),
    prisma.customerAddress.update({ where: { id: existing.id }, data: { isDefault: true } })
  ]);
  await logAudit({
    ...actor(session),
    action: "CUSTOMER_ADDRESS_UPDATED",
    targetType: "Customer",
    targetId: customerId,
    detail: `varsayılan adres: ${previous?.label ?? "-"} -> ${existing.label}`
  });
  editBack(customerId, "varsayilan");
}
