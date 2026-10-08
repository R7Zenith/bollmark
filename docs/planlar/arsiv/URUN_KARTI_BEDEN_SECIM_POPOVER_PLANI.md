# Ürün Kartı — "+" Hızlı Sepete Ekle Butonuna Beden Seçim Kutusu (Araştırma + Claude Code Promptu)

## Sorun

Katalog sayfasındaki ürün kartlarının sağ altındaki `+` butonu şu an tıklanınca hiçbir beden sormadan direkt sepete ekliyor. Kullanıcının "rastgele beden atıyor" dediği davranışın kaynağı bulundu:

- `src/lib/catalog.ts` içindeki `pickQuickAddVariant` fonksiyonu, stoktaki varyantlar arasından **sadece ilkini** (`variants.find((v) => v.stock > 0)`) seçip tek bir `QuickAddVariant` döndürüyor.
- `src/components/product-card.tsx` içindeki `handleQuickAdd`, bu tek varyantı sorgusuz sualsiz `addLine(...)` ile sepete atıyor.
- Yani beden gerçekten rastgele değil ama kullanıcıya hiç sorulmuyor — DB'de hangi varyant "ilk" geliyorsa o gidiyor, çoğu zaman istenen beden değil.

## Mevcut durum (kodla doğrulandı)

