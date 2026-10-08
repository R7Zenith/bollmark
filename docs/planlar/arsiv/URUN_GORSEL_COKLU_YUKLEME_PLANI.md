# Ürün Görselleri — Çoklu Seçim, Toplu Yükleme ve Sürükle-Bırak Sıralama Planı

## İstek

Admin panelde ürüne fotoğraf eklerken şu an **her görsel için ayrı ayrı** "Görsel Ekle"ye basıp açılan kutuya tek dosya seçmek gerekiyor. İstenen:

1. "Görsel Ekle" butonuyla **birden fazla fotoğraf tek seferde** seçilip eklenebilsin.
2. Eklenen görsellerin **sırası** kaydetmeden önce düzenlenebilsin.
3. Sonra **Kaydet**'e basılıp işlem bitsin.

## Mevcut Durum (kod incelendi)

- `src/components/admin/multi-image-field.tsx` → `MultiImageField`. "Görsel Ekle" butonu listeye sadece **boş bir satır** (`{ url: "" }`) ekliyor. Her satır bir `ImageField`.
- `src/components/admin/image-field.tsx` → `ImageField`. Gizli `<input type="file">` **`multiple` değil**, sadece `files[0]` alınıyor. Tek görsel yükleyip `/api/admin/upload`'a POST ediyor. Yanında URL yapıştırma ve alt metin kutusu var.
- Sıralama şu an sadece küçük ↑ / ↓ oklarıyla yapılıyor (dikey liste, her satır büyük). Yıldız = vitrin fotoğrafı.
- `MultiImageField` iki yerde kullanılıyor, ikisi de bu değişiklikten otomatik faydalanır:
  - `product-images-field.tsx` → ürünün genel "Görseller" kartı
  - `variant-editor.tsx` (≈ satır 619) → her renk için "Renk Görselleri"
- Kaydetme zaten doğru kurulmuş: görseller gizli input'a JSON yazılıyor, `useDirtySignal` "Kaydedilmemiş değişiklikler var" çubuğunu (`save-bar.tsx`) açıyor, **Kaydet** formu gönderiyor. Yani "önce sırala, sonra kaydet" akışı için sunucu tarafına dokunmaya gerek yok.
- `@dnd-kit/core` + `@dnd-kit/sortable` projede **zaten kurulu** ve `category-manager.tsx`'te kullanılıyor. Yeni paket gerekmiyor.
- Upload route (`/api/admin/upload`) 5 MB'a izin veriyor, sunucuda `sharp` ile 1600 px WebP'e sıkıştırıyor. **Ama Vercel fonksiyonlarının istek gövdesi sınırı ~4.5 MB**; telefondan çekilmiş 4.5–5 MB'lık bir fotoğraf canlıda 413 hatası alır. Toplu yüklemede bu daha sık görülür.

## Önerilen Tasarım

**1. Tek tıkla çoklu seçim**
- "Görsel Ekle" butonu doğrudan dosya seçiciyi açar (`multiple`). Ctrl/Shift ile 10 fotoğraf seçilebilir.
- Ayrıca kartın üstüne **bilgisayardan dosya sürükleyip bırakma** alanı ("Fotoğrafları buraya sürükleyin veya seçin").
- Seçilen dosyalar **anında küçük resim olarak** ızgaraya düşer (yüklenmeden önce yerel önizleme), üstlerinde yükleme göstergesi olur.
- Yüklemeler arka planda **aynı anda en fazla 3'er** gider (sunucuyu boğmamak için). Başarısız olan kartta kırmızı "Tekrar dene" çıkar, diğerleri etkilenmez.

**2. Izgara görünüm + sürükle-bırak sıralama**
- Satır satır liste yerine **küçük resim ızgarası** (masaüstünde 5–6, mobilde 3 sütun). Shopify/ikas panellerindeki gibi.
- Kartlar **fareyle sürüklenerek** yer değiştirir (dnd-kit). Mobilde de parmakla sürüklenir.
- Her kartta: sıra numarası, ★ vitrin fotoğrafı yap, 🗑 sil, ← → (sürüklemek istemeyen / klavye için), alt metin için küçük "düzenle" ikonu.
- İlk sıradaki görsel otomatik "Vitrin" etiketi alır (yıldız mantığı aynen korunur).

**3. URL ile ekleme korunuyor**
- Önceki planda URL yapıştırma özellikle geri istenmişti. Butonun yanında küçük **"URL ile ekle"** linki: açılan kutuya **alt alta birden fazla URL** yapıştırılabilir, hepsi tek seferde eklenir.

