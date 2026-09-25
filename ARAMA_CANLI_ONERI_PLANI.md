# Site Araması — Canlı Öneri + Animasyonlu Arama Paneli Planı

## İstek

Header'daki arama butonu çalışmıyor, basınca Ürünler sayfasına gidiyor. Çalışır hale getirilecek:
- Yazdıkça en yakın **3–4 sonuç** anında görünsün, yazılanlar arttıkça sonuçlar daralsın/netleşsin.
- Açılırken ve kapanırken hafif, şık bir animasyon olsun.
- Mobilde de düzgün ve kullanışlı olsun.

## Mevcut Durum (incelendi)

- `src/components/site-header.tsx` ~609. satır: arama ikonu sadece `<Link href="/urunler">`. Kodda "Arama şimdilik /urunler'e yönlendiriyor, gerçek arama işlevi bu adımın kapsamı dışında" yorumu var. Yani hata yok, arama hiç yazılmamış.
- İkon sadece masaüstünde (`hidden xl:inline-flex`). **Mobilde arama ikonu yok.**
- `src/app/(site)/urunler/page.tsx` sadece `kategori`, `cinsiyet`, `sirala` ve filtre parametrelerini okuyor, **arama parametresi yok**.
- `src/lib/catalog.ts` → `getCatalogEntries()` çok renkli ürünü renk başına ayrı giriş olarak döndürüyor. Kart verisi (`CatalogEntry`) hazır, yeniden kullanılabilir.
- `Product` modelinde aranabilir alanlar: `name`, `code` (ürün/stil kodu, örn. 3WAM10005LK), `brand`, `category`, `gender`, `tags`, varyantlarda `sku` ve `barcode`.
- Veritabanı: Postgres (Neon). Türkçe büyük/küçük harf sorunu var: `İ/ı` ve `ILIKE` iyi anlaşamıyor, ayrıca "gomlek" yazan "gömlek"i de bulabilmeli.
- Mobil menüde (`MobileMenu`) `shouldRender` + `visible` + 300 ms gecikmeli unmount ile açılış/kapanış animasyonu deseni zaten var. Ayrıca `backdrop-blur` yüzünden overlay'in `createPortal` ile body'ye taşınması gerekiyor. Arama paneli de **aynı deseni** kullanmalı.
- `src/lib/revalidate-catalog.ts` ürün değişince sayfaları tazeliyor. Arama indeksinin önbelleği de buraya bağlanmalı.

## Önerilen Çözüm

### 1) Arama altyapısı (sunucu)

- **Arama indeksi:** Yayındaki tüm ürünlerin hafif bir listesi. Her ürün için: id, slug, ad, kod, marka, kategori, cinsiyet, renkler (+ renk görseli), fiyat, indirimli fiyat, ilk görsel, stok durumu ve SKU/barkod listesi. Buna bir de **normalize edilmiş arama metni** eklenir: küçük harf, Türkçe harfler sadeleştirilmiş (ı/İ→i, ş→s, ğ→g, ü→u, ö→o, ç→c).
- İndeks `unstable_cache` ile `search-index` etiketiyle önbelleğe alınır. `revalidateCatalog()` içine `revalidateTag("search-index")` eklenir, böylece ürün eklenince/düzenlenince arama da güncellenir. Her tuş vuruşunda veritabanına gidilmez: hızlı olur, Neon/Vercel yükü düşük kalır.
- **Eşleştirme:** Sorgu kelimelere bölünür. **Her kelime** ürünün arama metninde bir yerde geçmeli (VE mantığı). "siyah erkek tişört" gibi aramalar bu yüzden kelime ekledikçe daralır.
- **Puanlama (en yakın sonuç üstte):**
  1. Ürün kodu / SKU / barkod birebir eşleşmesi → en üstte
  2. Ad sorguyla başlıyor
  3. Addaki bir kelime sorguyla başlıyor
  4. Adın içinde geçiyor
  5. Sadece marka/kategori/renk üzerinden eşleşiyor
  - Eşitlikte: stokta olan önce, sonra öne çıkan (isFeatured), sonra en yeni.
- Sorgu bir renk içeriyorsa ("siyah") o rengin görseli gösterilir ve link `?renk=Siyah` ile açılır.
- **API:** `GET /api/arama?q=...` → `{ results: [en fazla 4], total }`. En az 2 karakter şartı var. Yanıt `Cache-Control: s-maxage=60, stale-while-revalidate=300` ile CDN'de önbelleklenir, aynı arama tekrar fonksiyon çalıştırmaz.

