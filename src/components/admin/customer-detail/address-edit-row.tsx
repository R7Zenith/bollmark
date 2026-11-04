"use client";

import { useState } from "react";
import { Badge } from "@/components/admin/badge";
import { Button } from "@/components/admin/button";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";
import { formatTrMobile } from "@/lib/phone";
import { AddressFields, type AddressValues } from "./address-fields";

const linkClass = "text-sm text-admin-accent hover:underline";

export function AddressEditRow({
  customerId,
  address,
  updateAction,
  deleteAction,
  setDefaultAction
}: {
  customerId: string;
  address: AddressValues & { id: string; isDefault: boolean };
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  setDefaultAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);
  const hidden = (
    <>
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="addressId" value={address.id} />
    </>
  );

  if (editing) {
    return (
      <li className="py-4">
        <form action={updateAction} className="space-y-3">
          {hidden}
          <AddressFields values={address} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
              Vazgeç
            </Button>
            <Button type="submit">Kaydet</Button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-col gap-3 py-4 text-sm sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium text-admin-text">
          {address.label} {address.isDefault && <Badge tone="green">Varsayılan</Badge>}
        </p>
        <p className="text-admin-text">
          {address.name} · {formatTrMobile(address.phone)}
        </p>
        <p className="break-words text-admin-text-muted">
          {address.address}, {address.district} / {address.city} {address.postalCode}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-4">
        {!address.isDefault && (
          <form action={setDefaultAction}>
            {hidden}
            <button type="submit" className={linkClass}>
              Varsayılan yap
            </button>
          </form>
        )}
        <button type="button" onClick={() => setEditing(true)} className={linkClass}>
          Düzenle
        </button>
        <form action={deleteAction}>
          {hidden}
          <ConfirmSubmitButton confirmMessage={`"${address.label}" adresi silinsin mi?`} className="text-sm text-red-600 hover:underline">
            Sil
          </ConfirmSubmitButton>
        </form>
      </div>
    </li>
  );
}
