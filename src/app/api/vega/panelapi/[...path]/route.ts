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

async function handleCategories(request: NextRequest) {
  const auth = await verifyVegaToken(request);
  if (!auth.ok) {
    logVega("GET Categories yetkisiz", { error: auth.error });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const searchParams = request.nextUrl.searchParams;
  const pageIndex = Math.max(1, Math.round(Number(searchParams.get("PageIndex") ?? "1")) || 1);
  const pageSize = Math.min(500, Math.max(1, Math.round(Number(searchParams.get("PageSize") ?? "100")) || 100));

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

  return NextResponse.json({
    data: categories.map((category) => ({
      id: category.id,
      name: category.name,
      parentId: category.parentId
    })),
    totalCount,
    pageIndex,
    pageSize
  });
}

type Handler = (request: NextRequest) => Promise<NextResponse>;

const routes: Record<string, Handler> = {
  "POST Account/Token": handleAccountToken,
  "GET Categories": handleCategories
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
