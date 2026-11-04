import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireCustomer } from "@/lib/require-customer";
import { HesapNav } from "@/components/hesap-nav";
import { resendVerificationFromWaiting } from "../(auth)/dogrulama-bekleniyor/actions";

export default async function HesapLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCustomer();
  const customerId = session.user!.id!;
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, select: { name: true, emailVerifiedAt: true } });

  return (
    <div className="mx-auto max-w-[1600px] px-9 py-16">
      {customer && !customer.emailVerifiedAt && (
        <form
          action={resendVerificationFromWaiting}
          className="mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-ink/20 bg-ink/[0.03] px-4 py-3 text-xs text-ink"
        >
          <input type="hidden" name="devam" value="/hesap" />
          <span>E-posta adresin henüz doğrulanmadı.</span>
          <button className="-my-3 py-3 text-[10px] uppercase tracking-[1px] underline hover:text-ink/60">Tekrar gönder</button>
        </form>
      )}
      <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[1px] text-ink/50">
        <Link href="/" className="hover:text-ink">
          Ana Sayfa
        </Link>
        <span>/</span>
        <span className="text-ink">Hesabım</span>
      </nav>

      <h1 className="mt-4 font-display text-[47px] leading-[47px] tracking-[-1.88px]">Merhaba, {customer?.name}!</h1>

      <div className="mt-10 flex flex-col lg:flex-row gap-0">
        <div className="w-full lg:w-[320px] border border-line">
          <HesapNav />
        </div>
        <div className="flex-1 border border-line lg:border-l-0 p-8 lg:p-12 lg:px-16">{children}</div>
      </div>
    </div>
  );
}
