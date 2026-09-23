# Koton Görsel ve Açıklama Toplama Planı (Tarayıcı Yöntemi)

Tarih: 2026-09-24
Durum: Test yapıldı (2 ürün tamam, 1 ürün yarım kaldı). Aşama 2 (panele işleme) henüz yazılmadı.

Bu doküman, Claude ile yapılan istişarenin özetidir. Kodlama Claude Code ile yapılacak, Claude (sohbet tarafı) sadece araştırır, önerir ve prompt hazırlar.

---

## 1. Neden bu plan?

- Excel aktarımında Koton sitesinden otomatik fotoğraf çekme kapatıldı, çünkü sunucudan giden istekler bot olarak algılanıyordu (bkz. `EXCEL_KOTON_GORSEL_ARAMA_TAKILIYOR_PLANI.md`, `COK_MARKALI_GORSEL_BULMA_PLANI.md`).
- Yeni fikir: ürünler Excel'den panele aktarıldıktan sonra, Claude senin gerçek Chrome tarayıcını kullanarak Koton'da ürünleri tek tek bulsun, fotoğraf ve açıklamaları toplasın.
- Hedef hacim: günde yaklaşık 20-30 ürün.

## 2. Yöntem: İki aşamalı ayrım

### Aşama 1: Claude tarayıcıda toplar (Koton'a dokunulan tek yer)
Claude in Chrome ile, senin Chrome'unda, senin IP ve çerezlerinle çalışır. Sunucudan istek yok.

Adımlar (testte çalışan akış):
1. Koton'un **kendi arama kutusuna** ürün kodu yazılır (örn. `6SAM60044HW`). Tahmin edilen arama adresi (`/tr/search?q=...`) 404 verir, kullanılmamalı.
2. Sonuç kartına tıklanır, ürün sayfası açılır.
3. Renk seçenekleri (swatch) sayfadan tıklanarak gezilir. Her renk ayrı adrestir (örn. `...gomlek-beyaz-4095132/`, `...ekru-4095133/`, `...lacivert-4095136-1/`, `...siyah-4095138/`). Sayfa başlığında renk adı doğrulanır.
4. Galeri görselleri sayfadan okunur. Ana galeri, sayfanın sol yarısındaki görsellerin ortak kapsayıcısından alınır (sayfada diğer renklerin küçük önizlemeleri de var, karışmamalı). Aynı görsel DOM'da iki kez geçer (mobil ve masaüstü), tekilleştirilir. Renk başına 5-6 galeri görseli çıkıyor.
5. Açıklama, kumaş, özellikler "Ürün Detay" bölümünden okunur (bazı ürünlerde stil önerisi, model bilgisi ve ölçü tablosu da var, bazılarında yok).
6. Görseller indirilir (aşağıya bak).
7. Sonuçlar Excel'e satır olarak yazılır.

Görsel adresi kalıbı: `https://ktnimg2.mncdn.com/products/YYYY/MM/DD/<urun-id>/<uuid>_size870x1142.jpg`. Sonundaki `_size870x1142` kısmı silinirse 2250x2954 büyük sürüm gelir (henüz indirmedik).

### İndirme yöntemi
- Görsel adresi yeni sekmede açılır (insanın "görseli yeni sekmede aç" demesiyle aynı istek).
- İşletim sisteminin "Farklı kaydet" penceresi otomasyonla yönetilemediği için, indirme komutu **aynı sekmenin içinden** verilir (aynı adresi okuyup `a.download` ile kaydetme). Genelde önbellekten gelir, ek istek atmaz.
- Chrome ilk seferde "birden fazla dosya indirme" uyarısı verdi. Bir kereliğine `ktnimg2.mncdn.com` için izin verildi, tekrar sorun olmadı.
- Dosyalar önce Downloads klasörüne düşer. Claude'un Downloads klasörüne erişim izni verildi. Dosyalar oradan Bollmark içindeki `gorsel-test` klasörüne kopyalanır (bu ortamda cihaz kabuğu yok, kopyalama "hazırla ve yaz" adımlarıyla yapılıyor).
- Dosya adı: `<urunkodu>_<renk>_<sıra>.jpg` (örn. `6SAM60012HW_lacivert_3.jpg`).

### Aşama 2: Claude Code panele işler (Koton'la ilgisi yok)
Toplanan veriyi panelin kendi akışıyla ürün varyantlarına ekler. Aşağıda taslak prompt var (bölüm 7).

## 3. Test sonuçları (2026-09-24)

