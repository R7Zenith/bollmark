# Excel Aktarımı — Büyük Dosyalarda "Hata Verip Kabul Etmeme" + İlerleme Yüzdesi (Araştırma + Claude Code Promptu)

## Tetikleyen olay

Kullanıcı `KOTON11052026CHECKLIST.xls` paylaştı: **415 satır, 68 benzersiz ürün
kodu, 36 renk, 29 beden, ürün başına ortalama ~6 (en fazla 21) varyant.**
İlk incelenen örnek dosya (`KOTON11052026CHECKLIST.xls` — eski, farklı içerik,
49 satır/6 ürün) ile karşılaştırınca boyut farkı ~8 kat. Kod incelemesiyle
kesin bir kök neden tespit edildi (aşağıda), ama panelin gösterdiği **tam hata
metnini görmedim** — bu metin (varsa ekran görüntüsü) bir sonraki adımda işe
yarar, çünkü şu an `excel-aktar` route'u her hatayı tek bir jenerik mesaja
("İçe aktarım sırasında bir hata oluştu, hiçbir değişiklik kaydedilmedi.")
gizliyor (`console.error` ile sunucu logunda gerçek hata kalıyor ama panelde
görünmüyor).

## Kök neden — kesin (kodla doğrulandı)

`src/app/api/admin/urunler/excel-aktar/route.ts`, tek bir POST isteğinde
**sırasıyla** şunları yapıyor:

