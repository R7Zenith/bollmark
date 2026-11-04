export const adminInputClass =
  "w-full rounded-md border border-admin-border px-3 py-2 text-sm focus:border-admin-accent focus:outline-none focus:ring-1 focus:ring-admin-accent";

export interface AddressValues {
  label: string;
  name: string;
  phone: string;
  address: string;
  city: string;
  district: string;
  postalCode: string | null;
}

// Hesabim > Adreslerim ve checkout'taki gibi il/ilce serbest metin (projede secim listesi yok).
export function AddressFields({ values }: { values?: AddressValues }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <input name="label" required defaultValue={values?.label} placeholder="Etiket (Ev, İş...)" className={adminInputClass} />
      <input name="name" required defaultValue={values?.name} placeholder="Alıcı adı soyadı" className={adminInputClass} />
      <input name="phone" required defaultValue={values?.phone} placeholder="Telefon" className={adminInputClass} />
      <input name="postalCode" defaultValue={values?.postalCode ?? ""} placeholder="Posta kodu" className={adminInputClass} />
      <textarea name="address" required defaultValue={values?.address} placeholder="Açık adres" rows={2} className={`sm:col-span-2 ${adminInputClass}`} />
      <input name="city" required defaultValue={values?.city} placeholder="İl" className={adminInputClass} />
      <input name="district" required defaultValue={values?.district} placeholder="İlçe" className={adminInputClass} />
    </div>
  );
}
