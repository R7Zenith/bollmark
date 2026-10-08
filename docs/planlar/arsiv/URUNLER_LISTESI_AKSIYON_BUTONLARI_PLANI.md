# Ürünler Listesi — Aksiyonlar Kolonu (İkon Butonlar) Planı

## İstek

Admin panelde **Ürünler** listesinde her satırın sonuna bir "Aksiyonlar" kolonu eklenecek. Bu kolonda, yan yana duran, anlamını ikonla ifade eden, tıklaması kolay kutucuk butonlar olacak:

1. **Düzenle** — ürün düzenleme sayfasına gider
2. **Fiyat Güncelle** — satırdan çıkmadan hızlıca fiyat güncellemek için
3. **Fotoğrafları Yeniden Ara** — Koton'da otomatik görsel arama
4. **Koton Linkiyle Ekle** — Koton ürün linki yapıştırarak görsel ekleme
5. **Ürünü Gör** — ürünün site üzerindeki (müşteri tarafı) sayfasını yeni sekmede açar

## Mevcut Durum (incelendi)

- Tablo bileşeni: `src/components/admin/products-table.tsx`
- Şu an "Aksiyonlar" kolonunda sadece metin linkler var: fotoğraf yoksa "Fotoğrafları yeniden ara" ve "Koton linkiyle ekle" linkleri, her zaman "Düzenle" linki. Fiyat güncelleme ve "Ürünü Gör" yok.
- Görsel arama zaten çalışıyor: `POST /api/admin/urunler/[id]/gorsel-yenile` (Koton'da otomatik arar) ve `POST /api/admin/urunler/[id]/gorsel-ekle` (kullanıcının verdiği Koton linkinden görsel çeker). İkisi de `products-table.tsx` içinde `handleGorselYenile` / `handleGorselEkle` olarak zaten var, sadece görünüm değişecek.
- Fiyat güncelleme için satır bazlı hızlı bir aksiyon **yok**. Fiyat sadece `/admin/urunler/[id]` düzenleme sayfasında değiştirilebiliyor. Toplu işlemler için `POST /api/admin/urunler/bulk` var (`SET_STATUS`, `DELETE` action'ları destekliyor) — buraya `SET_PRICE` action'ı eklemek en temiz çözüm (tek üründe de `ids: [id]` ile kullanılabilir).
- "Ürünü Gör" için ürünün `slug` alanı gerekiyor ama şu an admin listesi sorgusunda (`src/app/(admin)/admin/urunler/page.tsx`) `slug` çekilmiyor, `ProductRow` tipinde de yok. Site tarafında ürün sayfası `src/app/(site)/urunler/[slug]/page.tsx` — yani URL `/urunler/{slug}`. `Product` modelinde `slug String @unique` zaten var (prisma/schema.prisma), sadece admin sorgusuna ve `ProductRow`'a eklenmesi lazım.
- Taslak (DRAFT) durumundaki ürünler sitede görünmüyor olabilir — "Ürünü Gör" butonu bu durumda kullanıcıyı 404'e götürebilir, bunun için buton pasif/tooltip'li olmalı ya da yine de açılsın ama bir uyarı olsun (aşağıda öneri var).
- İkon kütüphanesi: `lucide-react` zaten kullanılıyor (`ImageOff, Check, RefreshCw, Loader2, Link2`). Eksik ikonlar: `Pencil` (Düzenle), `Tag` veya `BadgeTurkishLira`/`CircleDollarSign` (Fiyat — `BadgeTurkishLira` lucide'da yoksa `Tag` kullanılabilir), `ExternalLink` veya `Eye` (Ürünü Gör).
- Ortak `Button` bileşeni (`src/components/admin/button.tsx`) var ama sadece metin/genel buton varyantları var, ikon-only kare buton varyantı yok — bunun için küçük bir `IconButton` alt bileşeni önerilir (tooltip için `title`, erişilebilirlik için `aria-label`).

## Önerilen Tasarım

Aksiyonlar kolonunda, satır sonunda sağa yaslı, 5 adet küçük kare/yuvarlak köşeli ikon buton yan yana:

| Sıra | Buton | İkon | Davranış | Not |
|---|---|---|---|---|
| 1 | Düzenle | `Pencil` | `/admin/urunler/{id}`'e git | Her zaman aktif |
| 2 | Fiyat Güncelle | `Tag` | "Fiyat" kolonundaki hücre inline düzenlenebilir input'a döner, yanında onay (Check) ve vazgeç (X) ikon butonları çıkar — popup/prompt yok | Her zaman aktif |
| 3 | Fotoğrafları Yeniden Ara | `RefreshCw` (arama sırasında `Loader2` + spin) | Koton'da otomatik arar | Sadece `imageUrl` yoksa göster (mevcut davranış korunuyor) |
| 4 | Koton Linkiyle Ekle | `Link2` | Link sorup görsel çeker | Sadece `imageUrl` yoksa göster |
| 5 | Ürünü Gör | `ExternalLink` | Yeni sekmede `/urunler/{slug}` açar | `status !== "PUBLISHED"` ise buton soluk/disabled + title="Ürün yayında değil, sitede görünmez" |

Görsel stil önerisi: her biri `h-8 w-8` (mobilde `h-9 w-9` dokunma alanı için), `rounded-md border border-admin-border`, `hover:bg-admin-bg hover:text-admin-accent` geçişli, `title` attribute ile tooltip (native browser tooltip yeterli, ekstra kütüphane gerekmez). Tehlikeli olmayan aksiyonlar nötr renkte, "Ürünü Gör" hover'da `text-admin-accent`, "Fiyat Güncelle" hover'da yeşilimsi bir vurgu olabilir (opsiyonel, şart değil).

Fotoğraf ile ilgili 2 buton (3 ve 4) `imageUrl` doluysa listede yer kaplamasın diye gizli kalmaya devam etsin — bu, mevcut davranışla tutarlı ve gereksiz buton kalabalığını önler.

### Fiyat Güncelle akışı (güncellendi — popup/prompt YOK, tamamen inline)

Popup veya `window.prompt` kullanılmayacak. Bunun yerine **"Fiyat" kolonunun kendisi** düzenlenebilir alana dönüşecek:

1. Normal halde "Fiyat" kolonunda sadece `formatPrice(row.priceCents)` metni var (mevcut davranış).
2. Aksiyonlar kolonundaki **Fiyat Güncelle** (`Tag`) ikonuna basılınca o satır "düzenleme moduna" girer: hangi satırın düzenlendiği `editingPriceId` (tek satır aynı anda düzenlenebilir yeterli, `string | null` state) ile tutulur.
3. Düzenleme modundaki satırda **"Fiyat" kolonunun içeriği** metinden küçük bir sayısal `<input>`'a döner (mevcut fiyat TL cinsinden önceden dolu gelir, örn. `129.90`), yanında bir **onay (Check ikonu) butonu** ve küçük bir **vazgeç (X ikonu) butonu** olur — hepsi hücrenin içinde, satırın yüksekliğini bozmayacak şekilde (`h-8` input + `h-8 w-8` butonlar, `flex items-center gap-1`).
4. Input açıldığında otomatik odaklanır (`autoFocus`) ve içeriği seçili gelir, Enter'a basmak onay butonuna basmakla aynı işi yapar, Escape vazgeçmekle aynı işi yapar.
5. Onay butonuna basılınca (veya Enter) girilen TL değeri kuruşa çevrilip (`Math.round(parseFloat(value.replace(",", ".")) * 100)`) `bulk` API'sine `{ ids: [row.id], action: "SET_PRICE", priceCents }` gönderilir; istek sürerken input/butonlar `disabled` olur ve onay butonunda `Loader2` spinner döner. Başarılıysa `editingPriceId` sıfırlanır, toast gösterilir, `router.refresh()` çağrılır (liste yeni fiyatla güncellenir). Hatalıysa (örn. geçersiz sayı, 0 veya negatif) input kırmızı border alır ve satır altında küçük bir hata mesajı gösterilir, düzenleme modundan çıkılmaz.
6. Aksiyonlar kolonundaki diğer butonlar (Düzenle, fotoğraf butonları, Ürünü Gör) o satır düzenleme modundayken gizlenmesine gerek yok ama Fiyat Güncelle ikonu o an "aktif/basılı" görünsün (örn. `bg-admin-accent/10 text-admin-accent`) — kullanıcı hangi satırın düzenlemede olduğunu net görsün.

Bu tamamen tablo/liste sayfasından çıkmadan, popup açmadan, "Excel'de hücreye çift tıklayıp yazma" hissi veren bir deneyim olur.

## Claude Code için Prompt (uygulama bu promptla yapılacak)

Aşağıdaki prompt'u Claude Code'a birebir verebilirsin:

---

> Admin panelde Ürünler listesinin (`src/components/admin/products-table.tsx`) "Aksiyonlar" kolonunu ikon-buton satırına çevir. Şu an sadece metin linkleri var; bunun yerine yan yana duran, ikon tabanlı, tooltip'li (title attribute) kare butonlar olsun:
>
> 1. **Düzenle** — `Pencil` ikonu, `/admin/urunler/{id}`'e link, her zaman görünür.
> 2. **Fiyat Güncelle** — POPUP VEYA `window.prompt` KULLANMA. Bunun yerine "Fiyat" kolonunun kendi hücresini inline düzenlenebilir hale getir:
>    - `ProductsTable` içinde `editingPriceId: string | null` ve `priceDraft: string` (input değeri) state'i ekle, ayrıca `savingPrice: boolean` state'i ekle.
>    - Aksiyonlar kolonundaki `Tag` ikonlu **Fiyat Güncelle** butonuna basılınca `editingPriceId = row.id` yapılır ve `priceDraft`, `row.priceCents`'in TL karşılığına (örn. `(row.priceCents / 100).toFixed(2)`) set edilir. Bu buton, o satır düzenleme modundayken görsel olarak aktif/basılı görünsün (`bg-admin-accent/10 text-admin-accent`).
>    - "Fiyat" kolonunun `render` fonksiyonu: eğer `row.id === editingPriceId` ise, normal `formatPrice(row.priceCents)` metni yerine `flex items-center gap-1` içinde küçük bir `<input type="text" inputMode="decimal" autoFocus className="w-20 rounded border border-admin-border px-1.5 py-1 text-sm text-right" value={priceDraft} onChange=... />`, yanında yeşil/accent renkli bir **onay** `IconButton` (`Check` ikonu) ve nötr bir **vazgeç** `IconButton` (`X` ikonu) render et. Değilse mevcut `formatPrice(row.priceCents)` metnini göster.
>    - Input'ta `onKeyDown`: Enter → onay fonksiyonunu çağır, Escape → `editingPriceId` null yapıp vazgeç.
>    - Onay fonksiyonu (`handleFiyatKaydet(id)`): `parseFloat(priceDraft.replace(",", "."))` ile sayıya çevir; `NaN` veya `<= 0` ise input'a kırmızı border (`border-red-400`) ver ve altında `text-xs text-red-600` ile "Geçerli bir fiyat girin" göster, isteği gönderme. Geçerliyse `priceCents = Math.round(deger * 100)`, `savingPrice = true` yap, `POST /api/admin/urunler/bulk` endpoint'ine `{ ids: [id], action: "SET_PRICE", priceCents }` gönder. Bekleme sırasında input ve butonlar `disabled`, onay butonunda `Loader2 className="animate-spin"` göster. Başarılıysa `editingPriceId = null`, toast göster (`"Fiyat güncellendi."`, `"success"`), `router.refresh()` çağır. Hatalıysa toast ile hata göster, düzenleme modundan çıkma (kullanıcı tekrar denesin).
>    - `src/app/api/admin/urunler/bulk/route.ts` içine `SET_PRICE` action'ı ekle: `body.priceCents` sayı ve `Number.isFinite(body.priceCents) && body.priceCents > 0` ise `prisma.product.updateMany({ where: { id: { in: ids } }, data: { priceCents: body.priceCents } })` çalıştırıp `{ ok: true }` dön, değilse `{ error: "Geçersiz fiyat." }` ile 400 dön.
> 3. **Fotoğrafları Yeniden Ara** — mevcut `handleGorselYenile` fonksiyonunu kullan, `RefreshCw` ikonu (yüklenirken `Loader2` + `animate-spin`), sadece `!row.imageUrl` iken göster (mevcut davranış).
> 4. **Koton Linkiyle Ekle** — mevcut `handleGorselEkle` fonksiyonunu kullan, `Link2` ikonu, sadece `!row.imageUrl` iken göster (mevcut davranış).
> 5. **Ürünü Gör** — `ExternalLink` ikonu, `target="_blank" rel="noopener noreferrer"` ile `/urunler/{slug}` linki (yeni sekmede açılsın). `row.status !== "PUBLISHED"` ise buton `opacity-40 pointer-events-none` gibi görsel olarak pasif olsun ve `title="Ürün yayında değil, sitede görünmez"` yazsın.
>
> Bunun için:
> - `ProductRow` interface'ine `slug: string` alanı ekle.
> - `src/app/(admin)/admin/urunler/page.tsx` içindeki `prisma.product.findMany` sorgusuna `slug`'ı dahil et (select/include gerekmiyor çünkü zaten tüm alanlar geliyor, sadece `rows` map'inde `slug: p.slug` ekle) ve `ProductRow` objesine ekle.
> - Küçük ortak bir `IconButton` bileşeni oluştur (`src/components/admin/icon-button.tsx` gibi) — `h-8 w-8 md:h-9 md:w-9 inline-flex items-center justify-center rounded-md border border-admin-border text-admin-text-muted hover:bg-admin-bg hover:text-admin-accent transition-colors disabled:opacity-40 disabled:pointer-events-none` sınıflarıyla, `title` ve `aria-label` prop'larını zorunlu tut (erişilebilirlik). Hem `<button>` hem `<a>`/`<Link>` olarak kullanılabilmesi için `as="button" | "a"` gibi basit bir prop ya da iki ayrı export (`IconButton`, `IconLinkButton`) tercih edilebilir — kod tabanındaki mevcut örneklere (`button.tsx`) bak ve tutarlı bir yaklaşım seç.
> - Aksiyonlar kolonunun `render` fonksiyonunu bu 5 `IconButton`'ı `flex items-center justify-end gap-1.5` içinde yan yana dizecek şekilde yeniden yaz. Mobilde de dokunması kolay olsun diye buton boyutları küçük ekranda biraz büyüsün (`h-9 w-9` gibi).
> - Var olan toast, `router.refresh()`, `Loader2` spinner davranışlarını koru; sadece görünümü ikon-butona çevir, mevcut network/state mantığını bozma.
> - Değişiklikleri test et: `npm run build` veya `npm run lint` ile tip hatası olmadığından emin ol.
> - İş bitince her zamanki gibi `DEPLOY_STATUS.md`'ye not düş.

---

## Notlar / Kararlar (senin onayına açık)

- **Fiyat Güncelle**: popup/prompt yok, "Fiyat" kolonunun hücresi doğrudan input'a dönüyor, yanında onay/vazgeç ikon butonları çıkıyor — istediğin gibi.
- **Ürünü Gör**, taslak ürünlerde pasif gösteriliyor — istersen bunun yerine "yine de aç ama uyarı ver" şeklinde de yapılabilir.
- İkon renkleri/hover vurguları şu an nötr (gri → mor accent) öneriliyor; farklı bir buton başına renk kodlaması istersen (örn. fiyat=yeşil, gör=mavi) belirt, prompt'u ona göre güncelleyeyim.
