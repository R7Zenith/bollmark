import { createHash, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { getSiteUrl } from "@/lib/site-url";

// E-posta dogrulama (KALP_TOPLA_PLANI.md 5.4): 32 bayt token, DB'de yalniz
// SHA-256 ozeti, 24 saat gecerli, tek kullanimlik. Ayni uyeye 10 dakikada en
// cok bir e-posta gider.
const TOKEN_HOURS = 24;
const RESEND_MINUTES = 10;

export function hashVerificationToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Kayitta giden genel dogrulama e-postasi (Faz 3 karari: kampanyadan bahsetmez).
// "KALP": dogrulanmamis uye kalp verince giden surum (plan 7.4).
export async function sendVerificationEmail(
  customer: {
    id: string;
    email: string;
    name: string;
  },
  purpose: "KAYIT" | "KALP" = "KAYIT"
): Promise<"sent" | "throttled"> {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { customerId: customer.id, createdAt: { gt: new Date(Date.now() - RESEND_MINUTES * 60 * 1000) } },
    select: { id: true }
  });
  if (recent) return "throttled";

  const token = randomBytes(32).toString("base64url");
  await prisma.emailVerificationToken.create({
    data: {
      customerId: customer.id,
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(Date.now() + TOKEN_HOURS * 60 * 60 * 1000)
    }
  });

  const url = `${getSiteUrl()}/hesap/dogrula?token=${token}`;
  await sendMail({
    to: customer.email,
    subject: purpose === "KALP" ? "Bollmark: e-postanı doğrula, kalbin sayılsın ❤️" : "Bollmark: e-posta adresini doğrula",
    html:
      `<p>Merhaba ${escapeHtml(customer.name)},</p>` +
      (purpose === "KALP"
        ? `<p>Verdiğin kalbin bara sayılması için e-posta adresini doğrula:</p>`
        : `<p>Bollmark hesabını oluşturduğun için teşekkürler. E-posta adresini doğrulamak için aşağıdaki bağlantıya tıkla:</p>`) +
      `<p><a href="${url}">E-postamı doğrula</a></p>` +
      `<p>Bağlantı ${TOKEN_HOURS} saat geçerlidir. Bu hesabı sen oluşturmadıysan bu e-postayı dikkate alma.</p>`
  });
  return "sent";
}

export type VerifyResult = "verified" | "already" | "expired" | "invalid";

export async function verifyEmailToken(token: string): Promise<{ result: VerifyResult; customerId?: string }> {
  if (!token) return { result: "invalid" };
  const row = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashVerificationToken(token) } });
  if (!row) return { result: "invalid" };
  if (row.usedAt) return { result: "already", customerId: row.customerId };
  if (row.expiresAt < new Date()) return { result: "expired", customerId: row.customerId };

  const now = new Date();
  const used = await prisma.$transaction(async (tx) => {
    // Kosullu guncelleme: ayni token'la es zamanli iki istekten yalniz biri kullanir.
    const claim = await tx.emailVerificationToken.updateMany({ where: { id: row.id, usedAt: null }, data: { usedAt: now } });
    if (claim.count === 0) return false;
    await tx.customer.updateMany({ where: { id: row.customerId, emailVerifiedAt: null }, data: { emailVerifiedAt: now } });
    return true;
  });
  return { result: used ? "verified" : "already", customerId: row.customerId };
}