| Ürün | Durum | Detay |
|---|---|---|
| 6SAM60044HW (Beyaz) | Tamam | 5 görsel, açıklama, kumaş, stil önerisi, model bilgisi, ölçü tablosu okundu |
| 6SAM60012HW | Tamam | Beyaz 5, Ekru 6, Lacivert 5, Siyah 6 = 22 görsel. Açıklama ve kumaş var. Stil önerisi, model bilgisi, ölçü tablosu yok. Koton'da 7 renk var (kahverengi, mavi, yeşil de), Excel'de sadece 4 tanesi olduğu için diğerleri alınmadı |
| 6SAM60122HW (Bej Çizgili) | Yapılamadı | Arama kutusu üç denemede de yazıyı almadı, bir sekme donmuştu. Sebebi bilinmiyor |

Gözlemler:
- Koton'dan engel, captcha, boş sayfa ya da hata gelmedi. Bütün görseller 200 OK ile geldi.
- Toplam: 3 arama, 6 ürün sayfası, yaklaşık 27 görsel. Bir görsel sekmesi Claude'un grubundan çıktı, bir sekme kendiliğinden görsel açtı (zararsız).
- Süre: 4 renkli ürün için yaklaşık 10-12 dakika (renk başına ~3 dk).
- 044'ün 3 görseli Chrome uyarısı yüzünden iki kez indirildi.
- Excel dosyası (`koton_urun_aciklamalari.xlsx`) kullanıcıda açık olduğu için üzerine yazılamadı, güncel sürüm `koton_urun_aciklamalari_v2.xlsx`.

Not: `ornek-veriler/KOTON11052026CHECKLIST.xls` dosyasında toplam 6 ürün kodu var (hepsi erkek gömleği): 6SAM60012HW, 6SAM60013HW, 6SAM60022HW, 6SAM60044HW, 6SAM60122HW, 6SAM60139HW.

## 4. Bot algısı ve risk değerlendirmesi

Bot izi gibi görünmeyenler:
- Gerçek Chrome, senin IP'n, senin çerezlerin. Sunucudan istek yok.
- Küçük hacim, aralıklı gezinme.