- `QuickAddVariant = { variantId: string; size: string; color: string } | null` — tek varyant taşıyor, `getPublishedProducts`, `getCatalogEntries`, `getRelatedProducts` (hepsi `src/lib/catalog.ts`) bunu `pickQuickAddVariant(...)` ile dolduruyor.
- `product-card.tsx`'te `+` butonu görsel olarak zaten var: `absolute bottom-2 right-2 ... rounded-full bg-ink text-cream`, tıklanınca `Check` ikonuna dönüp 1.5sn sonra `Plus`'a geri dönüyor (`justAdded` state'i).
- Beden bilgisi başka bir yerde zaten kutucuklu/zarif şekilde gösteriliyor: ürün detay sayfasında (`product-viewer.tsx`, "Beden" bölümü) kare kutucuklar (`h-7 min-w-[28px] border border-ink`, seçili olan `bg-ink text-cream`), sıralama admin panelindeki `VariantAttributeValue.position` alanına göre (`optionPosition()` yardımcı fonksiyonu `src/lib/variant-attributes.ts`'te zaten var, kullanılabilir).
- Site paleti tamamen monokrom (`ink` #111111, `cream` #ffffff, `tailwind.config.ts`), hazır bir `shadow-soft` gölgesi (`0 8px 30px -12px rgba(17,17,17,0.08)`) tanımlı — yüzen (floating) bir kutu için hazır, ekstra tasarım gerekmiyor. Projede hazır bir animasyon/keyframe kütüphanesi yok, geçişler şu ana kadar sade Tailwind `transition`/`duration` class'larıyla yapılmış (bkz. kartın kendi hover geçişleri).

## Önerilen çözüm

**Veri katmanı:** `pickQuickAddVariant` → `pickQuickAddVariants` olarak değişir, stoktaki **tüm** bedenleri (`VariantAttributeValue.position`'a göre sıralı) bir dizi olarak döner. `QuickAddVariant` tipi tekil öğeyi temsil etmeye devam eder (`{ variantId, size, color }`), ama kart verisindeki alan `quickAddVariants: QuickAddVariant[]` olur (boş dizi = stokta hiç yok, buton zaten `outOfStock` kontrolüyle gizli kalıyor).

**Arayüz:** `+` butonuna tıklanınca:

- Stokta **tek** beden varsa (renk grubunda başka seçenek yok) — soru sormanın anlamı yok, direkt eskisi gibi o tek varyant sepete eklenir, `Check` animasyonu oynar.
- Stokta **birden fazla** beden varsa — buton bedeni direkt eklemek yerine, **butonun üzerinden yukarı doğru sarkan** (görsel üzerine taşan), köşeleri yumuşak, `shadow-soft` gölgeli, beyaz (`cream`) bir kutu açılır. İçinde `product-viewer.tsx`'teki beden kutucuklarıyla aynı dilde (kare, `border-ink`, hover'da `bg-ink`/`text-cream`) küçük beden çipleri sıralanır. Butonun tam altına, kutuyu butona görsel olarak bağlayan küçük bir "kuyruk" (45°'e döndürülmüş küçük kare, ok gibi) eklenir — kutu gerçekten butondan "sarkıyormuş" gibi durur.
- Açılış/kapanış Tailwind `transition-all duration-200` ile `opacity/scale/translate-y` üzerinden yumuşak geçişli olur (kutu her zaman DOM'da durur, `sizePickerOpen` durumuna göre görünürlüğü class'larla değişir — proje ekstra animasyon kütüphanesi kullanmadığı için en tutarlı yöntem bu).
- Bir bedene tıklanınca o varyant sepete eklenir, kutu kapanır, buton `Check` ikonuyla 1.5sn onay animasyonu oynatır (mevcut `justAdded` davranışı korunur).
- Kutu açıkken dışarı tıklanırsa veya `Escape`'e basılırsa kapanır. `+` butonunun ikonu kutu açıkken `X`'e dönüşür (tekrar tıklayınca kapatma imkânı).
- Tüm tıklamalar `preventDefault`/`stopPropagation` ile korunur ki kart linkine (`/urunler/{slug}`) yönlendirme tetiklenmesin — kartta zaten favori butonu ve renk swatch'larında aynı desen kullanılıyor.

Bu tasarım hem "rastgele beden gitmesin" isteğini çözüyor hem de kullanıcının tarif ettiği "zarif, animasyonlu, butondan sarkan beden kutusu" hissini, projenin mevcut görsel dilinden (monokrom, keskin/yarı-yuvarlak kutucuklar, `shadow-soft`) hiç sapmadan veriyor.

## Claude Code için Prompt (uygulama bu promptla yapılacak)

---

> Katalog sayfalarındaki ürün kartlarında (`src/components/product-card.tsx`) sağ alttaki `+` (hızlı sepete ekle) butonu şu an tıklanınca hiç beden sormadan, stoktaki ilk varyantı direkt sepete ekliyor. Bunun yerine tıklanınca zarif, animasyonlu, butondan yukarı doğru sarkan bir beden seçim kutusu açılmalı; kullanıcı bedeni seçtikten sonra sepete eklensin.
>
> **1) `src/lib/catalog.ts` — veri katmanı:**
> - `QuickAddVariant` tipini tekil öğe olarak bırak: `export type QuickAddVariant = { variantId: string; size: string; color: string };` (artık `| null` yok).
> - `pickQuickAddVariant` fonksiyonunu `pickQuickAddVariants` olarak yeniden yaz — stoktaki (`stock > 0`) TÜM varyantları, `src/lib/variant-attributes.ts`'teki `optionPosition(variant, "Beden")` değerine göre küçükten büyüğe sıralı bir `QuickAddVariant[]` olarak döndürsün (stokta hiç yoksa boş dizi `[]`). Örnek:
>   ```ts
>   function pickQuickAddVariants(
>     variants: (VariantOptionInclude & { id: string; stock: number })[]
>   ): QuickAddVariant[] {
>     return variants
>       .filter((v) => v.stock > 0)
>       .sort((a, b) => optionPosition(a, "Beden") - optionPosition(b, "Beden"))
>       .map((v) => ({ variantId: v.id, size: optionValue(v, "Beden"), color: optionValue(v, "Renk") }));
>   }
>   ```
>   (`optionPosition` import'unu `variant-attributes.ts`'ten ekle.)
> - Bu fonksiyonu çağıran üç yer var, hepsinde alan adını `quickAddVariant` → `quickAddVariants` yap ve `pickQuickAddVariants(...)` çağır: `getPublishedProducts` (satır ~91), `getCatalogEntries`'in hem tek-renkli hem çok-renkli dalları (satır ~214 ve ~243), `getRelatedProducts` (satır ~276).
> - `CatalogEntry` tipindeki `quickAddVariant: QuickAddVariant;` alanını `quickAddVariants: QuickAddVariant[];` yap, yorum satırını da güncelle (artık tek varyant değil, stoktaki tüm bedenler).
>
> **2) `src/components/product-card.tsx` — arayüz:**
> - `ProductCardData` tipindeki `quickAddVariant?: QuickAddVariant` alanını `quickAddVariants?: QuickAddVariant[]` yap.
> - `useState, useRef, useEffect` (React) ve `X` ikonunu (`lucide-react`, mevcut `Heart, Plus, Check` importuna ekle) içeri al.
> - Yeni state: `const [sizePickerOpen, setSizePickerOpen] = useState(false);` ve kutunun dışına tıklamayı yakalamak için `const sizePickerRef = useRef<HTMLDivElement>(null);`.
> - `handleQuickAdd`'i ikiye ayır:
>   - Ortak bir `addVariantToCart(variant: QuickAddVariant)` fonksiyonu — mevcut `addLine({...})` çağrısını (compareAtCents/priceCents mantığı olduğu gibi kalsın) buraya taşı, sonrasında `setSizePickerOpen(false); setJustAdded(true); setTimeout(() => setJustAdded(false), 1500);` çalıştırsın.
>   - Butona tıklanınca çalışacak `handleQuickAddClick(e)`: `e.preventDefault(); e.stopPropagation();` sonra `const variants = product.quickAddVariants ?? [];` — boşsa veya `justAdded` ise `return`. `variants.length === 1` ise direkt `addVariantToCart(variants[0])` çağır (tek seçenek varken soru sormaya gerek yok). Birden fazlaysa `setSizePickerOpen((open) => !open)`.
>   - Bir bedene tıklanınca çalışacak `handleSizeSelect(e, variant)`: `e.preventDefault(); e.stopPropagation(); addVariantToCart(variant);`.
> - Dışarı tıklama / Escape ile kapatma: `sizePickerOpen` true iken `document`'a `mousedown` ve `keydown` listener'ı ekleyen bir `useEffect` — `mousedown`'da `sizePickerRef.current` tıklanan elemanı içermiyorsa, `keydown`'da tuş `"Escape"` ise `setSizePickerOpen(false)`. Cleanup'ta listener'ları kaldır.
> - Butonu şu an sardığı `<div className="relative aspect-[3/4] ...">` içinde, buton artık kendi `relative` konumlandırılmış küçük bir sarmalayıcı `div`'e alınmalı (popover'ı ona göre konumlandırmak için). Mevcut buton JSX'ini şöyle bir yapıya çevir (class'lardaki mevcut boyut/renk/geçiş değerlerini birebir koru, sadece yapı ve içerik değişiyor):
>   ```tsx
>   {product.quickAddVariants && product.quickAddVariants.length > 0 && !product.outOfStock && (
>     <div ref={sizePickerRef} className="absolute bottom-2 right-2 sm:bottom-3 sm:right-3">
>       <button
>         type="button"
>         onClick={handleQuickAddClick}
>         title="Hızlı sepete ekle"
>         aria-label="Sepete ekle"
>         className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-cream opacity-100 transition hover:bg-clay sm:h-8 sm:w-8 md:h-9 md:w-9 md:opacity-0 md:group-hover:opacity-100"
>       >
>         {justAdded ? (
>           <Check className="h-3.5 w-3.5 md:h-4 md:w-4" />
>         ) : sizePickerOpen ? (
>           <X className="h-3.5 w-3.5 md:h-4 md:w-4" />
>         ) : (
>           <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
>         )}
>       </button>
>       <div
>         className={`absolute bottom-full right-0 z-20 mb-2.5 origin-bottom-right rounded-xl bg-cream p-2 shadow-soft transition-all duration-200 ease-out ${
>           sizePickerOpen ? "translate-y-0 scale-100 opacity-100" : "pointer-events-none translate-y-1 scale-95 opacity-0"
>         }`}
>       >
>         <span className="absolute -bottom-[5px] right-[13px] h-2.5 w-2.5 rotate-45 bg-cream" />
>         <div className="relative flex max-w-[152px] flex-wrap justify-end gap-1.5">
>           {product.quickAddVariants.map((variant) => (
>             <button
>               key={variant.variantId}
>               type="button"
>               onClick={(e) => handleSizeSelect(e, variant)}
>               className="flex h-7 min-w-[28px] items-center justify-center rounded-md border border-ink px-1.5 text-[11px] leading-none tracking-[0.4px] text-ink transition-colors hover:bg-ink hover:text-cream"
>             >
>               {variant.size}
>             </button>
>           ))}
>         </div>
>       </div>
>     </div>
>   )}
>   ```
>   Not: `span` (kuyruk) kutunun `p-2` içeriğinin ÜSTÜNDE değil kutunun kendi arka planıyla aynı hizada durmalı — `z-index` sırası: kuyruk kutunun `bg-cream`'iyle aynı düzlemde, içerik (`relative`) onun üstünde kalacak şekilde ayarla, gölgenin kuyruktan taşmaması için `shadow-soft`'u sadece dış `div`'e ver, `span`'a verme.
> - `product-viewer.tsx`'te zaten olduğu gibi, mobilde dokunma alanı yeterince büyük olsun diye beden çipleri `h-7 min-w-[28px]` boyutunda bırakıldı — kalabalık görünürse (5+ beden) `flex-wrap` zaten ikinci satıra taşıracak, kutunun `max-w-[152px]` sınırı bunu tetikler.
>
> **3) Test:**
> - `npm run build` veya `npm run lint` ile tip hatası olmadığından emin ol (özellikle `quickAddVariant` → `quickAddVariants` yeniden adlandırmasının kullanıldığı tüm yerleri — `catalog.ts` ve `product-card.tsx` dışında başka dosya bu alanı okuyorsa onu da güncelle).
> - Katalogda birden fazla bedeni stokta olan bir ürünün `+` butonuna basınca kutunun açıldığını, bir bedene tıklayınca sepete o bedenin eklendiğini ve kutunun kapandığını; dışarı tıklayınca kutunun kapandığını; tek bedeni stokta olan bir üründe ise kutu açılmadan direkt eklendiğini doğrula.
>
> İş bitince her zamanki gibi `DEPLOY_STATUS.md`'ye not düş.

---

## Notlar / kararların gözden geçirilmesi (kullanıcı onayına açık)

- **Tek beden varsa kutu açılmadan direkt eklensin** öneriliyor (soru sormanın anlamı yok) — istenirse bu kaldırılıp her zaman kutu açılacak şekilde de yapılabilir.
- Kutu **butonun üzerine, resmin içine taşarak** açılıyor (kart zaten `aspect-[3/4]` resim + altında bilgiler şeklinde, buton resmin en altında olduğu için yukarı açılmak en doğal olanı — aşağı açılırsa ürün adı/fiyat alanının üzerine biner).
- Kutuya tıklamak sepete ekliyor ama ürün sayfasına yönlendirmiyor (kart linkinin `preventDefault/stopPropagation` deseni korunuyor) — bu, favori butonu ve renk swatch'larıyla tutarlı.
