# Excel Aktarımı — Faz 2 (Koton Görsel Arama) Takılıp Kalıyor + Ürün Bazında "Yeniden Ara" Butonu

## Yeni bulgu (kullanıcı teyidi)

Önceki turda (`EXCEL_BUYUK_LISTE_TIMEOUT_VE_ILERLEME_PLANI.md`) verilen
prompt Claude Code tarafından uygulanmış — kod incelendi, `excel-aktar` artık
sadece DB yazıp `newProductTargets` döndürüyor, ayrı `/excel-aktar/gorsel-getir`
endpoint'i var, wizard iki fazlı (aktarım + görseller) çalışıp **ilerleme
çubuğunu her iki faz için de zaten gösteriyor** (`progress.phase === "gorseller"`
iken "Görseller aranıyor: X/Y" + yüzde çubuğu — bu kısım zaten var, yeniden
eklemeye gerek yok, sadece aşağıdaki düzeltmeyle gerçekten ilerlediğinden
emin olunacak).

Kullanıcı `KOTON11052026CHECKLIST.xls` (415 satır/68 ürün) ile tekrar
denedi: **"3. Sonuç" ekranı hiç gelmiyor, içeri aktardan sonra kalıyor, yeni
bir ekrana geçmiyor.** Yani Faz 1 (DB yazımı) muhtemelen bitiyor (ürünler
fotoğrafsız olarak zaten oluşmuş durumda — kullanıcı bunu gördü), ama Faz 2
(Koton görsel arama döngüsü) hiç bitmiyor/çok uzun sürüyor, `setStep("result")`
satırına hiç ulaşılmıyor — dolayısıyla ilerleme çubuğu da göründüğü halde
ilerlemiyor gibi kalmış olabilir.

Kullanıcı ayrıca ileride kalıcı olarak şunu istiyor: Koton'da bulunamayan/
görselsiz kalan bir ürün için, Ürünler sayfasındaki satırının sonuna
**"Fotoğrafları yeniden ara"** butonu — tıklanınca sadece o ürün için Koton
araması tekrar tek başına çalışsın, bulursa görselleri eklesin.

## Kök neden (kodla doğrulanan risk) — Faz 2 takılması

`src/lib/koton-images.ts`'teki üç `fetch` çağrısının (`fetchAutocompleteUrl`,
`fetchKotonProductData`, `reuploadImageToBlob`) **hiçbirinde timeout/AbortController
yok.** Eğer koton.com sunucu tarafından (Vercel'in IP'sinden) gelen istekleri
artık yanıtlamıyorsa/engelliyorsa (bot koruması, IP kısıtlaması, ya da basitçe
ağ gecikmesi), her `fetch` düşmeden/hata vermeden **askıda kalabilir** — tek
çıkış yolu `gorsel-getir` route'undaki `export const maxDuration = 30;`
sınırı, yani Vercel o fonksiyonu zorla 30 saniyede kesiyor.

68 ürünün HER biri için bu böyle olursa: 68 × 30 saniye ≈ **34 dakika.**
İstemci tarafında da bu fetch'lere bir zaman aşımı konulmadığı için tarayıcı
sekmesi de bu süre boyunca sessizce bekliyor — kullanıcıya tamamen
"takılmış/donmuş" gibi görünüyor, muhtemelen bu kadar uzun süre beklemeden
sayfayı kapatıp/yenileyip vazgeçiyor. Bu da "ürünler fotoğrafsız kaldı"
şikayetini birebir açıklıyor: Faz 1 zaten tamamlanıp ürünler kaydedilmiş,
ama Faz 2 hiç bitmediği için görseller hiç eklenemedi.

