# Katalog — "Daha Fazla Göster" (Parti Parti Yükleme) Planı

## İstek

Ürün sayısı arttıkça `/urunler` katalog sayfası çok uzuyor. Ürünler parti parti yüklensin, premium his korunsun. **Sonsuz kaydırma (infinite scroll) olmasın** — footer'a inmek isteyen müşteriyi sayfa inatla aşağı doğru yükleyerek engellemesin.

## Mevcut Durum (incelendi)

- `src/app/(site)/urunler/page.tsx` → `getCatalogEntries()` ile kapsamdaki **tüm** ürünleri çekiyor, arama/filtre/sıralamayı bellekte uyguluyor ve `entries.map(...)` ile **hepsini tek seferde** `ProductCard` olarak basıyor. Sayfalama yok.
- Sonuç: 300 renk girişi varsa 300 kart + 600 görsel (hover için 2. görsel) tek HTML'de geliyor. Sayfa hem uzuyor hem ağırlaşıyor.
- `CatalogToolbar`'a `count={entries.length}` gidiyor (toplam sonuç sayısı) — bu kalmalı.
- Boş durum ekranları (arama sonuçsuz, filtre sonuçsuz, `EmptyCategoryState`) ayrı dallarda; bunlara dokunulmayacak.
- Sitede zaten kullanılan pill buton stili: `h-[44px] rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] hover:bg-ink hover:text-cream`.

## Seçenekler

| Yöntem | Artı | Eksi |
|---|---|---|
| Sonsuz kaydırma | Akıcı | Footer'a ulaşılamaz, geri dönünce konum kaybolur, SEO zayıf — **istemiyoruz** |
| Klasik sayfa numaraları (1 2 3) | SEO iyi, footer erişilebilir | Moda/lüks sitelerde "eski" hissi, her sayfada en üste atar |
| **"Daha Fazla Göster" butonu + sayaç** | Kontrol müşteride, footer her zaman erişilebilir, COS / Arket / Massimo Dutti / Release tarzı premium his | Biraz daha kod |

## Önerim: "Daha Fazla Göster" + ilerleme sayacı

Grid'in altında ortalanmış, sade bir blok:

```
          48 / 312 ürün gösteriliyor
          ━━━━━━━━───────────────────────   (ince 2px ilerleme çizgisi, ~160px genişlik)

              [  DAHA FAZLA GÖSTER  ]        (mevcut pill buton stili)
```

Premium hissi veren detaylar:

1. **Parti boyutu 24.** Masaüstünde 4 sütun × 6 satır, mobilde 2 × 12 — her iki düzende de son satır hiç yarım kalmaz.
2. **Sayaç + ince ilerleme çizgisi.** Müşteri ne kadarını gördüğünü ve ne kadar kaldığını bilir; lüks markaların neredeyse hepsinde bu dil var.
3. **Yükleme hissi:** butona basınca yazı "Yükleniyor" olur ve buton kilitlenir (çift tıklama olmaz); yeni kartlar alttan hafif yukarı kayarak (`opacity 0→1`, `translateY 12px→0`, 400 ms, kartlar arası 30 ms gecikme) belirir. `prefers-reduced-motion` açık olan müşteride animasyon olmaz.
4. **Sayfa zıplamaz:** yeni kartlar eklenince kaydırma konumu olduğu yerde kalır, müşteri kaldığı yerden aşağı doğru devam eder.
5. **Geri tuşu konumu korur:** URL'ye `?goster=48` yazılır. Müşteri bir ürüne girip geri dönünce 48 ürün tekrar gelir ve Next.js kaydırma konumunu geri yükler. Kötü tasarlanmış sitelerde müşteri geri dönünce en başa atılır; bunu engellemek, premium hissin en önemli parçası.
6. **Hepsi yüklenince** buton kaybolur, yerine sade bir "Tüm ürünleri gördünüz · 312 ürün" satırı ve küçük bir "Başa dön ↑" bağlantısı gelir.
7. **SEO ve JS kapalıyken çalışma:** buton aslında `<a href="?goster=48">` bağlantısıdır. JS varsa istemci tarafında yükler, yoksa link normal çalışır. Google da sonraki ürünleri bu bağlantılar üzerinden bulabilir.
8. **Filtre, sıralama veya arama değişince** liste 24'e sıfırlanır (`goster` parametresi silinir).
9. **Erişilebilirlik:** yükleme bitince ekran okuyucuya "24 ürün daha yüklendi" duyurulur (`aria-live`), klavye odağı ilk yeni karta geçer.

**Neden ayrı bir API yerine sunucu aksiyonu (server action):** Filtre ve sıralama mantığı şu an `page.tsx` içinde. Bu mantığı `lib/`e taşıyıp hem sayfa hem "sonraki partiyi getir" aksiyonu aynı fonksiyonu kullanırsa sonuçlar asla birbirinden sapmaz. Yeni bir route dosyası da eklenmez (Vercel function sayısı ve boyutu şişmez).

