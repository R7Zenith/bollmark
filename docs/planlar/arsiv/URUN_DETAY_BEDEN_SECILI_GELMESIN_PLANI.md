# Ürün Detay: Beden Otomatik Seçili Gelmesin — Plan

## Sorun
Ürün sayfası açıldığında bir beden hazır seçili geliyor (stokta olan ilk beden). Müşteri bedeni bilinçli seçmeden sepete ekleyebiliyor; yanlış beden siparişi ve iade riski var.

## Kök neden
`src/components/product-viewer.tsx`, satır ~189-197: `size` state'inin başlangıç fonksiyonu, başlangıç rengi için stokta olan ilk bedeni (yoksa ilk bedeni) döndürüyor. Bu yüzden sayfa her zaman bir bedenle açılıyor.

Bu state'e bağlı yerler (hepsi `null` durumunu bilmeli):
- `selected` (satır ~228) `size` ile varyant buluyor. Beden yoksa `selected` undefined olur.
- `outOfStock = !selected || selected.stock <= 0` (satır ~229). Beden seçilmediğinde bu true olur ve buton yanlışlıkla "Stokta Yok" yazar, StockAlertForm görünür. En önemli tuzak bu.
- `addToCart`, `handleAdd`, `handleBuyNow` (satır ~302-329).
- Adet seçici max değeri `selected?.stock` (satır ~705).
- Beden butonları (satır ~657-677) ve "Son N adet kaldı" satırı (satır ~738).

## İstenen davranış
1. Sayfa ilk açıldığında hiçbir beden seçili olmaz (hiçbir kutucuk dolu görünmez).
2. Müşteri bir beden seçince mevcut davranış aynen devam eder (stok, fiyat, adet, "Son N adet").
3. Beden seçmeden "Sepete Ekle" veya "Hemen Al"a basılırsa ürün sepete eklenmez; Beden alanının altında kısa bir uyarı çıkar ("Lütfen beden seçin") ve beden kutucukları bir an vurgulanır. Butonlar disabled olmaz, ki müşteri tıklayınca geri bildirim alsın. Buton metni "Stokta Yok" olmaz, normal "Sepete Ekle" kalır.
4. Renk değişince: seçili beden yeni renkte stokta varsa korunur, yoksa seçim sıfırlanır (null). Farklı renge geçince sessizce başka bedene atlamasın.
5. İstisna: üründe tek bir beden değeri varsa (Standart, Tek Ebat vb.) veya beden hiç yoksa (`sizes.some(Boolean)` false), o beden otomatik seçili olur. Aksi halde müşteri hiç seçemez ve sepete ekleyemez.
6. Adet seçici beden seçilene kadar pasif (disabled) görünür, gizlenmez (düzen zıplamasın).
7. Ürün tamamen stokta yoksa mevcut "Stokta Yok" akışı bozulmasın. Bunu beden seçimi zorunluluğundan ayrı ele al: `colorOutOfStock` ve tüm varyantların stoğu 0 ise mevcut davranış korunur.

## Kapsam dışı
- Ürün kartındaki beden seçim popover'ı (`product-card.tsx`) bu işte değişmeyecek. Sadece "orada da otomatik seçim var mı" diye bak ve raporda belirt; değiştirme.
- Katalogdan renge tıklanıp gelme (`initialColor`) mantığı aynen kalır. Sadece beden başlangıçta boş olur.

## Doğrulama
- Çok bedenli üründe sayfa açılınca hiçbir beden seçili değil.
- Seçmeden Sepete Ekle: sepete eklenmiyor, uyarı görünüyor.
- Seçince normal ekleniyor, fiyat/stok/adet doğru.
- Beden seçili iken stoğu olmayan renge geçince seçim sıfırlanıyor.
- Tek bedenli (Standart) ürün otomatik seçili ve eklenebiliyor.
- Bedensiz ürün eklenebiliyor.
- Masaüstü ve mobil görünümde kontrol et. `npx tsc --noEmit` ve `npm run lint` temiz olmalı.
- Sepetteki satır ve `/odeme` akışında beden bilgisi doğru geliyor.

---

## Claude Code için prompt

```
Görev: Ürün detay sayfasında beden otomatik seçili gelmesin. Müşteri ilk girişte bedeni kendisi seçsin.

Önce yüklü skill'leri, AGENTS.md ve karpathy-guidelines.md'yi oku. Sonra URUN_DETAY_BEDEN_SECILI_GELMESIN_PLANI.md dosyasını oku ve plana göre uygula. Değişiklik minimum olsun, sadece bu davranışa dokun.

Dosya: src/components/product-viewer.tsx

1. `size` state'ini `string | null` yap, başlangıcı null olsun (satır ~189'daki "stokta olan ilk beden" mantığını kaldır). İstisna: `sizes` içinde tek bir dolu değer varsa veya hiç dolu beden yoksa (`!sizes.some(Boolean)`), başlangıçta o değeri/boş değeri seç ki müşteri sepete ekleyebilsin.
2. `selected` yalnızca size null değilse aranır. `outOfStock` tanımını ayır: beden seçilmemişse `needsSize = true` olsun ve `outOfStock` false kalsın (buton "Stokta Yok" yazmasın, StockAlertForm çıkmasın). Ürünün tüm varyantları stoksuzsa mevcut "Stokta Yok" akışı aynen çalışsın.
3. `addToCart`, `handleAdd`, `handleBuyNow`: needsSize ise ekleme yapma, bunun yerine Beden bölümünün altında "Lütfen beden seçin" uyarısını göster ve beden kutucuklarını kısa süre vurgula (örn. 1.5 sn kırmızımsı çerçeve veya hafif shake; mevcut tasarım diline uy, Tailwind kullan). Uyarı, kullanıcı bir beden seçince kaybolsun. Butonlar disabled olmasın.
4. Renk değişiminde (`setColor`): mevcut `size` yeni renkte stokta varsa koru, yoksa null yap.
5. Adet seçici beden seçilene kadar disabled olsun ama görünür kalsın. `selected.stock` erişimlerini ve "Son N adet kaldı" satırını null-safe yap.
6. product-card.tsx ve diğer dosyalara dokunma. Sadece kartta da otomatik seçim olup olmadığını rapora yaz.
7. `addLine`'a giden `size` değeri hiçbir durumda null olmasın (needsSize korumasından sonra string).

Doğrulama: `npx tsc --noEmit` ve `npm run lint`. Dev sunucuda çok bedenli, tek bedenli ve bedensiz ürünlerle masaüstü + mobilde dene: ilk açılışta seçili beden yok; seçmeden ekleme engelleniyor ve uyarı çıkıyor; seçince normal çalışıyor; stoksuz renge geçince seçim sıfırlanıyor.

İş bitince commit at ve DEPLOY_STATUS.md dosyasına ne yaptığını, değişen dosyaları ve doğrulama sonucunu kısa bir not olarak ekle.
```