**Neden koton.com yanıt vermiyor olabilir (ikincil, doğrulanması gereken
sorular):** Dosyadaki sezon kodu (`KOD6`) hepsinde **"2026 YAZ"** — bugünün
tarihi 2026-09-09, yani yaz sezonu bitmiş durumda. Koton muhtemelen sezonu
kapanan ürünleri kendi sitesinden kaldırmış/aramadan çıkarmış olabilir - bu
durumda arama YAVAŞ değil HIZLI bir şekilde "bulunamadı" dönmeli (bu normal,
beklenen bir durum, plan belgesinde zaten "v1 kapsamı dışı" olarak not
edilmişti). Ama şu anki davranış "hızlı bulunamadı" değil "hiç yanıt gelmiyor/
sonsuza kadar bekliyor" gibi görünüyor - bu ayrımı netleştirmek için önce
timeout eklenmesi gerekiyor (aşağıdaki prompt), çünkü timeout olmadan hangi
senaryonun yaşandığını Vercel loglarına bakmadan bilemiyoruz.

Bu ikinci ihtiyaç (ürün bazında yeniden arama butonu) aslında bu riski hafifleten
kalıcı bir güvenlik ağı: Koton araması ister zaman aşımından, ister sezon
bitmesinden, ister geçici bir ağ sorunundan dolayı başarısız olsun, admin
istediği zaman tek bir ürün için tekrar deneyebilecek — büyük dosyayı baştan
yüklemesine gerek kalmıyor.

## Çözüm — dört parça

**1) Her dış isteğe kesin bir zaman aşımı (AbortController) ekle** — hem
sunucu tarafındaki (`koton-images.ts`) hem istemci tarafındaki
(`excel-import-wizard.tsx`'in `/gorsel-getir` çağrısı) `fetch`'lere. Böylece
koton.com yanıt vermese bile her ürün için en fazla birkaç saniye (örn. 8sn)
beklenir, süreç asla "askıda" kalmaz - hızla bir sonraki ürüne geçer (ve
zaten var olan ilerleme çubuğu da gerçekten ilerlediğini gösterir).

**2) Kullanıcıya kontrol ve görünürlük ver** — Faz 2 sırasında bir "Görselleri
atla ve bitir" butonu göster. Ürünler zaten Faz 1'de güvenle kaydedildiği
için (barkod bazlı upsert, tekrar yüklemede veri kaybı yok), admin isterse
görsel aramayı yarıda kesip sonuç ekranına geçebilsin.

**3) Gerçek teşhis için loglama ekle** — `enrichOne`/`fetchAutocompleteUrl`
içine, hangi adımda ne olduğunu (istek atıldı mı, HTTP durumu ne, JSON
parse edilebildi mi, base_code eşleşti mi) gösteren `console.error`/`console.log`
satırları ekle.

**4) Ürünler sayfasında satır bazında "Fotoğrafları yeniden ara" butonu**
(yeni istek) — `src/components/admin/products-table.tsx`'teki "actions"
kolonuna, fotoğrafı olmayan (`!row.imageUrl`) satırlarda mevcut "Düzenle"
linkinin yanına bir buton eklenecek. Tıklanınca yeni bir endpoint
(`/api/admin/urunler/[id]/gorsel-yenile`), o ürünün DB'deki verilerinden
(kod, ilk barkod, renk varyant değerleri) bir `KotonEnrichmentTarget`
oluşturup zaten var olan `enrichOne`'ı çağıracak — Excel aktarımındaki
mekanizmanın birebir aynısı, sadece tek bir ürün için, ayrı bir tetikleyiciyle.

## Verilen Claude Code promptu

