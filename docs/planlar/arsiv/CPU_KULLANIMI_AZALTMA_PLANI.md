# Vercel Fluid Active CPU azaltma planı (v2)

**İlk sürüm:** 2 Ekim 2026. Uygulanmadı.
**Güncelleme:** 4 Ekim 2026. Bugünkü koda göre yeniden yazıldı. Renk seçimi için "flaşsız" yöntem seçildi, sipariş/iade sonrası stok tazeleme ve proxy iyileştirmesi eklendi.
**Durum:** 7 Ekim 2026'da uygulandı ve localhost'ta test edildi (bkz. DEPLOY_STATUS.md). Kullanıcı onayıyla commit ve push edildi.

## 1. Durum

- Vercel → Usage → Fluid Active CPU: **3 sa 15 dk / 4 sa** (4 Ekim). Hobby planda kayan 30 günlük pencere.
- Limit dolarsa proje durdurulabilir (503 DEPLOYMENT_PAUSED). Bu durumda vitrin, sepet, ödeme ve admin, hepsi kapanır.
- 2 Ekim'de Observability → Functions (son 12 saat) ölçümü:

| Rota | Çağrı | Active CPU |
|---|---|---|
| `/urunler/[slug]` | 507 | **43 sn (~%50)** |
| `/` | 17 | 7 sn |
| `/api/musteri-auth/[...nextauth]` | 33 | 6 sn |
| `/[cinsiyet]` | 128 | 5 sn |
| `/urunler` | 43 | 3,4 sn |
| `/kategori/[slug]` | 80 | 3,2 sn |

## 2. Kök neden (4 Ekim'de kod tekrar kontrol edildi)

1. **Ürün sayfası her istekte baştan oluşturuluyor.** `src/app/(site)/urunler/[slug]/page.tsx` dosyası `?renk=` için `searchParams` okuyor ve `revalidate` ayarı yok. Bu yüzden sayfa tamamen dinamik. Her ziyaret, Googlebot dahil, 5–6 Prisma sorgusu ve tam bir render demek.
2. **Anasayfa** `revalidate = 60`, yani dakikada bir yeniden üretiliyor.
3. **Katalog sayfaları** (`/[cinsiyet]`, `/[cinsiyet]/[kategori]`, `/kategori/[slug]`, `/urunler`) filtreler için `searchParams` okuyor. Her istekte yayındaki bütün ürünleri ve varyantları DB'den çekiyorlar (`getCatalogEntries`). Mega menü verisi (`getMegaMenuData`) de her render'da DB'ye gidiyor.
4. **Proxy her istekte çalışıyor**, `public/` görselleri dahil (`/hero-model.jpg`, `/menu/*.webp`, …). `src/proxy.ts` içindeki matcher dosya uzantılarını hariç tutmuyor. Fonksiyon içindeki regex bu istekleri sadece erken geçiriyor, proxy yine de her biri için çağrılmış oluyor.

Hazır olanlar:
- `revalidateCatalog(slug?)` (`lib/revalidate-catalog.ts`) zaten `revalidatePath('/urunler/<slug>')` çağırıyor. Ama sayfa önbellekte olmadığı için şu an hiçbir etkisi yok.
- Vega stok güncellemesi (`app/Servis/[service]/route.ts`) `revalidateCatalog()` çağırıyor.
- Sepet (`/api/sepet/dogrula`) ve sipariş oluşturma (`api/orders` → `resolveBestDiscount`) fiyatı, stoğu ve indirimi sunucuda **her seferinde** yeniden hesaplıyor. Bu yüzden önbellekteki bir sayfa bir an eski görünse bile **yanlış fiyattan ya da stokta olmayan bir ürün satılamaz**.

## 3. Çözüm

### Faz 1 — Ürün sayfasını önbelleğe al (ISR), renk seçimi flaşsız

**Amaç:** Ürün sayfası ilk ziyarette bir kez üretilsin ve CDN'den sunulsun. Sonraki ziyaretlerde fonksiyon çalışmasın.

