# Ürün Detay Sayfası – İade/Değişim, Ürün Bakım Talimatı, Beden Tablosu Planı (v4)

> v3'ten farkı: "Beden Tablosu" satırının/butonunun KONUMU netleşti. Kullanıcı üç satırın (İade ve Değişim, Ürün Bakım Talimatı, Beden Tablosu) alt alta, TEK BİR BLOK halinde, ürün açıklamasının hemen altında durmasını istiyor — Beden Tablosu eski konumunda (Ürün Detayları accordion'unun yanında) kalmayacak.
>
> v2'den farkı: Kullanıcı Beden Tablosu için ürüne özel basit tablo değil, Koton'daki GENEL (çok kategorili) beden rehberini birebir istedi. Koton canlı sitesinden tüm kategori/alt tip tabloları (27 tablo) tek tek tarayıcıyla açılıp okundu, tam veri aşağıda.

## Buton/satır sırası (netleşen)

Ürün açıklamasının (descriptionHtml + "Devamını Oku") hemen altında, güven şeridinden (trust-ticker) önce, üç satır ALT ALTA tek blok halinde:

1. İade ve Değişim → InfoDrawer (sağdan çekmece) açar
2. Ürün Bakım Talimatı → InfoDrawer (sağdan çekmece) açar
3. **Beden Tablosu → SizeGuideModal (ortalanmış modal) açar — bu üçüncü satır önceki turda unutulmuş/eski yerinde (Ürün Detayları accordion'unun yanında) kalmış olabilir, Claude Code'un bunu diğer ikisinin hemen altına TAŞIMASI gerekiyor.**

Üçü de aynı görsel dilde (ok işaretli satır, aynı padding/border-t) olmalı — tıklanan şeyin türü (drawer vs modal) farklı ama satırın görünümü tutarlı olsun.

## Bu turda netleşen karar

**Beden Tablosu artık genel, çok kategorili bir rehber olacak** — Koton'daki gibi: üstte ana kategori sekmeleri (Kadın/Genç/Erkek/Kız Çocuk/Erkek Çocuk/Bebek/Büyük Beden), onun altında alt tip sekmeleri (Üst Giyim/Elbise/Mayo/İç Giyim Alt/Alt Giyim/Denim Alt/Denim Üst/İç Giyim Üst/Kemer — kategoriye göre değişen alt küme), seçilen kombinasyona göre bir ölçü tablosu. Bu artık ürünün kendi `sizeGuide` alanından bağımsız, TÜM sitede sabit/ortak bir veri seti (Koton'da da öyle — ürüne özel değil, marka geneli bir referans).

**Sunum biçimi:** Koton'da bu içerik ORTALANMIŞ BİR MODAL (drawer değil) olarak açılıyor — geniş bir tablo + yanında ölçüm nasıl yapılır görselleri içerdiği için sağdan dar bir çekmeceye sığmıyor. Bu yüzden İade ve Değişim/Ürün Bakım Talimatı'nın kullandığı `InfoDrawer` (sağdan çekmece) DEĞİL, ayrı ve ortalanmış bir `SizeGuideModal` component'i öneriliyor. "Beden Tablosu" satırına tıklayınca bu modal açılacak.

---

## TAM VERİ SETİ (Koton'dan birebir okundu, 18 Eylül 2026)

