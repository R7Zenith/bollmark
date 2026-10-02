import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { PREVIEW_COOKIE_MAX_AGE, PREVIEW_COOKIE_NAME, PREVIEW_GATE_PATH } from "@/lib/preview-gate";
import { isPathAllowedForRole } from "@/lib/roles";
import { catalogHref, LEGACY_CATEGORY_SLUGS } from "@/lib/catalog-url";

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
// - Geçerli cookie varsa dokunmadan geçirir. Cookie değeri şifrenin kendisi
//   olduğu için PREVIEW_PASSWORD değişince eski cookie'lerin hepsi geçersiz olur.
// - Cookie yoksa/yanlışsa mağaza sayfasını yapim-asamasinda sayfasına rewrite eder
//   (adres çubuğundaki URL değişmez, sadece gösterilen içerik değişir).
// - PREVIEW_PASSWORD tanımlı değilse koruma tamamen devre dışı kalır (yanlışlıkla
//   herkesi kilitlememek için).
// - PREVIEW_GATE="off" ise kapı hiç çalışmaz, site herkese açık olur (değer yoksa
//   veya "on" ise yukarıdaki davranış geçerli).
function guardPreview(request: NextRequest) {
  if (process.env.PREVIEW_GATE?.trim().toLowerCase() === "off") return NextResponse.next();

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

// Eski katalog adresleri (/urunler?kategori=gomlek&cinsiyet=Erkek) temiz
// yollara 301 ile yonlenir (bkz. SEO_FAZ3_KATEGORI_URL_PLANI.md). Diger
// parametreler (siralama, filtre) korunur. Arama (?ara=) /urunler'de kalir.
function redirectLegacyCatalog(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  if (params.has("ara") || (!params.has("kategori") && !params.has("cinsiyet"))) return null;
  const rawCategory = params.get("kategori") || null;
  const category = rawCategory ? (LEGACY_CATEGORY_SLUGS[rawCategory] ?? rawCategory) : null;
  const destination = new URL(catalogHref({ gender: params.get("cinsiyet"), category }), request.url);
  params.forEach((value, key) => {
    if (key !== "kategori" && key !== "cinsiyet") destination.searchParams.append(key, value);
  });
  return NextResponse.redirect(destination, 301);
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/urunler") {
    const legacyRedirect = redirectLegacyCatalog(request);
    if (legacyRedirect) return legacyRedirect;
  }

  // Yapim-asamasinda sayfasının kendisi, /admin/login, arama motoru
  // dosyaları (robots.txt/sitemap.xml), Google Merchant feed'i ve public/ altındaki statik varlıklar
  // (logo vb.) her zaman erişilebilir - aksi halde önizleme şifresi
  // arkasındaki bir mağazada bu dosyalar da gizlenir ve tarayıcılar/arama
  // motorları hiç erişemez (bkz. Faz C.8), admin login/sidebar logosu da
  // bozuk görünür.
  if (
    pathname === PREVIEW_GATE_PATH ||
    pathname.startsWith("/admin/login") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/feed/google.xml" ||
    /\.(png|jpe?g|svg|webp|ico|gif|woff2?|ttf)$/.test(pathname)
  ) {
    return NextResponse.next();
  }

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    return guardAdmin(request);
  }

  return guardPreview(request);
}

export const config = {
  // "Servis" (buyuk S) haric tutuluyor: Vega'nin Ticimax taklidi SOAP
  // entegrasyonu (bkz. src/app/Servis) gercek Ticimax magazalarinin URL
  // yapisiyla ("www.<domain>/Servis/<Servis>.svc", path yok) birebir
  // eslesmesi icin site kokune yerlestirildi - onizleme sifresi kapisina
  // takilirsa Vega SOAP istegi yerine HTML gate sayfasi alir.
  matcher: ["/((?!api|Servis|_next|favicon.ico).*)"]
};
