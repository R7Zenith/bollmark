# Ürün Detay Sayfası – İade/Değişim, Ürün Bakım Talimatı, Beden Tablosu Planı

> Kaynak istek: Koton ürün detay sayfası referans alınarak (`https://www.koton.com/rahat-kalip-dugmeli-mini-denim-sort-etek-dark-indigo-4197527/`), Bollmark ürün detay sayfasına İade ve Değişim + Ürün Bakım Talimatı bölümleri eklenecek (sepetteki gibi sağdan animasyonlu çekmece ile), Beden Tablosu içeriği de bu linktekine benzer biçimde (gerçek ölçü tablosu görünümünde) gösterilecek. Kodlama tamamen Claude Code ile yapılacak, bu dosya + aşağıdaki prompt ona verilecek.

## Kullanıcıyla netleşen kararlar

1. **Beden Tablosu UI:** Accordion olarak kalacak (İade/Değişim ve Bakım Talimatı gibi çekmeceye çevrilmeyecek). Sadece içerik gerçek bir tabloya benzer şekilde gösterilecek.
2. **Beden Tablosu verisi:** Şema değişikliği yapılmayacak. Mevcut `sizeGuide` serbest metin alanı korunacak; admin bu alana pipe (`|`) ile ayrılmış satırlar girerse site tarafında gerçek bir `<table>` olarak render edilecek (girmezse mevcut davranış — düz paragraf — korunur, geriye dönük uyumlu).

## Mevcut kod tabanı analizi (araştırma sonucu)

