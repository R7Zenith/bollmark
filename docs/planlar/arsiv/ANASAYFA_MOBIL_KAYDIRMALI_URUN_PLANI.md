# Anasayfa mobil ürün bölümleri - "tek tek büyük, kaydırmalı" kart görünümü

## İstek

Release temasının anasayfasında mobil görünümde "Just arrived" / yeni gelenler bölümü şu şekilde çalışıyor: ürünler yatayda tek tek, büyük gösteriliyor; yanında bir sonraki ürünün azıcık kenarı görünüyor; kullanıcı kaydırdıkça sıradaki ürüne geçiyor. Kullanıcı Bollmark anasayfasındaki ürün bölümlerinin mobilde aynı davranışa geçmesini istiyor.

## Mevcut durum (kod incelendi)

Bollmark'ta anasayfada iki ürün bölümü var, ikisi de mobilde **sabit 2 sütunlu grid** kullanıyor (kaydırma yok, kart küçük, tek ekranda çok ürün üst üste diziliyor):

- `src/components/featured-carousel.tsx` (satır 94) - **Yeni Gelenler**: `-mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3 md:hidden`
- `src/components/home/bestsellers-tabs.tsx` (satır 80) - **Çok Satanlar**: aynı grid, `md:` üstünde 4 sütuna geçiyor

İkisi de masaüstünde zaten "carousel" mantığında (Yeni Gelenler: 4'lü, ok ile bir adım kayan slider; Çok Satanlar: sabit 4'lü grid + sekmeler) - sadece mobil tarafı klasik grid'e düşüyor.

Bollmark'ta bu istenen "tek tek büyük, kaydırınca geçen" davranışın **zaten bir örneği var**: aynı sayfada "Özel Koleksiyonlarımız" bölümü (`app/(site)/page.tsx` satır 266) mobilde tam olarak bu deseni kullanıyor:

```
-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] ...
```
kart genişliği `w-[44vw]` (o bölümde kart küçük/kare olduğu için 44vw yeterli - ekranda ~2 kart yan yana görünüyor).

Yeni Gelenler/Çok Satanlar için istenen görünüm bundan farklı: kart çok daha büyük olacak (neredeyse tam ekran genişliği), yanında sadece bir sonraki ürünün kenarı (~%8-10'u) görünecek - yani aynı teknik (`snap-x snap-mandatory` + `overflow-x-auto`), farklı kart genişliği.

## Not: Release'in tam mobil piksel ölçüleri doğrulanamadı

Bu oturumda tarayıcı penceresi mobil genişliğe (390px) küçültülemedi (pencere yeniden boyutlandırma bu ortamda çalışmadı), o yüzden Release'in "Just arrived" carousel'inin mobildeki kart genişliği/gap değerlerini computed style ile birebir doğrulayamadım - önceki masaüstü ölçümlerinde olduğu gibi kesin piksel veremiyorum. Aşağıdaki değerler, Shopify/e-ticaret sitelerinde yaygın olan "bir kart + yanında kısmi ikinci kart" deseninin standart oranlarına ve Bollmark'ın kendi koleksiyon kartı carousel'inde kullandığı tekniğe dayanıyor. İstersen bir sonraki oturumda gerçek mobil cihaz/emülatör ile Release'i tekrar ölçüp bu değerleri kesinleştirebiliriz; şimdilik makul bir başlangıç değeri veriyorum, gözle kontrol edip ince ayar (genişlik %'si, gap) kolayca yapılabilir.

## Önerilen çözüm

Her iki bölümün mobil grid'ini, koleksiyon kartlarında kullanılan `snap-x` tekniğiyle, tek-kart-büyük görünüme çevir:

