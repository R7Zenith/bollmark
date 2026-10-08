# Ürün Detay Sayfası — Galeri Fotoğrafları Geniş Ekranda Neden Küçük Kalıyor

## Önceki analiz neden yanılttı

Bir önceki oturumda galeri/bilgi paneli oranını sadece **1600px'te** ölçmüştüm
(895px galeri / 586px bilgi paneli, Bollmark'ta 888/592 — neredeyse eşit).
Kullanıcı "hâlâ eşitlenmedi, Release'in fotoğrafları daha geniş yer
kaplıyor" dedi — haklıydı. Sorun sadece **geniş ekranlarda** (1800px+)
ortaya çıkıyor, 1600px'te tesadüfen neredeyse örtüşüyorlardı.

**Önemli teknik not:** Release'in galerisi CSS `fr` ile değil, sayfa
yüklenirken JS ile hesaplanan px değerleriyle çalışıyor (Shopify temasının
kendi grid/swiper mantığı) — tarayıcı penceresini sadece yeniden
boyutlandırmak (resize) bu değerleri güncellemiyor, **sayfanın o
genişlikte yeniden yüklenmesi (reload) gerekiyor**. İlk denemede resize
yapıp eski/bayat değerleri okumuştum, bu da yanlış sonuca götürmüştü. Bu
kez her genişlikte sayfa yeniden yüklenerek ölçüldü.

## Gerçek ölçüm (her genişlikte sayfa yeniden yüklenerek)

| Viewport | Release — galeri | Release — bilgi paneli | Bollmark — galeri | Bollmark — bilgi paneli |
|---|---|---|---|---|
| 1600px | 895px | 586px | 888px | 592px |
| 1920px | **1211px** | **590px** | **1081px** | **720px** |

**Örüntü net:** Release'in bilgi paneli (sağdaki metin sütunu) ~586-590px
civarında **neredeyse sabit kalıyor**, ekran genişledikçe büyümüyor —
ekstra genişliğin tamamı galeriye gidiyor. Bollmark'ın bölünmesi ise
`md:grid-cols-[60fr_40fr]` (yüzdesel) olduğu için **her iki taraf da
orantılı büyüyor** — bilgi paneli 1920px'te 720px'e kadar şişiyor,
bu da galerinin görece daralmasına (1081px, Release'den %11 dar) yol
açıyor.

1600px'te iki site tesadüfen birbirine yakın çıktığı için önceki
ölçümde sorun görünmüyordu; 1920px gibi geniş bir ekranda (muhtemelen
kullanıcının kendi ekranı) fark gözle görülür hale geliyor.

## Çözüm

`product-viewer.tsx` satır 291'deki:

```
<div className="grid gap-x-8 gap-y-12 md:grid-cols-[60fr_40fr]">
```

satırını, bilgi panelini **320px ile 590px arasında sınırlayan, galeriyi
esnek bırakan** bir yapıya çevir:

```
<div className="grid gap-x-8 gap-y-12 md:grid-cols-[1fr_minmax(320px,590px)]">
```

Böylece:
- Dar masaüstü genişliklerde (ör. 1024-1280px) bilgi paneli gerektiği
  kadar küçülüp galeriye yer açar (320px altına inmez, metin
  sıkışmaz).
- Geniş ekranlarda (1600px ve üstü) bilgi paneli 590px'te sabitlenir,
  **ekstra genişliğin tamamı galeriye gider** — Release'in gerçek
  davranışıyla birebir.

## Claude Code'a verilecek prompt

```
Ürün detay sayfasında (src/components/product-viewer.tsx, satır 291)
galeri/bilgi paneli bölünmesi şu an `md:grid-cols-[60fr_40fr]` - yani
yüzdesel, ekran genişledikçe HER İKİ taraf da orantılı büyüyor. Ama
release-main.myshopify.com/products/top-8'de gerçek davranış farklı:
tarayıcıda her genişlikte SAYFA YENİDEN YÜKLENEREK ölçüldü (resize
yetmiyor, bu tema grid genişliklerini JS ile sayfa yüklenirken
hesaplıyor) - Release'in bilgi/metin paneli ~586-590px civarında
neredeyse SABİT kalıyor (1600px'te 586px, 1920px'te 590px), ekstra
genişliğin TAMAMI galeriye gidiyor (1600px'te 895px, 1920px'te 1211px).
Bollmark'ta ise yüzdesel bölünme yüzünden 1920px'te bilgi paneli 720px'e
şişiyor, galeri de görece daralıyor (1081px, Release'den %11 dar) - bu
yüzden geniş ekranlarda Bollmark'ın ürün fotoğrafları Release'e göre
belirgin şekilde küçük kalıyor.

`grid gap-x-8 gap-y-12 md:grid-cols-[60fr_40fr]` satırını şuna çevir:

`grid gap-x-8 gap-y-12 md:grid-cols-[1fr_minmax(320px,590px)]`

Bu, bilgi panelini 320px (alt sınır, dar ekranlarda metin sıkışmasın) ile
590px (üst sınır, Release'in ölçülen sabit genişliği) arasında tutar,
galeri sütunu (`1fr`) kalan TÜM alanı alır - ekran genişledikçe sadece
galeri büyür.

Sonra:
1. npx tsc --noEmit ve npm run build hatasız geçmeli.
2. Yerel dev sunucuda ürün detay sayfasını 1280px, 1600px VE 1920px'te
   (üçünde de tarayıcıyı o genişlikte YENİDEN YÜKLEYEREK, sadece resize
   etmeyerek) aç, galeri/bilgi paneli genişliklerini getBoundingClientRect
   ile ölç:
   - 1600px'te bilgi paneli ~586-590px, galeri ~895px civarında olmalı.
   - 1920px'te bilgi paneli hâlâ ~590px'te sabit kalmalı (BÜYÜMEMELİ),
     galeri ~1211px civarına çıkmalı.
3. 1024px ve 390px'te de yatay taşma olmadığını, bilgi panelinin çok
   sıkışmadığını (320px altına inmediğini) kontrol et.

DEPLOY_STATUS.md'ye bu düzeltmeyi, ölçüm tablosunu ve önceki analizin
neden yanıldığını (sadece 1600px'te ölçülmüştü, tek genişlik yeterli
değildi) not düş. Commit'i öner ama onayım olmadan push etme.
```