1. `importProductGroups(groups, ...)` — tüm ürün/varyant/renk/beden
   upsert'lerini **tek bir Prisma transaction'ında** (`{ timeout: 30000 }`),
   grup grup **sıralı** (`for` döngüsü, `await` ile) yazıyor. 68 ürün × ~6
   varyant = ~415 sıralı yazma sorgusu, tek transaction içinde. Neon'un pooled
   bağlantısındaki ağ gecikmesiyle (kodun kendi yorumunda da belirtilmiş: "P2028
   zaman aşımı" riski) bu, 30 saniyelik transaction limitini kolayca aşabilir.
2. Transaction bittikten **hemen sonra, aynı istek içinde**,
   `enrichProductsFromKoton(summary.newProductTargets)` çağrılıyor — bu, YENİ
   oluşturulan **her ürün için sırayla** (`src/lib/koton-images.ts`):
   - Ürünler arasında sabit **900ms bekleme** (`REQUEST_DELAY_MS`),
   - `koton.com`'a 2 ayrı istek (autocomplete + ürün detay JSON),
   - Bulunursa, ürünün her rengi için (**ortalama birkaç renk**) her renkte
     en fazla 6 görseli **tek tek indirip Vercel Blob'a yeniden yüklüyor**
     (`reuploadImageToBlob` — her biri ayrı bir `fetch` + `put`).

   68 yeni ürün için bu: sadece bekleme süresi 67 × 900ms ≈ **60 saniye**, artı
   her ürün için 2 API çağrısı + bulunan ürünlerde renk başına birkaç görsel
   indirme/yükleme — kabaca **ürün başına 5-10 saniye**, toplamda **6-11
   dakika**ya kadar çıkabiliyor.

**Sonuç:** Bu tek istek, Vercel'in serverless fonksiyon süre sınırını (Hobby'de
10sn, Pro'da varsayılan 15sn/`maxDuration` ile en fazla birkaç dakika) fazlasıyla
aşıyor. 6 ürünlük eski örnek dosyada bu süre ~1 dakikanın altında kaldığı için
sorun fark edilmemişti; 68 ürünlük bu dosyada fonksiyon zaman aşımına uğrayıp
işlem yarıda kesiliyor, panel de bunu (muhtemelen 504/timeout ya da fetch'in
kendi hata mesajı olarak) "hata, kabul etmiyor" şeklinde gösteriyor.

Önemli: transaction 30sn içinde tamamlanmış olsa bile, **veri zaten yazılmış**
oluyor ama kullanıcı `enrichProductsFromKoton` sırasında zaman aşımı hatası
görüyor — yani veri kısmen/tamamen kaydedilmiş olabilir ama panel "başarısız"
gösteriyor, bu da yönetici için kafa karıştırıcı (belki de "aynı dosyayı
tekrar yükleyince bazı ürünler zaten var" diye fark edilmiş olabilir).

## Çözüm — iki fazlı, parçalı (chunked) işlem + gerçek ilerleme yüzdesi

Kullanıcının ikinci isteği (yüzde ilerleme çubuğu) aslında bu performans
sorunuyla aynı kökten çözülüyor: **tek dev bir isteği, istemcinin sırayla
attığı küçük parçalara bölmek.** Böylece hiçbir tekil istek zaman aşımına
yaklaşmaz VE her parça tamamlandığında gerçek bir ilerleme yüzdesi
güncellenebilir (sahte bir "spinner" değil, gerçek backend ilerlemesine bağlı).

**Faz 1 — Ürün/varyant aktarımı, ürün grubu bazında parçalı:**
- İstemci (`excel-import-wizard.tsx`), `preview.groups`'u sabit boyutlu
  gruplara böler (örn. 15 ürün kodu/istek).
- Her parça için `preview.rows`'tan sadece o parçadaki ürün kodlarına ait
  satırlar filtrelenip mevcut `/api/admin/urunler/excel-aktar`'a gönderilir
  (route'un mantığı DEĞİŞMEZ, sadece Koton zenginleştirme adımı çıkarılır —
  aşağıya bakın). Sunucu tarafında hâlâ transaction kullanılıyor ama artık
  parça başına ~15 ürün × ~6 varyant ≈ 90 satır — 30 saniyelik limitin çok
  altında.
- İstemci her parça yanıtından sonra "X/68 ürün grubu aktarıldı" ilerlemesini
  günceller, sayaçları (productsCreated/Updated, variantsCreated/Updated)
  toplar.

**Faz 2 — Koton görsel/açıklama zenginleştirmesi, ürün bazında parçalı:**
- `excel-aktar` route'u artık `enrichProductsFromKoton`'u **kendi içinde
  çağırmıyor** — bunun yerine yanıtında `newProductTargets` listesini
  (productId, productCode, productName, firstBarcode, colorValueIdByLabel)
  aynen döndürüyor.
- İstemci, tüm parçalardan topladığı `newProductTargets` listesi üzerinde
  **kendisi** sırayla döner: her biri için yeni, tek-ürünlük bir endpoint'e
  (`/api/admin/urunler/excel-aktar/gorsel-getir`) istek atar, istekler arasına
  kendisi ~900ms bekleme koyar (Koton'a karşı nezaket kuralı istemci tarafında
  korunur — bkz. EXCEL_URUN_AKTARIM_PLANI.md bölüm 4). Her yanıttan sonra
  "X/68 üründe görsel aranıyor" ilerlemesi güncellenir.
- Bu adım artık uzun sürse bile (68 ürün × ~1-2sn ≈ 1-2 dakika toplam), her
  TEKİL istek 1-3 saniyede bitiyor — hiçbir istek zaman aşımına uğramaz.

**Sonuç:** Dosya ne kadar büyük olursa olsun (415 satır da olsa, 4000 satır da
olsa) hiçbir istek büyümez, sadece istek SAYISI artar — bu da doğal olarak
"1/68, 2/68, ... 68/68" şeklinde gerçek bir ilerleme çubuğu verir.

## Ek (ikincil) iyileştirmeler

- `importProductGroups` içindeki `resolveOptionValueIds`/`resolveBrandId`/
  `generateUniqueSlug` sıralı `await` döngüleri, küçük gruplar halinde
  (`Promise.all` ile ~8-10'lu paralel) çalıştırılarak her parçanın süresi
  daha da kısaltılabilir (opsiyonel, ilk etapta şart değil).
- Her iki route dosyasına `export const maxDuration = 60;` eklenmesi (Vercel
  fonksiyon süresi için ek güvenlik payı — parçalama zaten asıl çözüm ama bu
  bedava bir ek güvence).
- `excel-aktar` route'undaki genel `catch` bloğu, gerçek hata mesajını (en
  azından geliştirme/admin ortamında) yanıta ekleyecek şekilde güncellenmeli
  — jenerik "bir hata oluştu" yerine, bir dahaki sorunda kullanıcı gerçek
  nedeni görebilsin.
- Aynı dosya iki kez yüklenirse (bir önceki denemede kısmen kaydedilmiş
  ürünler varsa) barkod bazlı upsert zaten var olan ürünleri günceller,
  yeniden oluşturmaz — bu yüzden "yarıda kalan" bir denemeden sonra dosyayı
  tekrar yüklemek güvenli, veri tekrarlanmaz.

## Verilen Claude Code promptu

```
Bollmark'ın Excel ürün aktarımı büyük dosyalarda (400+ satır, 60+ yeni ürün)
zaman aşımına uğrayıp panelde hataya düşüyor. Kök neden tespit edildi: mevcut
akışta tek bir POST isteği (/api/admin/urunler/excel-aktar) hem TÜM ürün/
varyant DB yazımını (tek transaction, sıralı) HEM DE yeni ürünler için Koton
görsel/açıklama aramasını (koton.com'a sıralı istekler + ürün başına 900ms
bekleme + görsel indirme/Blob'a yeniden yükleme) art arda, aynı istek
içinde yapıyor. 60+ yeni ürün olduğunda bu tek istek birkaç dakikayı buluyor,
Vercel'in fonksiyon süre sınırını aşıyor. Bunu iki fazlı, parçalı (chunked)
bir akışa dönüştüreceğiz — bu hem zaman aşımını çözer hem de kullanıcının
istediği gerçek ilerleme yüzdesini doğal olarak sağlar.

### 1. `src/lib/koton-images.ts`: `enrichOne`'ı export et

Şu an `enrichOne` fonksiyonu private (export edilmemiş). Başına `export`
ekle — yeni, tek-ürünlük bir API route bunu doğrudan çağıracak.

### 2. `src/app/api/admin/urunler/excel-aktar/route.ts`: Koton zenginleştirmesini çıkar

- Dosyanın sonundaki `const kotonResults = await enrichProductsFromKoton(summary.newProductTargets);`
  satırını ve `enrichProductsFromKoton` import'unu KALDIR.
- Yanıta (`NextResponse.json({...})`) `kotonResults` yerine ham
  `newProductTargets: summary.newProductTargets` ekle (bu zaten
  `ImportSummary` içinde JSON-uyumlu bir şekle sahip: productId, productCode,
  productName, firstBarcode, colorValueIdByLabel).
- Dosyanın başına `export const maxDuration = 60;` ekle (ek güvenlik payı).
- Genel `catch` bloğundaki hata yanıtına, `error instanceof Error ? error.message : String(error)`
  değerini (kısaltılmış, örn. ilk 300 karakter) `detail` alanı olarak ekle —
  ileride benzer bir sorun çıkarsa panelde gerçek neden görünsün.

### 3. Yeni route: `src/app/api/admin/urunler/excel-aktar/gorsel-getir/route.ts`

Mevcut admin route'larıyla aynı desende (`require-admin`/session kontrolü,
bkz. `excel-aktar/route.ts`'in başındaki oturum kontrolü), tek bir ürün
hedefini alıp Koton'da arayan, minimal bir endpoint:

```ts
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { enrichOne, type KotonEnrichmentResult } from "@/lib/koton-images";
import type { KotonEnrichmentTarget } from "@/lib/excel-import";

export const maxDuration = 30;

function isValidTarget(v: unknown): v is KotonEnrichmentTarget {
  if (typeof v !== "object" || v === null) return false;
  const t = v as Record<string, unknown>;
  return (
    typeof t.productId === "string" &&
    typeof t.productCode === "string" &&
    typeof t.productName === "string" &&
    typeof t.firstBarcode === "string" &&
    typeof t.colorValueIdByLabel === "object" &&
    t.colorValueIdByLabel !== null
  );
}

// Excel aktarımının 2. fazı: TEK bir yeni ürün için Koton görsel/açıklama
// arar. İstemci (excel-import-wizard.tsx) bu endpoint'i yeni ürün başına bir
// kez, aralarda kendi bekleme süresini koyarak çağırır - böylece büyük
// dosyalarda tek bir uzun istek yerine birçok kısa istek olur, hiçbiri zaman
// aşımına uğramaz ve istemci gerçek bir ilerleme yüzdesi gösterebilir.
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  if (session.user?.role !== "ADMIN") return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });

  const body = await request.json().catch(() => null);
  const target = body?.target;
  if (!isValidTarget(target)) {
    return NextResponse.json({ error: "Geçersiz hedef." }, { status: 400 });
  }

  let result: KotonEnrichmentResult;
  try {
    result = await enrichOne(target);
  } catch (error) {
    console.error(`Koton görsel eşleştirme başarısız (ürün kodu: ${target.productCode}):`, error);
    result = { productId: target.productId, productCode: target.productCode, found: false, imagesAdded: 0, descriptionUpdated: false };
  }
  return NextResponse.json(result);
}
```

(`enrichProductsFromKoton` fonksiyonunu `koton-images.ts`'te SİLME - ileride
başka bir yerde toplu/sıralı ihtiyaç çıkarsa dursun, sadece artık
`excel-aktar` route'u onu kullanmıyor.)

### 4. `src/components/admin/excel-import-wizard.tsx`: parçalı akış + ilerleme çubuğu

- Yeni bir state ekle:
  ```ts
  type ImportProgress = {
    phase: "aktarim" | "gorseller";
    doneGroups: number;
    totalGroups: number;
    doneProducts: number;
    totalProducts: number;
  };
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  ```
- `handleImport`'u şu mantıkla yeniden yaz (BATCH_SIZE=15 ürün grubu/istek,
  ayarlanabilir bir sabit olarak dosyanın başına koyulabilir):
  1. `preview.groups`'u `BATCH_SIZE`'lık parçalara böl.
  2. `progress`'i `{ phase: "aktarim", doneGroups: 0, totalGroups: preview.groups.length, doneProducts: 0, totalProducts: 0 }` yap.
  3. Her parça için: o parçadaki `productCode`'lara ait `preview.rows` satırlarını
     filtrele, ilgili `categoryByCode` alt kümesini al, mevcut
     `/api/admin/urunler/excel-aktar`'a gönder (mevcut body şekli aynı kalır,
     sadece `rows` ve `categoryOverrides` o parçaya filtrelenmiş olur). Yanıttaki
     `productsCreated`/`productsUpdated`/`variantsCreated`/`variantsUpdated`'ı
     bir toplam objesine ekle, `newProductTargets`'ı bir diziye biriktir,
     `progress.doneGroups`'u parça boyutu kadar artır (her parça sonrası
     `setProgress` ile UI güncellensin - React state güncellemesi arada
     render tetikleyecek şekilde `await` sırasında yapıldığından otomatik
     çalışır).
     Bir parça hata dönerse (`!res.ok`), mevcut `showToast` + `return` davranışı
     korunsun (kısmi aktarım sonucu yine de tutulmuş olur, kullanıcıya "X/Y
     grup aktarıldı, sonra hata oluştu" gibi bir mesaj da eklenebilir).
  4. Tüm parçalar bitince `progress`'i `{ ...progress, phase: "gorseller", totalProducts: allTargets.length, doneProducts: 0 }` yap.
  5. Biriken `allTargets` (KotonEnrichmentTarget[]) üzerinde sırayla dön: her biri
     için (ilkinden sonra `await sleep(900)`) `/api/admin/urunler/excel-aktar/gorsel-getir`'e
     `{ target }` gönder, dönen `KotonEnrichmentResult`'ı bir diziye ekle,
     `progress.doneProducts`'ı 1 artır.
  6. Bitince `setResult({ productsCreated, productsUpdated, variantsCreated, variantsUpdated, kotonResults })`
     ile mevcut "3. Sonuç" adımına geç (`setStep("result")`), `progress`'i temizle.
- Önizleme adımının altına (veya "İçe Aktar" butonunun yerini alacak şekilde,
  `loading && progress` iken) bir ilerleme göstergesi ekle:
  - `phase === "aktarim"` iken: "Ürünler aktarılıyor: {doneGroups}/{totalGroups}"
    metni + bir `<div>` tabanlı yüzde çubuğu (`width: ${(doneGroups/totalGroups)*100}%`,
    mevcut admin tasarım dilindeki renkleri kullan, örn. `bg-admin-accent`).
  - `phase === "gorseller"` iken: "Görseller aranıyor: {doneProducts}/{totalProducts}"
    metni + aynı şekilde bir yüzde çubuğu.
  - Buton bu sırada disabled kalsın (`loading` zaten bunu yapıyor), metnini
    "İçe aktarılıyor..." yerine faza göre güncelle.
- `PreviewGroup`/`ImportResponse` tiplerini yeni response şekline göre güncelle
  (`kotonResults` artık `/excel-aktar` yanıtında değil, `newProductTargets`
  var; `KotonEnrichmentTarget` tipini bu dosyaya da ekle).

### Test/doğrulama

1. `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
2. Küçük bir dosyayla (örn. eski 49 satırlık örnek) uçtan uca test: önizleme
   → içe aktar → ilerleme çubuğunun önce "aktarım" sonra "görseller" fazını
   gösterip %100'e ulaştığını, sonuç ekranının aynı şekilde çalıştığını
   doğrula.
