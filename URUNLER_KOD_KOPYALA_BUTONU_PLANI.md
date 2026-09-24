# Ürünler Listesi — Ürün Kodu Kopyala Butonu Planı

## İstek

Admin panelde **Ürünler** sayfasında ürün kodlarını (örn. `3WAM10005LK` gibi Koton kodları) kolayca kopyalayabilmek için buton.

## Mevcut Durum (incelendi)

- Tablo: `src/components/admin/products-table.tsx`. Ürün kodu "Ürün" kolonunda, ürün adının altında küçük gri metin olarak duruyor (`{row.code && <span className="text-xs text-admin-text-muted">{row.code}</span>}`).
- Bu hücrenin tamamı bir `<Link href="/admin/urunler/{id}">` içinde. Yani koda tıklayınca düzenleme sayfasına gidiliyor; kodu seçip kopyalamak zor. Butonu Link'in **içine koymak** tıklamada sayfa değişmesine yol açar, bu yüzden Link'in dışına alınmalı (ya da `preventDefault` + `stopPropagation` şart).
- `src/components/admin/copy-button.tsx` zaten var ama metin etiketli ("Kopyala") büyük buton; tablo satırı için fazla iri. Ayrıca `src/components/admin/icon-button.tsx` içinde ikon-only `IconButton` var, tablo aksiyonlarında kullanılıyor.
- Kütüphane: `lucide-react` zaten kullanılıyor (`Copy`, `Check` ikonları `copy-button.tsx`'te mevcut).

## Önerilen Tasarım

1. Kodun hemen yanında küçük (`h-6 w-6`) bir **Kopyala** ikon butonu (`Copy` ikonu). Tıklanınca kod panoya gider, ikon 1.5 sn `Check` (yeşil) olur ve `title` "Kopyalandı" olur. Toast gerekmez, sessiz ve hızlı olsun.
2. Kod satırı `<Link>`'in dışına alınır; ürün adı/görsel yine Link olarak kalır, kod + kopyala butonu altında ayrı satırda durur.
3. Kod yoksa (`row.code` null) buton gösterilmez.
4. **Opsiyonel (öneri):** Birden fazla ürün seçildiğinde toplu işlem çubuğuna "Kodları Kopyala" eklenir; seçili ürünlerin kodları alt alta (satır sonu ile) panoya kopyalanır. Excel'e yapıştırıp toplu iş yaparken çok işe yarar. İstemezsen prompttaki 2. maddeyi sil.

## Claude Code için Prompt

> Admin panelde Ürünler listesinde (`src/components/admin/products-table.tsx`) ürün kodunu kolayca kopyalamak için buton ekle.
>
> 1. `src/components/admin/copy-code-button.tsx` adında küçük bir client bileşeni oluştur (`"use client"`). Prop: `value: string`. `navigator.clipboard.writeText(value)` ile kopyalasın; başarılıysa 1500 ms boyunca `Copy` yerine yeşil `Check` ikonu ve `title="Kopyalandı"` göstersin, sonra eski haline dönsün. Pano erişimi hata verirse sessizce yut (mevcut `copy-button.tsx` gibi try/catch). Görünüm: `inline-flex h-6 w-6 items-center justify-center rounded border border-transparent text-admin-text-muted hover:border-admin-border hover:bg-admin-bg hover:text-admin-accent transition-colors`, ikon `size={13}`, `title="Kodu Kopyala"` ve `aria-label` olsun. `type="button"` olsun. Mevcut `copy-button.tsx` ve `icon-button.tsx` dosyalarına dokunma, sadece stile bakıp tutarlı ol.
> 2. `products-table.tsx` içindeki "Ürün" kolonu `render` fonksiyonunu düzelt: şu an tüm hücre bir `<Link>`; kopyala butonu Link içinde olursa tıklamada düzenleme sayfasına gider. Bu yüzden dış sarmalayıcıyı `<div className="flex items-center gap-3">` yap; içinde görsel kutusu + ürün adı `<Link href={`/admin/urunler/${row.id}`}>` olarak kalsın (hover:underline davranışı korunsun), ürün kodu satırı ise Link'in DIŞINDA, ad bloğunun altında `<span className="flex items-center gap-1 text-xs text-admin-text-muted">{row.code}<CopyCodeButton value={row.code} /></span>` şeklinde render edilsin. Yalnızca `row.code` doluysa göster. "Fotoğraf Yok" rozeti mevcut yerinde kalsın. Görsel yerleşim (görsel solda, ad + kod + rozet sağda alt alta) şu anki haliyle birebir aynı görünsün, sadece koda yanına ikon eklenmiş olsun.
> 3. (Opsiyonel toplu kopyalama) `bulkActions` fonksiyonuna `{ label: "Kodları Kopyala", variant: "secondary", onClick: ... }` ekle: `selectedIds`'e karşılık gelen `products` satırlarının `code` değerlerini (boş olanları atla) `\n` ile birleştirip `navigator.clipboard.writeText` ile kopyala, ardından `showToast(`${n} ürün kodu kopyalandı.`, "success")` göster; kod bulunamazsa `showToast("Seçili ürünlerde kod yok.", "error")`. Seçimi temizleme, çünkü kullanıcı ardından başka işlem yapabilir.
> 4. `DataTable` satır tıklaması varsa (data-table.tsx'e bak) butonun `onClick`'inde `e.stopPropagation()` çağır ki satır seçimi/tıklaması tetiklenmesin.
> 5. Mobilde de kod satırı taşmasın (`flex-wrap`), dokunma alanı küçük kalmasın diye mobilde buton `h-7 w-7` olabilir.
> 6. `npm run lint` ve `npx tsc --noEmit` ile hata olmadığını doğrula.
> 7. Proje kuralları: değişiklikleri önce localhost'ta göreceğim. Ben onaylayınca YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan. İş bitince `DEPLOY_STATUS.md`'ye not düş.

## Test Listesi (localhost'ta)

- Koda tıkla → panoya kopyalandı mı, ikon 1.5 sn yeşil tik oldu mu? (Excel/Not Defteri'ne yapıştırarak kontrol)
- Butona basınca düzenleme sayfasına gitmiyor mu?
- Ürün adına tıklayınca hâlâ düzenleme sayfası açılıyor mu?
- Kodu olmayan üründe buton çıkmıyor mu?
- (Opsiyonel) 3 ürün seç → "Kodları Kopyala" → yapıştırınca alt alta 3 kod geliyor mu?
- Mobil genişlikte satır bozulmuyor mu?
