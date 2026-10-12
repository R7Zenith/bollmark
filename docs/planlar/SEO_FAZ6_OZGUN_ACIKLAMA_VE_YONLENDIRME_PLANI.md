# SEO Faz 6: özgün ürün açıklamaları + ürün yönlendirmeleri

**Tarih:** 13 Ekim 2026
**Durum:** Devam ediyor (kod yazıldı, şema uygulandı; taslaklar API'siz, Claude Code oturumunda yazıldı ve admin'de onay bekliyor, bkz. docs/gunluk/2026-10.md)
**Plandan sapma (kullanıcı kararı, 13 Ekim 2026):** API anahtarı alınmayacak. Bölüm A2-A3'teki Anthropic API çağrısı, `scripts/ai-aciklama-uret.ts` ve A4'teki "AI ile özgün açıklama üret" butonu kaldırıldı. Taslaklar Claude Code oturumunda yazılıp `scripts/ai-taslak-aktar.ts` ile kaydedilir; kalite kontrolü, taslak/onay akışı ve Bölüm B aynen geçerli.
**Kaynak:** SEO_TEKNIK_DENETIM_VE_PLAN.md, madde 2.3 (kopya içerik) ve 2.12 (stok ve silinen ürün politikası)
**Ön koşul:** GOOGLE_ARAMA_SONUCLARI_DUZELTME_PLANI.md uygulanmış ve site açılmış olmalı. Teknik olarak bağımsızdır, sıra yalnız öncelik içindir.

## 1. Neden

- **Kopya içerik:** Ürün açıklamaları tedarikçi sitelerindeki metinle birebir aynı. Google aynı metni birden çok sitede görünce orijinal kaynağı gösterir, kopyaları filtreler. Bollmark'ın ürün sayfalarının aramada görünmemesinin en büyük nedeni bu.
- **Kırık ürün adresleri:** Arşivlenen ürün şu an 404 veriyor. Slug değişince eski adres de 404 oluyor. Google'daki ve paylaşılmış linkler kırılıyor, sayfanın biriktirdiği değer kayboluyor.

## 2. Kullanıcı kararları

- **Açıklamalar: toplu taslak + ürün başına buton.** Mevcut tüm ürünlere bir kerede **taslak** üretilir. Taslak kullanıcı onaylayana kadar sitede görünmez. Admin'de her ürün için ayrıca "AI ile özgün açıklama üret" butonu olur (yeni ürünler ve yeniden üretme için).
- Hiçbir açıklama onaysız yayına çıkmaz.

## 3. Bölüm A: Özgün açıklamalar

### A1. Veri modeli (`prisma/schema.prisma`, `npm run db:push`)

`Product` modeline üç alan eklenir. Hepsi boş bırakılabilir, mevcut satırlara dokunulmaz:
- `descriptionDraft String?`: onay bekleyen AI taslağı.
- `originalDescription String?`: tedarikçinin ilk metni. İlk taslak üretilirken bir kez doldurulur, sonra değişmez. Geri dönmek ve AI'ya kaynak olarak vermek için tutulur. Sitede gösterilmez.
- `descriptionApprovedAt DateTime?`: özgün açıklamanın onaylandığı zaman. "Bu ürün tamam" işareti olarak kullanılır.

**Not:** DB localhost ile canlı arasında ortak. `db push` canlıya anında uygulanır. Yalnız yeni ve boş bırakılabilir alanlar eklendiği için mevcut site etkilenmez. Yine de push öncesi `prisma db push` çıktısında **veri kaybı uyarısı olmadığı** kontrol edilir. Uyarı varsa durulur.

### A2. Üretim (`src/lib/ai-description.ts`)