```
Excel ürün aktarımının 2. fazında (Koton görsel/açıklama arama) bir sorun
var: "3. Sonuç" ekranına hiç geçilmiyor, kullanıcı "içeri aktardan sonra
kalıyor, yeni ekrana gitmiyor" diyor. Kök neden muhtemelen şu: koton-images.ts
içindeki fetch çağrılarının hiçbirinde zaman aşımı/AbortController yok - eğer
koton.com yanıt vermiyorsa (engelleme, sezon bitmiş ürün, ağ sorunu vb.) her
istek Vercel'in gorsel-getir route'undaki 30 saniyelik maxDuration'a kadar
askıda kalabiliyor; 60+ yeni ürün olduğunda bu toplamda onlarca dakikaya
çıkıp kullanıcıya "donmuş" gibi görünüyor (mevcut ilerleme çubuğu bu yüzden
hareket etmiyormuş gibi görünüyor olabilir - kendisi zaten doğru kodlanmış,
sorun altında yatan isteklerin hiç bitmemesi).

Ayrıca, ileride Koton'da bulunamayan/görselsiz kalan tekil ürünler için,
Ürünler sayfasından o ürünü baştan Excel'e sokmadan tekrar arayabilmek
istiyoruz - bunun için de ayrı bir "yeniden ara" özelliği ekleyeceğiz.

### 1. Dış isteklere zaman aşımı ekle (src/lib/koton-images.ts)

Dosyanın başına bir yardımcı ekle:

```ts
const FETCH_TIMEOUT_MS = 8000;

async function fetchWithTimeout(url: string, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}
```

`fetchAutocompleteUrl`, `fetchKotonProductData` ve `reuploadImageToBlob`
içindeki üç `fetch(...)` çağrısını `fetchWithTimeout(...)` ile değiştir (aynı
`headers` parametreleriyle). `AbortError` zaten mevcut `try/catch` bloklarına
(bu fonksiyonları çağıran `findKotonProductData` ve `reuploadImageToBlob`'un
kendi `catch`'i) düşüp `null` dönecek şekilde davranacak - ek bir değişiklik
gerekmiyor, sadece "sonsuza kadar bekleme" ihtimali ortadan kalkıyor.

### 2. Teşhis için loglama ekle (src/lib/koton-images.ts)

`fetchAutocompleteUrl` içine, `if (!res.ok) return null;` satırından önce:

```ts
if (!res.ok) {
  console.error(`Koton autocomplete başarısız (barkod: ${barcode}): HTTP ${res.status}`);
  return null;
}
```

`fetchKotonProductData` içine, base_code kontrolünden önce/sonra:

```ts
if (baseCode !== expectedProductCode) {
  console.error(`Koton base_code eşleşmedi: beklenen ${expectedProductCode}, gelen ${baseCode}`);
  return null;
}
```

Bu loglar sadece Vercel fonksiyon loglarına düşer, kullanıcıya gösterilmez -
bir sonraki denemede loglara bakılıp kesin neden (engelleme mi, sezon bitmiş
ürün mü, başka bir şey mi) teyit edilebilir.

### 3. İstemci tarafına da zaman aşımı + "Görselleri atla ve bitir" ekle (src/components/admin/excel-import-wizard.tsx)

- `/api/admin/urunler/excel-aktar/gorsel-getir` çağrısına da bir
  `AbortController` ile ~12 saniyelik istemci taraflı zaman aşımı ekle (sunucu
  taraflı 8sn + ağ payı) - sunucu taraflı timeout'un beklenmedik şekilde
  çalışmadığı bir durumda bile tarayıcı sonsuza kadar beklemesin.
- Faz 2 ("gorseller") sırasında, zaten var olan ilerleme çubuğunun yanına/
  altına küçük bir "Görselleri atla ve bitir" (`variant="secondary"`, küçük
  boyut) butonu ekle. Tıklanınca: mevcut görsel arama döngüsünü durdur (bir
  `let skipped = false` flag'i ya da `AbortController` ile döngü kontrolü),
  kalan hedefler için `kotonResults`'a `{ productId, productCode, found: false,
  imagesAdded: 0, descriptionUpdated: false }` ekleyerek direkt
  `setResult(...)` + `setStep("result")`'a geç. Bu buton sadece
  `progress?.phase === "gorseller"` iken görünsün.
- Sonuç ekranındaki "Koton'da bulunamadı, görseller elle eklenmeli" mesajının
  yanına, mevcut `FOTOGRAFSIZ_URUNLER_PLANI.md`'de eklenmiş "Fotoğrafsız
  ürünler" filtresine giden bir link ekle (`/admin/urunler?fotograf=yok`).

### 4. Ürünler sayfasında ürün bazında "Fotoğrafları yeniden ara" butonu

**4a. Yeni route: `src/app/api/admin/urunler/[id]/gorsel-yenile/route.ts`**

Projedeki diğer dinamik admin route'larının (`/admin/urunler/[id]/...` altında
zaten var olan route'lar) `params` kalıbına ve oturum kontrolü desenine
(`getServerSession(authOptions)`, `session.user?.role !== "ADMIN"`) uyarak
yeni bir POST route yaz:

```ts
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { enrichOne } from "@/lib/koton-images";