3. Paylaşılan `KOTON11052026CHECKLIST.xls` (415 satır, 68 ürün) ile aynı testi
   tekrarla:
   - Hiçbir ağ isteğinin (tarayıcı devtools Network sekmesi) tek başına birkaç
     saniyeden uzun sürmediğini doğrula.
   - İlerleme çubuğunun gerçek zamanlı ilerlediğini (donmadığını) doğrula.
   - Sonunda 68 ürünün de (Prisma Studio veya admin panelinden) doğru
     oluşturulduğunu, hiçbirinin eksik/yarım kalmadığını doğrula.
   - Aynı dosyayı BİR KEZ DAHA yükleyip (idempotency testi) barkodların
     güncelleme olarak işlendiğini, yeni ürün oluşmadığını doğrula.
4. `npm run lint` hatasız geçmeli.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme. Bitince
git diff özetini ve büyük dosyayla çalışan ilerleme çubuğunun bir ekran
görüntüsünü/kısa GIF'ini paylaş.
```

## Sonraki oturumda kontrol edilecek

Bu promptun sonucu doğrulanmalı: büyük dosya artık hatasız tamamlanıyor mu,
ilerleme çubuğu gerçek zamanlı çalışıyor mu, `npm run lint`/`npm run build`
durumu. Ayrıca önceki turda verilen cinsiyet/renk/kategori promptunun
(`EXCEL_CINSIYET_RENK_KATEGORI_DUZELTME_PLANI.md`) sonucu da hâlâ
doğrulanmayı bekliyor.
