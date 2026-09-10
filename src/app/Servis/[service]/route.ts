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
// alanlarinin DATA_NS altinda, ALFABETIK sirayla dizilmesi.
//
// DATA_NS iki yanlis tahminden (".../2004/07/UrunServis" ve ".../2004/07/Ticimax")
// sonra Vega'nin KENDI gonderdigi SelectUrunCount istegindeki filtre
// alanlarindan birebir okundu: sonu BOS ("/2004/07/") - yani Ticimax'in
// DataContract siniflari C# tarafinda isimsiz (kok) namespace'te duruyor.
const DATA_NS = "http://schemas.datacontract.org/2004/07/";
const XSI_NS = "http://www.w3.org/2001/XMLSchema-instance";

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

// Etiket adindan sonra bosluk / "/" / ">" bekleniyor - aksi halde <ID> ararken
// <IDBaskaBirSey> gibi etiketler de eslesir. Namespace oneki (orn. <a:ID>)
// opsiyonel olarak kabul ediliyor.
function extractTag(xml: string, tag: string): string | null {
  const match = new RegExp(`<(?:\\w+:)?${tag}(?=[\\s/>])[^>]*>([\\s\\S]*?)</(?:\\w+:)?${tag}>`, "i").exec(xml);
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
    `<SelectKategoriResult xmlns:a="${DATA_NS}" xmlns:i="${XSI_NS}">` +
    items +
    `</SelectKategoriResult>` +
    `</SelectKategoriResponse>`;

  return xmlResponse(soapEnvelope(body));
}

// Vega'nin urun listeleme akisi once SelectUrunCount ile toplam sayiyi, sonra
// SelectUrun ile sayfa sayfa urunleri cekiyor. Filtre alanlarinda -1 "filtre
// yok" demek (bkz. Ticimax dokumantasyonu); Bollmark tarafinda su an sadece
// yayindaki urunler doneceginden filtreler yok sayiliyor.
function publishedProductsWhere() {
  return { status: "PUBLISHED" as const };
}

async function handleSelectUrunCount(rawBody: string) {
  const uyeKodu = extractTag(rawBody, "UyeKodu");
  if (!(await verifyUyeKodu(uyeKodu))) {
    logTcmx("SelectUrunCount yetkisiz", {});
    return xmlResponse(soapFault("UyeKodu hatali."), 500);
  }

  const count = await prisma.product.count({ where: publishedProductsWhere() });
  logTcmx("SelectUrunCount basarili", { count });

  return xmlResponse(
    soapEnvelope(
      `<SelectUrunCountResponse xmlns="http://tempuri.org/">` +
        `<SelectUrunCountResult>${count}</SelectUrunCountResult>` +
        `</SelectUrunCountResponse>`
    )
  );
}

async function handleSelectUrun(rawBody: string) {
  const uyeKodu = extractTag(rawBody, "UyeKodu");
  if (!(await verifyUyeKodu(uyeKodu))) {
    logTcmx("SelectUrun yetkisiz", {});
    return xmlResponse(soapFault("UyeKodu hatali."), 500);
  }

  const startIndex = Number(extractTag(rawBody, "BaslangicIndex") ?? "0") || 0;
  const pageSize = Math.min(500, Number(extractTag(rawBody, "KayitSayisi") ?? "100") || 100);

  const products = await prisma.product.findMany({
    where: publishedProductsWhere(),
    orderBy: { vegaId: "asc" },
    skip: startIndex,
    take: pageSize,
    include: {
      category: true,
      brand: true,
      variants: { include: { options: { include: { value: true } } } }
    }
  });

  logTcmx("SelectUrun basarili", { startIndex, pageSize, donenAdet: products.length });

  // DataContract alanlari ALFABETIK sirada yazilmali (WCF varsayilani) -
  // gonderilmeyen alanlar minOccurs=0 oldugu icin atlanabiliyor, bu yuzden
  // sadece barkod eslestirmesi ve stok/fiyat icin gerekli olanlar donuluyor.
  const items = products
    .map((product) => {
      const totalStock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
      const variants = product.variants
        .map((variant) => {
          const priceCents = variant.priceCents ?? product.priceCents;
          return (
            `<a:Varyasyon>` +
            `<a:Aktif>true</a:Aktif>` +
            `<a:Barkod>${xmlEscape(variant.barcode ?? variant.sku)}</a:Barkod>` +
            `<a:ID>${variant.vegaId}</a:ID>` +
            `<a:KdvDahil>true</a:KdvDahil>` +
            `<a:KdvOrani>10</a:KdvOrani>` +
            `<a:ParaBirimiID>1</a:ParaBirimiID>` +
            `<a:SatisFiyati>${(priceCents / 100).toFixed(2)}</a:SatisFiyati>` +
            `<a:StokAdedi>${variant.stock}</a:StokAdedi>` +
            `<a:StokKodu>${xmlEscape(variant.sku)}</a:StokKodu>` +
            `<a:UrunKartiID>${product.vegaId}</a:UrunKartiID>` +
            `</a:Varyasyon>`
          );
        })
        .join("");

      return (
        `<a:UrunKarti>` +
        `<a:Aciklama>${xmlEscape(product.description)}</a:Aciklama>` +
        `<a:Aktif>true</a:Aktif>` +
        `<a:AnaKategori>${xmlEscape(product.category?.name ?? "")}</a:AnaKategori>` +
        `<a:AnaKategoriID>${product.category?.vegaId ?? 0}</a:AnaKategoriID>` +
        `<a:ID>${product.vegaId}</a:ID>` +
        `<a:Marka>${xmlEscape(product.brand?.name ?? "")}</a:Marka>` +
        `<a:MarkaID>0</a:MarkaID>` +
        `<a:SatisBirimi>Adet</a:SatisBirimi>` +
        `<a:ToplamStokAdedi>${totalStock}</a:ToplamStokAdedi>` +
        `<a:UrunAdi>${xmlEscape(product.name)}</a:UrunAdi>` +
        `<a:Varyasyonlar>${variants}</a:Varyasyonlar>` +
        `</a:UrunKarti>`
      );
    })
    .join("");

  return xmlResponse(
    soapEnvelope(
      `<SelectUrunResponse xmlns="http://tempuri.org/">` +
        `<SelectUrunResult xmlns:a="${DATA_NS}" xmlns:i="${XSI_NS}">` +
        items +
        `</SelectUrunResult>` +
        `</SelectUrunResponse>`
    )
  );
}