**Renk (`?renk=`) için yöntem:** Renk bilgisi adres çubuğunda aynen kalacak, ama sunucu tarafında URL yoluna taşınacak.
- Yeni bir iç rota oluşturulacak: `src/app/(site)/urunler/[slug]/renk/[renk]/page.tsx`.
- `proxy.ts`, `/urunler/<slug>?renk=X` isteğini bu rotaya **rewrite** edecek (redirect değil). Tarayıcıdaki adres değişmez.
- Böylece her renk kendi önbellekli sayfasına sahip olur. Sayfa doğru renk seçili halde gelir, "önce varsayılan renk, sonra seçili renk" geçişi (flaş) olmaz.
- `ProductViewer`'a dokunmaya gerek yok. `initialColor` prop'u aynen kullanılır.
- `useSearchParams` KULLANILMAYACAK. Statik sayfada galeriyi Suspense fallback'ine düşürür ve SEO'yu bozar.

**Yapılacaklar:**
1. `urunler/[slug]/page.tsx` içindeki sayfa gövdesi ve `generateMetadata` ortak bir sunucu modülüne alınacak, örneğin `urunler/[slug]/product-page.tsx`:
   - `renderProductPage(slug, renk?)`
   - `productMetadata(slug)`
   - Davranış, HTML, JSON-LD ve canonical birebir aynı kalmalı.
2. `urunler/[slug]/page.tsx`:
   - `searchParams` kaldırılacak.
   - `export const revalidate = 3600` eklenecek.
   - `export async function generateStaticParams() { return [] }` eklenecek.
   - `renderProductPage(slug)` çağrılacak.
3. `urunler/[slug]/renk/[renk]/page.tsx`:
   - Aynı ayarlarla (`revalidate = 3600`, boş `generateStaticParams`) `renderProductPage(slug, decode(renk))` çağıracak.
   - Metadata aynı olacak. **Canonical `/urunler/<slug>` olarak kalacak**, renk eklenmeyecek.
   - Bu adres doğrudan açılırsa da çalışmalı. Sitemap'e ve linklere eklenmeyecek.
4. `proxy.ts` değişiklikleri:
   - Mevcut önizleme kapısı ve `/urunler` eski-katalog yönlendirmesi **önce** çalışmaya devam etsin.
   - Kapı geçildikten sonra, yol tam olarak `/urunler/<tek segment>` ise ve `renk` parametresi doluysa, isteği `/urunler/<slug>/renk/<encodeURIComponent(renk)>` adresine `NextResponse.rewrite` ile yönlendir.
   - Diğer query parametreleri rewrite'a taşınmaz, ürün sayfası başka parametre kullanmıyor.
   - Türkçe karakterli slug ve renk adları için çift encode olmamalı. `decodeSlug` mantığı korunacak.
5. `getProductBySlug` içindeki `cache()` aynen kalır.

**Tazelik:** Önbellekteki sayfa şu durumlarda **anında** yenilenmeli.
- `revalidateCatalog(slug)`:
  - Mevcut `revalidatePath('/urunler/<slug>')` kalacak.
  - Ek olarak renk sayfaları için `revalidatePath('/urunler/[slug]/renk/[renk]', 'page')` çağrılacak. Bu bütün renk sayfalarını geçersiz kılar ama renk sayfaları ziyaret edildikçe üretildiği için maliyeti düşük.
  - `slug` verilmediğinde mevcut `revalidatePath('/urunler/[slug]', 'page')` satırının yanına aynı renk satırı da eklenecek.
- **Ödeme onaylanıp stok düştüğünde:** `lib/payment/orders/reconcile.ts` içinde `decrementStock` çağrısının bulunduğu iki akış var: iyzico ödeme onayı ve `finalizeFreeOrder`. Transaction bittikten **sonra**, siparişteki ürünlerin slug'ları için `revalidateCatalog(slug)` çağrılacak.
  - Best-effort olmalı: try/catch ile sarılsın, hata ödeme akışını asla bozmasın.
