import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PREVIEW_COOKIE_MAX_AGE, PREVIEW_COOKIE_NAME, PREVIEW_GATE_PATH } from "@/lib/preview-gate";
import { isPathAllowedForRole } from "@/lib/roles";

// /admin altındaki tüm sayfaları giriş yapmış yönetici ile sınırlar, ayrıca
// PERSONEL rolünün sadece kendisine izinli yollara erişebilmesini sağlar -
// asıl route koruması burada (sayfa içindeki requireAdmin() ikinci katman).
async function guardAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    const signInUrl = new URL("/admin/login", request.url);
    signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
    return NextResponse.redirect(signInUrl);
  }

  const role = typeof token.role === "string" ? token.role : "ADMIN";
  if (!isPathAllowedForRole(role, request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  return NextResponse.next();
}

// Mağaza için şifreli önizleme kapısı.
// - ?preview=DOGRU_SIFRE ile gelinirse 30 günlük cookie bırakıp aynı sayfanın
//   temiz (preview parametresi silinmiş) haline yönlendirir.
// - Geçerli cookie varsa dokunmadan geçirir.
// - Cookie yoksa/yanlışsa mağaza sayfasını yapim-asamasinda sayfasına rewrite eder
//   (adres çubuğundaki URL değişmez, sadece gösterilen içerik değişir).
// - PREVIEW_PASSWORD tanımlı değilse koruma tamamen devre dışı kalır (yanlışlıkla
//   herkesi kilitlememek için).
function guardPreview(request: NextRequest) {
  const previewPassword = process.env.PREVIEW_PASSWORD;
  if (!previewPassword) return NextResponse.next();

  const suppliedPassword = request.nextUrl.searchParams.get("preview");
  if (suppliedPassword && suppliedPassword === previewPassword) {
    const destination = new URL(request.nextUrl);
    destination.searchParams.delete("preview");

    const response = NextResponse.redirect(destination);
    response.cookies.set(PREVIEW_COOKIE_NAME, previewPassword, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: PREVIEW_COOKIE_MAX_AGE,
      path: "/"
    });
    return response;
  }

  const cookiePassword = request.cookies.get(PREVIEW_COOKIE_NAME)?.value;
  if (cookiePassword === previewPassword) return NextResponse.next();

  return NextResponse.rewrite(new URL(PREVIEW_GATE_PATH, request.url));
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Yapim-asamasinda sayfasının kendisi ve /admin/login her zaman erişilebilir.
  if (pathname === PREVIEW_GATE_PATH || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return guardAdmin(request);
  }

  return guardPreview(request);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"]
};