Her tablonun ilk satırı sütun başlıklarıdır. Ondalık sayılarda Türkçe virgül (`,`) kullanılıyor (Koton'da öyle, birebir korunuyor).

### KADIN

**Üst Giyim**
```
Beden | Boyun | Göğüs | Bel
XXS/32 | 31 | 78 | 60
XS/34 | 32 | 82 | 64
S/36 | 33 | 86 | 68
M/38 | 34 | 90 | 72
L/40 | 35 | 96 | 78
XL/42 | 36 | 102 | 84
2XL/44 | 37 | 108 | 90
3XL/46 | 38 | 114 | 96
4XL/48 | 39 | 120 | 102
```

**Elbise**
```
Beden | Boyun | Göğüs | Bel | Basen
XXS/32 | 31 | 78 | 60 | 86
XS/34 | 32 | 82 | 64 | 90
S/36 | 33 | 86 | 68 | 94
M/38 | 34 | 90 | 72 | 98
L/40 | 35 | 96 | 78 | 104
XL/42 | 36 | 102 | 84 | 110
2XL/44 | 37 | 108 | 90 | 116
3XL/46 | 38 | 114 | 96 | 122
4XL/48 | 39 | 120 | 102 | 128
```

**Mayo**
```
Beden | Göğüs | Bel | Basen
XXS/32 | 77-80 | 61-64 | 86-88
XS/34 | 81-84 | 65-68 | 90-93
S/36 | 85-88 | 69-72 | 94-97
M/38 | 89-92 | 73-75 | 98-101
L/40 | 93-96 | 76-80 | 102-105
XL/42 | 97-102 | 81-85 | 106-110
2XL/44 | 103-109 | 86-90 | 111-115
3XL/46 | 109-114 | 91-95 | 116-120
```

**İç Giyim Alt**
```
Beden | Bel | Basen
XXS/32 | 61-64 | 86-88
XS/34 | 65-68 | 90-93
S/36 | 69-72 | 94-97
M/38 | 73-75 | 98-101
L/40 | 76-80 | 102-105
XL/42 | 81-85 | 106-110
2XL/44 | 86-90 | 111-115
3XL/46 | 91-95 | 116-120
4XL/48 | 96-100 | 121-125
```

**Alt Giyim**
```
Beden | Bel | Basen | İç Boy
XXS/32 | 60 | 86 | 75
XS/34 | 64 | 90 | 75
S/36 | 68 | 94 | 75
M/38 | 72 | 98 | 75
L/40 | 78 | 104 | 75
XL/42 | 84 | 110 | 75
2XL/44 | 90 | 116 | 75
3XL/46 | 96 | 122 | 75
4XL/48 | 102 | 128 | 75
```

**Denim Alt**
```
Beden | Bel | Basen | Bacak Boy 30 | Bacak Boy 32 | Bacak Boy 34
25 | 60 | 87 | 76 | 81 | 86
26 | 64 | 91 | 76 | 81 | 86
27 | 68 | 95 | 76 | 81 | 86
28 | 72 | 99 | 76 | 81 | 86
29 | 76 | 103 | 76 | 81 | 86
30 | 82 | 107 | 76 | 81 | 86
31 | 88 | 113 | 76 | 81 | 86
32 | 94 | 119 | 76 | 81 | 86
33 | 100 | 125 | 76 | 81 | 86
```

**Denim Üst**
```
Beden | Boyun | Göğüs | Bel | Basen
XXS/32 | 31 | 78 | 58 | 86
XS/34 | 32 | 82 | 62 | 90
S/36 | 33 | 86 | 66 | 94
M/38 | 34 | 90 | 70 | 98
L/40 | 35 | 94 | 74 | 102
XL/42 | 36 | 100 | 78 | 108
XXL/44 | 37 | 106 | 84 | 114
3XL/46 | 38 | 112 | 90 | 120
4XL/48 | 39 | 118 | 96 | 126
```

**İç Giyim Üst**
```
Beden | A | B | C | D | DD
70 | 81-83 | 83-85 | 85-87 | 87-89 | 89-92
75 | 86-88 | 88-90 | 90-92 | 92-94 | 94-96
80 | 91-93 | 93-95 | 95-97 | 97-99 | 99-101
85 | 96-98 | 98-100 | 100-102 | 102-104 | 104-106
90 | 101-103 | 103-105 | 105-107 | 107-109 | 109-111
95 | 106-108 | 108-110 | 110-112 | 112-114 | 114-116
100 | 111-113 | 113-115 | 115-117 | 117-119 | 119-121
105 | 116-118 | 118-120 | 120-122 | 122-124 | 124-126
110 | 121-123 | 123-125 | 125-127 | 127-129 | 129-131
```

**Kemer**
```
Beden | Bel
S/36 | 80
M/38 | 85
L/40 | 90
```

### GENÇ

**Üst Giyim** — Kadın Üst Giyim ile birebir aynı veri.

**Alt Giyim** — Kadın Alt Giyim ile birebir aynı veri (Beden/Bel/Basen/İç Boy).

**Elbise** — Kadın Elbise ile birebir aynı veri.

**Denim Üst**
```
Beden | Boyun | Göğüs | Bel | Basen
XXS/32 | 31 | 78 | 60 | 86
XS/34 | 32 | 82 | 64 | 90
S/36 | 33 | 86 | 68 | 94
M/38 | 34 | 90 | 72 | 98
L/40 | 35 | 94 | 76 | 102
XL/42 | 36 | 100 | 82 | 108
XXL/44 | 37 | 106 | 88 | 114
3XL/46 | 38 | 112 | 94 | 120
4XL/48 | 39 | 118 | 100 | 126
```

### ERKEK

**Üst Giyim**
```
Beden | Boyun | Göğüs | Bel
XXS/44 | 34,5 | 88 | 73
XS/46 | 36 | 92 | 77
S/48 | 37,5 | 96 | 81
M/50 | 39 | 100 | 85
L/52 | 40,5 | 104 | 89
XL/54 | 42 | 108 | 93
2XL/56 | 43,5 | 112 | 97
3XL/58 | 45 | 116 | 101
4XL/60 | 46,5 | 120 | 105
```

**Alt Giyim**
```
Beden | Bel | Basen | İç Boy
XXS/36 | 73 | 90 | 80
XS/38 | 77 | 94 | 80
S/40 | 81 | 98 | 80
M/42 | 85 | 102 | 80
L/44 | 89 | 106 | 80
XL/46 | 93 | 110 | 80
2XL/48 | 97 | 114 | 80
3XL/50 | 101 | 118 | 80
4XL/52 | 105 | 122 | 80
```

**Denim Alt**
```
Beden | Bel | Basen | Bacak Boy 30 | Bacak Boy 32 | Bacak Boy 34
29 | 79 | 96 | 76 | 81 | 86
30 | 81 | 98 | 76 | 81 | 86
31 | 83 | 100 | 76 | 81 | 86
32 | 85 | 102 | 76 | 81 | 86
33 | 87 | 104 | 76 | 81 | 86
34 | 89 | 106 | 76 | 81 | 86
36 | 93 | 110 | 76 | 81 | 86
38 | 97 | 114 | 76 | 81 | 86
40 | 101 | 118 | 76 | 81 | 86
```

**Denim Üst**
```
Beden | Boyun | Göğüs | Bel
XXS/44 | 34,5 | 88 | 70
XS/46 | 36 | 92 | 74
S/48 | 37,5 | 96 | 78
M/50 | 39 | 100 | 82
L/52 | 40,5 | 104 | 86
XL/54 | 43,5 | 108 | 90
2XL/56 | 45-46 | 112 | 94
3XL/58 | 45 | 116 | 98
4XL/60 | 46,5 | 120 | 102
```

**Kemer**
```
Beden | Bel
S/36 | 95
M/38 | 100
L/40 | 105
```

### KIZ ÇOCUK

**Üst Giyim**
```
Beden | Boyun | Göğüs | Bel
6-7 Y (116-122 cm) | 28 | 63-65 | 58-60
7-8 Y (122-128 cm) | 29 | 65-67 | 60-62
9-10 Y (134-140 cm) | 31 | 69-72 | 64-67
11-12 Y (146-152 cm) | 33 | 75-78 | 70-73
13-14 Y (158-164 cm) | 35 | 81-84 | 76-79
```

**Alt Giyim**
```
Beden | Bel | Basen | İç Boy
6-7 Y (116-122 cm) | 58-60 | 66-68 | 54
7-8 Y (122-128 cm) | 60-62 | 68-70 | 57
9-10 Y (134-140 cm) | 64-67 | 72-75 | 62
11-12 Y (146-152 cm) | 70-73 | 78-81 | 69
13-14 Y (158-164 cm) | 76-79 | 84-87 | 76
```

### ERKEK ÇOCUK

**Üst Giyim** — Kız Çocuk Üst Giyim ile birebir aynı veri.

**Alt Giyim** — Kız Çocuk Alt Giyim ile birebir aynı veri.

### BEBEK

**Üst/Alt Giyim (tek tablo)**
```
Beden | Boyun | Göğüs | Bel | Basen | İç Bacak
9-12 Ay (74-80 cm) | 24 | 49-51 | 49-50 | 52-54 | 31
12-18 Ay (80-86 cm) | 24,5 | 51-53 | 50-51 | 54-56 | 34,5
18-24 Ay (86-92 cm) | 25 | 53-55 | 51-52 | 56-58 | 38
24-36 Ay (92-98 cm) | 25,5 | 55-57 | 52-53 | 58-60 | 41,5
3-4 Y (98-104 cm) | 26 | 57-59 | 53-54 | 60-62 | 45
4-5 Y (104-110 cm) | 26,5 | 59-61 | 54-56 | 62-64 | 49
5-6 Y (104-110 cm) | 27 | 61-63 | 56-58 | 64-66 | 51
```

### BÜYÜK BEDEN

**Kadın Üst Giyim**
```
Beden | Boyun | Göğüs | Bel
L/40 | 35 | 96 | 78
XL/42 | 36 | 102 | 84
2XL/44 | 37 | 108 | 90
3XL/46 | 38 | 114 | 96
4XL/48 | 39 | 120 | 102
```

**Kadın Alt Giyim**
```
Beden | Bel | Basen | İç Boy
L/40 | 78 | 104 | 75
XL/42 | 84 | 110 | 75
2XL/44 | 90 | 116 | 75
3XL/46 | 96 | 122 | 75
4XL/48 | 102 | 128 | 75
```

**Erkek Üst Giyim**
```
Beden | Boyun | Göğüs | Bel
L/52 | 40,5 | 104 | 89
XL/54 | 42 | 108 | 93
2XL/56 | 43,5 | 112 | 97
3XL/58 | 45 | 116 | 101
4XL/60 | 46,5 | 120 | 105
```

**Erkek Alt Giyim**
```
Beden | Bel | Basen | İç Boy
L/44 | 89 | 106 | 80
XL/46 | 93 | 110 | 80
2XL/48 | 97 | 114 | 80
3XL/50 | 101 | 118 | 80
4XL/52 | 105 | 122 | 80
```

---

## "Bedeninizi nasıl ölçmelisiniz?" ölçüm rehberi metinleri (Koton'da tablonun yanında görsellerle gösteriliyor)

```
Göğüs: Göğsünüzün en geniş kısımından tüm göğsü çevreleyin.
Göğüs Altı: Göğüs çevrenizi tam göğsünüzün altından ölçün.
Bel: Mezurayı belinizin en ince kısmına yerleştirerek ölçün.
Basen: Kalçanızın en geniş kısmından ölçüm yapın.
```

(Koton'da bu 4 tanım görsellerle birlikte gösteriliyor; Boyun/İç Boy/Bacak Boy/İç Bacak için ayrıca görsel yok, sadece tablo başlığı olarak geçiyor — bunları aynen böyle bırak, ekstra açıklama uydurma.)

Ayrıca her tablonun altında sabit bir uyarı notu var, bunu da ekle:
```
Kumaştan dolayı ölçülerde ±2 cm sapma olabilir. Standart bedenler, mağazamızın beden ölçülerini yansıtır, ürünün tam boyutlarını değildir.
```
(Koton metninde "Koton mağazasının" geçiyor, Bollmark için "mağazamızın" olarak uyarlandı.)

---

## Claude Code için GÜNCELLENMİŞ prompt (v3 — Beden Tablosu artık genel modal)

```
Önceki turlarda İade ve Değişim + Ürün Bakım Talimatı için InfoDrawer (sağdan çekmece) component'i ve içerikleri zaten kuruldu/güncellendi (dokunma). Şimdi SADECE Beden Tablosu'nu tamamla:

1) "Beden Tablosu" artık ürün bazlı sizeGuide accordion'u DEĞİL, Koton'daki gibi GENEL, çok kategorili bir referans tablosu. src/components/size-guide-modal.tsx adında yeni bir component oluştur: ortalanmış bir modal (overlay + kutu, ESC ve overlay tıklayınca kapanır, body scroll lock — cart-drawer.tsx'teki body.style.overflow="hidden" mantığını buradan da kopyalayabilirsin ama ANİMASYON PATTERN'İ FARKLI: bu sağdan kayan bir çekmece değil, ortada beliren/fade+scale ile açılan klasik bir modal olsun, örn. opacity 0→1 + scale-95→100, duration 200-300ms yeterli, cart-drawer'ın 450ms translate-x'ini kopyalama).

2) Modal içinde iki seviyeli sekme (tab) yapısı:
   - Üst seviye (ana kategori): Kadın, Genç, Erkek, Kız Çocuk, Erkek Çocuk, Bebek, Büyük Beden
   - Alt seviye (alt tip): seçili ana kategoriye göre değişir, kategoriler şunlar (hangi ana kategoride hangi alt tipler var, aşağıdaki veri objesinin anahtarlarına bak):
     Kadın: Üst Giyim, Elbise, Mayo, İç Giyim Alt, Alt Giyim, Denim Alt, Denim Üst, İç Giyim Üst, Kemer
     Genç: Üst Giyim, Alt Giyim, Elbise, Denim Üst
     Erkek: Üst Giyim, Alt Giyim, Denim Alt, Denim Üst, Kemer
     Kız Çocuk: Üst Giyim, Alt Giyim
     Erkek Çocuk: Üst Giyim, Alt Giyim
     Bebek: (alt tip yok, tek tablo direkt gösterilir)
     Büyük Beden: Kadın Üst Giyim, Kadın Alt Giyim, Erkek Üst Giyim, Erkek Alt Giyim (bunlar aslında bu ana kategorinin KENDİ alt tipleri gibi davran — 4 sekme)
   Ana kategori değişince alt tip sekmesi otomatik ilk seçeneğe dönsün.

3) Seçili kombinasyona göre bir <table> göster (ilk satır <thead>, kalanı <tbody>, mevcut sitenin border-line/text-ink Tailwind diliyle basit ve okunabilir bir stil — cart-drawer'daki gibi cream/ink renk paletine sadık kal). Tablonun altına şu sabit notu ekle:

"Kumaştan dolayı ölçülerde ±2 cm sapma olabilir. Standart bedenler, mağazamızın beden ölçülerini yansıtır, ürünün tam boyutlarını değildir."

Tablonun yanında (masaüstünde yan yana, mobilde alt alta) küçük bir "Bedeninizi nasıl ölçmelisiniz?" kutusu — 4 madde, görsele gerek yok, sadece başlık + açıklama yeterli:
- Göğüs: Göğsünüzün en geniş kısımından tüm göğsü çevreleyin.
- Göğüs Altı: Göğüs çevrenizi tam göğsünüzün altından ölçün.
- Bel: Mezurayı belinizin en ince kısmına yerleştirerek ölçün.
- Basen: Kalçanızın en geniş kısmından ölçüm yapın.

4) VERİ: Bu dosyanın (URUN_DETAY_IADE_BAKIM_BEDEN_TABLOSU_PLANI.md) "TAM VERİ SETİ" bölümündeki TÜM tabloları birebir, satır satır bir TypeScript veri objesine gir (src/lib/size-guide-data.ts gibi ayrı bir dosyaya koyabilirsin, örn. `export const SIZE_GUIDE: Record<string, Record<string, { headers: string[]; rows: string[][] }>>`). "X ile birebir aynı veri" yazan yerlerde (örn. Genç Üst Giyim = Kadın Üst Giyim) gerçekten aynı objeyi referans göster, kopyala-yapıştırma. Ondalık virgülleri ("34,5" gibi) OLDUĞU GİBİ bırak, noktaya çevirme.

5) product-viewer.tsx'te "Beden Tablosu" satırı artık bu modalı açsın (ok işaretli satır aynı kalsın, sadece tıklama davranışı InfoDrawer yerine bu yeni modalı açacak şekilde değişsin). Ürünün kendi `sizeGuide` prop'una (varsa) DOKUNMA — onunla ilgili önceki "pipe ile tablo" işini YAPMA, o plan artık geçersiz, bu genel modal onun yerini alıyor. `sizeGuide` prop'u ve accordion'u siteden tamamen kaldırılsın (artık kullanılmıyor) — descriptionHtml/careInstructions gibi diğer prop'lara dokunma.

6) Değişiklikleri yaptıktan sonra npm run build ile derlemenin geçtiğini doğrula, birkaç farklı kategori/alt tip kombinasyonunu (örn. Kadın Denim Alt, Erkek Kemer, Bebek) tarayıcıda açıp tabloların doğru göründüğünü kontrol et, DEPLOY_STATUS.md'ye not düş (bu turda Beden Tablosu'nun ürün bazlı basit tablodan Koton tarzı genel çok kategorili rehbere dönüştürüldüğünü yaz).
```
