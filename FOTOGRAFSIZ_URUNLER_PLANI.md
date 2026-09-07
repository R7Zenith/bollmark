# Fotoğrafsız Ürünleri Ayırt Etme — Uygulama Planı

**Tarih:** 2026-09-07
**Durum:** Uygulandı ✅ (aynı oturumda, build ve tip kontrolü doğrulandı)
**Kapsam:** Admin panel → Ürünler sayfası

## Neden

Ürünler listesinde fotoğrafı olmayan ürünleri fark etmek zor. Amaç: bu
ürünleri listede kolayca görüp, filtreleyip, toplu olarak yayından
kaldırabilmek (taslağa alma / arşivleme zaten bulk action olarak mevcut).

## Seçilen 4 öneri

1. **Filtre:** Ürünler sayfasındaki filtre çubuğuna "Fotoğraf durumu"
   dropdown'ı — "Fotoğrafsız ürünler" seçeneği ile listeyi daraltmak.
2. **Görsel işaret:** Tabloda fotoğrafı olmayan satırları kırmızı tonlu bir
   "Fotoğraf Yok" rozetiyle / kırmızımsı çerçeveyle belirginleştirmek.
3. **Sıralama:** Mevcut sort seçeneklerine (isim, fiyat, stok, oluşturulma)
   "fotoğraf durumu"nu eklemek — fotoğrafsızları listenin başına toplamak.
4. **Uyarı satırı:** Ürünler sayfasının üstünde "N ürün fotoğrafsız"
   yazan, tıklanınca filtreyi otomatik uygulayan bir uyarı/bant.

## Değişecek dosyalar (referans — Claude Code kendi bulacak)

- `src/components/admin/products-filters.tsx` — fotoğraf durumu select'i
- `src/app/(admin)/admin/urunler/page.tsx` — where koşulu, fotoğrafsız
  sayımı, sıralama, uyarı bandı
- `src/components/admin/products-table.tsx` — kırmızı rozet/çerçeve,
  "photo" sort kolonu

## Veri modeli notu

Bir ürünün fotoğrafı yok sayılması: `images` (ProductImage) VE
`optionImages` (ProductOptionImage) ilişkilerinin ikisi de boş olmalı —
liste sayfasındaki `imageUrl` mantığı zaten `p.images[0]?.url ??
p.optionImages[0]?.url ?? null` şeklinde bunu yansıtıyor.

## Claude Code prompt'u

Aşağıdaki prompt, projenin kök dizininde (`Bollmark/`) Claude Code'a
verilmek üzere hazırlandı:

```
Admin panelde Ürünler sayfasına (src/app/(admin)/admin/urunler/page.tsx,
src/components/admin/products-filters.tsx,
src/components/admin/products-table.tsx) "fotoğrafsız ürün" ayırt etme
özelliği ekle. Product modelinde fotoğraf, images (ProductImage) ve
optionImages (ProductOptionImage) ilişkilerinden geliyor; ikisi de boşsa
ürünün fotoğrafı yok demektir (bkz. page.tsx'teki
`p.images[0]?.url ?? p.optionImages[0]?.url ?? null` mantığı).

1) Filtre: products-filters.tsx'e mevcut durum/kategori select'lerinin
   yanına "Fotoğraf" adlı bir select ekle ("Tümü" / "Fotoğrafsız ürünler",
   query param adı `fotograf`, değeri "yok"). page.tsx'te searchParams'tan
   `fotograf` oku, "yok" ise Prisma where koşuluna
   `images: { none: {} }, optionImages: { none: {} }` ekle.

2) Görsel işaret: products-table.tsx'teki "Ürün" kolonunda imageUrl null
   olduğunda mevcut ImageOff ikonunun bulunduğu kutucuğu kırmızımsı yap
   (örn. border-red-300 bg-red-50) ve isim satırının altına küçük bir
   Badge tone="red" ile "Fotoğraf Yok" yazısı ekle (bkz. badge.tsx'teki
   BadgeTone tipleri).

3) Sıralama: sort key listesine "photo" ekle (DataTable kolonunda
   sortable: true, header "Fotoğraf"). page.tsx'te stock sıralamasının
   yapıldığı gibi (client-side, fetch sonrası) photo sıralamasını da ekle:
   imageUrl null olanlar asc'de üstte, desc'de altta olacak şekilde
   sırala.

4) Uyarı satırı: page.tsx'te ayrı bir lightweight count query ile (mevcut
   filtrelerden bağımsız) toplam fotoğrafsız ürün sayısını hesapla. Sayı
   0'dan büyükse, sayfanın başlığının altına tıklanabilir bir uyarı bandı
   ekle: "N ürün fotoğrafsız, incele" — tıklanınca ?fotograf=yok query
   param'ını uygulayan bir Link olsun. Diğer admin sayfalarındaki
   uyarı/empty-state renk paletine (kırmızı/amber tonları) uygun bir
   stil kullan.

Mevcut kod stiline (Türkçe route/param isimleri, admin-* tailwind
class'ları, bulk action yapısı) sadık kal. Değişiklik sonrası
`npm run build` veya `npx tsc --noEmit` ile tip hatası olmadığını
doğrula.
```

## Uygulama sonucu

Prompt yukarıdaki 4 maddeye göre uygulandı:

- `src/components/admin/products-filters.tsx`: "Fotoğraf" select'i eklendi
  (`fotograf=yok`).
- `src/app/(admin)/admin/urunler/page.tsx`: `fotograf` searchParam okunup
  where koşuluna eklendi; ayrı bir `missingPhotoCount` sorgusu ile toplam
  fotoğrafsız ürün sayısı hesaplanıp 0'dan büyükse başlığın altında
  kırmızı, tıklanabilir bir uyarı bandı gösteriliyor; `photo` sort key'i
  için client-side sıralama eklendi (stock sıralamasıyla aynı desende).
- `src/components/admin/products-table.tsx`: fotoğrafsız satırlarda
  kutucuk kırmızımsı (`border-red-300 bg-red-50`), isim altında
  `Badge tone="red"` ile "Fotoğraf Yok"; ayrıca sortable "Fotoğraf" kolonu
  (check/ImageOff ikonlu) eklendi.

`.next` klasöründe önceki bir `next dev` çalıştırmasından kalma bozuk bir
otomatik üretilmiş dosya (`routes.d.ts`) build'i engelliyordu; temizlenip
yeniden derlendi. `npm run build` hatasız tamamlandı, tip hatası yok.
