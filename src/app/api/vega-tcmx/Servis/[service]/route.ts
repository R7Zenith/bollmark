import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Vega'nin "Site Tipi: Ticimax" secenegi, kullanicinin girdigi "Site Adi"
// degerinin sonuna kendisi "/Servis/<Servis>.svc" ekleyip, Ticimax'in GERCEK
// (SOAP/WCF) web servis protokolunu konusuyor - bizim JSON "panelapi"
// taklidimizden (src/app/api/vega/panelapi) tamamen ayri, Ticimax'in resmi
// dokumantasyonuna (static.ticimax.com/dokumanlar/webservis.pdf) ve gercek
// bir Ticimax magazasindan (lorisparfum.com) uretilmis acik kaynak PHP SOAP
// istemcisine (github.com/asilbalaban/ticimax-wsdl-php) dayanarak uygulandi.
// Bkz. VEGA_PANELAPI_BULGULARI_VE_PLAN.md - "Ticimax taklidi" bolumu.
//
// Vega'nin webhook.site ile yakalanan gercek istegi:
//   POST {SiteAdi}/Servis/UrunServis.svc
//   SOAPAction: http://tempuri.org/IUrunServis/SelectKategori
//   User-Agent: Embarcadero SOAP 1.4 (Delphi istemcisi)
//   <SelectKategori xmlns="http://tempuri.org/">
//     <UyeKodu>...</UyeKodu><kategoriID>0</kategoriID><dil>tr</dil>
//   </SelectKategori>
//
// SOAPAction'daki "http://tempuri.org/IUrunServis/..." kalibi klasik bir WCF
// servisinin (ozellestirilmemis) varsayilan namespace'idir - bu yuzden
// cevaplar da WCF'in varsayilan uretim kurallarina gore olusturuluyor:
// "<MetotResponse><MetotResult>..." sarmalama ve DataContract sinif
// alanlarinin "http://schemas.datacontract.org/2004/07/<CLR namespace>"
// altinda, ALFABETIK sirayla dizilmesi. CLR namespace'i kesin bilinmiyor
// (Ticimax'in kapali kaynak sunucu kodu), servis dosyasinin adindan
// ("UrunServis.svc") "UrunServis" olarak tahmin edildi - canli testte
// yanlissa Vega'nin davranisindan (bos liste / parse hatasi) anlasilip
// duzeltilecek.

function logTcmx(label: string, detail: Record<string, unknown>) {
  console.log(`[vega-tcmx] ${label}`, JSON.stringify(detail));
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(xml);
  return match ? match[1].trim() : null;
}

function soapEnvelope(body: string) {
  return (
    `<?xml version="1.0" encoding="utf-8"?>` +
    `<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>${body}</s:Body></s:Envelope>`
  );
}

function soapFault(message: string) {
  return soapEnvelope(
    `<s:Fault><faultcode>s:Server</faultcode><faultstring xml:lang="tr-TR">${xmlEscape(message)}</faultstring></s:Fault>`
  );
}

function xmlResponse(xml: string, status = 200) {
  return new NextResponse(xml, {
    status,
    headers: { "Content-Type": "text/xml; charset=utf-8" }
  });
}

// SOAPAction header'i "http://tempuri.org/IUrunServis/SelectKategori" gibi
// gelir - son "/" sonrasi gercek metot adidir. Bulunamazsa govdedeki ilk
// Body cocugunun etiket adina dusuluyor (Vega hep SOAPAction gonderdigi
// icin bu sadece bir guvenlik agi).
function extractMethodName(request: NextRequest, rawBody: string): string | null {
  const action = (request.headers.get("soapaction") ?? "").trim().replace(/^"|"$/g, "");
  const bySoapAction = /\/([A-Za-z0-9_]+)$/.exec(action);
  if (bySoapAction) return bySoapAction[1];

  const byBody = /<(?:[a-zA-Z0-9]+:)?Body[^>]*>\s*<(?:[a-zA-Z0-9]+:)?([A-Za-z0-9_]+)/i.exec(rawBody);
  return byBody ? byBody[1] : null;
}

