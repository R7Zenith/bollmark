# Excel Aktarımı — Koton Aramasına Ürün Kodu Fallback'i

## Sorun

`src/lib/koton-images.ts` içindeki arama **sadece barkod ile** çalışıyor:

- `enrichOne` → `findKotonProductData(target.firstBarcode, target.productCode)`
- `findKotonProductData` → `fetchAutocompleteUrl(barcode)` — Koton'un
  `/autocomplete/?search_text=...` uç noktasını **yalnızca barkodla** sorguluyor.
- Koton'un autocomplete sonuçlarında `suggestion_type === "product"` olan ilk
  eşleşmenin `url`'i alınıp `fetchKotonProductData` ile ürün detay JSON'u
  çekiliyor; orada da `base_code === expectedProductCode` kontrolü var (yanlış
  ürün eşleşirse otomatik elenir).

Kullanıcının bulgusu doğru: Excel'deki `BARKOD` alanı Koton'un kendi arama
indeksinde her zaman bulunamayabiliyor (ör. barkod Koton tarafında hiç
girilmemiş/güncellenmemiş olabilir), ama aynı ürünün `ÜRÜN KODU` alanı
(örn. `6SAM60012HW`) zaten Koton'un ürün sayfası URL'lerinde ve kendi site
aramasında standart olarak kullanılan bir değer — bulunma oranı barkoda göre
çok daha yüksek. Şu an kod, barkod aramasında sonuç gelmezse **hiç ürün kodu
denemiyor**, direkt `null` dönüp o ürünü "bulunamadı" sayıyor.

## Önerilen çözüm

`findKotonProductData` içine bir **fallback** eklenmeli: önce barkodla ara
(zaten kesin/benzersiz bir eşleşme — mevcut davranış korunmalı), barkod
aramasından sonuç gelmezse **ürün koduyla aynı autocomplete uç noktasını
tekrar dene**. `fetchKotonProductData` içindeki `base_code` doğrulaması zaten
var olduğu için, ürün kodu aramasının yanlış/alakasız bir ürüne
yönlendirmesi riski düşük — yanlış eşleşme otomatik elenip `null` dönüyor.
Bu yüzden bu değişiklik ek bir doğrulama riski getirmiyor, sadece kapsamı
genişletiyor.

Barkod önce denenmeli çünkü belirli bir renk/beden varyantına özgü ve daha
kesin; ürün kodu tüm renk/beden varyantlarını kapsayan üst ürünü temsil
ediyor (zaten `fetchKotonProductData` tüm renklerin görsellerini tek seferde
çekiyor, dolayısıyla hangi barkod/kodla bulunduğunun sonuç üzerinde pratik
bir farkı yok — sadece "bulunabilirlik" farkı var).

## Verilen Claude Code promptu

```
src/lib/koton-images.ts içinde Koton'dan ürün bulma sadece barkodla
çalışıyor (findKotonProductData → fetchAutocompleteUrl(barcode)). Ancak
Koton'un sitesinde barkod her zaman indekste olmuyor, oysa ürün kodu
(productCode, örn. "6SAM60012HW") ile bulunma oranı çok daha yüksek.
Barkod aramasında sonuç gelmezse ürün koduyla da aramalı.

findKotonProductData fonksiyonunu şöyle güncelle: önce mevcut haliyle
barkodla dene (fetchAutocompleteUrl(barcode) → fetchKotonProductData).
Eğer bu null dönerse (autocomplete'te barkod bulunamadı VEYA
fetchKotonProductData null döndü - örn. base_code eşleşmedi), aynı
autocomplete uç noktasını bu sefer productCode ile çağırıp
(fetchAutocompleteUrl(productCode)) bulunan URL'i yine
fetchKotonProductData(url, productCode) ile doğrula. fetchKotonProductData
içindeki mevcut base_code === expectedProductCode kontrolü olduğu gibi
kalsın - bu, ürün kodu aramasının yanlış ürüne yönlenmesine karşı zaten
yeterli bir güvenlik.

Diagnostik için: hangi yöntemle bulunduğunu (barkod mu ürün kodu mu, yoksa
hiçbiri mi) console.log ile logla, örn. `Koton eşleşmesi (${productCode}):
barkod ile bulundu` / `... ürün kodu ile bulundu` / `... bulunamadı`.

Sonra:
1. npx tsc --noEmit ve npm run build hatasız geçmeli.
2. npm run lint hatasız geçmeli.
3. Mümkünse KOTON11052026CHECKLIST.xls dosyasındaki birkaç üründen barkodu
   bilerek yanlış/eksik olan bir örnekle (ya da barkod alanını geçici olarak
   bozarak) test et - ürünün artık ürün kodu fallback'iyle bulunduğunu
   Vercel loglarından doğrula.
4. Ürünler sayfasındaki "Fotoğrafları yeniden ara" butonu da aynı
   enrichOne/findKotonProductData fonksiyonunu kullandığı için otomatik
   olarak bu fallback'ten faydalanacak - ayrı bir değişiklik gerekmiyor,
   sadece bunu doğrula.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
Bitince git diff özetini ve logladığın örnek eşleşme mesajlarını paylaş.
```

## Not

Bu değişiklik `EXCEL_KOTON_GORSEL_ARAMA_TAKILIYOR_PLANI.md`'de önerilen
zaman aşımı/loglama değişiklikleriyle tam uyumlu — aynı `fetchWithTimeout`
altyapısını kullanıyor, `enrichOne`/`enrichProductsFromKoton` akışına
dokunmuyor.