- Ürün detay UI'ı: `src/components/product-viewer.tsx` (client component). Şu an iki `<details>` accordion var: "Ürün Detayları" (materyal/menşei/bakım — ürün bazlı `careInstructions` alanını da burada satır olarak basıyor) ve "Beden Tablosu" (`sizeGuide` alanını `whitespace-pre-line` ile düz metin gösteriyor).
- Sayfa: `src/app/(site)/urunler/[slug]/page.tsx` bu prop'ları `ProductViewer`'a geçiyor (`careInstructions`, `sizeGuide` zaten Prisma'dan geliyor — DB şeması hazır, yeni alan gerekmiyor).
- Çekmece animasyon deseni: `src/components/cart-drawer.tsx`. Bu component'te kullanılan desen (mount → shouldRender → visible üç aşamalı state + `createPortal(document.body)` + `transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)]` + `translate-x-full` ↔ `translate-x-0`) İade/Değişim ve Bakım Talimatı çekmeceleri için **birebir aynı** kullanılmalı — kullanıcı zaten "sepette yaptığımız gibi" dedi, görsel tutarlılık için farklı bir animasyon yazılmamalı.
- **Önemli bulgu:** Koton'un İade & Değişim metnini olduğu gibi kopyalamak yanlış olur — hem başka bir markanın (rakip) metni hem de Bollmark'ın gerçek politikasıyla örtüşmüyor (Koton'da "tüm Türkiye mağazalarından iade", "Koton Firma İadesi" kargo etiketi gibi Bollmark'ta karşılığı olmayan ifadeler var). Projede zaten gerçek, doğrulanmış Bollmark iade politikası var: proje klasöründeki `HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md` → "Teslimat ve İade Şartları" bölümü (14 gün cayma hakkı, iade kargo ücreti alıcıya ait, iade adresi Karacabey/Bursa, iç giyim/mayo istisnası, bilgi@bollmark.com). Çekmecede bu gerçek politika özetlenecek, Koton'un kendi ifadeleri değil.
- Ürün Bakım Talimatı için Bollmark'a özgü sabit bir metin yok; Koton'un metnini birebir kopyalamak (hem özgünlük hem de "başka markanın metni" sorunu nedeniyle) önerilmiyor. Bunun yerine: (a) genel, markadan bağımsız orijinal bir bakım rehberi metni + (b) ürünün kendi `careInstructions` alanı doluysa üstte ayrıca gösterilecek.

## Yapılacaklar (Claude Code'a verilecek)

1. `cart-drawer.tsx`'teki mount/shouldRender/visible + portal deseni genel bir `InfoDrawer` component'ine çıkarılacak (`src/components/info-drawer.tsx`), başlık + içerik + açık/kapalı state prop olarak alınacak. Sepet çekmecesine dokunulmayacak (o kendi state'ini `useCart`'tan alıyor, bu farklı, basit local `useState` yeterli).
2. `product-viewer.tsx`'te "Ürün Detayları" ve "Beden Tablosu" accordion'larının altına, Koton'daki gibi ok işaretli (chevron) iki yeni satır eklenecek: "İade ve Değişim" ve "Ürün Bakım Talimatı". Tıklanınca `InfoDrawer` açılacak.
3. Beden Tablosu accordion'u içeriği: `sizeGuide` metninde `|` karakteri varsa satırları parse edip `<table>` olarak, yoksa mevcut düz metin olarak gösterecek küçük bir yardımcı fonksiyon (`lib/format.ts` veya `product-viewer.tsx` içinde lokal).
4. Admin ürün formuna (muhtemelen `src/app/(admin)/admin/urunler/[id]/page.tsx` / `.../yeni/page.tsx`) Beden Tablosu alanının yanına kısa bir yardım metni eklenecek: "Tablo olarak göstermek için satırları `Beden | Boy | Bel | Kalça` gibi `|` ile ayırın."
5. `DEPLOY_STATUS.md`'ye her zamanki gibi not düşülecek.

---

## Claude Code için hazır prompt

```
Bollmark e-ticaret sitesinde ürün detay sayfasına (src/components/product-viewer.tsx) üç şey ekleyeceğiz. Referans: Koton'un ürün sayfasındaki (https://www.koton.com/rahat-kalip-dugmeli-mini-denim-sort-etek-dark-indigo-4197527/) "İade ve Değişim", "Ürün Bakım Talimatı", "Beden Tablosu" bölümleri — ama metin içerikleri Bollmark'a özel olacak, Koton'un metni kopyalanmayacak.

1) Genel bir InfoDrawer component'i oluştur (src/components/info-drawer.tsx), src/components/cart-drawer.tsx'teki animasyon deseninin AYNISINI kullan: mounted/shouldRender/visible üç aşamalı state, useEffect'lerle 450ms'lik timeout, createPortal(document.body), overlay (bg-black/50, tıklayınca kapanır), sağdan açılan panel (`translate-x-full` ↔ `translate-x-0`, `transition-[transform,visibility] duration-[450ms] ease-[cubic-bezier(0.74,-0.01,0.26,1)]`, `bg-cream`), üstte başlık + X kapat butonu (lucide X, size 20). cart-drawer.tsx'i DEĞİŞTİRME, sadece aynı deseni yeni component'te tekrar kullan. Props: `open: boolean`, `onClose: () => void`, `title: string`, `children: React.ReactNode`. Panel genişliği cart-drawer kadar geniş olmasın, içerik metin ağırlıklı olduğu için w-[28rem] max-w-full yeterli, içerik `overflow-y-auto` scroll edebilir olsun, padding px-6 py-6.

2) product-viewer.tsx'e iki yeni state ekle: `const [iadeDrawerOpen, setIadeDrawerOpen] = useState(false)` ve `const [bakimDrawerOpen, setBakimDrawerOpen] = useState(false)`.

3) Mevcut "Ürün Detayları" ve "Beden Tablosu" `<details>` bloklarının hemen altına (aynı `md:sticky` bilgi panelinin içinde, "Beden Tablosu" accordion'undan sonra, "Renk/Beden" seçim bloğundan önce), Koton'daki gibi ok işaretli (ChevronRight, lucide-react) iki satır ekle:

<button type="button" onClick={() => setIadeDrawerOpen(true)} className="flex w-full items-center justify-between border-t border-line py-4 text-[16px] tracking-[-0.64px] text-ink">
  İade ve Değişim
  <ChevronRight size={18} className="text-ink/40" />
</button>
<button ... onClick={() => setBakimDrawerOpen(true)}>
  Ürün Bakım Talimatı
  <ChevronRight ... />
</button>

(gerçek class isimlerini sayfanın mevcut Tailwind diliyle - border-line, text-ink, tracking değerleri - tutarlı tut, yukarıdaki taslak)

4) İki InfoDrawer'ı component'in return'ünün sonuna (Lightbox'tan sonra, aynı Fragment içinde) ekle:

<InfoDrawer open={iadeDrawerOpen} onClose={() => setIadeDrawerOpen(false)} title="İade & Değişim">
  ...içerik (aşağıda)...
</InfoDrawer>
<InfoDrawer open={bakimDrawerOpen} onClose={() => setBakimDrawerOpen(false)} title="Ürün Bakım Talimatı">
  ...içerik (aşağıda)...
</InfoDrawer>

İADE & DEĞİŞİM içeriği (Bollmark'ın GERÇEK politikası, HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md'deki "Teslimat ve İade Şartları" bölümünden özetlenmiştir — Koton metni değil):

- Başlık altı kısa paragraf: "Bollmark üzerinden yaptığınız alışverişlerde, ürünü teslim aldığınız tarihten itibaren 14 gün içinde hiçbir gerekçe göstermeksizin cayma hakkınızı kullanabilir, ürünü iade edebilirsiniz."
- "İadesi Mümkün Olmayan Ürünler" alt başlığı: "İç giyim, mayo ve bikini gibi hijyen açısından hassas ürünler; ambalajı/etiketi açılmış veya kullanılmışsa iade kapsamı dışındadır."
- "İade Adımları" alt başlığı, numaralı liste: (1) bilgi@bollmark.com adresine sipariş numaranızla iade talebinizi iletin, (2) ürünü faturası, orijinal kutusu/ambalajı ve etiketleriyle birlikte, kullanılmamış ve hasarsız şekilde paketleyin, (3) belirtilen adrese gönderin, (4) iade kargo ücreti alıcıya aittir, (5) ürün elimize ulaşıp kontrolü tamamlandıktan sonra bedeli en geç 14 gün içinde ödeme yaptığınız yönteme iade edilir.
- En altta küçük bir satır + link: "Detaylı bilgi için Teslimat ve İade Şartları sayfamızı inceleyebilirsiniz." — /teslimat-ve-iade route'u zaten varsa (yasal sayfalar planı uygulanmışsa) ona Link ile bağla, yoksa şimdilik düz metin bırak, sonradan linklenir.

ÜRÜN BAKIM TALİMATI içeriği (orijinal, markadan bağımsız genel rehber — Koton metni kopyalanmayacak):

- Eğer bu ürünün kendi `careInstructions` alanı doluysa (component zaten prop olarak alıyor), drawer'ın EN ÜSTÜNDE "Bu ürün için" alt başlığıyla o metni göster.
- Altında genel bir "Genel Bakım Önerileri" bölümü, kısa maddeler halinde (5-6 madde, her biri 1-2 cümle), örnek içerik:
  1. Ürünün etiketindeki yıkama ve bakım sembollerini satın almadan önce ve her kullanımdan sonra kontrol edin.
  2. Farklı ürün ve kumaşlar için farklı bakım yöntemleri gerekebilir; etikette belirtilen talimatlara sadık kalın.
  3. Yüksek dereceli yıkama ve sık kuru temizleme yerine, mümkün olduğunda daha düşük sıcaklıkta ve nazik yıkama tercih edin.
  4. Deterjanı ölçü kabıyla, önerilen miktarda kullanın; fazla deterjan hem ürüne hem çevreye zarar verir.
  5. Koyu ve açık renkli ürünleri ayrı yıkayın, renk akmasını önlemek için ilk birkaç yıkamada dikkatli olun.
  6. Ayakkabı ve çanta gibi ürünleri doğrudan güneş ışığından ve nemden uzak, kuru bir ortamda saklayın.
(Bu maddeleri istersen daha da kısalt/uyarla, önemli olan Koton'un cümlelerinin birebir kopyalanmaması.)

5) Beden Tablosu accordion'unun içeriğini güncelle: şu an `<p className="mt-3 whitespace-pre-line ...">{sizeGuide}</p>` var. Bunu şöyle değiştir: sizeGuide metninde herhangi bir satırda "|" karakteri geçiyorsa, metni satırlara böl, her satırı "|" ile parse edip bir `<table>` (ilk satır `<thead>`, geri kalanı `<tbody>`, className ile ince border/line-height, text-xs, border-line renkleriyle mevcut tasarım diline uygun) olarak render et; "|" yoksa mevcut whitespace-pre-line paragrafı aynen kullanmaya devam et (geriye dönük uyumluluk — mevcut ürünlerin sizeGuide'ı düz cümle olabilir). Bu parse fonksiyonunu component içinde küçük bir yardımcı fonksiyon olarak yaz (örn. parseSizeGuideTable), ayrı dosyaya gerek yok.

6) Admin ürün formunda (src/app/(admin)/admin/urunler/[id]/page.tsx ve .../yeni/page.tsx içinde Beden Tablosu / sizeGuide input'unun olduğu yeri bul) input'un altına küçük gri bir yardım metni ekle: "Tablo olarak göstermek için satırları | ile ayırın, örnek: Beden | Boy | Bel | Kalça sonra 34 | 35 | 34 | 46 gibi her ölçü satırını yeni satıra yaz."

7) Import eksikse ChevronRight'ı lucide-react'ten ekle (mevcut import satırındaki diğer ikonlarla birlikte).

8) Değişiklikleri yaptıktan sonra npm run build ile derlemenin geçtiğini doğrula, sonra DEPLOY_STATUS.md'ye her zamanki formatta bir not düş (ne eklendi, hangi dosyalar değişti).

Lütfen mevcut kod stiline (yorumlar, değişken isimlendirme, Tailwind sınıf dili) sadık kal, product-viewer.tsx'teki mevcut Türkçe yorum tarzını koru.
```