- **İadede stok geri eklendiğinde:** `lib/payment/orders/refund.ts` içinde, `restock` olan iadelerden sonra ilgili ürün için aynısı yapılacak.
- **Bütün stok yazan yerler:** `grep -rn "stock" src --include=*.ts --include=*.tsx` ile stok, fiyat, görsel, yayın durumu ya da slug yazan **her** yer bulunacak ve `revalidateCatalog` çağırdığı doğrulanacak. Çağırmayan varsa eklenecek. Kapsam:
  - admin ürün kaydı, toplu işlemler, arşiv/silme
  - Excel aktarımı, görsel ekle/yenile
  - Vega senkronu, sipariş iptali ve geri yükleme
- **Slug değişirse:** eski slug için de `revalidatePath('/urunler/<eski-slug>')` çağrılmalı. Yoksa eski adres önbellekten eski ürünü göstermeye devam eder.
- **Kampanya kaydı ve silme:** `revalidateCatalog()` (slug'sız, tüm ürünler) çağrıldığı doğrulanacak, yoksa eklenecek.
- **Otomatik kampanya kullanım limiti:** `api/orders/route.ts` içinde bir otomatik kampanyanın `usedCount` değeri `usageLimit`'e ulaştığında `revalidateCatalog()` çağrılacak.
- **Türkçe karakterli slug kontrolü:** `revalidatePath`'in Türkçe karakterli slug'larda (ı, ğ, ü, ş, ö, ç) gerçekten çalıştığı testte doğrulanacak (bkz. Test 4). Çalışmıyorsa o çağrıda slug `encodeURIComponent` ile verilecek. Bu da olmazsa ilgili yerde `revalidatePath('/urunler/[slug]', 'page')` kullanılacak.

### Faz 2 — Anasayfa
- `src/app/(site)/page.tsx`: `revalidate = 60` → `3600`. Açıklama yorumu da güncellenecek.
- Ürün, kampanya ve sipariş yazımlarının zaten `revalidateCatalog()` çağırdığı Faz 1'de doğrulanmış olacak. Bu yüzden anasayfa yine anında güncellenir.

### Faz 3 — Katalog ve menü verisini önbelleğe al
- `lib/catalog.ts` → `getCatalogEntries`:
  - Ağır DB sorgusu ve dönüşüm `unstable_cache` ile sarılacak: `tags: ['catalog']`, `revalidate: 3600`. Argümanlar (kategori, cinsiyet, featuredFirst) cache anahtarına girer.
  - Mevcut `search.ts` içindeki `unstable_cache` kullanımı örnek alınacak.
  - `CatalogEntry` içinde `Date` alanı yok (`isNew` boolean), JSON'a çevrilmesi sorun çıkarmaz. Bunu doğrula.
- `lib/catalog-listing.ts` → kategori filtre listesi (`prisma.category.findMany`) aynı şekilde `['catalog']` tag'iyle önbelleğe alınacak.
- `lib/site-nav.ts` → `getMegaMenuData`: React `cache()` kalacak. İçindeki DB çağrıları `unstable_cache` ile sarılacak, `tags: ['catalog']`, `revalidate: 3600`.
- `revalidateCatalog()` içine `revalidateTag('catalog', { expire: 0 })` eklenecek. Mevcut `SEARCH_INDEX_TAG` satırıyla aynı biçimde olacak.
- Kategori ekleme, düzenleme, silme ve sıralama yapan yerler (`lib/category-actions.ts`, `api/admin/kategoriler/*`) `revalidateCatalog()` ya da en az `revalidateTag('catalog', { expire: 0 })` çağırmalı. Yoksa eklenecek.
- `getActiveAutomaticPercentCampaigns` **önbelleğe alınmayacak.** Küçük bir sorgu ve güne bağlı. Önbelleksiz kalması gece yarısı başlayan/biten kampanyaların katalogda anında doğru görünmesini sağlar.
- **Boyut sınırı:** `unstable_cache` 2 MB'tan büyük veriyi yazmaz. Tüm katalog (kategori ve cinsiyet filtresiz) için `JSON.stringify(entries).length` ölçülecek ve DEPLOY_STATUS'a yazılacak. 1,5 MB'ı geçiyorsa sadece kartın kullandığı alanlar bırakılacak.
- Katalog sayfaları dinamik kalır (filtreler `searchParams`'ta). Ama artık her istek DB yerine önbellekten okur.

### Faz 4 — Proxy'yi statik dosyalarda çalıştırma
- `src/proxy.ts` → `config.matcher` statik dosya uzantılarını hariç tutacak şekilde genişletilecek. Örneğin:
  `"/((?!api|Servis|_next|favicon.ico|.*\\.(?:png|jpe?g|svg|webp|ico|gif|woff2?|ttf|txt|xml)$).*)"`
- Bu değişiklikle `robots.txt`, `sitemap.xml` ve `feed/google.xml` de proxy'den geçmez. Zaten her zaman serbest bırakılıyorlardı, davranış değişmez.
- Fonksiyon içindeki regex kontrolü yedek olarak kalabilir.
- `/admin` koruması ve `/urunler` yönlendirmesi etkilenmemeli. Testte doğrulanacak.

### Kapsam dışı
- Vercel Bot Protection (Challenge): iyzico, Vega ve cron için bypass kuralları yazılmadan açılmayacak (önceki karar).
- `images.unoptimized` ayarı: dokunulmayacak (bkz. VERCEL_GORSEL_VE_BOT_LIMIT_PLANI.md).
- R2 taşıma işi: ayrı bir iş.
- Pro'ya geçiş: iş kararı.

## 4. Müşteri deneyimine etkisi

- **Hız:** Ürün sayfaları CDN'den hazır geldiği için **daha hızlı** açılır. Süresi dolan bir sayfa ilk ziyaretçiye eski haliyle hemen gösterilir, yenisi arka planda üretilir. Kimse bekletilmez.
- **Stok ve fiyat:** Admin'deki her değişiklikte, her ödemede ve her iadede ilgili sayfa anında tazelenir. Bir şey gözden kaçsa bile sepet ve ödeme sunucuda tekrar kontrol ettiği için yanlış satış olmaz.
- **Renk seçimi:** Katalogdan bir renge tıklayınca sayfa o renk seçili halde açılır. Adres aynı kalır, flaş olmaz.
- **SEO:** HTML, JSON-LD ve canonical aynı kalır. Googlebot'un taraması artık fonksiyon çalıştırmaz.
- **Bilinen küçük gecikme (en fazla 1 saat):**
  - Gece yarısı başlayan veya biten otomatik kampanya ürün detay sayfasında en fazla 1 saat gecikmeyle görünebilir. Sepet ve ödeme tutarı her zaman doğrudur. Katalog kartlarında gecikme olmaz.
  - "Yeni" rozeti de en fazla 1 saat geç kalkabilir.

## 5. Test (localhost)

**Önemli:** `npm run dev` önbelleği kullanmaz. Testler `npm run build && npm run start` ile yapılacak. Yayındaki ürünlerde veri değiştiren bir test yapılmayacak, sadece **taslak/test ürün** kullanılacak. DB ortak, canlı site de etkilenir.

1. `npm run build` çıktısında `/urunler/[slug]` ve `/urunler/[slug]/renk/[renk]` dinamik (`ƒ`) değil, ISR olarak görünmeli. `/` için `revalidate: 1h` görünmeli. `npx tsc --noEmit` ve `npm run lint` temiz olmalı.
2. Bir ürün sayfası iki kez açıldığında ikinci yanıtta `x-nextjs-cache: HIT` olmalı (ya da `next start` loglarında ikinci istekte render olmadığı görülmeli).
3. Katalogda çok renkli bir ürünün **ikinci** rengine tıkla:
   - Sayfa doğru renk ve doğru galeriyle açılmalı, flaş olmamalı.
   - Adres çubuğunda `?renk=...` görünmeli.
   - `<head>` içindeki canonical query'siz olmalı, JSON-LD olmalı.
   - Türkçe karakterli bir renk ("Gümüş", "Açık Mavi" gibi) ve Türkçe karakterli bir slug ile de dene.
4. **Tazelik (taslak ürünü geçici yayınla, sonra geri al):**
   - Admin'den fiyat ya da stok değiştir. Ürün sayfası, renk sayfası, katalog kartı ve anasayfa yenileyince **hemen** güncel olmalı.
   - Bu testi Türkçe karakterli slug'a sahip bir ürünle de yap.
5. Reconcile ve refund içine eklenen `revalidateCatalog` çağrılarının try/catch içinde olduğunu ve transaction'dan sonra çalıştığını kodda göster. Gerçek ödeme testi yapılmayacak.
6. Katalog: filtre, sıralama, "Daha Fazla Göster" ve arama (`?ara=`) eskisi gibi çalışmalı. Mega menü kategorileri doğru görünmeli. Admin'de bir kategoriyi pasif yapınca menüden ve filtreden hemen kalkmalı (test kategorisiyle yapılacak, sonra geri alınacak).
7. Proxy:
   - `/admin` girişsiz açılınca login'e yönlenmeli.
   - `/urunler?kategori=gomlek&cinsiyet=Erkek` adresi 301 ile temiz yola gitmeli.
   - `/hero-model.jpg` ve `/robots.txt` açılmalı.
8. Katalog önbelleği boyutu ölçülüp rapora yazılmalı.

## 6. Canlıya alma ve takip

- Kullanıcı localhost'ta onaylayınca: önce DEPLOY_STATUS güncellenir, sonra yerel commit atılır. **Push kullanıcı söyleyince yapılır.**
- Push'tan 1–2 gün sonra Vercel → Observability → Functions'ta `/urunler/[slug]` çağrı sayısının ve CPU'sunun belirgin düştüğü kontrol edilmeli. Usage → Fluid Active CPU günlük grafiğinin de düşmesi beklenir.
- Beklenen etki: günlük CPU'nun kabaca yarısından fazlası kalkar. 30 günlük toplam, eski yoğun günler pencereden çıktıkça hızla düşer.

## 7. Claude Code prompt'u (kopyala-yapıştır)

```
Bollmark projesinde CPU_KULLANIMI_AZALTMA_PLANI.md (v2, 4 Ekim) dosyasını baştan sona oku ve uygula. Yüklü skill'leri (özellikle karpathy-guidelines) kullan. Değişiklikleri küçük ve cerrahi tut, planda olmayan davranışa dokunma.

Önemli kurallar:
- Ürün sayfası ISR olacak. ?renk= için useSearchParams KULLANMA; proxy.ts'te /urunler/<slug>?renk=X isteğini /urunler/<slug>/renk/<renk> iç rotasına REWRITE et (adres çubuğu değişmesin). Ortak render/metadata modülü kullan, HTML/JSON-LD/canonical birebir aynı kalsın; canonical her zaman query'siz /urunler/<slug>.
- Tazelik kritik: stok/fiyat/görsel/yayın/slug/kampanya/kategori yazan HER yeri grep ile bul ve revalidateCatalog (veya planda yazan revalidatePath/revalidateTag) çağırdığını doğrula. Özellikle reconcile.ts (ödeme onayı + finalizeFreeOrder) ve refund.ts (restock) için transaction SONRASI, try/catch içinde, ödeme akışını asla bozmayacak şekilde ekle. Slug değişince eski slug da tazelenmeli.
- getActiveAutomaticPercentCampaigns'i önbelleğe ALMA. unstable_cache'e Date içeren veri koyma (JSON'a çevrilir); koyman gerekirse geri Date'e çevir.
- images ayarlarına (unoptimized dahil), sıkıştırmaya, R2 koduna dokunma.
- DB localhost ile canlı arasında ORTAK: testlerde yayındaki ürünlerde veri değiştirme, sadece taslak/test ürün ve test kategorisi kullan, test sonrası eski haline getir. Gerçek ödeme testi yapma.
- Testleri npm run dev ile DEĞİL, npm run build && npm run start ile yap (dev önbelleği kullanmaz).

Planın 5. bölümündeki testleri yap, build çıktısındaki rota tiplerini, katalog önbellek boyutunu ve hangi dosyalara revalidate eklediğini bana raporla. Bitince DEPLOY_STATUS.md'ye not düş. Ben localhost'ta onaylamadan commit atma; onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```