**4. Kaydet güvenliği**
- Yükleme sürerken Kaydet'e basılırsa form gönderilmez; "3 görsel hâlâ yükleniyor, bitmesini bekleyin" uyarısı çıkar. (Yoksa yarım yüklenen görseller kaybolur.)
- Gizli input'a sadece yüklemesi **bitmiş** görseller yazılır.

**5. Önerim: tarayıcıda ön küçültme (4.5 MB sorununu çözer)**
- Dosya gönderilmeden önce tarayıcıda uzun kenar 2000 px'e küçültülüp JPEG'e (kalite ~0.9) çevrilir. Telefon fotoğrafı 6 MB → ~600 KB olur. Hem 413 hatası ortadan kalkar hem toplu yükleme çok hızlanır. Sunucudaki `sharp` sıkıştırması aynen devam eder, kalite kaybı olmaz.

**6. Önerim: kaydedilmeden silinen görselleri Blob'dan temizleme**
- Görsel seçilir seçilmez Blob'a yükleniyor. Kaydetmeden silinirse Blob'da sahipsiz kalıyor (depo şişmesi). Bu oturumda yüklenip kaydetmeden silinen görseller için upload route'a admin korumalı küçük bir `DELETE` eklenip mevcut `deleteBlobUrls` ile silinir. Daha önce kaydedilmiş görsellere dokunulmaz (onları zaten ürün kaydı sırasında mevcut mantık temizliyor).

## Claude Code için Prompt

