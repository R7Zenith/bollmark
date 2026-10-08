# Ana Sayfa — "Yeni Gelenler" Altı Bölümleri Planı

Hedef: Ana sayfada hero ve "Yeni Gelenler" bölümü AYNEN kalır (dokunma). Onun altındaki mevcut iki geçici bölüm
(Unsplash hotlink'li "Zamansız Rahatlık" görseli ve 3 kartlı "Özel Koleksiyonlarımız") yeniden düzenlenir ve
yanlarına yeni bölümler eklenir. Referans: Shopify Release teması (bkz. `RELEASE_TEMA_BIREBIR_UYUM_PLANI.md`):
Poppins + yalnız `<em>` içinde Cormorant italik vurgu (`font-accent`), hap (pill) butonlar, beyaz zemin.

Dosya: `src/app/(site)/page.tsx` (şu an ~200 satır). Yeni bileşenler `src/components/home/` altına.

## Kurallar (Claude Code için)

- Başlamadan `AGENTS.md`'yi oku: bu Next.js sürümü bildiğin gibi değil; `node_modules/next/dist/docs/` içindeki ilgili kılavuzu oku.
- `karpathy-guidelines` skill'ini kullan: cerrahi değişiklik, hero + Yeni Gelenler + FeaturedCarousel + ProductCard'a DOKUNMA
  (yalnız import ederek yeniden kullan).
- Kod yorumlarının dili projedeki gibi (Türkçe, aksansız), her bölümün başına "neden böyle" notu.
- Sıralama (yukarıdan aşağı): Hero → Yeni Gelenler → **A** Editoryal ikili blok → **B** Kategori kartları →
  **C** Tam genişlik lookbook → **D** Çok satanlar → **E** Instagram → **F** SSS + mağaza bilgisi → footer.
- Yatay gutter: Yeni Gelenler ile aynı `px-4 md:px-6 xl:px-9` (max-w-7xl kullanma). Dikey ritim: `py-section`.
- Bölüm başlığı stili: Yeni Gelenler `h2` ile aynı (`font-display text-3xl font-normal tracking-[-0.04em] md:text-5xl`).
- Mobil (390px) ve masaüstü (1600px) ekran görüntüsü alıp kontrol et (Playwright ile).

## Görseller

Görselleri sen indir (curl, `-L`) ve `public/anasayfa/` altına kaydet; sayfada `next/image` ile YEREL yoldan kullan
(hotlink yok). İndirirken genişliği `w=` ile ver. Unsplash ücretsiz lisans; kaynakları `public/anasayfa/KAYNAKLAR.md`'e yaz
(fotoğrafçı adı + unsplash sayfası).

| Dosya | Unsplash foto kimliği (URL: `https://images.unsplash.com/photo-<kimlik>?fm=jpg&q=80&fit=max&w=<genişlik>`) | Genişlik | Fotoğrafçı |
|---|---|---|---|
| `editoryal-sol.jpg` | `1613915617430-8ab0fd7c6baf` (blazer/pantolon, portre) | 1400 | Chyntia Juls |
| `editoryal-sag.jpg` | `1619603364937-8d7af41ef206` (kahve palto, erkek) | 1400 | Taras Chernus |
| `lookbook-genis.jpg` | `1781454230912-ba9ce1b46b56` (bej palto, yatay) | 2200 | Margo Evardson |
| `koleksiyon-kadin.jpg` | `1601762603339-fd61e28b698a` (gri trençkot) | 1000 | Alireza Dolati |
| `koleksiyon-erkek.jpg` | `1539125530496-3ca408f9c2d9` (mavi ceket) | 1000 | Laurence Cruz |
| `koleksiyon-cocuk.jpg` | `1502451885777-16c98b07834a` (çocuk, desenli gömlek) | 1000 | Janko Ferlič |
| `koleksiyon-ayakkabi.jpg` | `1656164753657-8ff832063a71` (beyaz ayakkabı, dikey) | 1000 | HamZa Nouasria |
| `koleksiyon-aksesuar.jpg` | `1599108859613-88a1fff8e2e4` (deri çanta) | 1000 | Logan Weaver |

İndirme başarısız olursa (403/404) bir alternatifle geçme; hangi görselin inmediğini raporla ve o bölümde
geçici koyu (`bg-line`) zemin bırak. İndirdikten sonra her dosyayı aç ve içeriğin marka için uygun olduğunu gözle doğrula
(alt metinler aşağıda sabit).

## A) Editoryal ikili blok

Release'teki "Timeless *classics*" bloğu. Masaüstünde 2 sütun, mobilde alt alta.
- Sol kart (`aspect-[4/5]`): `editoryal-sol.jpg`, alt-sol köşede beyaz başlık
  `Zamansız <em class="font-accent italic font-normal">klasikler</em>` + hap buton "Keşfet" → `/urunler`.
- Sağ kart: yalnız `editoryal-sag.jpg` (metinsiz), tamamı `/urunler?cinsiyet=Erkek` bağlantısı.
- Hover: görsel `scale-105`, `duration-500 ease-out` (mevcut kategori kartlarıyla aynı).
- alt: "Bollmark kadın sonbahar koleksiyonu", "Bollmark erkek palto".

## B) Kategori kartları ("Özel Koleksiyonlarımız" → yenilenir)

Mevcut 3 kartlı bölümü (page.tsx'teki `collections` dizisi + Unsplash hotlink'ler) değiştir.
- 5 kart: Kadın, Erkek, Çocuk, Ayakkabı, Aksesuar. Görsel + ad + ürün sayısı üst simge (mevcut `sup` stili).
- Masaüstü: `lg:grid-cols-5 gap-4`, tablet 3 sütun, mobil: yatay kaydırmalı (snap-x, kart genişliği ~44vw) — dikey yığılma yok.
- Sayıları DB'den `prisma.product.count` ile çek (PUBLISHED). ÖNCE gerçek verideki `gender` değerlerini ve kategori
  slug'larını kontrol et (Çocuk için gender değeri "Çocuk" mü, "Kız/Erkek Çocuk" mu? Ayakkabı/aksesuar kategori slug'ları neler?
  bkz. `src/lib/excel-import.ts`, `prisma/schema.prisma` Category). Sayısı 0 olan kartı GİZLE.