> **Faz 2 (şimdi değil, not):** `getCatalogEntries` hâlâ her istekte tüm ürünleri veritabanından çekiyor. Ürün sayısı 1000'i geçerse bu sorgu `unstable_cache` / `revalidateTag` ile önbelleğe alınmalı (`lib/revalidate-catalog.ts` zaten var). Bu iş, bu planın kapsamında değil.

## Claude Code için Prompt

> Katalog sayfasına (`src/app/(site)/urunler/page.tsx`) sonsuz kaydırma OLMADAN, butonla parti parti yükleme ekle. Önce `AGENTS.md`'deki talimata uy: bu projedeki Next.js sürümünde server actions, `searchParams`, `useSearchParams`, `useOptimistic`/`useTransition` ve scroll restoration ile ilgili dokümanları `node_modules/next/dist/docs/` altından oku, eski API'lere güvenme.
>
> **1. Filtre hattını ortak fonksiyona taşı.** `page.tsx` içindeki `applySearch`, `parseSearchQuery`, `sortEntries` ve "scopedEntries → arama → facet → filtre → sıralama" akışını `src/lib/catalog-listing.ts` içinde `getCatalogListing(params: URLSearchParams)` fonksiyonuna taşı. Fonksiyon `{ entries, rawEntries, facets, filters, hasActiveFilters, kategori, cinsiyet, sirala, ara, automaticCampaigns, filterCategories }` döndürsün. `page.tsx` bu fonksiyonu kullansın; davranış birebir aynı kalsın (boş durumlar, banner, breadcrumb, `generateMetadata` dahil). Kart verisini hazırlayan kodu (`ProductCard`'a giden obje, `resolveProductDisplayPrice` ve `FALLBACK_IMAGE` dahil) `toCatalogCardProps(entry, automaticCampaigns)` adıyla aynı dosyaya al. Böylece hem ilk render hem sonraki partiler aynı kodu kullanır.
>
> **2. Parti boyutu ve URL.** `CATALOG_PAGE_SIZE = 24` sabiti tanımla. `page.tsx` `?goster=` parametresini okusun: geçerli bir sayıysa en yakın 24'ün katına yuvarla, alt sınır 24, üst sınır toplam giriş sayısı olsun. Sunucu yalnızca `entries.slice(0, goster)` kadar kartı render etsin. Toolbar'daki `count` toplam sonuç sayısı (`entries.length`) olarak kalsın. `goster` parametresini `FILTER_PARAM_KEYS`'e ekleme, filtre sayısına da katma. Ama filtre çekmecesi, sıralama ve kategori linkleri URL'yi değiştirirken `goster` parametresini silsin (`catalog-toolbar.tsx` ve `filter-drawer.tsx`'te URL'nin nasıl kurulduğuna bak). Böylece filtre değişince liste 24'ten başlar.
>
> **3. Sunucu aksiyonu.** `src/app/(site)/urunler/actions.ts` içinde `"use server"` ile `loadMoreCatalog(query: string, offset: number)` yaz. Aksiyon `getCatalogListing(new URLSearchParams(query))` çağırsın ve `entries.slice(offset, offset + CATALOG_PAGE_SIZE).map(toCatalogCardProps)` ile `{ items, total }` döndürsün. `offset`'i doğrula (negatif veya sayı değilse 0 kabul et). Yeni bir `app/api/...` route'u AÇMA.
>
> **4. Client bileşen `src/components/catalog-grid.tsx`** (`"use client"`). Props: `initialItems`, `total`, `query` (goster hariç mevcut search params stringi). Grid'in className'i şu anki grid ile birebir aynı olsun: `mt-8 -mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:mx-0 md:grid-cols-4 md:gap-6`. Kartlar mevcut `ProductCard` ile render edilsin, key yapısı aynı kalsın. `ProductCard` client bileşen değilse ya da server-only bir şey import ediyorsa önce bunu kontrol et, gerekirse bana sor.
> - Grid'in altında, ortada `mt-16 flex flex-col items-center gap-5` bir blok olsun:
>   - Sayaç: `"{shown} / {total} ürün gösteriliyor"`, stil `text-xs tracking-[0.48px] text-ink/60`.
>   - İlerleme çizgisi: `h-[2px] w-40 bg-ink/10` kap, içinde `bg-ink` dolgu. Genişlik `shown/total` oranında olsun, `transition-[width] duration-500`.
>   - Buton: sitedeki pill stili (`flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream`). Etiket "Daha Fazla Göster". Butonu `<a href={`/urunler?${query}&goster=${shown + 24}`}>` olarak render et ve JS varken `onClick`'te `preventDefault` yap. Böylece JS kapalıyken ve Google için de çalışır.
>   - Tıklanınca `useTransition` içinde `loadMoreCatalog(query, shown)` çağır. Bekleme sırasında buton etiketi "Yükleniyor" olsun, `aria-busy` alsın ve tıklanamasın. Gelen öğeleri listeye ekle, sonra `window.history.replaceState` ile URL'yi `goster={yeni sayı}` olacak şekilde güncelle. Next.js'in bu sürümünde `replaceState`'in router ile uyumlu kullanımını dokümandan doğrula. `router.push` kullanma, çünkü sayfa baştan render edilip kaydırma konumu kayar.
>   - Hata olursa buton eski haline dönsün, altında küçük bir "Yüklenemedi, tekrar deneyin" metni çıksın.
>   - `shown >= total` olunca buton ve çizgi kaybolsun. Yerine `"Tüm ürünleri gördünüz · {total} ürün"` metni ve `window.scrollTo({ top: 0, behavior: "smooth" })` yapan "Başa dön ↑" metin butonu gelsin (`text-[10px] uppercase tracking-[1px] underline underline-offset-2`).
>   - `total <= 24` ise bu blok hiç render edilmesin.
> - **Animasyon:** yeni eklenen kartları bir sarmalayıcıyla `opacity-0 translate-y-3` → `opacity-100 translate-y-0` geçişiyle göster (400 ms ease-out, kart başına `index * 30ms` gecikme, en fazla 300 ms). İlk render'daki kartlar animasyonsuz gelsin. `motion-reduce:` ile animasyonu kapat. Sarmalayıcı grid hücresi davranışını bozmasın.
> - **Erişilebilirlik:** `aria-live="polite"` görünmez bir alanda `"{n} ürün daha yüklendi"` duyur. Yükleme bitince odağı ilk yeni kartın linkine taşı (`preventScroll: true`).
> - **Kaydırma:** ekleme sırasında sayfa zıplamasın. Butona basan kişinin ekranı olduğu yerde kalsın. Görsellerde `ProductCard`'ın mevcut en-boy oranı kutusu olduğundan emin ol; yoksa layout shift olur, kontrol et.
>
> **5. `page.tsx`'te** grid dalını `<CatalogGrid initialItems={...} total={entries.length} query={...} />` ile değiştir. Boş durum dalları olduğu gibi kalsın.
>
> **6. Geri tuşu testi:** `?goster=72` ile sayfayı açınca 72 kart sunucudan gelsin. Bir karta tıklayıp tarayıcı geri tuşuyla dönünce 72 kart ve kaydırma konumu korunsun. Korunmuyorsa bu Next sürümünün scroll restoration davranışını dokümandan kontrol edip düzelt.
>
> **7. Kesinlikle yapma:** IntersectionObserver ile otomatik yükleme, sonsuz kaydırma, "yaklaşınca kendiliğinden yükle" davranışı. Yükleme SADECE butona basınca olsun. Footer her zaman erişilebilir kalsın.
>
> **8. Doğrulama:** `npm run lint` ve `npx tsc --noEmit` hatasız olsun. Localhost'ta Playwright ile şunlara bak: masaüstü 1440px ve mobil 390px; Tüm Ürünler, bir kategori, cinsiyet koleksiyonu, arama sonucu (`?ara=`) ve filtreli görünümde butonun doğru çalışması, sayaç, son partide butonun kaybolması, filtre değişince 24'e dönüş. Ekran görüntülerini göster.
>
> **9. Proje kuralları:** Değişiklikleri önce localhost'ta göreceğim. Ben onaylayınca YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan. İş bitince `DEPLOY_STATUS.md`'ye not düş.

## Test Listesi (localhost'ta)

- Tüm Ürünler'de ilk açılışta 24 kart var mı, sayaç "24 / X" gösteriyor mu?
- "Daha Fazla Göster" → 24 kart daha yumuşakça geliyor mu, sayfa zıplamıyor mu, URL `?goster=48` oldu mu?
- Kaydırarak aşağı inince hiçbir şey kendiliğinden yüklenmiyor mu, footer'a rahatça iniliyor mu?
- 48 ürün açıkken bir ürüne gir → geri dön: 48 ürün ve kaldığın konum duruyor mu?
- Filtre, sıralama veya kategori değiştir → liste 24'ten başlıyor mu?
- Son partide buton kayboluyor, "Tüm ürünleri gördünüz" ve "Başa dön" çıkıyor mu?
- 24'ten az ürünü olan kategoride blok hiç görünmüyor mu?
- Arama sonucu sayfasında (`?ara=gömlek`) da çalışıyor mu?
- Mobilde (390px) sayaç, çizgi ve buton düzgün ortalı mı?
- Hızlı sepete ekle (+), renk swatch'ları ve hover görseli yeni yüklenen kartlarda da çalışıyor mu?