- Kart genişliği: `w-[82vw]` (ekranın büyük kısmını kaplasın, sağda bir sonraki ürünün ~%10-12'si görünsün)
- `snap-x snap-mandatory` + `overflow-x-auto` + `-mx-4 px-4` (kenardan kenara kaydırma, mevcut desenle aynı)
- Kart arası boşluk: `gap-3` (mevcut koleksiyon carousel'iyle tutarlı)
- Scrollbar gizli: `[scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
- `snap-start` (soldan hizalı dursun, "Özel Koleksiyonlar" ile aynı)
- Çok Satanlar'da sekme değişince scroll pozisyonu başa dönmeli (yoksa kullanıcı 3. sekmede kaydırılmış kalır) - sekme değişiminde container'ı `scrollLeft = 0` yapmak gerekiyor.
- Yeni Gelenler'in masaüstü ok/slider mantığına dokunulmuyor - sadece mobil (`md:hidden`) grid satırı değişiyor.

Bu değişiklik yalnız CSS/className seviyesinde, veri veya bileşen mantığında değişiklik gerekmiyor (Çok Satanlar'daki sekme sıfırlama hariç, o da küçük bir `ref` + `useEffect` eklemesi).

## Claude Code'a verilecek prompt

Aşağıdaki promptu Claude Code'a birebir verebilirsin:

---

Bollmark anasayfasında iki ürün bölümünün mobil görünümünü değiştir: **Yeni Gelenler** (`src/components/featured-carousel.tsx`) ve **Çok Satanlar** (`src/components/home/bestsellers-tabs.tsx`).

Şu an ikisi de mobilde (`md:hidden` / `md:` altı) sabit 2 sütunlu grid kullanıyor:
```
-mx-4 grid grid-cols-2 gap-x-0.5 gap-y-3
```

Bunu, aynı dosyada `app/(site)/page.tsx` içindeki "Özel Koleksiyonlarımız" bölümünün (yaklaşık satır 266) zaten kullandığı yatay kaydırmalı (`snap-x`) teknikle değiştir, ama kart çok daha büyük olacak - amaç: kullanıcı mobilde tek seferde bir ürünü büyük görsün, yanında bir sonrakinin kenarı azıcık görünsün, kaydırınca bir sonraki ürüne geçsin (Shopify "Release" temasının anasayfa "Just arrived" carousel davranışı).

Her iki bileşende mobil grid'i şuna çevir (masaüstü/`md:` kısımlarına dokunma):

```
-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden
```

ve içindeki her `ProductCard`'ı `shrink-0 snap-start w-[82vw]` ile sarmala (şu an direkt grid item'ı iken artık flex item'ı olacak, container'a `<div className="shrink-0 snap-start w-[82vw]"><ProductCard ... /></div>` şeklinde sarman gerekiyor - ProductCard'ın kendi iç genişlik mantığına dokunma).

`w-[82vw]` başlangıç değeri - localhost'ta gerçek telefon genişliğinde (375-414px) gözle kontrol et, sağda görünen "bir sonraki ürün kenarı" çok az/çok fazla görünüyorsa `78vw`-`85vw` aralığında ince ayar yap, kesin doğru değeri sen belirle.

`bestsellers-tabs.tsx`'te ek olarak: sekme (Tümü/Kadın/Erkek/Çocuk) değiştiğinde, eğer kullanıcı önceki sekmede sağa kaydırmışsa yeni sekme de kaydırılmış görünmesin - sekme değişince mobil kaydırma container'ının `scrollLeft`'ini 0'a resetle (bir `ref` ekleyip `setActiveKey` çağrılan yerde veya bir `useEffect` ile `activeKey` değişince sıfırla).

Değişiklik sadece bu iki dosyada mobil className'leri ve bestsellers-tabs'taki scroll-reset ile sınırlı - başka bölümlere (masaüstü carousel mantığı, kategori kartları, veri katmanı) dokunma.

Kod stiline uy: dosyalardaki mevcut Türkçe yorum tarzını koru, üstteki değişikliği açıklayan kısa bir yorum ekle (neden `snap-x` + `w-[82vw]`'ye geçildiği).

localhost'ta mobil genişlikte (Chrome DevTools cihaz simülasyonu, iPhone boyutu) görsel olarak doğrula: tek kart büyük görünmeli, kaydırma akıcı olmalı (`snap-mandatory` ile kart ortasında/başında durmalı), sekme değişince scroll sıfırlanmalı. Onay alana kadar push etme, sadece yerel commit at.

DEPLOY_STATUS.md dosyasına bu işin notunu düş (ne değişti, hangi dosyalar, kullanıcı localhost'ta onayladıktan sonra).

---
