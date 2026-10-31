import { isDisposableEmailDomain } from "disposable-email-domains-js";
import { prisma } from "@/lib/prisma";

// Gecici e-posta engeli (KALP_TOPLA_PLANI.md 5.4, Y4, Y14): npm paketi +
// admin'in BlockedEmailDomain listesi. Alt alan adlari ust alan adiyla eslesir
// ("x.ornekmail.com" -> "ornekmail.com" engelliyse engelli).
export const DISPOSABLE_EMAIL_MESSAGE = "Lütfen kalıcı bir e-posta adresi kullan";

// "a.b.ornek.com" -> ["a.b.ornek.com", "b.ornek.com", "ornek.com"]
export function domainSuffixes(email: string): string[] {
  const domain = email.trim().toLowerCase().split("@").pop() ?? "";
  const parts = domain.split(".").filter(Boolean);
  const out: string[] = [];
  for (let i = 0; i < parts.length - 1; i++) out.push(parts.slice(i).join("."));
  return out;
}

export async function isBlockedEmail(email: string): Promise<boolean> {
  const candidates = domainSuffixes(email);
  if (candidates.length === 0) return false;
  if (candidates.some((d) => isDisposableEmailDomain(d))) return true;
  const blocked = await prisma.blockedEmailDomain.findFirst({
    where: { domain: { in: candidates } },
    select: { id: true }
  });
  return Boolean(blocked);
}
