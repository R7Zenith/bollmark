"use client";

import { useState } from "react";

const inputClass = "rounded-lg border border-line px-3 py-2 text-sm focus:border-ink focus:outline-none";
const actionLinkClass = "text-[10px] uppercase tracking-[1px] underline text-ink/60 hover:text-ink";

export interface HesapAddress {
  id: string;
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  postalCode: string | null;
  isDefault: boolean;
}

export function HesapAddressRow({
  address,
  updateAction,
  deleteAction,
  setDefaultAction
}: {
  address: HesapAddress;
  updateAction: (formData: FormData) => void;
  deleteAction: (formData: FormData) => void;
  setDefaultAction: (formData: FormData) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <li className="p-4">
        <form action={updateAction} className="grid grid-cols-2 gap-2" onSubmit={() => setEditing(false)}>
          <input name="label" defaultValue={address.label} required placeholder="Etiket (Ev, İş...)" className={inputClass} />
          <input name="name" defaultValue={address.name} required placeholder="Ad Soyad" className={inputClass} />
          <input name="phone" defaultValue={address.phone} required placeholder="Telefon" className={inputClass} />
          <input name="postalCode" defaultValue={address.postalCode ?? ""} placeholder="Posta Kodu" className={inputClass} />
          <input name="address" defaultValue={address.address} required placeholder="Adres" className={`col-span-2 ${inputClass}`} />
          <input name="city" defaultValue={address.city} required placeholder="İl" className={inputClass} />
          <input name="district" defaultValue={address.district} required placeholder="İlçe" className={inputClass} />
          <div className="col-span-2 flex justify-end gap-4">
            <button type="button" onClick={() => setEditing(false)} className={actionLinkClass}>
              Vazgeç
            </button>
            <button type="submit" className={actionLinkClass}>
              Kaydet
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex items-center justify-between p-4 text-sm">
      <div>
        <p className="font-medium">
          {address.label} {address.isDefault && <span className="ml-2 text-xs text-clay">(Varsayılan)</span>}
        </p>
        <p className="text-ink/70">{address.name} · {address.phone}</p>
        <p className="text-ink/50">
          {address.address}, {address.district} / {address.city} {address.postalCode}
        </p>
      </div>
      <div className="flex items-center gap-4">
        {!address.isDefault && (
          <form action={setDefaultAction}>
            <button type="submit" className={actionLinkClass}>
              Varsayılan Yap
            </button>
          </form>
        )}
        <button type="button" onClick={() => setEditing(true)} className={actionLinkClass}>
          Düzenle
        </button>
        <form
          action={deleteAction}
          onSubmit={(e) => {
            if (!window.confirm("Bu adres silinsin mi?")) e.preventDefault();
          }}
        >
          <button type="submit" className={actionLinkClass}>
            Sil
          </button>
        </form>
      </div>
    </li>
  );
}