async function verifyUyeKodu(uyeKodu: string | null): Promise<boolean> {
  if (!uyeKodu) return false;
  const integration = await prisma.vegaIntegration.findUnique({ where: { id: "singleton" } });
  return Boolean(integration?.ticimaxUyeKodu) && integration!.ticimaxUyeKodu === uyeKodu;
}

async function handleSelectKategori(rawBody: string) {
  const uyeKodu = extractTag(rawBody, "UyeKodu");
  const kategoriIdRaw = extractTag(rawBody, "kategoriID");
  const kategoriId = kategoriIdRaw ? Number(kategoriIdRaw) : 0;

  if (!(await verifyUyeKodu(uyeKodu))) {
    logTcmx("SelectKategori yetkisiz", { kategoriId });
    return xmlResponse(soapFault("UyeKodu hatali."), 500);
  }

  // PID (ust kategori) icin cuid -> vegaId eslemesi gerektigi icin, filtreden
  // bagimsiz olarak TUM kategoriler once kucuk bir haritaya cekiliyor.
  const allCategories = await prisma.category.findMany({
    select: { id: true, vegaId: true, parentId: true, name: true, slug: true, sortOrder: true, isActive: true }
  });
  const vegaIdById = new Map(allCategories.map((c) => [c.id, c.vegaId]));

  const selected =
    kategoriId > 0
      ? allCategories.filter((c) => c.vegaId === kategoriId)
      : allCategories.filter((c) => c.isActive);

  logTcmx("SelectKategori basarili", { kategoriId, donenAdet: selected.length });

  const items = selected
    .map((category) => {
      const pid = category.parentId ? (vegaIdById.get(category.parentId) ?? 0) : 0;
      return (
        `<a:Kategori>` +
        `<a:Aktif>${category.isActive ? "true" : "false"}</a:Aktif>` +
        `<a:ID>${category.vegaId}</a:ID>` +
        `<a:Icerik i:nil="true"/>` +
        `<a:KategoriMenuGoster>true</a:KategoriMenuGoster>` +
        `<a:Kod>${xmlEscape(category.slug)}</a:Kod>` +
        `<a:PID>${pid}</a:PID>` +
        `<a:SeoAnahtarKelime i:nil="true"/>` +
        `<a:SeoSayfaAciklama i:nil="true"/>` +
        `<a:SeoSayfaBaslik i:nil="true"/>` +
        `<a:Sira>${category.sortOrder}</a:Sira>` +
        `<a:Tanim>${xmlEscape(category.name)}</a:Tanim>` +
        `<a:Url i:nil="true"/>` +
        `</a:Kategori>`
      );
    })
    .join("");

  const body =
    `<SelectKategoriResponse xmlns="http://tempuri.org/">` +
    `<SelectKategoriResult xmlns:a="http://schemas.datacontract.org/2004/07/UrunServis" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">` +
    items +
    `</SelectKategoriResult>` +
    `</SelectKategoriResponse>`;

  return xmlResponse(soapEnvelope(body));
}

type Handler = (rawBody: string) => Promise<NextResponse>;

const methods: Record<string, Handler> = {
  SelectKategori: handleSelectKategori
};

export async function POST(request: NextRequest, context: { params: Promise<{ service: string }> }) {
  const { service } = await context.params;
  const rawBody = await request.text();
  const method = extractMethodName(request, rawBody);

  logTcmx("istek alindi", {
    service,
    method,
    soapAction: request.headers.get("soapaction"),
    contentLength: rawBody.length
  });

  const handler = method ? methods[method] : undefined;
  if (!handler) {
    logTcmx("desteklenmeyen metot", { service, method });
    return xmlResponse(soapFault(`Desteklenmeyen metot: ${service}/${method ?? "?"}`), 500);
  }

  return handler(rawBody);
}
