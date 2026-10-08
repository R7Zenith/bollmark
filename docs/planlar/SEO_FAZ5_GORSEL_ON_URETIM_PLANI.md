# SEO Faz 5 — Görsel ön-üretim (plan)

> **Durum (1 Ekim 2026):** Kullanıcı yalnızca madde 6’yı (public/ görselleri) onayladı ve bu madde uygulandı. Ürün fotoğraflarının 800px sürümleri (madde 1–5) ertelendi; trafik artınca ya da Search Console’da mobil hız uyarısı çıkınca yeniden ele alınacak.

Kaynak: SEO_TEKNIK_DENETIM_VE_PLAN.md bölüm 2.10. Tarih: 1 Ekim 2026.

## 1. Mevcut durum (kod ve canlı veri incelemesi)

- `next.config.mjs` içinde geçici olarak `images.unoptimized: true` duruyor. Bunun sebebi Vercel Image Transformations kotasının (Hobby: 5.000/ay) dolması ve görsellerin 402 hatasıyla kırılmasıydı. Bu ayar yüzünden bütün `next/image` görselleri, **mobil dahil, olduğu gibi (1600px)** iniyor.
- Veritabanında **1.085 ürün, kategori ve marka görseli** var. Hepsi Vercel Blob'da, hepsi WebP ve 1600px genişliğinde, ortalama 69 KB.
- Blob'a görsel yazan yalnızca iki yer var: admin yükleme (`api/admin/upload`) ve Koton/Slazenger görsel çekme (`reuploadImageToBlob`). İkisi de `compressImage` (1600px WebP q78) kullanıyor.
- `public/` altındaki sabit görseller sıkıştırılmamış:
  - `hero-model.jpg`: 1,4 MB
  - `menu/*.webp`: 0,4–1,5 MB
  - `anasayfa/*.jpg`: 0,1–0,7 MB
  - toplam yaklaşık 7 MB