Dikkat çekmiş olabilecekler (kesin bilinmiyor, Koton'un tarafı görülemiyor):
- Görseller neredeyse eşit aralıkla indi (düzenli ritim). Çözüm: rastgele bekleme.
- Bazı görseller iki kez istenmiş olabilir.
- İlk denemedeki yanlış arama adresi 404 verdi.
- Arama kutusunun yazı almaması ve donan sekmenin sebebi belirsiz.

Kural olarak: gerçek bir müşteri gibi **görünmek**, gerçek bir müşteri gibi **davranıyor olmak** demek değildir. Koton'un kullanım şartları büyük ihtimalle otomatik veri toplamayı yasaklıyor (hukuki yorum değil, avukat değiliz).

## 5. Hukuki ve içerik notları

- Koton görselleri ve açıklamaları Koton'a aittir. Yetkili satıcı olarak görsel kullanımı sektörde yaygın ama toptancıdan ya da Koton'un bayi kanalından **resmi görsel paketi** olup olmadığı sorulmalı. Varsa daha temiz, daha kaliteli, iş de kolaylaşır.
- Açıklamalar birebir yayınlanmamalı (kopya içerik, SEO ve telif). Excel'de "Koton Açıklaması (kaynak)" sütunu sadece referans, "Yeniden Yazılmış Açıklama" sütununa özgün metin yazılmalı.

## 6. Hızlandırma seçenekleri (henüz uygulanmadı)

Risk artırmadan:
1. **Renk başına tek komut:** Tüm görseller aynı sunucuda (`ktnimg2.mncdn.com`). Bir görsel sekmesi açıkken diğerleri aynı sekmeden tek komutla, aralarına rastgele bekleme koyarak indirilir. İstek sayısı aynı, adım sayısı çok daha az.
2. **Rastgele bekleme:** Sabit 9-15 sn yerine 4-12 sn arası rastgele.
3. **Önbellekten alma (denenmemiş):** Ürün sayfası açıldığında galeri görselleri zaten tarayıcıya yükleniyor. Çalışırsa Koton'a hiç ek istek gitmez. Tarayıcı çapraz kaynak kuralları engelleyebilir, denemek gerekiyor.
4. Diğer renk linklerini bir ürün sayfasından toplayıp sırayla gezmek.

Yapılmayacaklar: paralel indirme, beklemeleri sıfıra yakın yapma.

Tahmini süre: renk başına ~1-1.5 dk. Günde 20-30 ürün, ortalama 3 renkle yaklaşık 1-1.5 saat.

## 7. Aşama 2 için Claude Code prompt taslağı

> Bu bir taslaktır. Claude Code önce mevcut kodu (Excel aktarımı, görsel yönetimi, varyant yapısı) okuyup gerçek dosya ve fonksiyon adlarına göre revize etmeli. Önce planı Bollmark klasörüne `.md` olarak yazsın.

```
Görev: Koton'dan tarayıcı ile toplanan görselleri ve açıklamaları panelde mevcut ürünlere ekle.

Girdi:
- Bollmark/gorsel-test klasörü: <urunkodu>_<renk>_<sira>.jpg görseller
- Bollmark/gorsel-test/koton_urun_aciklamalari_v2.xlsx: her satır bir ürün+renk
  Sütunlar: Ürün Kodu, Ürün Adı, Renk, Koton Ürün Sayfası, Koton Açıklaması (kaynak),
  Stil Önerisi (kaynak), Ürün Özellikleri, Kumaş, Model Bilgisi, Ölçü Tablosu,
  Görsel Dosyaları, Yeniden Yazılmış Açıklama

Yapılacaklar:
1. Önce mevcut kodu oku (Excel ürün aktarımı, renk bazlı görsel galerisi, varyant modeli,
   GORSEL_YONETIMI_PLANI.md, GORSEL_SIKISTIRMA_VE_BLOB_LIMIT_PLANI.md) ve planı proje klasörüne yaz.
2. Ürün kodu + renk ile panelde zaten aktarılmış varyantı bul. Bulamazsan tahmin etme,
   "eşleşmedi" olarak listele.
3. Görselleri kendi depolamamıza yükle, renk bazlı galeriye sıra numarasına göre ekle.
   Vercel function/blob depolamasını şişirme: yüklemeden önce boyut ve sıkıştırmayı kontrol et.
4. Açıklama: "Koton Açıklaması (kaynak)" sütununu ürüne YAZMA. "Yeniden Yazılmış Açıklama"
   doluysa onu kullan, boşsa açıklamayı boş bırak ve bana listele.
5. Ürünler taslak olarak açılıyor (mevcut davranış), bunu bozma. Yayına alma.
6. İdempotent ol: aynı klasörü ikinci kez çalıştırınca çift görsel/çift kayıt oluşmasın.
7. Önce dry-run çalıştır: neyi ekleyeceğini, neyi eşleştiremediğini listele. Onayımdan sonra gerçekten yaz.
8. Sonunda DEPLOY_STATUS.md'ye not düş.

Kurallar:
- Yüklü skill'leri kullan.
- Değişiklikleri önce localhost'ta göstereceğim (localhost Neon'a bağlı, ürünler taslak).
- Onayımdan sonra yerel commit at. Ben söylemeden push etme.
```

## 8. Push ve deploy durumu

- Günlük ürün yükleme için push/deploy gerekmez. Ürünler ve varyantlar Neon veritabanında, görseller depolamada duruyor.
- Push ve deploy sadece kod değiştiğinde lazım (Aşama 2 aracını yazıp yayına almak için, tek seferlik).
- Günlük akış iki şekilde olabilir: (a) panelde import aracı (bir kere deploy, sonra panelden çalışır), (b) bilgisayardan betik (deploy yok, dry-run şart). İkisi de veritabanına doğrudan yazar.
- Localhost Neon'a bağlı, ürünler taslak olarak açılıyor (kullanıcı doğruladı). Bu yüzden localhost'ta import edilen ürünler canlı veritabanına yazılır ama sitede yayınlanmaz.
- Görsel yüklemesi depolama alanı tüketir, bu yüzden sıkıştırma ve boyut kontrolü prompt'ta yer alıyor.

## 9. Açık noktalar / sonraki adımlar

1. 6SAM60122HW (Bej Çizgili) ürününü yeniden denemek (arama kutusu sorunu tekrar ederse tarayıcı sekmelerini kapatıp temiz başlamak).
2. Açıklamaları yeniden yazma işi: kim yapacak? Öneri: Claude taslak metinleri yazıp Excel'in son sütununa koysun, sonra Claude Code panele işlesin.
3. Hızlandırma: "renk başına tek komut" ve "rastgele bekleme" yöntemini bir sonraki testte denemek. Önbellekten alma yöntemini bir ürünle test etmek.
4. Resmi görsel paketi: toptancıya ya da Koton bayi kanalına sormak.
5. Aşama 2 promptunu Claude Code'un mevcut kodu okumasına göre son haline getirmek.
6. Diğer markalar (Slazenger vb.) için aynı yöntemin uygulanabilirliği: `COK_MARKALI_GORSEL_BULMA_PLANI.md` ile birlikte değerlendirilecek.
7. Tarayıcıda açık kalan Koton sekmelerini kontrol edip kapatmak.

## 10. İlgili dosyalar

- `Bollmark/gorsel-test/` : indirilen 27 görsel (6SAM60044HW 5 adet, 6SAM60012HW 22 adet)
- `Bollmark/gorsel-test/koton_urun_aciklamalari.xlsx` : ilk sürüm (yalnızca 044)
- `Bollmark/gorsel-test/koton_urun_aciklamalari_v2.xlsx` : güncel liste (044 + 012'nin 4 rengi)
- `Bollmark/ornek-veriler/KOTON11052026CHECKLIST.xls` : test için kullanılan Excel
- Downloads klasöründe aynı görsellerin kopyaları duruyor (istersen silebilirsin)