- Linkler mevcut katalog filtre URL'leriyle (`/urunler?cinsiyet=...`, `/urunler?kategori=<slug>`), `mega-menu-cards.ts` ile aynı biçim.
- Kategorinin kendi `imageUrl`'i doluysa onu kullan, yoksa yukarıdaki yerel `koleksiyon-*.jpg`.
- Bu sorgular mevcut `Promise.all` içine eklenmeli (ardışık await yok).

## C) Tam genişlik lookbook

Mevcut "Zamansız Rahatlık" bölümünü güncelle: görsel yerel `lookbook-genis.jpg` (opacity-50 yerine gradient overlay ile
okunaklılık; hero'daki `from-ink/…` gradyanına benzer), başlık `Her güne <em>uyan</em> parçalar`,
alt satır (küçük, `text-cream/80`): "2026 Sonbahar / Kış", hap buton "Koleksiyonu Keşfet" → `/urunler`.
- OPSİYONEL (yalnız kolay ve güvenliyse): `getActiveAutomaticPercentCampaigns` (zaten sayfada çağrılıyor) sonucunda aktif
  kampanya varsa başlığın üstünde küçük hap etiket "Sezon fırsatı: %X'e varan indirim". Kampanya veri şekli bu cümleyi
  doğru kuramıyorsa BU KISMI ATLA ve raporda yaz; uydurma indirim oranı yazma.
- Yükseklik `min-h-[70vh]` kalsın, mobilde `min-h-[60vh]`.

## D) Çok satanlar (sekmeli)

Yeni istemci bileşeni `src/components/home/bestsellers-tabs.tsx`; veri sunucuda hazırlanır, sekme değişimi istemcide
(fetch yok). Sekmeler: Tümü / Kadın / Erkek / Çocuk (ürünü olmayan sekmeyi gizle).
- Sıralama: `OrderItem.quantity` toplamı, SON 90 gün, yalnız başarılı sayılan siparişler (`src/lib/status.ts` ve
  `lib/payment/orders/state.ts` içinden hangi durumların "ödenmiş/geçerli" olduğunu OKU; iptal/başarısız/silinmiş siparişleri
  sayma). Stokta olmayan ürünleri dışla. Sekme başına en fazla 8 ürün.
- Yedek: satış verisi az/yoksa (sekmede 4'ten az ürün çıkarsa) `isFeatured` ürünlerle, sonra en yeni ürünlerle tamamla —
  bölüm hiçbir zaman boş görünmesin. Yeni gelenlerdeki ürünlerle tamamen aynı liste çıkıyorsa yine göster (ama önce
  çok satan olanlar).
- Kartlar mevcut `ProductCard` (aynı `ProductCardData` şekli, `resolveProductDisplayPrice` ile fiyat, `quickAddVariants`).
  `page.tsx`'te `featuredProducts.map(...)` ile yapılan dönüşümü bir yardımcı fonksiyona çıkar ve iki yerde kullan
  (Yeni Gelenler'in çıktısı DEĞİŞMEMELİ).
- Düzen: masaüstü 4 sütun grid (carousel değil), mobil 2 sütun (`-mx-4 gap-x-0.5` katalog gridiyle aynı).
- Başlık: "Çok Satanlar", sağda "Tümünü Gör" (mevcut `link-shrink-underline` stili) → `/urunler`.
- Sorgu `revalidate = 60` ile uyumlu; ağır olmasın (tek `groupBy` + tek `findMany`, N+1 yok).
- Sekme butonları: aktif olanın altı çizili (Release menü çizgisi stili), klavye erişilebilir (`role="tablist"`).

## E) Instagram galerisi

Yeni bileşen `src/components/home/instagram-grid.tsx`, veri `src/lib/instagram-posts.ts` içinde statik dizi
(`{ image: "/instagram/post-1.jpg", alt: string }[]`), 6 kare, `aspect-square`; mobilde 3 sütun × 2 satır, masaüstü 6 sütun.
- Başlık: "Bizi <em>takip edin</em>" + "@kullanıcıadı" bağlantısı; her kare profil bağlantısına gider (`target="_blank"`,
  `rel="noopener noreferrer"`). Instagram API'si KULLANMA (kırılgan, token ister).
- Profil adresi `NEXT_PUBLIC_INSTAGRAM_URL` ortam değişkeninden gelir. Değişken boşsa VEYA `public/instagram/` içinde
  dizideki dosyalar yoksa bölüm HİÇ render edilmez (sayfa boş kare göstermesin). `.env.example`'a değişkeni ekle
  (yorumla: "Instagram profil adresi, örn. https://www.instagram.com/kullaniciadi"). Vercel'e DEĞER EKLEME — değer
  bende (kullanıcıda) belli olunca ayrıca yapılacak; şimdilik bölüm gizli kalır ve bu kabul edilen davranıştır.
- `public/instagram/README.md` yaz: 6 kare fotoğrafın dosya adları (`post-1.jpg` … `post-6.jpg`), önerilen 1080×1080 ve
  dizideki `alt` metinlerinin nasıl düzenleneceği.
- Stok fotoğrafı ile "sahte Instagram" doldurma: yapma.

## F) SSS + mağaza bilgisi

İki sütun (mobilde alt alta). Bileşen `src/components/home/faq-and-store.tsx`, sunucu bileşeni.
- Sol: "Sıkça Sorulan Sorular", 5 soru, JS'siz `<details>/<summary>` akordeon (ok ikonu `lucide-react` Plus/Minus,
  açılınca döner). Sayfaya `FAQPage` JSON-LD ekle (`<script type="application/ld+json">`).
- CEVAPLAR YALNIZ KODDA/İÇERİKTE DOĞRULANABİLEN BİLGİLERDEN yazılmalı: kargo ücreti/eşik için `src/lib/shipping.ts` ve
  `StoreSettings.defaultShippingCents`; iade süresi/şartları için yasal sayfalar (`LegalPage`, bkz. `HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md`) —
  ilgili yasal sayfaya `/sayfa/<slug>` bağlantısı ver; beden için `size-guide-data.ts` (beden tablosu modalı);
  ödeme için iyzico (kart ile ödeme; taksit vb. vaat etme); sipariş takibi için `/siparis-durumu`.
  Bir bilgiyi kodda bulamazsan o soruyu ÇIKAR, uydurma. Önerilen sorular: Kargo ne kadar sürer/ücreti?, İade nasıl yapılır?,
  Beden nasıl seçerim?, Nasıl ödeme yapabilirim?, Siparişimi nasıl takip ederim?
- Sağ: "Mağazamız" kartı: "Koton Corner Mağazası — 2016'dan beri", adres
  (Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa), telefon/e-posta `StoreSettings` (`contactPhone`, `contactEmail`; boşsa satırı gizle),
  "Yol tarifi al" hap butonu (Google Maps arama URL'si: `https://www.google.com/maps/search/?api=1&query=<adres, encodeURIComponent>`),
  "İletişim" → `/iletisim`. Çalışma saati YAZMA (bilgi yok). "Mağazadan teslim" gibi bir hizmet ima etme.
- Kart zemini açık gri (`bg-line`/mevcut açık ton), köşe yuvarlaklığı sitenin geri kalanıyla aynı (`rounded-none` mi `rounded-…` mi
  önce bak).

## Doğrulama listesi

- `npx tsc --noEmit` ve `npm run lint` temiz; `npm run build` başarılı.
- Hero ve Yeni Gelenler piksel olarak değişmedi (önce/sonra ekran görüntüsü).
- 390px: yatay taşma yok, kategori kartları kaydırılabilir, sekmeler sığıyor, başlıklar kesilmiyor.
- 1600px: kartlar Yeni Gelenler ile aynı kenar boşluğunda hizalı.
- Ürün olmayan durumda (boş DB) sayfa hata vermiyor; Instagram env boşken bölüm yok.
- Sayfada hiç `images.unsplash.com` hotlink'i kalmadı (ürün yedek görseli hariç, o dokunulmayacak).
- Lighthouse/CLS: görsellerde `sizes` verildi, yukarıdaki görseller `priority` DEĞİL.

## İş bitince

Proje kuralı gereği `DEPLOY_STATUS.md`'nin sonuna tarihli kısa not düş (yapılanlar, Instagram bölümünün gizli olduğu,
bekleyen adım: profil adresi + 6 fotoğraf). Deploy'u projenin mevcut akışıyla (DEPLOY_STATUS.md'deki son adımlar) yap.
