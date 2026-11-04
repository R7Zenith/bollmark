import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { formatTrMobile } from "@/lib/phone";
import { Button } from "@/components/admin/button";
import { Card } from "@/components/admin/card";
import { AddressFields, adminInputClass } from "@/components/admin/customer-detail/address-fields";
import { AddressEditRow } from "@/components/admin/customer-detail/address-edit-row";
import {
  createAddressAction,
  deleteAddressAction,
  setDefaultAddressAction,
  updateAddressAction,
  updateCustomerAction
} from "../actions";

const RESULT: Record<string, { text: string; error?: true }> = {
  guncellendi: { text: "Müşteri bilgileri güncellendi." },
  "adres-eklendi": { text: "Adres eklendi." },
  "adres-guncellendi": { text: "Adres güncellendi." },
  "adres-silindi": { text: "Adres silindi." },
  varsayilan: { text: "Varsayılan adres değişti." },
  "degisiklik-yok": { text: "Değişiklik yok, kayıt yapılmadı." },
  "ad-gerekli": { text: "Ad boş bırakılamaz.", error: true },
  "eposta-gecersiz": { text: "Geçerli bir e-posta girin.", error: true },
  "eposta-kullanimda": { text: "Bu e-posta başka bir hesapta kayıtlı.", error: true },
  "telefon-gecersiz": { text: "Geçerli bir cep telefonu numarası girin (05xx xxx xx xx).", error: true },
  "adres-eksik": { text: "Etiket, alıcı, telefon, adres, il ve ilçe zorunlu.", error: true },
  "adres-bulunamadi": { text: "Adres bulunamadı.", error: true }
};

// Hesapli musteri duzenleme. Yalniz ADMIN (sayfa + her action requireAdmin).
export default async function AdminCustomerEditPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sonuc?: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const result = RESULT[(await searchParams).sonuc ?? ""];

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, phone: true, addresses: { orderBy: { createdAt: "asc" } } }
  });
  if (!customer) notFound();

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <Link href={`/admin/musteriler/${customer.id}`} className="text-sm text-admin-text-muted hover:underline">
          ← Müşteri detayı
        </Link>
        <h1 className="mt-2 break-words text-2xl font-semibold text-admin-text">{customer.name} · Düzenle</h1>
        <p className="mt-1 text-sm text-admin-text-muted">Değişiklikler geçmiş siparişleri etkilemez.</p>
      </div>

      {result && (
        <p
          className={`rounded-md border px-4 py-3 text-sm ${
            result.error ? "border-red-200 bg-red-50 text-red-700" : "border-admin-border bg-admin-surface text-admin-text"
          }`}
        >
          {result.text}
        </p>
      )}

      <Card title="Müşteri bilgileri">
        <form action={updateCustomerAction} className="space-y-4">
          <input type="hidden" name="customerId" value={customer.id} />
          <label className="block text-sm">
            <span className="text-xs text-admin-text-muted">Ad soyad</span>
            <input name="name" required defaultValue={customer.name} className={`mt-1 ${adminInputClass}`} />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-admin-text-muted">Cep telefonu</span>
            <input
              name="phone"
              type="tel"
              defaultValue={customer.phone ? formatTrMobile(customer.phone) : ""}
              placeholder="05xx xxx xx xx"
              className={`mt-1 ${adminInputClass}`}
            />
          </label>
          <label className="block text-sm">
            <span className="text-xs text-admin-text-muted">E-posta</span>
            <input name="email" type="email" required defaultValue={customer.email} className={`mt-1 ${adminInputClass}`} />
            <span className="mt-1 block text-xs text-yellow-700">
              E-posta değişirse müşteri bundan sonra yeni e-postasıyla giriş yapar. E-posta doğrulaması sıfırlanır.
            </span>
          </label>
          <div className="flex justify-end">
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </Card>

      <Card title={`Adresler (${customer.addresses.length})`}>
        {customer.addresses.length === 0 ? (
          <p className="text-sm text-admin-text-muted">Kayıtlı adres yok.</p>
        ) : (
          <ul className="divide-y divide-admin-border">
            {customer.addresses.map((a) => (
              <AddressEditRow
                key={a.id}
                customerId={customer.id}
                address={a}
                updateAction={updateAddressAction}
                deleteAction={deleteAddressAction}
                setDefaultAction={setDefaultAddressAction}
              />
            ))}
          </ul>
        )}
      </Card>

      <Card title="Yeni adres">
        <form action={createAddressAction} className="space-y-3">
          <input type="hidden" name="customerId" value={customer.id} />
          <AddressFields />
          <div className="flex justify-end">
            <Button type="submit">Adres ekle</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
