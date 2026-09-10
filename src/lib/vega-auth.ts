import { SignJWT, jwtVerify } from "jose";
import type { NextRequest } from "next/server";

// Vega'nin panelapi/Account/Token'dan aldigi bearer token'i uretir/dogrular.
// Ayri bir sir gerektirmesin diye NextAuth'un zaten tanimli NEXTAUTH_SECRET'i
// paylasilir; "scope" alani bu token'i NextAuth session JWT'sinden ayirt eder.
const VEGA_TOKEN_SCOPE = "vega-panelapi";
// Vega bir kez giris yapip token'i program acik kaldigi surece tekrar
// yenilemeden kullaniyor gibi gorunuyor (otomatik re-login yok) - kisa
// bir sure (orn. 1 saat) "Gecersiz veya suresi dolmus token." hatasina
// yol acip Vega'nin (kod tarafinda bir sorun yokken) calismayi kesmesine
// sebep oldu. Bu bir kullanici oturumu degil, sunucu-sunucu entegrasyon
// kimlik bilgisi oldugu icin uzun omurlu tutuluyor.
const VEGA_TOKEN_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 30;

function getSecretKey() {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET tanimli degil.");
  return new TextEncoder().encode(secret);
}

export async function signVegaToken(email: string) {
  const token = await new SignJWT({ email, scope: VEGA_TOKEN_SCOPE })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${VEGA_TOKEN_EXPIRES_IN_SECONDS}s`)
    .sign(getSecretKey());
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

  try {
    const { payload } = await jwtVerify(match[1], getSecretKey());
    if (payload.scope !== VEGA_TOKEN_SCOPE || typeof payload.email !== "string") {
      return { ok: false, status: 401, error: "Gecersiz token." };
    }
    return { ok: true, email: payload.email };
  } catch {
    return { ok: false, status: 401, error: "Gecersiz veya suresi dolmus token." };
  }
}