> Admin panelde ürün görseli eklemeyi çoklu seçim + toplu yükleme + sürükle-bırak sıralamaya çevir. Plan dosyası: `URUN_GORSEL_COKLU_YUKLEME_PLANI.md` (önce oku). Sunucu tarafındaki ürün kaydetme mantığına ve veri formatına DOKUNMA; `MultiImageField`'in dışa dönük API'si (`images`, `onChange`, `addLabel`, `uploadEndpoint`, `ImageEntry` tipi) aynı kalsın ki `product-images-field.tsx` ve `variant-editor.tsx` değişmeden çalışsın.
>
> 1. **`src/components/admin/multi-image-field.tsx`'i yeniden yaz** (gerekirse `image-field.tsx`'i tek görsel kullanan başka yerler için olduğu gibi bırak; kullanıldığı başka yer var mı kontrol et):
>    - "Görsel Ekle" butonu gizli `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`'i açsın. Seçilen TÜM dosyalar listeye eklensin.
>    - Kartın içinde dosya sürükle-bırak alanı olsun (`onDragOver`/`onDrop`, sadece görsel MIME tipleri kabul, diğerlerini sessizce atla, hover'da kenarlık rengi değişsin). Metin: "Fotoğrafları buraya sürükleyin veya **Görsel Ekle**'ye basın".
>    - Her yeni dosya için bileşen içi durum tut: `{ key, status: "uploading" | "done" | "error", previewUrl (URL.createObjectURL), url?, error? }`. Kart hemen önizlemeyle görünsün, üstünde spinner olsun. Unmount'ta ve iş bitince `URL.revokeObjectURL` çağır.
>    - Yüklemeleri **en fazla 3 eşzamanlı** olacak şekilde küçük bir kuyrukla `/api/admin/upload`'a gönder (`uploadEndpoint` prop'u varsa onu kullan). Hata olan kartta kırmızı çerçeve + "Tekrar dene" butonu.
>    - **Tarayıcıda ön küçültme:** göndermeden önce `createImageBitmap` + canvas ile uzun kenar 2000 px'i aşıyorsa küçült, `canvas.toBlob(..., "image/jpeg", 0.9)` ile JPEG yap (dosya adını `.jpg` ile koru). EXIF yönü için `createImageBitmap(file, { imageOrientation: "from-image" })` kullan. Küçültme başarısız olursa orijinal dosyayı gönder. Sonuç hâlâ 4.5 MB üstündeyse yüklemeden "Dosya çok büyük" hatası göster. Bunu `src/lib/client-image-resize.ts` gibi ayrı küçük bir yardımcıya koy.
>    - `onChange`'e sadece `status === "done"` olan görselleri `ImageEntry` olarak ilet; yükleme sürenler ve hatalılar parent state'e girmesin ama ızgarada sıralarıyla görünsün. Bitenler seçim sırasına göre listenin SONUNA eklensin.
>    - **Izgara görünüm:** `grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2`, kare (`aspect-square`) küçük resimler, `object-cover`. Her kartta: sol üstte sıra numarası, ilk/vitrin görselde "Vitrin" rozeti, hover'da (mobilde her zaman görünür) ★ vitrin yap, 🗑 sil, ← / → taşı, ✎ alt metin düzenle (küçük popover veya kart altında açılan input). Mevcut `isCover` mantığını aynen koru (hiçbiri işaretli değilse ilk görsel vitrin).
>    - **Sürükle-bırak sıralama:** `@dnd-kit/core` + `@dnd-kit/sortable` (zaten kurulu, `category-manager.tsx`'teki kullanım örneğine bak) ile `rectSortingStrategy`. `PointerSensor` (activationConstraint `distance: 5` ki butonlara tıklama sürükleme sanılmasın) + `TouchSensor` (delay ~150 ms) + `KeyboardSensor`. Sürüklenen kart hafif büyüsün/gölgelensin. Sıralama sonrası `arrayMove` ile `onChange` çağır.
>    - **URL ile ekle:** butonun yanında küçük "URL ile ekle" linki; açılan textarea'ya satır başına bir URL, "Ekle" deyince boş olmayan, `http(s)://` ile başlayan her satır bir görsel olarak eklensin (upload yok).
>    - Boş durumda (hiç görsel yoksa) büyük kesikli kenarlıklı bırakma alanı göster.
> 2. **Yükleme sürerken kaydetmeyi engelle:** `MultiImageField` yükleme sürdükçe en yakın `form` elemanına (`ref.closest("form")`) capture fazında `submit` dinleyicisi eklesin; bekleyen yükleme varsa `preventDefault()` + `stopPropagation()` yapıp bileşenin içinde "X görsel hâlâ yükleniyor, bitince kaydedin" uyarısı göstersin (projede `toast.tsx` varsa onu kullan). Dinleyici yükleme bitince kaldırılsın. Aynı formda birden fazla `MultiImageField` (renk görselleri) olduğunu unutma, her biri kendi bekleyenlerini kontrol etsin.
> 3. **Kaydetmeden silinen yeni yüklemeleri temizle:** `src/app/api/admin/upload/route.ts`'e admin oturumu kontrollü bir `DELETE` handler ekle: body `{ url }`, sadece `src/lib/blob.ts`'teki `deleteBlobUrls` ile (o zaten sadece Vercel Blob URL'lerini siler). `MultiImageField`, bu oturumda KENDİ yüklediği URL'leri bir `Set`'te tutsun; kullanıcı böyle bir görseli silerse arka planda DELETE çağırsın (hata olursa yut). Başlangıçta gelen (`images` prop'undaki ilk) görseller için DELETE ÇAĞIRMA.
> 4. Upload route'taki `MAX_SIZE_BYTES`'ı 4.5 MB'a çek ve hata mesajını buna göre güncelle (Vercel gövde sınırıyla tutarlı olsun).
> 5. `product-images-field.tsx` ve `variant-editor.tsx`'teki kullanımlar değişmeden çalışmalı; ikisinde de test et (genel görseller + en az iki renk görseli bölümü). "Kaydedilmemiş değişiklikler var" çubuğu sıralama, ekleme ve silmede açılmaya devam etmeli.
> 6. Mobil (390 px) ve masaüstü genişlikte düzen bozulmasın; butonların dokunma alanı en az 32 px olsun.
> 7. `npm run lint` ve `npx tsc --noEmit` ile hata olmadığını doğrula.
> 8. Proje kuralları: değişiklikleri önce localhost'ta göreceğim (`npm run dev`). Ben onaylayınca YEREL commit at, **ben söylemeden push etme**. Yüklü skill'leri kullan (karpathy-guidelines dahil). İş bitince `DEPLOY_STATUS.md`'ye not düş.

## Test Listesi (localhost'ta)

- Ürün düzenle → Görsel Ekle → Ctrl ile 5 fotoğraf seç → 5'i birden önizlemeyle geldi mi, yüklendi mi?
- Masaüstünden 3 fotoğrafı karta sürükleyip bırak → eklendi mi?
- 6+ MB'lık bir telefon fotoğrafı → hata vermeden yüklendi mi?
- Kartları fareyle sürükleyip sırayı değiştir → Kaydet → sayfayı yenile → sıra korunmuş mu? Vitrinde ilk görsel doğru mu?
- Yükleme sürerken Kaydet'e bas → engellendi ve uyarı çıktı mı?
- ★ ile başka bir görseli vitrin yap → kaydet → sitede kapak o mu?
- Renk görselleri bölümünde (örn. Kırmızı, Mavi) aynı çoklu ekleme ve sıralama çalışıyor mu?
- "URL ile ekle" → 3 URL alt alta yapıştır → 3 görsel geldi mi?
- Yeni yüklediğin bir görseli kaydetmeden sil → hata yok mu? (Blob'dan silinmiş olmalı.)
- Eski kayıtlı bir görseli silip Kaydet → ürün normal güncellendi mi?
- Mobil genişlikte ızgara 3 sütun, parmakla sürükleme çalışıyor mu?