export const maxDuration = 30;

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const { id } = await context.params;
  const product = await prisma.product.findUnique({
    where: { id },
    include: {
      variants: { include: { options: { include: { value: { include: { attribute: true } } } } } }
    }
  });
  if (!product) return NextResponse.json({ error: "Ürün bulunamadı." }, { status: 404 });
  if (!product.code) {
    return NextResponse.json({ error: "Bu ürünün ürün kodu kayıtlı değil, Koton'da aranamaz." }, { status: 400 });
  }
  const firstBarcode = product.variants.find((v) => v.barcode)?.barcode ?? null;
  if (!firstBarcode) {
    return NextResponse.json({ error: "Bu ürünün barkodlu bir varyantı yok." }, { status: 400 });
  }

  const colorValueIdByLabel: Record<string, string> = {};
  for (const variant of product.variants) {
    for (const opt of variant.options) {
      if (opt.value.attribute.name === "Renk") {
        colorValueIdByLabel[opt.value.value] = opt.value.id;
      }
    }
  }

  const result = await enrichOne({
    productId: product.id,
    productCode: product.code,
    productName: product.name,
    firstBarcode,
    colorValueIdByLabel
  });

  return NextResponse.json(result);
}
```

(`enrichOne` zaten `koton-images.ts`'te export edilmiş durumda - EXCEL_KOTON
promptunun 1. maddesinden önce bile, bkz. mevcut kod. Bu yeni route sadece
Excel importundaki aynı fonksiyonu tek ürün için, DB'den kurduğu bir
`KotonEnrichmentTarget`'la çağırıyor - yeni bir arama mantığı YAZILMIYOR.)

Not: `enrichOne` mevcut ürünün açıklamasını da (varsa Koton'dan gelen
`description`) güncelliyor - bu istenen bir davranış mı (yönetici zaten
düzenlemiş bir açıklamanın üzerine yazılması) diye bir düşün; istenmiyorsa
`enrichOne`'a opsiyonel bir `overwriteDescription?: boolean` parametresi
eklenip bu route'tan `false` geçirilebilir (Excel aktarımından çağrılırken
`true`/varsayılan davranış). Bu kullanıcıyla teyit edilmeli - varsayılan
olarak "sadece görsel ekle, açıklamaya dokunma" daha güvenli bir seçim
olabilir çünkü bu buton var olan, muhtemelen zaten gözden geçirilmiş bir
ürüne tıklanarak çalıştırılıyor.

**4b. `src/components/admin/products-table.tsx` güncellemesi**

- Başa `import { useState } from "react";` ve `lucide-react`'ten `RefreshCw`,
  `Loader2` ekle.
- Component içine:
  ```tsx
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());

  async function handleGorselYenile(id: string) {
    setRefreshingIds((prev) => new Set(prev).add(id));
    try {
      const res = await fetch(`/api/admin/urunler/${id}/gorsel-yenile`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        showToast(data.error ?? "Görsel arama başarısız oldu.", "error");
        return;
      }
      if (data.found && data.imagesAdded > 0) {
        showToast(`${data.imagesAdded} görsel eklendi.`, "success");
        router.refresh();
      } else if (data.found) {
        showToast("Ürün Koton'da bulundu ama bu renkler için görsel bulunamadı.", "error");
      } else {
        showToast("Koton'da bulunamadı.", "error");
      }
    } catch {
      showToast("Görsel arama sırasında bir hata oluştu.", "error");
    } finally {
      setRefreshingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }
  ```
- `"actions"` kolonunun `render`'ını güncelle - fotoğrafı olmayan satırlarda
  "Düzenle" linkinin solunda buton göster:
  ```tsx
  render: (row) => (
    <div className="flex items-center justify-end gap-3">
      {!row.imageUrl && (
        <button
          onClick={() => handleGorselYenile(row.id)}
          disabled={refreshingIds.has(row.id)}
          className="inline-flex items-center gap-1 text-xs text-admin-accent hover:underline disabled:opacity-50"
        >
          {refreshingIds.has(row.id) ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          {refreshingIds.has(row.id) ? "Aranıyor..." : "Fotoğrafları yeniden ara"}
        </button>
      )}
      <Link href={`/admin/urunler/${row.id}`} className="text-admin-accent hover:underline">
        Düzenle
      </Link>
    </div>
  )
  ```
- Buton bir satırda "Aranıyor..." gösterirken diğer satırlardaki butonlar
  etkilenmesin diye state bir `Set<string>` (ürün id'si) olarak tutuluyor -
  toplu değil, satır bazlı yükleniyor.
- Bu buton her tıklamada tek bir senkron istek atıyor (Excel aktarımındaki
  gibi bir kuyruk/ilerleme çubuğu gerekmiyor, çünkü tek seferde tek ürün) -
  isteğin kendisi 8sn'lik sunucu taraflı timeout (madde 1) sayesinde makul
  sürede döner.

### Test/doğrulama

1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. `KOTON11052026CHECKLIST.xls` ile tekrar dene:
   - Faz 2'nin artık makul bir sürede ilerlediğini, ilerleme çubuğunun
     gerçekten hareket ettiğini, "3. Sonuç" ekranına gerçekten ulaştığını
     doğrula.
   - Vercel loglarına bak: eklenen loglar hangi hatayı gösteriyor - HTTP durum
     kodu mu (403/429, engelleme işareti), "bulunamadı" mı, yoksa base_code
     uyuşmazlığı mı?
   - "Görselleri atla ve bitir" butonunun beklendiği gibi çalıştığını doğrula.
3. Görselsiz kalan (veya bilerek görseli silinmiş test amaçlı) bir üründe,
   Ürünler sayfasında "Fotoğrafları yeniden ara" butonuna tıkla:
   - Bulunursa görsellerin gerçekten eklendiğini (sayfa yenilenince "Fotoğraf
     Yok" rozetinin kalktığını) doğrula.
   - Bulunamazsa uygun bir toast mesajı geldiğini, sayfanın donmadığını
     doğrula.
   - Aynı anda başka bir satırda butona tıklamanın (varsa) birbirini
     etkilemediğini doğrula.
4. `npm run lint` hatasız geçmeli.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme. Bitince
git diff özetini, Vercel loglarından çıkan gerçek hata örneklerini ve
"yeniden ara" butonunun çalıştığı bir ekran görüntüsünü/GIF'ini paylaş.
```

## Sonraki oturumda kontrol edilecek

- Bu promptun sonucu: Faz 2 artık sonuç ekranına ulaşıyor mu, loglar gerçek
  nedeni gösteriyor mu (engelleme/sezon bitmiş/başka), "Fotoğrafları yeniden
  ara" butonu Ürünler sayfasında çalışıyor mu.
- `enrichOne`'ın açıklamayı da güncelleme davranışı (4a'daki not) kullanıcıyla
  netleştirilmeli - "yeniden ara" butonunda açıklamaya dokunulsun mu
  dokunulmasın mı.
- Loglardan çıkan nedene göre kalıcı bir karar gerekebilir: örn. koton.com
  gerçekten engelliyorsa (403/429), User-Agent/header stratejisi ya da bu
  özelliğin ne sıklıkla/ne zaman kullanılabilir olduğu yeniden konuşulmalı.
- Önceki iki turun (cinsiyet/renk/kategori, büyük dosya/timeout) sonuçları da
  hâlâ ayrıca doğrulanmayı bekliyor.
