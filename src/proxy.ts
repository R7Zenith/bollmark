import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PREVIEW_COOKIE_MAX_AGE, PREVIEW_COOKIE_NAME, PREVIEW_GATE_PATH } from "@/lib/preview-gate";

// /admin altindaki tum sayfalari giris yapmis yonetici ile sinirlar.
// /admin/login sayfasi proxy() icinde ayrica ele alinir, buraya girmez.
async function guardAdmin(request: NextRequest) {
  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  if (token) return NextResponse.next();

  const signInUrl = new URL("/admin/login", request.url);
  signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
  return NextResponse.redirect(signInUrl);
}

// Magaza icin sifreli onizleme kapisi.
// - ?preview=DOGRU_SIFRE ile gelinirse 30 gunluk cookie birakip ayni sayfanin
//   temiz (preview parametresi silinmis) haline yonlendirir.
// - Gecerli cookie varsa dokunmadan gecirir.
// - Cookie yoksa/yanlissa magaza sayfasini yapim-asamasinda sayfasina rewrite eder
//   (adres cubugundaki URL degismez, sadece gosterilen icerik degisir).
// - PREVIEW_PASSWORD tanimli degilse koruma tamamen devre disi kalir (yanlislikla
//   herkesi kilitlememek icin).
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

  // Yapim-asamasinda sayfasinin kendisi ve /admin/login her zaman erisilebilir.
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
