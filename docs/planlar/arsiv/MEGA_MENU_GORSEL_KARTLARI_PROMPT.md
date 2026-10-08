# Claude Code Prompt: Mega menüye kategori görsel kartları

Görev: Header mega menüsünde (hover ile açılan tam genişlik panel), Kadın ve Erkek sekmeleri için sağ tarafa 2'şer adet promosyon görsel kartı ekle. Referans: Release temasındaki mega menü (solda metin sütunları, sağda 2 portre görsel kartı, üzerinde kısa yazı).

Önce mevcut mega menü bileşenini bul ve nasıl çalıştığını oku (menü verisi nereden geliyor, hangi sekmeler var). Sadece bu iş için gereken değişikliği yap, başka bileşenlere dokunma.

## Tasarım (Release ölçümlerine göre)

- Panel masaüstünde 3 bölgeli: sol metin sütunları, sağda 2 kart yan yana. Kartlar panelin sağına hizalı, aralarında ~20px boşluk, panelin sağ kenarında sayfa kenar boşluğu kadar (~36px) pay.
- Her kart portre, aspect-ratio 3/4, yaklaşık 475px genişlik (esnek olsun, flex/grid ile ölçeklensin), object-fit: cover, object-position: center top (fotoğraflarda yüz üstte, kırpılmasın), border-radius yok.
- Kartın ortasında iki satır yazı, beyaz: üstte küçük etiket (11-12px, uppercase, hafif letter-spacing), altında başlık (~28px, font-weight 500). Okunabilirlik için görsel üzerine hafif koyu overlay (rgba(0,0,0,0.2) civarı), gradient kullanma. Yazı bütün 4 fotoğrafta okunabilir olmalı; özellikle kadın bluz fotoğrafında desen yoğun, gerekirse overlay'i o kart için biraz artır.
- Kartın tamamı tıklanabilir (Link), href ilgili kategori sayfasına gitsin.
- Mega menü açılışı animasyonsuz kalsın (mevcut davranışı bozma). Kartlara ekstra hover efekti ekleme.
- Mobilde bu kartlar gösterilmesin (mobil menü aynı kalsın).

## Veri yapısı

Kart içeriğini bileşenin içine gömme, tek bir yapılandırma nesnesinde tut:

```
kadin: [
  { image: "/menu/kadin-elbise.webp", label: "YENİ SEZON", title: "Elbise", href: "/kategori/kadin-elbise" },
  { image: "/menu/kadin-bluz.webp", label: "ÇOK SATANLAR", title: "Bluz", href: "/kategori/kadin-bluz" }
],
erkek: [
  { image: "/menu/erkek-gomlek.webp", label: "YENİ SEZON", title: "Gömlek", href: "/kategori/erkek-gomlek" },
  { image: "/menu/erkek-ceket.webp", label: "ÇOK SATANLAR", title: "Ceket", href: "/kategori/erkek-ceket" }
]
```

- href değerlerini sitedeki gerçek kategori URL'lerine göre düzelt.
- Yapılandırmada kartı olmayan bir sekmede sağ panel hiç render edilmesin, sol sütunlar mevcut haliyle kalsın.

## Görseller

Görseller zaten `public/menu/` klasörüne şu adlarla yerleştirildi (WebP, 2250x2954 portre, 3/4'e yakın oran):

| Dosya | İçerik |
|---|---|
| kadin-elbise.webp | Siyah kolsuz mini elbise, ahşap panel önünde, mavi halı |
| kadin-bluz.webp | Bordo tığ işi/dantel bluz, turuncu koltukta uzanan model |
| erkek-gomlek.webp | Kareli gömlek, şapkalı model, koyu ahşap kapı önünde |
| erkek-ceket.webp | Siyah deri ceket, ahşap panele yaslanmış model |

- Önce `public/menu/` klasörünü listele ve 4 dosyanın da orada olduğunu doğrula. Eksik varsa DUR, hangisinin eksik olduğunu bana söyle, geçici placeholder ile ilerleme.
- Dosya boyutları 0.4MB ile 1.5MB arası (kadin-bluz.webp en büyüğü). next/image kullanılıyorsa otomatik optimize edilir, ayrıca sıkıştırma gerekmez. Ham <img> kullanılıyorsa kartın ihtiyacına göre (~1000px genişlik) küçültülmüş kopyalar üret ve orijinallere dokunma.
- next/image kullanılıyorsa `sizes` ve anlamlı `alt` ekle (örn. "Kadın elbise koleksiyonu").

## Bitirince

1. Hangi dosyaları değiştirdiğini/eklediğini söyle.
2. Kadın ve Erkek sekmelerinde masaüstü genişliğinde (1440px ve 1920px) tarayıcıda kontrol et; yazının görselin üzerinde 4 kartta da okunabildiğini doğrula.
3. Kartı olmayan bir sekmede menünün bozulmadığını doğrula.
4. Mobil görünümde kartların gösterilmediğini doğrula.
