import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signVegaToken, verifyVegaToken } from "@/lib/vega-auth";

// Vega SanalMagaza programi "Site Adi" ayarinin sonuna kendisi bir "/" ekleyip
// "panelapi/" ile birlestirdigi icin gercek istekler "panelapi//Account/Token"
// gibi CIFT slash ile gelir. Tek bir catch-all route ([...path]) kullanip
// gelen segmentlerdeki bos parcalari (cift slash'in urettigi) elle filtreleyerek
// bu farkli yazimlarin hepsini ayni handler'a yonlendiriyoruz (bkz.
// VEGA_PANELAPI_BULGULARI_VE_PLAN.md).
function normalizePanelApiPath(segments: string[]) {
  return segments.filter((segment) => segment.length > 0).join("/");
}

function logVega(label: string, detail: Record<string, unknown>) {
  console.log(`[vega-panelapi] ${label}`, JSON.stringify(detail));
}

// Authorization header'inin ve parola gibi alanlarin gercek degerini loglamadan
// varligini/bicimini gorebilmek icin.
function redactBody(body: unknown) {
  if (!body || typeof body !== "object") return body;
  const clone: Record<string, unknown> = { ...(body as Record<string, unknown>) };
  if ("password" in clone) clone.password = "***";
  return clone;
}

async function readJsonBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

const tokenBodySchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1)
});

async function handleAccountToken(request: NextRequest) {
  const body = await readJsonBody(request);
  logVega("POST Account/Token istegi", { body: redactBody(body) });

  const parsed = tokenBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "email ve password alanlari gerekli." }, { status: 400 });
  }

  const integration = await prisma.vegaIntegration.findUnique({ where: { id: "singleton" } });
  const emailMatches = Boolean(
    integration?.email && integration.email.toLowerCase() === parsed.data.email.toLowerCase()
  );
  const passwordMatches = integration?.passwordHash
    ? await bcrypt.compare(parsed.data.password, integration.passwordHash)
    : false;

  if (!integration?.email || !emailMatches || !passwordMatches) {
    logVega("POST Account/Token basarisiz", { girilenEmail: parsed.data.email });
    return NextResponse.json({ error: "E-posta veya parola hatali." }, { status: 401 });
  }

  const { token, expiresIn } = await signVegaToken(integration.email);
  logVega("POST Account/Token basarili", { email: integration.email });

  // Vega'nin cevaptaki token'i hangi JSON alanindan okudugu bilinmiyor, bu
  // yuzden en olasi birkac alan adiyla ayni deger tekrarlanip ilk canli
  // testte hangisinin isledigi gozlemlenecek.
  return NextResponse.json({
    token,
    accessToken: token,
    access_token: token,
    tokenType: "Bearer",
    expiresIn
  });
}

function parsePageParams(searchParams: URLSearchParams) {
  const pageIndex = Math.max(1, Math.round(Number(searchParams.get("PageIndex") ?? "1")) || 1);
  const pageSize = Math.min(500, Math.max(1, Math.round(Number(searchParams.get("PageSize") ?? "100")) || 100));
  return { pageIndex, pageSize };
}

// Vega'nin sayfalama zarfinda tam olarak hangi alan adlarini okudugu canli
// testlerle adim adim ortaya cikti: once "TotalPageSize", sonra "Count"
// (PascalCase - "PageIndex"/"PageSize" sorgu parametreleriyle ve
// "OrderDateMin" gibi diger alan adlariyla tutarli). "TotalPageSize"
// isminin aksine Vega bunu KAYIT SAYISI degil TOPLAM SAYFA SAYISI olarak
// okuyor - ilk denemede kayit sayisi (40) konulunca Vega 40 sayfa oldugunu
// sanip PageIndex=2..40'i de (hepsi bos) cekip kategori agacini bos
// birakti (bkz. VEGA_PANELAPI_BULGULARI_VE_PLAN.md).
function paginatedResponse(items: Record<string, unknown>[], pageIndex: number, pageSize: number, totalCount: number) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  return {
    data: items,
    Data: items,
    totalCount,
    TotalCount: totalCount,
    Count: totalCount,
    TotalPageSize: totalPages,
    TotalPages: totalPages,
    pageIndex,
    PageIndex: pageIndex,
    pageSize,
    PageSize: pageSize
  };
}

async function handleCategories(request: NextRequest) {
  const auth = await verifyVegaToken(request);
  if (!auth.ok) {
    logVega("GET Categories yetkisiz", { error: auth.error });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { pageIndex, pageSize } = parsePageParams(request.nextUrl.searchParams);

  const [totalCount, categories] = await Promise.all([
    prisma.category.count({ where: { isActive: true } }),
    prisma.category.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      skip: (pageIndex - 1) * pageSize,
      take: pageSize
    })
  ]);

  logVega("GET Categories istegi", {
    email: auth.email,
    pageIndex,
    pageSize,
    donenAdet: categories.length,
    totalCount
  });

  const items = categories.map((category) => ({
    id: category.id,
    Id: category.id,
    name: category.name,
    Name: category.name,
    parentId: category.parentId,
    ParentId: category.parentId
  }));

  return NextResponse.json(paginatedResponse(items, pageIndex, pageSize, totalCount));
}

// Vega, Kategori Secimi'nden sonra kendiliginden siparis senkronizasyonu
// icin bu uc noktayi da cagiriyor (OrderDateMin/OrderDateMax araligiyla).
// Siparis eslestirmesi henuz tasarlanmadi (Vega'nin beklidigi siparis JSON
// semasi bilinmiyor) - simdilik bos ama gecerli bir sayfali cevap donup
// Vega'nin bu adimda hata almadan devam edebilmesi saglaniyor.
async function handleSalesOrder(request: NextRequest) {
  const auth = await verifyVegaToken(request);
  if (!auth.ok) {
    logVega("GET SalesOrder yetkisiz", { error: auth.error });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { pageIndex, pageSize } = parsePageParams(request.nextUrl.searchParams);
  logVega("GET SalesOrder istegi (henuz uygulanmadi, bos donuyor)", {
    email: auth.email,
    orderDateMin: request.nextUrl.searchParams.get("OrderDateMin"),
    orderDateMax: request.nextUrl.searchParams.get("OrderDateMax"),
    pageIndex,
    pageSize
  });

  return NextResponse.json(paginatedResponse([], pageIndex, pageSize, 0));
}

type Handler = (request: NextRequest) => Promise<NextResponse>;

const routes: Record<string, Handler> = {
  "POST Account/Token": handleAccountToken,
  "GET Categories": handleCategories,
  "GET SalesOrder": handleSalesOrder
};

async function dispatch(request: NextRequest, path: string[]) {
  const cleanPath = normalizePanelApiPath(path);
  const routeKey = `${request.method} ${cleanPath}`;

  logVega("istek alindi", {
    method: request.method,
    rawPath: path,
    normalizedPath: cleanPath,
    query: Object.fromEntries(request.nextUrl.searchParams),
    hasAuthorizationHeader: request.headers.has("authorization")
  });

  const handler = routes[routeKey];
  if (!handler) {
    logVega("desteklenmeyen endpoint", { routeKey });
    return NextResponse.json({ error: `Desteklenmeyen endpoint: ${routeKey}` }, { status: 404 });
  }

  return handler(request);
}

type RouteContext = { params: Promise<{ path: string[] }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return dispatch(request, path);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = await context.params;
  return dispatch(request, path);
}
