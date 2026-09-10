import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Vega'nin panelapi/Account/Token'dan aldigi Bearer token'i uretir/dogrular.
//
// Once bir JWT, sonra VegaIntegration uzerinde "tek aktif token" alani
// denendi - ikisi de canli testte "gecersiz token" hatalarina yol acti.
// Gercek sebep formatla ilgili degildi: tek bir aktif token alani, Claude'un
// dogrulama icin attigi her test giris istegini Vega'nin kendi aldigi
// token'in yerine geciriyordu (her yeni giris bir oncekini gecersiz
// kiliyordu). Artik her giris VegaSession tablosunda kendi bagimsiz satirini
// aliyor, birbirini etkilemiyor (bkz. VEGA_PANELAPI_BULGULARI_VE_PLAN.md).
const VEGA_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

export async function signVegaToken(email: string) {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + VEGA_TOKEN_EXPIRES_IN_SECONDS * 1000);

  await prisma.vegaSession.create({
    data: { token, expiresAt, vegaIntegrationId: "singleton" }
  });

  return { token, expiresIn: VEGA_TOKEN_EXPIRES_IN_SECONDS };
}

export async function verifyVegaToken(
  request: NextRequest
): Promise<{ ok: true; email: string } | { ok: false; status: number; error: string }> {
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(header.trim());
  if (!match) {
    return { ok: false, status: 401, error: "Bearer token eksik." };
  }
  const suppliedToken = match[1].trim();

  const session = await prisma.vegaSession.findUnique({
    where: { token: suppliedToken },
    include: { vegaIntegration: true }
  });

  if (!session || session.expiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Gecersiz veya suresi dolmus token." };
  }

  return { ok: true, email: session.vegaIntegration.email };
}