- Bileşenlerdeki `sizes` değerleri doğru ayarlanmış (30 Eylül'de düzeltildi). Ürün galerisinin ilk görselinde ve anasayfa hero'sunda zaten `priority` var.
- **Vercel Blob Hobby sınırları** (vercel.com/docs, 1 Ekim'de okundu):
  - aylık 2.000 **yazma işlemi** (`put`/`list`/`copy`)
  - 1 GB depolama
  - 10.000 önbellek dışı okuma

  Bu sınırlar tüm proje için ortaktır.

## 2. Temel karar: kaç küçük sürüm?

Orijinal plan her görsel için 400, 800 ve 1600 px sürümlerini öngörüyordu. Bu, 1.085 × 3 = **3.255 yazma işlemi** eder ve aylık 2.000 sınırını aşar. Aşım olursa o ay admin panelden görsel yükleme ve Koton içe aktarımı da durabilir.

**Önerim: her görsele tek bir ara boy, 800px.**
- Yükü: 1.085 yazma işlemi (bir kerelik) ve yaklaşık 30 MB ek depolama. Yeni yüklenen her görsel 1 ek yazma işlemi getirir.
- Kurallar: 800px ve altı istekler 800'lük sürümü alır, daha büyükleri mevcut 1600'lük orijinali.
- Kazanç: mobilde ürün kartı ve galeri görselleri yaklaşık %55–60 küçülür (69 KB → yaklaşık 28 KB). Masaüstü galeri 1600'lük orijinali kullanmaya devam eder.

**Alternatifler:**
- **Vercel Pro'ya geçmek** (aylık yaklaşık 20 $). Blob ve görsel dönüştürme sınırları kalkar. Bu durumda `unoptimized` satırını kaldırmak tek başına yeterli olur ve bu faz çok küçülür. Bu bir iş kararı.
- **Vercel'in kendi görsel dönüştürmesini tekrar açmak** (Hobby). Bot trafiği engellendikten sonra kota yetebilir, ama katalog büyüdükçe yeniden dolar ve görseller yine kırılır. Önermiyorum.

## 3. Yapılacaklar (önerilen seçenekle)

1. **Özel görsel yükleyici (`src/lib/image-loader.ts` + `next.config` `loader: "custom"`):**
   - `unoptimized: true` kaldırılır. Bütün `next/image` görselleri bu yükleyiciden geçer. Bileşenlerde değişiklik gerekmez; mevcut `sizes` değerleri `srcset` üretmeye devam eder.
   - Blob görselinde istenen genişlik ≤ 800 ise `…/ad.w800.webp`, değilse orijinal adres döner.
   - `public/` görselinde aynı kural `/ad.w800.webp` ve `/ad.w1600.webp` dosyalarıyla uygulanır.
   - Diğer kaynaklarda (Unsplash yedeği) adres değiştirilmeden döner.
   - Vercel'in görsel dönüştürmesi (`/_next/image`) hiç kullanılmaz, kotaya bağımlılık tamamen biter.
2. **Yeni yüklemeler:** `compressImage` 800px sürümü de üretir. Admin yükleme ve `reuploadImageToBlob`, orijinalin yanına aynı ada `.w800.webp` ekiyle kaydeder (`addRandomSuffix: false`).
3. **Silme:** `deleteBlobUrls` orijinalle birlikte `.w800` sürümünü de siler. Bu yapılmazsa Blob'da sahipsiz dosyalar birikir.
4. **Backfill scripti (`scripts/gorsel-surumleri-uret.ts`):**
   - Varsayılan olarak `--dry-run` çalışır; yalnızca kaç görsel işleneceğini ve tahmini yazma işlemi sayısını gösterir.
   - `--apply` ile gerçekten yazar. `head()` ile önce sürümün var olup olmadığına bakar, varsa atlar, böylece kesilirse kaldığı yerden devam eder.
   - `--limit N` ile tek seferde en fazla N görsel işler, aylık kotayı kontrollü kullanmak için.
   - Hız sınırına (dakikada 900 yazma) takılmamak için sırayla ve küçük gruplar halinde çalışır.
5. **Canlıya alma sırası (kırık görsel olmaması için):** Önce backfill canlı veritabanı/Blob üzerinde tamamlanır, sonra yükleyici push edilir. Yükleyici canlıya çıkmadan önce script "eksik sürüm yok" doğrulaması yapar.
6. **`public/` görselleri (Blob'a gitmez, yazma işlemi harcamaz):** Tek seferlik bir script ile her görselin yanına `ad.w800.webp` ve `ad.w1600.webp` üretilir ve repoya eklenir. Orijinal dosyalar silinmez. Örnek: `hero-model.jpg` 1,4 MB iken yaklaşık 150–250 KB olur.
7. **alt metinleri:** Ürün galerisinde alt metni `{Marka} {Ürün adı} {Renk} - {n}. görsel` olur. Admin'de özel alt metin girilmişse o korunur.
8. **Ölçüm:** Yerelde production build üzerinde anasayfa, bir kategori ve bir ürün sayfasının mobil Lighthouse ölçümü (LCP ve toplam indirme boyutu) değişiklik öncesi ve sonrası alınıp raporlanır.

## 4. Riskler ve kontroller

- **Eksik sürüm = kırık görsel.** Yükleyici dosyanın var olup olmadığını bilemez. Bu yüzden canlıya çıkmadan önce backfill doğrulaması şart (madde 5). Doğrulamada eksik çıkan sürüm varsa push yapılmaz.
- **Yazma kotası:** Backfill 1.085 işlem, ayın geri kalanında ~900 işlem kalır. Bu ay yoğun Koton içe aktarımı planlanıyorsa backfill `--limit` ile iki aya bölünebilir. O durumda yükleyici canlıya ikinci ayın sonunda çıkar.
- **Admin önizlemeleri de yükleyiciden geçer.** Yüklemeden hemen sonra (sürüm yazılmadan) gösterilen önizlemeler için yükleme cevabı her iki dosya yazıldıktan sonra döner.

## 5. Kapsam dışı

- Farklı bir görsel CDN'i (Cloudflare Images/R2). Ek hesap ve kurulum gerektirir; Vercel Pro kararıyla birlikte değerlendirilebilir.
- Görsellerin AVIF sürümleri. Kazancı küçük, yazma işlemi maliyeti iki katı.
