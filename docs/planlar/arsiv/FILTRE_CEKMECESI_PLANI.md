# Filtre Çekmecesi (Filter Drawer) Planı

Release temasındaki katalog filtresi: "Filtre" butonuna basınca sepet çekmecesindeki gibi animasyonlu şekilde ekranın SOLUNDAN bir "Filter by" paneli açılıyor. Bizim sitedeki filtre kısıtlı ve yetersiz; aşağıdaki prompt ile detaylı, temaya uygun, animasyonlu bir çekmeceye dönüştürülecek.

## Claude Code Prompt'u

```
GÖREV: Ürün katalog sayfasındaki mevcut filtre özelliğini, Release temasındaki gibi soldan animasyonlu açılan detaylı bir "Filter by" çekmecesine (drawer) dönüştür.

ÖNCE İNCELE (kod yazmadan önce):
- Katalog sayfasındaki mevcut filtre bileşenini/route'unu ve filtrelerin ürünleri nasıl sorguladığını (query param mı, server action mı, client state mi) bul.
- Sepet çekmecesinin (cart drawer) açılış/kapanış animasyonunu, overlay'ini, z-index ve scroll-lock mantığını bul. Filtre paneli AYNI mekanizmayı ve animasyon süre/easing değerlerini kullansın, sadece soldan gelsin.
- Filtrelenebilecek veri alanlarını Prisma şemasından çıkar (kategori, renk, beden, fiyat, stok, indirim vb.). Yeni alan uydurma, olanı kullan.

DAVRANIŞ:
1. Katalogdaki "Filtre" butonuna basınca panel ekranın SOLUNDAN kayarak açılır (translateX(-100%) -> 0), arkada yarı saydam overlay belirir. Overlay'e tıklama, X butonu ve ESC ile kapanır. Açıkken body scroll kilitlenir. Kapanışta da animasyon çalışır (ani kaybolma yok).
2. Panel yapısı (Release'deki gibi):
   - Üstte sağda X kapat butonu, altında büyük "Filtrele" başlığı.
   - Akordeon bölümleri, her başlıkta sağda ok ikonu (aç/kapa, yumuşak yükseklik animasyonu): Renk, Beden, Fiyat, Stok Durumu, ve varsa Kategori / İndirimli ürünler.
   - Renk: her seçenekte küçük kare renk örneği + BÜYÜK HARF, geniş harf aralıklı etiket. İlk 5 renk görünür, altında altı çizili "DAHA FAZLA GÖSTER" linki ile kalanlar açılır.
   - Beden: seçilebilir kutucuk/çipler.
   - Fiyat: min-max girişi veya çift uçlu slider (mevcut ürünlerin gerçek min/max fiyatından).
   - Stok Durumu: "Stokta" / "Stokta yok" kare checkbox'lar.
   - Renk ve beden seçenekleri, katalogdaki ürün varyantlarından dinamik üretilsin ve yanında ürün sayısı gösterilsin (isteğe bağlı, hazırsa).
   - En altta sabit (sticky) iki buton: "TEMİZLE" (beyaz, siyah çerçeveli, tam yuvarlak köşe) ve "FİLTRELERİ UYGULA" (siyah dolgu, beyaz yazı, tam yuvarlak köşe). Küçük, büyük harfli, geniş harf aralıklı metin.
3. Seçimler panel içinde geçici tutulur, "Filtreleri uygula"ya basınca URL query param'larına yazılır (paylaşılabilir/geri tuşu çalışır) ve ürün listesi güncellenir. "Temizle" hepsini sıfırlar.
4. Katalog butonunda aktif filtre sayısı küçük bir rozet olarak görünsün. Ürün listesinin üstünde seçili filtreler kaldırılabilir çipler olarak gösterilsin.
5. Filtre sonucu ürün yoksa güzel bir "sonuç bulunamadı + filtreleri temizle" boş durumu göster.

TASARIM:
- Sitenin mevcut Release-uyumlu temasını (font, renk, harf aralığı, çizgi kalınlıkları, köşe yuvarlaklıkları) birebir kullan. Yeni renk/font ekleme, mevcut CSS değişkenlerini/tailwind token'larını kullan.
- Masaüstünde panel yaklaşık 420-500px genişlik, mobilde tam genişlik. Panel içeriği kendi içinde scroll olsun, butonlar sabit kalsın.
- Animasyon: sepet çekmecesiyle aynı süre/easing. Akordeonlar ve renk listesi genişlemesi de yumuşak olsun. prefers-reduced-motion'a saygı göster.
- Erişilebilirlik: role="dialog", aria-modal, focus trap, kapanınca odak filtre butonuna dönsün, checkbox'lar klavye ile kullanılabilsin.

KURALLAR:
- Sadece bu iş için gerekenleri değiştir, alakasız refactor yapma (CLAUDE.md ve karpathy-guidelines.md'ye uy).
- Yeni bağımlılık eklemeden önce gerekçesini söyle; mümkünse mevcut yığınla çöz.
- Bittiğinde build/lint/typecheck çalıştır, masaüstü ve mobilde paneli aç-kapa, filtre uygula-temizle senaryolarını tarayıcıda dene ve hangi dosyaları değiştirdiğini özetle.
```

## Release Referansı (ekran görüntüsünden)

- Sayfa: release-main.myshopify.com/collections/tops
- Başlık "Filter by", sağ üstte ince X ikonu.
- "Color" bölümü: kare renk örnekleri (Beige, Black, Blue, Brown, Gray), büyük harf ve geniş harf aralıklı etiketler, altında altı çizili "SHOW MORE".
- "Availability" bölümü: kare boş checkbox'lar (In stock, Out of stock).
- Bölümler arası ince gri ayırıcı çizgi, başlıkların sağında yukarı/aşağı ok.
- Altta sabit iki buton: "CLEAR ALL" (beyaz, siyah çerçeve, pill) ve "APPLY FILTERS" (siyah dolgu, pill).
- Arka plan overlay ile hafif kararıyor, panel solda beyaz.

## Sonraki Adım (isteğe bağlı)

Release'deki panelin gerçek animasyon süresi ve easing değerleri tarayıcıdan ölçülüp prompta eklenebilir.
