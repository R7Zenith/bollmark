import { randomBytes } from "crypto";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

// Vega'nin panelapi/Account/Token'dan aldigi bearer token'i uretir/dogrular.
//
// Once JWT kullanilmisti, ama canli testte taze uretilmis bir JWT (197
// karakter) dogrudan test edildiginde sorunsuzken, Vega'nin sakladigi/geri
// gonderdigi ayni token birkac dakika icinde "gecersiz" cevabi almaya
// basladi - Vega'nin (Delphi tabanli, muhtemelen sabit uzunlukta bir
// alanda tutulan) token'i saklarken/tekrar gonderirken kirptigi supheleniliyor.
// Bu yuzden kisa (32 karakter), opak, rastgele bir token'a gecildi; token +
// son gecerlilik zamani VegaIntegration singleton satirinda saklanip Bearer
// dogrulamasinda karsilastiriliyor (bkz. VEGA_PANELAPI_BULGULARI_VE_PLAN.md).
const VEGA_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

export async function signVegaToken(email: string) {
  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + VEGA_TOKEN_EXPIRES_IN_SECONDS * 1000);

  await prisma.vegaIntegration.update({
    where: { id: "singleton" },
    data: { activeToken: token, activeTokenExpiresAt: expiresAt }
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

  const integration = await prisma.vegaIntegration.findUnique({ where: { id: "singleton" } });
  if (!integration?.activeToken || integration.activeToken !== suppliedToken) {
    return { ok: false, status: 401, error: "Gecersiz veya suresi dolmus token." };
  }
  if (!integration.activeTokenExpiresAt || integration.activeTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, status: 401, error: "Gecersiz veya suresi dolmus token." };
  }

  return { ok: true, email: integration.email };
}
