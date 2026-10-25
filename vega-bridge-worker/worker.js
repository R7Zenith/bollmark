// Vega SanalMagaza'nin "Site Adi" ayarina bu Worker'in adresi yaziliyor.
//
// Neden var: Vega'nin Embarcadero REST istemcisi her zaman
// ".../panelapi//<endpoint>" seklinde CIFT slash'li bir path gonderiyor
// (kendi sabit "panelapi/" + "/<endpoint>" birlestirmesinden kaynaklaniyor,
// Site Adi'ndan bagimsiz). Next.js'in kendi cekirdek sunucusu (ve Vercel'in
// edge katmani) boyle bir path'i uygulama koduna hic ulastirmadan kosulsuz
// 308 redirect'e ceviriyor; Vega bu redirect'i takip etmiyor, istek sessizce
// kayboluyor (bkz. VEGA_PANELAPI_BULGULARI_VE_PLAN.md).
//
// Cloudflare Workers bu normalizasyonu yapmiyor (webhook.site testinde de
// dogrulandi), bu yuzden istegi burada, path'i kendimiz tek slash'e
// indirgeyip, asil Bollmark API'sine sunucu-sunucu bir fetch ile iletip
// cevabi oldugu gibi geri donuyoruz - Vega hicbir zaman bir redirect
// cevabi gormuyor.
//
// Ikinci bir kullanim alani daha eklendi: Vega'nin "TiciMax" (SOAP)
// entegrasyonunda cift slash sorunu yok, ama Vega'nin eski Embarcadero SOAP
// istemcisi Vercel'in TLS sertifikasi/sifreleme paketiyle anlasamiyor gibi
// gorunuyor - webhook.site'a (Cloudflare) sorunsuz HTTPS istegi atarken
// bollmark.com'a (Vercel) hic ulasamiyor (istek sessizce kayboluyor, Vercel
// loglarinda hicbir iz yok). Cloudflare'in eski istemcilerle genis TLS
// uyumlulugundan faydalanmak icin /Servis/... yolu da bu Worker uzerinden
// (ayni sunucu-sunucu fetch deseniyle) Bollmark'a yonlendiriliyor.
const ORIGIN = "https://bollmark.com";
const ALLOWED_PREFIXES = ["/api/vega/panelapi/", "/Servis/"];

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const normalizedPath = url.pathname.replace(/\/{2,}/g, "/");

    if (!ALLOWED_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))) {
      return new Response("Not found", { status: 404 });
    }

    const target = ORIGIN + normalizedPath + url.search;

    const headers = new Headers(request.headers);
    headers.delete("host");

    const init = { method: request.method, headers };
    if (request.method !== "GET" && request.method !== "HEAD") {
      init.body = await request.text();
    }

    return fetch(target, init);
  }
};
