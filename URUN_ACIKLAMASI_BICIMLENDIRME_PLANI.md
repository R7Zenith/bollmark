# Ürün Açıklaması — Satır Boşlukları ve Kalın Başlıklar Planı

## İstek

1. Admin panelde açıklamaya elle yapıştırılan metin satır satır, boşluklu duruyor; ama ürün detay sayfasında hepsi tek paragraf düz metin olarak çıkıyor.
2. Kopyalanan yerde (Koton vb.) kalın olan başlıklar ("Ürün Özellikleri", "Model Bilgileri" …) panele yapıştırınca normal kalınlıkta oluyor. Kalınlık korunsun.

## Kök Neden (kod incelendi)

- **Admin alanı düz `<textarea>`**: `src/app/(admin)/admin/urunler/[id]/page.tsx` (satır ~409) ve `yeni/page.tsx` (satır ~238). Textarea sadece düz metin tutar; panodaki kalın/başlık bilgisi yapıştırırken **tarayıcı tarafından atılıyor**. Kaydedilen şey `\n` içeren düz metin.
- **Ürün sayfası açıklamayı HTML olarak basıyor**: `urunler/[slug]/page.tsx` → `sanitizeDescriptionHtml()` → `product-viewer.tsx` içinde `dangerouslySetInnerHTML`. HTML'de `\n` satır sonu sayılmaz, bu yüzden tüm satırlar tek paragrafa yapışıyor.
- **Veri karışık**: Koton'dan otomatik çekilen açıklamalar zaten HTML (`<p>`, `<strong>` — `koton-images.ts` → `normalizeKotonDescription`), elle girilenler düz metin. Bonus sorun: Koton'dan gelen HTML açıklamalar şu an admin textarea'da **ham etiketlerle** (`<p><strong>…`) görünüyor, düzenlemesi zor.
- `sanitizeDescriptionHtml` izinli etiketler: `p, br, strong, b, em, i, u, ul, ol, li, span`. Başlık etiketleri (`h1–h6`) yok → yapıştırılan `<h3>` başlıklar atılıp düz metne düşer.

## Önerilen Çözüm (2 parça)

### A) Görüntüleme düzeltmesi — mevcut kayıtları da kurtarır
`description-html.ts`'e `plainTextToHtml()` eklenir. `sanitizeDescriptionHtml` girdide HTML etiketi yoksa önce bunu uygular:
- Boş satırla ayrılmış bloklar → `<p>`, blok içi tek satır sonları → `<br>`.
- **Başlık sezgisi** (sadece düz metin kayıtlar için): bir bloğun ilk satırı kısa (≤ 40 karakter), nokta ile bitmiyor ve altında başka satır varsa → `<strong>` yapılır. Sizin örnekte "Ürün Özellikleri" kalın olur; "Bel Tipi: Yüksek Bel" gibi satırlar normal kalır. "Model Bilgileri :" gibi `:` ile biten tek başına satırlar da kalın olur.
- Veritabanında hiçbir şey değişmez, migration yok. Elle girilmiş eski ürünler anında düzgün görünür.

