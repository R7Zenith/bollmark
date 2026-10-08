# Boş Kategori Sayfası — "Yeni Ürünler Geliyor" Tasarım Planı

## 1. Mevcut durum

`src/app/(site)/urunler/page.tsx` içinde, `entries.length === 0` ve aktif filtre yokken sadece düz bir satır çıkıyor:

```tsx
<p className="mt-10 text-ink/60">{emptyMessage}</p>   // "Bu kategoride henüz ürün bulunmuyor."
```

Banner + breadcrumb + toolbar zaten üstte render ediliyor; yani sorun sadece altta kalan boş alan. Filtreli boş durum ("Sonuç bulunamadı" + "Filtreleri Temizle") ayrı bir dal ve **dokunulmayacak**.

## 2. Tasarım yönü

Site Release temasının monokrom dilinde (ink #111 / beyaz / line #ebebeb, Poppins + `font-accent` italik serif vurgu). Tatlı ve zarif olması için: sıcak metin, küçük bir animasyonlu illüstrasyon, e-posta ile haber alma formu ve "bu arada şunlara bak" yönlendirmesi. Renk patlaması yok; tatlılık metinden, mikro animasyondan ve yuvarlak köşelerden gelecek.

Yerleşim (ortalı, `py-20 md:py-28`, `max-w-[560px]`):

1. **İllüstrasyon** — ince çizgili (1.5px stroke, ink) SVG askı + üstünde küçük bir tişört/elbise silueti; askı çok yavaş sallanıyor (`@keyframes` 4s ease-in-out, ±3°, `prefers-reduced-motion`'da kapalı). Yanında 2–3 küçük yıldız/pırıltı, sırayla parlıyor.
2. **Küçük üst etiket** — `text-[10px] uppercase tracking-[1px] text-ink/50`: "YAKINDA"
3. **Başlık** — `text-[27px] md:text-[38px] tracking-tight`: "Yeni parçalar *yolda*" (`yolda` kelimesi `font-accent italic`, ana sayfadaki vurgu stiliyle aynı).
4. **Alt metin** — `text-sm text-ink/60`: "{Kategori} koleksiyonumuzu şu an hazırlıyoruz. Yeni ürünler eklendiği gün ilk sen haberdar ol."
5. **E-posta formu** — pill input (h-[44px], rounded-[50px], border line) + dolu siyah pill buton "Haber Ver". Başarıda form yerine tik + "Tamam, ürünler gelince sana yazacağız." Hata/geçersiz e-posta satır içi mesaj.
6. **İnce ayraç** + "Bu arada göz atmak ister misin?" — mevcut `filterCategories` (yayında ürünü olan kategoriler) yatay kaydırmalı, yuvarlak köşeli 3–5 küçük kart/çip (kategori görseli + ad). Hiç yoksa "Tüm Ürünleri Gör" pill butonu.

Duruma göre metin: `cinsiyet` varsa "Kadın / Erkek koleksiyonunda bu kategori için…", yoksa genel.

## 3. Söz (copy) alternatifleri

| # | Başlık | Alt metin |
|---|---|---|
| A (önerilen) | Yeni parçalar *yolda* | Bu koleksiyonu şu an hazırlıyoruz. Ürünler eklendiği gün ilk sen haberdar ol. |
| B | Burası şimdilik *sessiz* | Ama uzun sürmeyecek. Yeni ürünler çok yakında burada. |
| C | Askılar *hazır*, ürünler yolda | Yeni sezon parçaları çok yakında raflarda. |
| D | Bir sürprizimiz *var* | Bu kategori için özel bir seçki hazırlıyoruz. Gelince haber verelim mi? |

Buton: "Haber Ver". Başarı: "Tamam, ürünler gelince sana yazacağız."

## 4. Haber verme formu (opsiyonel ama önerilen)

Boş sayfanın en değerli yanı: bu ziyaretçiyi kaybetmemek. Projede zaten `StockAlert` (varyant bazlı) ve `/api/stok-bildirimi` var; kategori için aynı desen:

- Prisma: yeni model `CategoryAlert { id, categoryId, gender?, email, notifiedAt?, createdAt }`, `@@unique([categoryId, gender, email])`. (`gender` null olabilir → unique için `gender` boş string default'u düşünülebilir; Claude Code Prisma/Postgres davranışına göre karar versin.)
- Route: `src/app/(site)/api/kategori-bildirimi/route.ts` — `stok-bildirimi` ile aynı yapı (zod + upsert, `notifiedAt: null` sıfırlama). Basit bir spam koruması: aynı IP için dakikada çok istek atılmasını engelleyen hafif bir sınır veya honeypot alanı.
- Bildirim gönderimi (kategoriye ilk ürün yayınlanınca mail) **bu işin kapsamı dışı**; sadece kayıt toplanır. Admin tarafında listeleme için ileride küçük bir ekran eklenebilir. Bunu DEPLOY_STATUS'a "sonraki adım" olarak yaz.

## 5. Teknik notlar (Claude Code için)

- Yeni client bileşeni: `src/components/empty-category-state.tsx` (form state + animasyon). Sayfa (server) `emptyMessage` satırını bununla değiştirir; props: `categoryName`, `categoryId`, `gender`, `suggestions` (mevcut `filterCategories`, aktif kategori hariç, en fazla 5).
- Animasyon CSS'i `globals.css`'e ya da bileşen içi `<style>`/Tailwind arbitrary keyframe ile; `motion-reduce:animate-none`.
- SVG inline, harici görsel/kütüphane yok. Erişilebilirlik: illüstrasyon `aria-hidden`, form `label` (sr-only), durum mesajı `aria-live="polite"`.
- Mobil: form tek sütun, çip satırı yatay scroll (`-mx-4 px-4`), butonlar min 44px.
- `noindex`: boş kategori sayfası için `generateMetadata`'da ürün yoksa `robots: { index: false }` (ince içerik olarak işaretlenmesin).
- Filtreli boş durum ve ürün olan durum **değişmeyecek**.

## 6. Bakmak istersen — ilham siteleri

- Shopify'ın "Coming Soon" sayfa örnekleri: https://www.shopify.com/blog/coming-soon-page
- Elementor'un 32 örneği: https://elementor.com/blog/best-coming-soon-page-examples/
- Boş durum (empty state) UX kuralları: https://www.eleken.co/blog-posts/empty-state-ux ve https://www.pencilandpaper.io/articles/empty-states
- Stokta yok / haber ver akışı: https://www.poptin.com/blog/back-in-stock-email-popups-waitlists/
- Canlı ilham için giyim sitelerinde (Aritzia, COS, Zara, Massimo Dutti) ürünü olmayan bir kategori/arama sonucu açıp bakabilirsin; genelde düz mesaj + yönlendirme kullanıyorlar, yani buradaki tasarım fark yaratır.

---

## 7. CLAUDE CODE PROMPTU

```
Yüklü skill'leri kullan (özellikle frontend/tasarım skill'leri ve karpathy-guidelines). Önce AGENTS.md ve CLAUDE.md'yi oku.

GÖREV: Kategori sayfasında (src/app/(site)/urunler/page.tsx) ürün yokken çıkan düz "Bu kategoride henüz ürün bulunmuyor." satırını, BOS_KATEGORI_YAKINDA_TASARIMI_PLANI.md'deki tasarımla değiştir. Planı (bölüm 2-5) baştan sona oku ve uygula.

Yapılacaklar:
1. src/components/empty-category-state.tsx (client component) oluştur: sallanan askı SVG illüstrasyonu (prefers-reduced-motion'a saygılı), "YAKINDA" etiketi, başlık "Yeni parçalar yolda" ("yolda" font-accent italic), alt metin (kategori adı + cinsiyet durumuna göre), e-posta formu (pill input + siyah pill "Haber Ver", başarı/hata durumları, aria-live), altında "Bu arada göz atmak ister misin?" bölümü — mevcut filterCategories'ten (aktif kategori hariç, en fazla 5) yatay kaydırmalı yuvarlak kartlar; hiç öneri yoksa "Tüm Ürünleri Gör" butonu. Site paletine (ink/cream/line/stone, Poppins) sadık kal; yeni renk ekleme.
2. page.tsx'te SADECE `hasActiveFilters === false && entries.length === 0` dalındaki <p>'yi bu bileşenle değiştir. Filtreli boş durum ve ürün listesi dallarına DOKUNMA. Ürün yokken generateMetadata'da robots noindex ver (kategori bulunuyorsa).
3. Prisma'ya CategoryAlert modeli ekle (categoryId, gender?, email, notifiedAt?, createdAt; categoryId+gender+email unique). Migration/db push'u projede daha önce şema değişikliklerinin nasıl yapıldığına bakarak (prisma/ klasörü, DEPLOY_STATUS.md) AYNI yöntemle Neon'a uygula. Gerekli env/Vercel adımları varsa bunları da kendin yap, bana manuel iş bırakma.
4. src/app/(site)/api/kategori-bildirimi/route.ts oluştur: /api/stok-bildirimi ile aynı desen (zod + upsert, notifiedAt sıfırlama) + basit honeypot/rate limit. Kategori yoksa 404.
5. Doğrula: `npm run build` ve lint hatasız; masaüstü (1440) ve mobil (390) genişlikte boş bir kategoriyi tarayıcıda (Playwright) aç, ekran görüntüsü al; form gönderimini test et (başarı, geçersiz e-posta, aynı e-postayla tekrar). Ürünlü kategori ve filtreli boş durumun bozulmadığını kontrol et.
6. Deploy et (Vercel), canlıda tekrar kontrol et.
7. DEPLOY_STATUS.md'ye not düş: ne yapıldı, hangi dosyalar, migration durumu, ve "sonraki adım: kategoriye ürün eklenince CategoryAlert kayıtlarına mail gönderimi + admin'de liste".

Kapsam dışı: mail gönderimi, admin ekranı, başka sayfaların tasarımı.
```