// Vega, stok senkronizasyonunda her varyant icin ayri bir VaryasyonGuncelle
// istegi atiyor (canli yakalamayla dogrulanan gercek govde):
//   <urun><Aktif>true</Aktif><ID>28</ID><StokAdedi>0</StokAdedi></urun>
//   <ayar><AktifGuncelle>true</AktifGuncelle><StokAdediGuncelle>true</StokAdediGuncelle></ayar>
// "ayar" bloku hangi alanlarin yazilacagini soyler; sadece bayragi true olan
// alan guncelleniyor. "Aktif" bayragi su an yok sayiliyor - Bollmark'ta
// varyant seviyesinde aktiflik alani yok, urunun tamamini pasife cekmek de
// istenmeyen bir yan etki olurdu.
async function handleVaryasyonGuncelle(rawBody: string) {
  const uyeKodu = extractTag(rawBody, "UyeKodu");
  if (!(await verifyUyeKodu(uyeKodu))) {
    logTcmx("VaryasyonGuncelle yetkisiz", {});
    return xmlResponse(soapFault("UyeKodu hatali."), 500);
  }

  const urunBlock = extractTag(rawBody, "urun") ?? "";
  const ayarBlock = extractTag(rawBody, "ayar") ?? "";

  const vegaId = Number(extractTag(urunBlock, "ID") ?? "0");
  const stokAdedi = Number(extractTag(urunBlock, "StokAdedi") ?? "0");
  const stokGuncellensin = (extractTag(ayarBlock, "StokAdediGuncelle") ?? "").toLowerCase() === "true";

  if (!vegaId || !stokGuncellensin) {
    logTcmx("VaryasyonGuncelle atlandi", { vegaId, stokGuncellensin });
    return xmlResponse(
      soapEnvelope(
        `<VaryasyonGuncelleResponse xmlns="http://tempuri.org/"><VaryasyonGuncelleResult>0</VaryasyonGuncelleResult></VaryasyonGuncelleResponse>`
      )
    );
  }

  const updated = await prisma.productVariant.updateMany({
    where: { vegaId },
    data: { stock: Math.max(0, Math.round(stokAdedi)) }
  });

  logTcmx("VaryasyonGuncelle", { vegaId, stokAdedi, guncellenen: updated.count });

  return xmlResponse(
    soapEnvelope(
      `<VaryasyonGuncelleResponse xmlns="http://tempuri.org/">` +
        `<VaryasyonGuncelleResult>${updated.count > 0 ? vegaId : 0}</VaryasyonGuncelleResult>` +
        `</VaryasyonGuncelleResponse>`
    )
  );
}

type Handler = (rawBody: string) => Promise<NextResponse>;

const methods: Record<string, Handler> = {
  SelectKategori: handleSelectKategori,
  SelectUrunCount: handleSelectUrunCount,
  SelectUrun: handleSelectUrun,
  VaryasyonGuncelle: handleVaryasyonGuncelle
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
    // Henuz uygulanmamis bir metot geldiginde govdeyi de logluyoruz: Vega'nin
    // hangi alanlari nasil gonderdigini (ve DataContract namespace'lerini) tek
    // bir canli denemede gorup uc noktayi ona gore yazabilmek icin. UyeKodu
    // gizleniyor.
    logTcmx("desteklenmeyen metot", {
      service,
      method,
      body: rawBody.replace(/<UyeKodu>[^<]*<\/UyeKodu>/i, "<UyeKodu>***</UyeKodu>").slice(0, 4000)
    });
    return xmlResponse(soapFault(`Desteklenmeyen metot: ${service}/${method ?? "?"}`), 500);
  }

  return handler(rawBody);
}