### 2) Arama paneli (istemci) — `src/components/search-overlay.tsx`

**Masaüstü (xl+):** Header'ın hemen altından kayarak inen, tam genişlikte krem panel (mega menü hissi). Üstte büyük, alt çizgili ince bir input, altında **4 sütunlu mini ürün kartları** (görsel, ad, fiyat). Arkada hafif koyu backdrop.

**Mobil:** Tam ekran panel. Üstte input + "Vazgeç" butonu, altında sonuçlar **dikey liste** (solda küçük görsel, sağda ad/marka/fiyat). Klavye açıkken de rahat kaydırılır. Mobil header'da solda boş duran sütuna **arama ikonu** eklenir (sağ taraf sepet + hamburger ile dolu, 390 px'te logoya binmesin).

**Davranış:**
- Yazdıkça **200 ms debounce** ile arama yapılır. Eski istek `AbortController` ile iptal edilir. Aynı sorgunun sonucu bellekte tutulur, geri silince anında gelir.
- Boş input'ta: **"Son aramalar"** (localStorage, en fazla 5, silinebilir) + **popüler kategori** chip'leri (header'da zaten olan `menuData`'dan).
- 1 karakterde: "En az 2 harf yazın" ipucu.
- Yüklenirken: 4 adet iskelet (skeleton) kart, zıplama olmasın.
- Sonuçta eşleşen kısım **kalın** gösterilir.
- Altta **"Tüm sonuçları gör (N)"** linki → `/urunler?ara=...`
- **Enter** → `/urunler?ara=...`. **↑/↓** ile sonuçlar arasında gezilir, Enter seçileni açar.
- Sonuç yoksa: "“xyz” için sonuç bulunamadı" + kategori chip'leri.
- Kapanma: **Esc**, backdrop'a tıklama, X/Vazgeç, sonuca tıklama, sayfa değişimi.
- Açıkken body scroll kilitli. Açılınca input otomatik odaklanır, kapanınca odak arama ikonuna döner.

**Animasyon (hafif ve zarif):**
- Açılış: backdrop 0→%40 opaklık (200 ms). Panel masaüstünde yukarıdan `-translate-y-2 + opacity-0` → yerine (260 ms, ease-out). Mobilde `opacity + scale-[0.98]` → normal (mobil menüyle aynı dil).
- Sonuç kartları sırayla belirir (her biri 40 ms arayla fade + 4 px yukarı kayma).
- Kapanış: aynısının tersi, 200 ms. Animasyon bitince DOM'dan kaldırılır (mobil menüdeki `shouldRender/visible` deseni).
- `prefers-reduced-motion` açıksa animasyonlar kapanır.
- Arama ikonu ile X ikonu arasında küçük dönüş/geçiş (hamburger↔X gibi).

