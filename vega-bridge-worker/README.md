# Vega koprulu Worker

Bollmark'in ana sitesi (Next.js) Vercel'de calisiyor. Vercel/Next.js, path'inde
tekrarlanan `/` (cift slash) olan istekleri uygulama koduna hic ulastirmadan
kosulsuz olarak 308 redirect'e ceviriyor. Vega SanalMagaza'nin Embarcadero REST
istemcisi ise her zaman `.../panelapi//<endpoint>` seklinde cift slash'li
istek gonderiyor ve bu 308'i takip etmiyor - istek sessizce kayboluyor (bkz.
`../VEGA_PANELAPI_BULGULARI_VE_PLAN.md`).

Bu Cloudflare Worker, Vega'nin bagladigi adres olarak kullanilir. Gelen
istegin path'indeki tekrarlanan slash'leri kendisi duzeltip asil Bollmark
API'sine (`https://bollmark.com/api/vega/panelapi/...`) sunucu-sunucu bir
fetch ile iletir ve cevabi oldugu gibi geri dondurur - Vega hicbir zaman bir
redirect cevabi gormez.

## Vega'da Site Adi

```
https://bollmark-vega-bridge.ozilevent.workers.dev/api/vega
```

(Vega bunun sonuna kendisi `/panelapi/<endpoint>` ekliyor.)

## Yeniden deploy etmek icin

```
cd vega-bridge-worker
npx wrangler deploy
```

Cloudflare hesabina giris gerekiyor (`npx wrangler login`) ya da
`CLOUDFLARE_API_TOKEN` ortam degiskeni (Workers Edit izinli bir token,
dash.cloudflare.com -> My Profile -> API Tokens) ile calistirilabilir.
