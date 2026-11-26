// Meta ürün akışını (feed/meta.xml) yalnız OKUR. Veritabanına hiç dokunmaz.
// Önce yerel geliştirme sunucusu, çalışmıyorsa canlı site denenir.
// Akıştaki her <item> bir varyanttır (renk + beden); video birimi "ürün kodu + renk".

const KAYNAKLAR = ["http://localhost:3000/feed/meta.xml", "https://bollmark.com/feed/meta.xml"];

const ENTITY = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITY[m]);

function alan(item, ad) {
  const m = item.match(new RegExp(`<${ad}>([\\s\\S]*?)</${ad}>`));
  return m ? decode(m[1]).trim() : "";
}
function alanlar(item, ad) {
  return [...item.matchAll(new RegExp(`<${ad}>([\\s\\S]*?)</${ad}>`, "g"))].map((m) => decode(m[1]).trim());
}
// "590.00 TRY" -> 590
const tl = (s) => (s ? Number(s.replace(/[^0-9.]/g, "")) : null);

export async function akisiGetir() {
  for (const url of KAYNAKLAR) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(url.includes("localhost") ? 8000 : 60000) });
      if (!r.ok) continue;
      const xml = await r.text();
      if (!xml.includes("<item>")) continue;
      return { url, xml, zaman: new Date().toISOString() };
    } catch {
      /* sıradaki kaynak */
    }
  }
  throw new Error("Ürün akışı okunamadı (localhost:3000 ve bollmark.com denendi).");
}

const trUst = (s) => s.toLocaleUpperCase("tr-TR");

// Başlık = "<Marka> <ad> <Renk> <Beden>" (bkz. src/lib/merchant-feed.ts). Renk/beden
// sondan, marka baştan atılır: videoda ürün adı marka adı olmadan yazılır.
function sadeAd(title, marka, renk, beden) {
  let t = title.trim();
  for (const parca of [beden, renk]) {
    if (!parca) continue;
    if (trUst(t).endsWith(" " + trUst(parca))) t = t.slice(0, t.length - parca.length - 1).trim();
  }
  if (marka && trUst(t).startsWith(trUst(marka) + " ")) t = t.slice(marka.length + 1).trim();
  return t;
}

export function akisiCoz(xml) {
  const itemler = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const urunler = new Map(); // "KOD|RENK" -> ürün
  itemler.forEach((it, sira) => {
    const kod = alan(it, "g:item_group_id");
    const renk = alan(it, "g:color");
    const beden = alan(it, "g:size");
    const marka = alan(it, "g:brand");
    const anahtar = `${kod}|${renk}`;
    const fiyat = tl(alan(it, "g:sale_price")) ?? tl(alan(it, "g:price"));
    const stokta = alan(it, "g:availability") === "in stock";
    let u = urunler.get(anahtar);
    if (!u) {
      const yol = alan(it, "g:product_type").split(">").map((s) => s.trim());
      u = {
        kod,
        renk,
        ad: sadeAd(alan(it, "title"), marka, renk, beden),
        marka,
        kategori: yol[yol.length - 1] ?? "",
        kategoriYolu: yol.join(" > "),
        anaGrup: yol[0] ?? "",
        cinsiyet: alan(it, "g:gender"),
        yasGrubu: alan(it, "g:age_group"),
        sezon: alan(it, "g:custom_label_1"),
        link: alan(it, "link"),
        gorseller: [alan(it, "g:image_link"), ...alanlar(it, "g:additional_image_link")].filter(Boolean),
        sira, // akış en yeniden eskiye sıralı (createdAt desc): küçük sıra = yeni ürün
        varyantlar: []
      };
      urunler.set(anahtar, u);
    }
    u.varyantlar.push({ sku: alan(it, "g:id"), beden, stokta, fiyat });
  });

  for (const u of urunler.values()) {
    const stoktakiler = u.varyantlar.filter((v) => v.stokta);
    u.stoktaBedenler = [...new Set(stoktakiler.map((v) => v.beden))];
    u.stokta = stoktakiler.length > 0;
    const fiyatlar = [...new Set((stoktakiler.length ? stoktakiler : u.varyantlar).map((v) => v.fiyat))];
    u.fiyat = Math.min(...fiyatlar);
    u.fiyatTekDegil = fiyatlar.length > 1; // bedenler farklı fiyatlıysa tek fiyat yazılamaz
  }
  return [...urunler.values()];
}

// 1290 -> "1.290 TL", 2552.5 -> "2.552,50 TL"
export function fiyatYaz(tutar) {
  const tam = Number.isInteger(tutar);
  return (
    tutar.toLocaleString("tr-TR", { minimumFractionDigits: tam ? 0 : 2, maximumFractionDigits: 2 }) + " TL"
  );
}

export const yazSezonuMu = (sezon) => /yaz/i.test(sezon ?? "");