### B) Admin'de zengin metin editörü — kalınlık korunur
Textarea yerine **TipTap** tabanlı küçük bir editör (`description-editor.tsx`):
- Yapıştırınca kalın, italik, madde listesi, paragraflar **korunur**. Google Docs/Word/Koton'dan gelen `font-weight:700` span'leri de kalın olarak tanınır (TipTap Bold eklentisi bunu yapıyor; Google Docs'un her şeyi `<b style="font-weight:normal">` ile sarma tuhaflığını da doğru ele alıyor).
- Araç çubuğu: **K** (kalın), *İ* (italik), madde listesi, numaralı liste, "Biçimi temizle". Ctrl+B / Ctrl+I çalışır.
- Başlık (`h1–h6`) olarak yapıştırılanlar kalın paragrafa çevrilir (sitede ayrı başlık stili istemiyoruz, mevcut `[&>strong]:block` stili zaten kalın satırı başlık gibi gösteriyor).
- Koton HTML'li açıklamalar editörde artık ham etiket değil, biçimli görünür. Eski düz metin açıklamalar editöre `plainTextToHtml` ile çevrilerek yüklenir.
- Kayıtta sunucu tarafı `sanitizeDescriptionHtml` ile temizlenir (XSS koruması aynen devam).
- TipTap **sadece admin sayfasında** yüklenir; müşteri tarafı paket boyutu ve Vercel function boyutu etkilenmez.

Neden TipTap: React 19 / Next 16 ile uyumlu, yapıştırma temizliği hazır, bakımı yapılan standart çözüm. Kendi `contentEditable` editörümüzü yazmak Word/Docs yapıştırma tuhaflıkları yüzünden hataya açık.

## Claude Code için Prompt

> Ürün açıklaması iki sorun var: (1) admin'de textarea'ya satır satır yapıştırılan açıklama, ürün detay sayfasında tek paragraf düz metin olarak görünüyor; (2) kopyalanan kaynaktaki kalın başlıklar yapıştırınca kayboluyor. Detaylar ve kök neden: `URUN_ACIKLAMASI_BICIMLENDIRME_PLANI.md`. Önce bu dosyayı oku. Yüklü skill'leri (karpathy-guidelines) kullan, cerrahi değişiklik yap.
>
> **1. Görüntüleme düzeltmesi — `src/lib/description-html.ts`**
> - `export function plainTextToHtml(text: string): string` ekle: `\r\n` → `\n`; metni HTML-escape et (`& < > "`); boş satırlarla (`/\n\s*\n/`) bloklara böl; her bloğu `<p>` yap, blok içindeki tek `\n`'ler `<br>` olsun. Başlık sezgisi: bir bloğun ilk satırı `trim` sonrası ≤ 40 karakter, `.` ile bitmiyor ve blokta ondan sonra en az bir satır daha varsa, o satırı `<strong>` ile sar; ayrıca tek başına bir satır `:` ile bitiyorsa (örn. "Model Bilgileri :") ve ardından satır geliyorsa onu da `<strong>` yap. "Anahtar: Değer" satırlarını (iki nokta sonrası metin olan) kalın YAPMA.
> - `export function looksLikeHtml(raw: string): boolean` → `/<\/?(p|br|strong|b|em|i|u|ul|ol|li|span|div|h[1-6])\b/i` testi.
> - `sanitizeDescriptionHtml` içinde: girdi `looksLikeHtml` değilse önce `plainTextToHtml` uygula, sonra mevcut sanitize'dan geçir. sanitize-html ayarına `transformTags` ekle: `h1–h6` → `strong`; `div` → `p`. `ALLOWED_TAGS`'e dokunma. Bu dosya müşteri sayfasından çağrıldığı için **cheerio veya ağır bağımlılık ekleme**.
> - `descriptionToPlainText` aynen kalsın (meta description için doğru çalışıyor).
>
> **2. Admin zengin metin editörü**
> - Kur: `@tiptap/react @tiptap/pm @tiptap/starter-kit` (v3). Başka eklenti kurma.
> - `src/components/admin/description-editor.tsx` (`"use client"`) oluştur. Props: `name: string`, `defaultValue: string`, `required?: boolean`. `useEditor({ extensions: [StarterKit.configure({ heading: false, code: false, codeBlock: false, blockquote: false, horizontalRule: false, strike: false })], content: <başlangıç>, immediatelyRender: false })`. Başlangıç içeriği: `looksLikeHtml(defaultValue) ? defaultValue : plainTextToHtml(defaultValue)`.
>   - Heading kapalı olduğu için yapıştırılan `<h1–h6>` içeriği kalın paragraf olarak gelsin: `editorProps.transformPastedHTML` ile `<hN ...>…</hN>` → `<p><strong>…</strong></p>` dönüştür.
>   - Editör içeriğini `onUpdate` ile state'e al ve `<input type="hidden" name={name} value={html} />` olarak forma bas. Editör boşsa (`editor.isEmpty`) değer `""` olsun.
>   - `required` ise: form submit'inde boşsa gönderimi engelleyip editörün altında kırmızı "Açıklama gerekli" mesajı göster (hidden input `required` çalışmaz).
>   - Araç çubuğu (lucide-react ikonları: `Bold`, `Italic`, `List`, `ListOrdered`, `RemoveFormatting`): aktif durumda buton vurgulu olsun. Butonlar `type="button"`.
>   - Görünüm: mevcut admin `inputClass` ile aynı çerçeve/rounded/focus stili; içerik alanı `min-h-[220px]`, kaydırılabilir `max-h-[520px] overflow-y-auto`, `text-sm leading-relaxed`; içerik içinde `[&_p]:mb-3 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5`. Editör mount olana kadar aynı yükseklikte bir iskelet göster ki sayfa zıplamasın.
> - `src/app/(admin)/admin/urunler/[id]/page.tsx` ve `yeni/page.tsx`: açıklama `<textarea>`'larını `<DescriptionEditor name="description" defaultValue={...} />` ile değiştir (yeni sayfada `required`). Server action'larda (`updateProduct` ve yeni ürün oluşturma) `description`'ı DB'ye yazmadan önce `sanitizeDescriptionHtml(...)`'dan geçir.
> - Admin'de açıklama değişince mevcut "kaydedilmemiş değişiklik" (SaveBar / `use-dirty-signal.ts`) mekanizması tetikleniyor mu kontrol et; textarea ile tetikleniyorsa editörde de tetiklensin (hidden input'a `input` event'i dispatch etmek yeterli olabilir, mevcut koda bak).
>
> **3. Doğrulama**
> - `description-html.ts` için küçük bir test dosyası yaz (`src/lib/description-html.test.ts`, `tsx --test` ile çalıştır): aşağıdaki örnek metin düz metin olarak verildiğinde çıktıda "Ürün Özellikleri" `<strong>` içinde, "Bel Tipi: Yüksek Bel" `<strong>` DEĞİL, satırlar `<br>` ile ayrılmış ve paragraflar ayrı `<p>` olmalı; HTML girdisi (Koton tarzı `<p><strong>…`) aynen korunmalı; `<script>` temizlenmeli; `<h3>Başlık</h3>` → `<strong>Başlık</strong>`.
>   ```
>   Denim şort, yüksek bel tasarımı ... kolaylaştırıyor.
>
>   Ürün Özellikleri
>   Bel Tipi: Yüksek Bel
>   Fit: Skinny
>   Kumaş: %81 Pamuk, %1 Elastan, %18 Lyocell
>
>   Dış : %1 ELASTAN, %18 LYOCELL, %81 PAMUK
>   Model Bilgileri :
>   Boy: 181 / Bel: 58 / Göğüs: 78 / Kalça: 89
>   ```
> - `npm run lint`, `npx tsc --noEmit` ve `npm run build` hatasız geçsin. Build çıktısında müşteri ürün sayfası (`/urunler/[slug]`) boyutunun artmadığını kontrol et (TipTap yalnızca admin chunk'ında olmalı).
>
> **4. Proje kuralları**
> Değişiklikleri önce localhost'ta göreceğim (`npm run dev`). Ben onaylayınca YEREL commit at, **ben söylemeden push etme**. İş bitince `DEPLOY_STATUS.md`'ye not düş.

## Test Listesi (localhost'ta)

- Daha önce elle yapıştırdığınız (ekran görüntüsündeki) ürünün sayfasını aç: paragraflar ayrı, satırlar alt alta, "Ürün Özellikleri" kalın mı?
- Koton'dan otomatik açıklaması gelmiş bir ürün: sitede görünüm bozulmadı mı? Admin'de artık `<p>` etiketleri yerine biçimli metin mi görünüyor?
- Koton sitesinden açıklamayı kopyala → admin editörüne yapıştır: kalın başlıklar kalın geldi mi? Kaydet → sitede de kalın mı?
- Word veya Google Docs'tan kalın başlıklı bir metin yapıştır → her şey kalın olmadan, sadece başlıklar kalın mı geldi?
- Araç çubuğundaki K / İ / liste butonları ve Ctrl+B çalışıyor mu?
- "Yeni Ürün"de açıklama boşken kaydet → "Açıklama gerekli" uyarısı çıkıyor mu?
- Açıklamayı değiştirince "kaydedilmemiş değişiklik" çubuğu çıkıyor mu?
- Ürün sayfasında "Devamını Oku / Daha Az Göster" hâlâ düzgün çalışıyor mu?
