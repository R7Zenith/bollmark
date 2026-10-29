import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { CONSENT_TEXTS } from "@/lib/kalp-topla/consent-texts";
import { savePreferences } from "./actions";

export default async function HesapTercihlerPage({ searchParams }: { searchParams: Promise<{ kaydedildi?: string }> }) {
  const session = await requireCustomer();
  const { kaydedildi } = await searchParams;
  const customer = await prisma.customer.findUnique({
    where: { id: session.user!.id! },
    select: { phone: true, marketingEmailAt: true, marketingWhatsappAt: true }
  });

  return (
    <div>
      <h2 className="font-display text-xl">İletişim Tercihleri</h2>
      {kaydedildi && <p className="mt-4 text-sm text-green-700">Tercihlerin kaydedildi.</p>}

      <form action={savePreferences} className="mt-6 max-w-[480px] space-y-6">
        <div className="space-y-2">
          <label htmlFor="tercih-phone" className="text-[10px] font-medium uppercase tracking-[1px] text-ink">
            Telefon (opsiyonel)
          </label>
          <input
            id="tercih-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            defaultValue={customer?.phone ?? ""}
            className="h-12 w-full rounded-lg border border-line bg-transparent px-4 text-xs"
          />
        </div>
        <label className="flex items-start gap-3 text-sm text-ink/80">
          <input
            type="checkbox"
            name="marketingEmail"
            defaultChecked={Boolean(customer?.marketingEmailAt)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          {CONSENT_TEXTS.EMAIL.text}
        </label>
        <label className="flex items-start gap-3 text-sm text-ink/80">
          <input
            type="checkbox"
            name="marketingWhatsapp"
            defaultChecked={Boolean(customer?.marketingWhatsappAt)}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            {CONSENT_TEXTS.WHATSAPP.text}
            <span className="block text-xs text-ink/50">WhatsApp bildirimleri yakında başlayacak.</span>
          </span>
        </label>
        <button className="rounded-full bg-ink px-6 py-4 text-[10px] uppercase tracking-[1px] text-white hover:bg-ink/90">
          Kaydet
        </button>
      </form>
    </div>
  );
}