- Anthropic API, projede zaten kullanılan yöntemle çağrılır (`ANTHROPIC_API_KEY`, `lib/category-suggest.ts`'teki çağrı biçimi). Yeni paket gerekmez. Model: `claude-sonnet-5-5` (Türkçe metin kalitesi için). Model adı tek bir sabitte tutulur.
- **AI'ya verilen bilgiler:** ürün adı, marka, kategori, cinsiyet, renkler (varyantlardan), materyal, menşe, bakım talimatı, etiketler ve `originalDescription` (yoksa mevcut `description`). Mevcut açıklama yalnızca **bilgi kaynağıdır**, cümleleri kopyalanmaz.
- **Çıktı:**
  - 2–3 cümlelik özgün giriş paragrafı: nerede ve nasıl giyilir, neyle kombinlenir, kumaşın hissi.
  - Ardından madde işaretli kısa bir özellik listesi: kumaş, kalıp, yaka, kol, cep gibi, **yalnız verilen bilgilerden**.
  - Toplam yaklaşık 60–120 kelime, Türkçe, sade ve samimi bir mağaza dili.
  - Biçim, admin açıklama editörünün kaydettiği biçimle aynı olur. Claude Code mevcut `description` değerlerine ve `description-editor.tsx`'e bakıp uyar. Ürün sayfasında, JSON-LD'de ve Merchant feed'de mevcut kodla doğru görünmeli.
- **Kurallar** (sistem talimatına yazılır):
  - Verilmeyen bir bilgi uydurulmaz: kumaş oranı, ölçü, "su geçirmez" gibi iddialar yazılmaz.
  - "En iyi", "1 numara" gibi abartılar ve sağlık iddiaları yazılmaz.
  - Fiyat, indirim, stok ve kargo süresi yazılmaz, bunlar değişir.
  - Tedarikçi sitesi ya da başka mağaza adı (ör. "koton.com") geçmez. Marka adı yalnız ürünün marka alanında yazdığı gibi kullanılır. Kodda müşteriye marka göstermeyle ilgili mevcut bir kural varsa (KOTON_IBARELERI_KALDIRMA çalışması) ona uyulur.
  - Kaynak metinden 6 kelimeden uzun bir öbek aynen alınmaz.
- **Basit kalite kontrolü:** Çıktı boşsa, 40 kelimeden kısaysa ya da kaynak metinle büyük örtüşme varsa (aynı 8 kelimelik öbek) taslak kaydedilmez, hata olarak raporlanır.
- 429/529 hatalarında bekleyip tekrar denenir (en fazla 3 kez). API anahtarı yoksa açık bir hata mesajı döner.

### A3. Toplu taslak scripti (`scripts/ai-aciklama-uret.ts`)

- Varsayılan `--dry-run`: kaç ürünün işleneceğini gösterir, API'ye istek atmaz.
- `--uygula`: yalnız `descriptionDraft` yazar (ve boşsa `originalDescription`'ı bir kez doldurur). **`description` alanına asla dokunmaz.**
- Seçim: önce yayındaki ürünler, sonra taslak durumdakiler. `descriptionApprovedAt` dolu olan ya da zaten taslağı bulunan ürünler atlanır, böylece script kaldığı yerden devam eder. Arşivliler atlanır.
- `--limit N`, `--urun <kod|slug>`, eşzamanlılık 2.
- Bitince rapor yazar: üretilen, atlanan ve hatalı ürün sayısı, toplam token kullanımı ve tahmini maliyet. Rapor `scripts/output/ai-aciklama-<zaman>.json` dosyasına gider.
- **Önce 3 üründe deneme:** kullanıcı localhost'ta okuyup onaylar, sonra tümü çalıştırılır.

### A4. Admin

- **Ürün düzenleme sayfası,** açıklama editörünün yanında:
  - "AI ile özgün açıklama üret" butonu taslak üretir ve kaydeder. Mevcut taslak varsa üzerine yazmadan önce sorar.
  - Taslak varsa mevcut açıklamanın yanında **yan yana** gösterilir, iki buton bulunur:
    - **Kullan:** `description = descriptionDraft`, `descriptionDraft = null`, `descriptionApprovedAt = now`, ardından `revalidateCatalog`.
    - **Vazgeç:** `descriptionDraft = null`.
  - Taslak, kullanmadan önce elle düzenlenebilmeli. Basit bir textarea ya da mevcut editör yeterli.
  - `originalDescription` doluysa "Orijinal metne dön" bağlantısı olur.
- **Ürün listesi:**
  - Yeni filtre: "Açıklama: taslak bekliyor / onaylı / tedarikçi metni".
  - Toplu işlem çubuğuna "Taslakları onayla" eklenir. Seçili ürünlerde taslağı olanlara "Kullan"ın yaptığını yapar ve tek bir `revalidateCatalog` çağırır.
- Yetki: mevcut ürün düzenleme yetkisiyle aynı. Denetim kaydına (audit log) "AI açıklaması onaylandı" yazılır.

### A5. Ne değişmez

- Excel aktarımı yeni ürünleri tedarikçi metniyle oluşturmaya devam eder. Yeni ürünler filtrede "tedarikçi metni" olarak görünür, buton ya da script ile taslak üretilir.
- Ürün adı ve başlık şablonu bu fazda değişmez.

## 4. Bölüm B: Ürün yönlendirmeleri

### B1. Veri modeli

Yeni bir model eklenir:
```prisma
model ProductRedirect {
  id        String   @id @default(cuid())
  fromSlug  String   @unique   // eski urun slug'i (decode edilmis haliyle)
  toPath    String             // hedef yol, ör. /urunler/yeni-slug veya /erkek/gomlek
  createdAt DateTime @default(now())
}
```

### B2. Ne zaman kayıt oluşur

- **Slug değişince** (admin ürün kaydı): eski slug → `/urunler/<yeni-slug>`. Eski slug'a işaret eden önceki kayıtların `toPath`'i de yeni adrese güncellenir, böylece zincir oluşmaz. Yeni slug için bir yönlendirme kaydı varsa silinir.
- **Ürün silinince:** slug → ürünün kategori sayfası (`catalogHref` ile). Kategori yoksa `/urunler`.
- **Arşivlenen ürün:** kayıt oluşmaz. Ürün sayfası, ürün PUBLISHED değilse kendi kategori sayfasına **301** yapar. Ürün tekrar yayına alınınca sayfa kendiliğinden geri gelir.
  - **İstisna:** DRAFT (hiç yayınlanmamış) ürün 404 kalır.

### B3. Nerede uygulanır

- `urunler/[slug]/product-page.tsx`: şu an `notFound()` çağrılan yerde önce ürün durumuna bakılır (arşiv ise 301). Ürün yoksa `ProductRedirect` tablosuna bakılır, kayıt varsa `permanentRedirect(toPath)`, yoksa `notFound()`. Aynı mantık renk rotasında da geçerli olur.
- **`proxy.ts`'te DB sorgusu yapılmaz** (CPU planı). Sorgu yalnız bulunamayan slug'larda çalışır, normal ürün sayfası ISR'dan gelmeye devam eder.
- Türkçe karakterli slug'lar için mevcut `decodeSlug` kullanılır.
- Sitemap ve Merchant feed zaten yalnız yayındaki ürünleri listeler, değişmez.

### B4. Kapsam dışı

- Eski siteden (2–3 yıl önceki) kalan adresler. Search Console'daki listeye bakıldıktan sonra ayrıca ele alınır (`next.config` redirects ya da ayrı tablo).
- Kategori slug değişiklikleri.

## 5. Test (localhost)

1. `db:push` çıktısında veri kaybı uyarısı yok. `npx tsc --noEmit`, `npm run lint`, `npm run build` ve `npm test` temiz.
2. **Script:**
   - `--dry-run` sayısı gösteriliyor.
   - `--uygula --limit 3` ile 3 ürüne taslak üretiliyor. Bu ürünlerin `description` alanı **değişmemiş**, canlı ürün sayfası aynı.
   - Token ve maliyet raporu var.
3. **Admin:**
   - Bir test ürününde buton taslak üretiyor, yan yana görünüyor, düzenlenip "Kullan" ile kaydediliyor ve ürün sayfasında ilk istekte yeni metin görünüyor.
   - "Vazgeç" taslağı siliyor.
   - "Orijinal metne dön" çalışıyor.
   - Liste filtresi ve "Taslakları onayla" toplu işlemi çalışıyor.
4. **Yönlendirme:**
   - Test ürününün slug'ı değişince eski adres 301 ile yeni adrese gidiyor. İki kez değişince zincir yok.
   - Arşivlenince 301 ile kategoriye gidiyor, yeniden yayınlanınca sayfa açılıyor.
   - Silinince 301 ile kategoriye gidiyor.
   - Türkçe karakterli slug'da da çalışıyor.
   - Var olmayan bir slug 404 veriyor.
   - Testler `curl -I` ile gösteriliyor.
5. **Test verisi:** Test ürünü canlı DB'de oluşturulursa test sonunda silinir. Yayındaki ürünlerde yalnız onaylanan açıklamalar değişir.

## 6. Claude Code prompt'u

```
Bollmark projesinde önce DEPLOY_STATUS.md'yi, sonra docs/planlar/SEO_FAZ6_OZGUN_ACIKLAMA_VE_YONLENDIRME_PLANI.md dosyasını baştan sona oku. Yüklü skill'leri (özellikle karpathy-guidelines) kullan; planda yazmayan dosyaya/davranışa dokunma.

Sırayla:
1. Bölüm A1 + B1: şema değişikliklerini yap. `npx prisma db push` çalıştırmadan önce bana ne ekleneceğini göster; DB canlıyla ORTAK. Çıktıda veri kaybı uyarısı varsa DUR.
2. Bölüm B (yönlendirmeler) ve A2–A4 (üretim kütüphanesi, script, admin) kodunu yaz. proxy.ts'e DB sorgusu ekleme.
3. Script'i önce --dry-run, sonra --uygula --limit 3 ile çalıştır. Bu 3 ürünün description alanının DEĞİŞMEDİĞİNİ göster, taslakları ve token/maliyet raporunu bana göster. Burada DUR: ben taslakların dilini ve doğruluğunu okuyup onaylamadan tüm ürünlere çalıştırma. Onaydan sonra kalanları çalıştır; hata olanları listele.
4. Planın 5. bölümündeki testleri yap ve sonuçları raporla. Test ürünü oluşturduysan sonunda sil.

API anahtarını ve başka secret'ları hiçbir yere yazdırma. Hiçbir ürünün description alanını kendin onaylama/değiştirme; onay benim (admin'den ya da "Taslakları onayla" ile).

Bitince docs/gunluk/2026-10.md'ye not düş, docs/planlar/README.md açık planlar tablosuna bu planı ekle/güncelle, bana localhost'ta neye bakacağımı söyle ve onayımı bekle. Onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at. Ben söylemeden push ETME.
```

## 7. Senin yapacakların (kod dışı)

- Toplu taslaklar üretildikten sonra admin'de "taslak bekliyor" filtresiyle ürünleri gözden geçir. İstersen birkaçını düzenle, sonra toplu onayla. Onaylanan açıklamalar anında sitede görünür.
- Onaydan 1–2 hafta sonra Search Console → Sayfalar raporunda dizine eklenen ürün sayısının artışını izle.