**Mobil detaylar:** Input `font-size: 16px` (iOS'ta zoom yapmasın), `inputMode="search"`, `enterKeyHint="search"`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="none"`. Yükseklik `100dvh` (klavye açılınca taşmasın). Dokunma alanları en az 44 px.

### 3) Ürünler sayfasında tam sonuç — `/urunler?ara=...`

- `ara` parametresi okunur, `getCatalogEntries` sonuçları **aynı eşleştirme fonksiyonu** ile süzülür. Mevcut filtre, sıralama ve kategori sistemiyle birlikte çalışır.
- Banner başlığı: **"“gömlek” için sonuçlar"**, altında "N ürün". Breadcrumb: Ana Sayfa / Arama.
- Sonuç yoksa "yakında" ekranı yerine **"Sonuç bulunamadı"** mesajı + "Tüm ürünlere göz at" linki.
- Sayfa başlığı (metadata): `“gömlek” araması | Bollmark`. `robots: noindex` (arama sayfaları Google'a girmesin).

## Karar vermen gereken 2 küçük nokta (öneri ile)

1. **Son aramalar:** Öneri: evet, sadece kullanıcının kendi tarayıcısında tutulur, "Temizle" butonu olur. İstemezsen prompttaki ilgili maddeyi sil.
2. **Mobil arama ikonunun yeri:** Öneri: header'ın **sol** tarafı (şu an mobilde boş). Alternatif: mobil menünün en üstüne bir arama kutusu. Önerim ikon, çünkü tek dokunuşla açılıyor.

---

## Claude Code için Prompt

> Sitedeki arama butonu gerçek bir arama değil, şu an `site-header.tsx` içinde sadece `/urunler`'e giden bir `<Link>`. Canlı öneri gösteren, animasyonlu, mobil uyumlu gerçek bir arama yapacağız. Önce `src/components/site-header.tsx` (özellikle `MobileMenu`'nun `shouldRender/visible` animasyon deseni ve `createPortal` kullanımı), `src/lib/catalog.ts` (`getCatalogEntries`, `productToCatalogEntries`, `CatalogEntry`), `src/lib/catalog-filters.ts`, `src/app/(site)/urunler/page.tsx`, `src/lib/revalidate-catalog.ts`, `src/lib/catalog-banner.ts` ve `prisma/schema.prisma` (Product: name, code, brand, category, gender, tags; ProductVariant: sku, barcode) dosyalarını oku. Mevcut tasarım diline (krem/ink renkler, ince büyük harf tipografi, `nav-underline`, `HEADER_ICON_LINK_CLASS`) sadık kal. Yüklü skill'leri kullan.
>
> **1. Arama çekirdeği — `src/lib/search.ts`**
> - `normalizeTr(s)`: küçük harfe çevir (önce `İ→i`, `I→ı`), sonra `ı→i, ş→s, ğ→g, ü→u, ö→o, ç→c`, aksanları temizle, fazla boşlukları sadeleştir. "GÖMLEK", "gomlek", "Gömlek" aynı sonucu versin.
> - `getSearchIndex()`: yayındaki (`status: "PUBLISHED"`) tüm ürünler için hafif bir kayıt listesi döndürsün: id, slug, name, code, brand adı, category adı (+ parent adı), gender, renk etiketleri (renk başına ilk/kapak görseli ile), priceCents, compareAtCents, ilk görsel (mevcut `firstImageUrl`/`pickCoverImage` mantığı), outOfStock, isFeatured, createdAt, varyant sku+barcode listesi ve hepsinden oluşan normalize edilmiş `haystack`. Bunu `unstable_cache(..., ["search-index"], { tags: ["search-index"], revalidate: 3600 })` ile önbelleğe al. Sadece gereken alanları `select` et, ağır include kullanma.
> - `revalidate-catalog.ts` içindeki `revalidateCatalog()` fonksiyonuna `revalidateTag("search-index")` ekle ki ürün değişince arama indeksi tazelensin.
> - `searchProducts(index, query, limit)`: sorguyu normalize et, kelimelere böl. **Her kelime** haystack'te geçmeli (AND). Puanlama: kod/SKU/barkod birebir eşleşmesi (1000) > ad sorguyla başlıyor (500) > addaki bir kelime bir sorgu kelimesiyle başlıyor (kelime başına 200) > ad içinde geçiyor (100) > sadece marka/kategori/renk eşleşmesi (20). Eşitlikte stokta olan önce, sonra isFeatured, sonra yeni. Sorgu kelimelerinden biri ürünün bir rengiyle eşleşiyorsa o rengin görselini ve `?renk=<etiket>` linkini döndür. Aksi halde ürün tek sonuç olarak gelsin (renk başına tekrar etmesin). `{ results, total }` döndürsün.
> - Aynı eşleştirme mantığını `CatalogEntry[]` süzmek için de dışa aç (`matchesQuery(entryText, query)` benzeri), böylece Ürünler sayfası da aynı kuralı kullanır.
>
> **2. API — `src/app/(site)/api/arama/route.ts`**
> - `GET ?q=`. `q` trim'lenmiş haliyle 2 karakterden kısaysa `{ results: [], total: 0 }`. En fazla 80 karakter al. `limit` 4.
> - Her sonuç: `{ slug, href, name, brand, image, priceCents, compareAtCents, outOfStock, colorLabel }`. Mevcut aktif otomatik kampanya indirimleri ürün kartında nasıl uygulanıyorsa (ürünler sayfasındaki `getActiveAutomaticPercentCampaigns` kullanımına bak) aynı indirimli fiyat burada da gösterilsin. Kartla popup'ta farklı fiyat görünmesin.
> - Yanıta `Cache-Control: public, s-maxage=60, stale-while-revalidate=300` ekle.
>
> **3. Arama paneli — `src/components/search-overlay.tsx` (`"use client"`)**
> - Props: `open`, `onClose`, `categories` (header'daki `menuData`'dan birkaç popüler kategori chip'i için). `createPortal` ile `document.body`'ye render et (header'daki backdrop-blur yüzünden, `MobileMenu`'daki yorumla aynı sebep).
> - Açılış/kapanış animasyonu için `MobileMenu`'daki `shouldRender` + `visible` + `requestAnimationFrame` + gecikmeli unmount desenini birebir kullan: backdrop `bg-ink/40` opacity 0→1 (200 ms). **Masaüstü** panel header'ın altından (`top-[72px]`) tam genişlikte, krem zemin, `-translate-y-2 opacity-0 → translate-y-0 opacity-100` (260 ms, ease-out). **Mobil** tam ekran (`fixed inset-0`, `h-[100dvh]`), `opacity + scale-[0.98] → scale-100`. Kapanış 200 ms, animasyon bitince unmount. Sonuç kartları sırayla (index × 40 ms `transition-delay`) fade + 4 px yukarıdan gelsin. `motion-reduce:` ile tüm geçişleri kapat.
> - Input: büyük, sadece alt çizgili, solda arama ikonu, sağda yazı varken "temizle" (×) butonu. Mobilde sağda "Vazgeç" metin butonu, masaüstünde X ikonu. `type="search"`, `inputMode="search"`, `enterKeyHint="search"`, `autoComplete="off"`, `autoCorrect="off"`, `autoCapitalize="none"`, `spellCheck={false}`, mobilde en az `text-base` (16 px, iOS zoom yapmasın). Placeholder: "Ürün, marka veya ürün kodu ara". Açılınca otomatik odaklansın, kapanınca odak arama ikonuna dönsün.
> - Arama: 200 ms debounce, `AbortController` ile önceki isteği iptal et, sorgu→sonuç eşlemesini bir `Map`'te tut (geri silince anında gelsin). Yüklenirken 4 iskelet kart (layout zıplamasın).
> - Durumlar: (a) boş input → "Son Aramalar" (localStorage `bollmark:recent-searches`, en fazla 5, tek tek silme + "Temizle"; localStorage erişimini try/catch ile sar) ve "Popüler Kategoriler" chip'leri; (b) 1 karakter → "En az 2 harf yazın"; (c) sonuç var → sonuçlar + altta "Tüm sonuçları gör (N) →" linki `/urunler?ara=<q>`; (d) sonuç yok → "“q” için sonuç bulunamadı" + kategori chip'leri.
> - Sonuç görünümü: **masaüstü** 4 sütunlu mini kart (3:4 görsel, marka küçük büyük harf, ad, fiyat; indirimliyse eski fiyat üstü çizili). **Mobil** dikey liste (solda 64×85 görsel, sağda marka/ad/fiyat, satırlar arasında `border-line`). Eşleşen kısmı `<mark>` yerine `font-semibold` ile vurgula (Türkçe normalize edilmiş eşleşmeyi orijinal metin üzerinde doğru konumla bul). Görsel yoksa nötr yer tutucu. Stokta yoksa küçük "Tükendi" etiketi.
> - Klavye: Esc kapatır, ↑/↓ sonuçlar arasında gezer (aktif satır belirgin olsun, `aria-activedescendant`), Enter aktif sonuç varsa onu açar, yoksa `/urunler?ara=<q>`'ya gider. Arama yapılan her sorguyu (Enter veya sonuca tıklama) son aramalara ekle.
> - Erişilebilirlik: `role="dialog"`, `aria-modal`, `aria-label="Ürün ara"`, input `role="combobox"` + `aria-expanded` + `aria-controls`, liste `role="listbox"`, sonuçlar `role="option"`. Açıkken body scroll kilitli. Backdrop'a tıklayınca, sonuca tıklayınca ve `pathname`/`searchParams` değişince kapansın.
>
> **4. Header entegrasyonu — `site-header.tsx`**
> - Masaüstündeki `<Link href="/urunler" aria-label="Ürünlerde ara">` yerine `searchOpen` state'ini açan bir `<button type="button">` koy (`HEADER_ICON_LINK_CLASS` ve `nav-underline` görünümü aynen kalsın). İlgili "gerçek arama kapsam dışı" yorumunu güncelle.
> - **Mobilde** (xl altı) header'ın **sol** sütununa aynı arama ikonunu ekle (orada mobilde bir şey yok). Logo 390 px'te tam ortada kalmalı ve hiçbir şeyin üstüne binmemeli, `grid-cols-[1fr_auto_1fr]` yapısını bozma. Dokunma alanı en az 44 px.
> - Arama açıkken header saydam olmasın (`transparent` hesabına `!searchOpen` ekle). Arama açılırken mega menü (`openMenu`) ve mobil menü kapansın. Mobil menü açılırken de arama kapansın.
> - Arama ikonu açıkken X'e dönüşsün (`AnimatedMenuIcon` gibi yumuşak bir geçişle), masaüstünde ikona tekrar basınca kapansın.
> - İsteğe bağlı kısayol: masaüstünde `/` tuşu (bir input içinde değilken) aramayı açsın.
>
> **5. Ürünler sayfası — `/urunler?ara=...`**
> - `urunler/page.tsx`'te `ara` parametresini oku (80 karakterle sınırla). Doluysa `rawEntries`'i `lib/search.ts`'teki aynı eşleştirme kuralıyla süz. Kategori/cinsiyet/filtre/sıralama ile birlikte çalışsın. Filtre çekmecesindeki facet'ler süzülmüş arama sonuçlarından üretilsin. Filtre/sıralama değişince `ara` parametresi URL'de korunsun (`catalog-toolbar.tsx` ve `filter-drawer.tsx`'te parametreleri nasıl yazdığına bak, `FILTER_PARAM_KEYS` temizlenirken `ara` silinmesin).
> - Aramada banner başlığı `“<q>” için sonuçlar`, altında `N ürün`. Breadcrumb: Ana Sayfa / Arama.
> - Aramada sonuç yoksa `EmptyCategoryState` ("yakında") yerine sade bir boş durum göster: "“q” için sonuç bulunamadı. Farklı bir kelime deneyin." + "Tüm ürünlere göz at" linki.
> - `generateMetadata`: `ara` varsa title `“q” araması | Bollmark` ve `robots: { index: false, follow: true }`.
>
> **6. Kontrol**
> - `npm run lint` ve `npx tsc --noEmit` hatasız olsun.
> - `npm run dev` ile localhost'ta test et: 1440 px ve 390 px genişlikte açılış/kapanış animasyonu, "gom" / "gömlek" / "GÖMLEK" aynı sonuç, "siyah gömlek" gibi çok kelimeli arama daralıyor mu, bir Koton ürün kodu ile arama en üstte doğru ürünü getiriyor mu, ↑/↓/Enter/Esc, sonuç yok durumu, "Tüm sonuçları gör" → ürünler sayfası + filtre/sıralama ile `ara` korunuyor mu, mobilde klavye açıkken panel taşmıyor mu, iOS'ta zoom yok mu.
> - Admin'de bir ürünün adını değiştirince (revalidateCatalog çalışınca) aramanın yeni adı bulduğunu doğrula.
>
> **Proje kuralları:** Değişiklikleri önce localhost'ta göreceğim. Ben onaylayınca **YEREL commit** at, **ben söylemeden push etme**. İş bitince `DEPLOY_STATUS.md`'ye not düş. Sonunda bana test ettiğin şeylerin kısa bir listesini ver.

## Test Listesi (localhost'ta senin kontrol edeceklerin)

- [ ] Masaüstü: arama ikonuna bas → panel yukarıdan yumuşakça iniyor mu, arka plan kararıyor mu?
- [ ] Esc / boşluğa tıklama / X ile kapanınca yumuşakça kayboluyor mu?
- [ ] "gö" → "gömlek" → "gömlek siyah" yazdıkça sonuçlar netleşiyor mu? En fazla 4 sonuç var mı?
- [ ] "gomlek" (Türkçe karaktersiz) ve büyük harfle yazınca da buluyor mu?
- [ ] Bir ürün kodunu (örn. Koton kodu) yazınca doğru ürün en üstte mi?
- [ ] Fiyatlar ürün kartındakiyle aynı mı (kampanya indirimi dahil)?
- [ ] Enter veya "Tüm sonuçları gör" → Ürünler sayfasında arama sonuçları + başlık doğru mu? Filtre/sıralama değiştirince arama kayboluyor mu? (Kaybolmamalı.)
- [ ] Olmayan bir şey yaz → "sonuç bulunamadı" düzgün mü?
- [ ] Mobil (telefon/390 px): header solunda arama ikonu var mı, logo ortada mı? Panel tam ekran açılıyor mu, klavye açıkken sonuçlar kaydırılabiliyor mu, iPhone'da ekran zoom yapıyor mu?
- [ ] Son aramalar görünüyor mu, silinebiliyor mu?
