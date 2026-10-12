# Google "bollmark" Arama Sonuçları — Düzeltme Planı

Tarih: 5 Ekim 2026
Durum: uygulandı (2026-10-13). Bölüm 6 uygulandı, önizleme kapısı kapatıldı, canlıda doğrulandı; Search Console adımları da aynı gün tamamlandı. (Bölüm 5 eskidir, bölüm 6 kullanıldı.)
Sorun: Google'da "bollmark" araması yapınca ana sonuç "BOLLMARK — Çok yakında" başlığıyla çıkıyor. Alt linklerde (sitelinks) "Sepetiniz Boş" ve "Çok yakında" gibi alakasız sayfalar var, ürünler hiç görünmüyor.

---

## 1. Neden böyle görünüyor? (Teşhis)

| Görünen | Gerçek sebep |
|---|---|
| Ana sonuç "BOLLMARK — Çok yakında" | Önizleme kapısı açıkken proxy **her adreste** (ana sayfa dahil) yapım aşamasında sayfasını gösteriyordu. Google ana sayfayı o dönemde taradı ve o kopyayı saklıyor. Kodda ana sayfa metadata'sı zaten düzgün ("Bollmark \| Modern Giyim"); Google henüz yeniden taramadı. |
| "Çok yakında — COMINGSOON" alt linki | `/yapim-asamasinda` sayfası kapı kapalıyken de herkese açık, 200 dönüyor ve `noindex` yok. Google bunu ayrı bir sayfa olarak dizinde tutuyor. |
| "Sepetiniz Boş" alt linki | `/sepet` Google tarafından robots.txt'e engel eklenmeden önce dizine alındı. Şimdi robots.txt `/sepet`'i engellediği için Google sayfayı **tekrar açıp kaldıramıyor** (yaygın bir tuzak: robots engeli dizinden çıkarmaz, sadece taramayı durdurur). Sepet sayfasında `noindex` de yok. Aynı risk `/hesap`, `/odeme`, `/siparis-durumu` için de geçerli. |
| "Kadın/Erkek Koleksiyonu" açıklaması "...keşfedin." | `catalog-page.tsx` içindeki cinsiyet açıklaması tek cümlelik kalıp metin. |
| Ürünler hiç görünmüyor | Site yaklaşık 2 haftadır açık. Ürün sayfaları ya henüz taranmadı ya da Search Console'da "Tarandı – şu an dizine eklenmedi" durumunda. Ayrıca açıklamaların Koton ile aynı olması (kopya içerik) dizine eklenmeyi yavaşlatıyor. |
| Alt linklerin seçimi | Sitelinks'i Google otomatik seçer, biz doğrudan seçemeyiz. Ama gereksiz sayfaları dizinden çıkarıp menü/iç linkleri net tutarak Google'ı doğru sayfalara yönlendirebiliriz. |

---

## 2. Kod tarafı (Claude Code yapacak)

1. **Yapım aşamasında sayfası:** Kapı kapalıyken (`PREVIEW_GATE=off` ya da `PREVIEW_PASSWORD` yok) `/yapim-asamasinda` adresi **301 ile `/`'a** yönlensin. Kapı açıkken de sayfa her zaman `robots: noindex, nofollow` taşısın. Böylece ileride kapı tekrar açılırsa Google'daki sonuçlar yeniden "Çok yakında" ile kirlenmez.
2. **Sepet / hesap / ödeme / sipariş durumu:** Bu sayfalara `noindex` eklensin. Sepet client component olduğu için ya `sepet/layout.tsx` metadata'sıyla ya da `next.config.mjs` `headers()` içinde `X-Robots-Tag: noindex` ile yapılmalı. Sonra robots.txt'ten `/sepet`, `/hesap`, `/odeme` engelleri **kaldırılsın** ki Google sayfaya girip `noindex`'i görebilsin ve sayfayı dizinden atsın. `/admin` ve `/api/` engeli kalsın.
3. **Koleksiyon açıklamaları:** Cinsiyet sayfaları (/kadin, /erkek, /cocuk, /unisex) için tek cümlelik kalıp yerine 140–160 karakterlik özgün açıklamalar yazılsın. Örnek: "Bollmark kadın koleksiyonu: elbise, gömlek, triko ve pantolonda sezonun yeni parçaları. Karacabey mağazamızda ve online, 14 gün iade." Kategori açıklaması boşsa kullanılan kalıp metin de zenginleştirilsin.
4. **Ana sayfa başlığı (öneri):** "Bollmark | Modern Giyim" yerine marka ile yerel aramayı birleştiren bir başlık: **"Bollmark | Kadın & Erkek Giyim – Karacabey"**. Bu karar senin; prompta seçenek olarak eklendi.
5. **Doğrulama:** localhost'ta `curl -I` ile `/yapim-asamasinda` adresinin 301 döndüğünü ve `/sepet` yanıtında noindex olduğunu göster. robots.txt çıktısını göster.

## 3. Senin yapacakların (kod dışı, deploy'dan sonra)

1. **Google Search Console** (search.google.com/search-console). Domain mülkü yoksa DNS TXT kaydıyla ekle (Cloudflare'de 1 dakika).
2. **Site haritaları** → `https://bollmark.com/sitemap.xml` gönder.
3. **URL Denetleme** → `https://bollmark.com/` yaz → "Dizine eklenmesini iste". Bu adım "Çok yakında" başlığını genelde birkaç gün içinde düzeltir. Aynısını /kadin, /erkek ve 4–5 ürün sayfası için de yap (günlük sınır yaklaşık 10).
4. **Kaldırmalar** → "Yeni istek" → `https://bollmark.com/yapim-asamasinda` ve `https://bollmark.com/sepet` için geçici kaldırma iste. Yaklaşık 6 ay gizler; bu sürede noindex/301 sayfaları kalıcı olarak düşürür.
5. **Sayfalar raporu** → "Dizine eklenmedi" listesinde eski siteden kalan adresleri bul. 404 olanlar zamanla kendiliğinden düşer. Hızlandırmak için listeyi bana gönder; eski adresleri 410 (kalıcı olarak silindi) ya da uygun yeni sayfaya 301 yaptıralım.
6. **Google İşletme Profili:** Karacabey mağazası için aç ya da sahiplen, web sitesi olarak bollmark.com yaz. Marka aramasında sağ tarafta harita/mağaza paneli çıkmasını sağlar.

## 4. Beklenti

- Ana sonuç başlığının düzelmesi: dizine ekleme isteğinden sonra genelde 2–7 gün.
- "Sepetiniz Boş" ve "Çok yakında" alt linklerinin kaybolması: kaldırma isteğiyle 1–2 gün, kalıcı olarak 2–4 hafta.
- Ürünlerin aramada görünmesi: haftalar sürer. Asıl hızlandırıcılar özgün ürün açıklamaları (SEO_TEKNIK_DENETIM_VE_PLAN.md Faz 6) ve Merchant Center ücretsiz listelemeler (feed hazır).

---

## 5. Claude Code promptu

```
GOOGLE_ARAMA_SONUCLARI_DUZELTME_PLANI.md dosyasını oku ve bölüm 2'yi uygula. Yüklü skill'leri kullan (karpathy-guidelines: cerrahi, minimum değişiklik).

1. src/proxy.ts: Önizleme kapısı devre dışıyken (PREVIEW_GATE=off veya PREVIEW_PASSWORD tanımsız; guardPreview'daki mantıkla aynı koşul, ortak bir isPreviewGateActive() yardımcısına çıkar) PREVIEW_GATE_PATH isteği 301 ile "/"'a yönlensin. Kapı aktifken bugünkü davranış aynen kalsın.
2. src/app/(gate)/yapim-asamasinda/page.tsx metadata'sına robots: { index: false, follow: false } ekle.
3. Sepet, hesap (tüm alt sayfalar), ödeme (basarisiz/tesekkurler dahil) ve siparis-durumu sayfalarına noindex ekle. Client component olanlar için ya o klasöre yalnız metadata export eden bir layout.tsx koy ya da next.config.mjs headers() ile X-Robots-Tag: "noindex, nofollow" ver. Hangisini seçtiğini ve nedenini söyle. Sepet sayfasının başlığı "Sepetim" olsun.
4. src/app/robots.ts: disallow listesinden "/hesap", "/odeme", "/sepet" satırlarını kaldır (Google'ın sayfaya girip noindex'i görebilmesi için; nedenini yoruma yaz). "/admin", "/api/" ve filtre parametresi engelleri aynen kalsın.
5. src/components/catalog-page.tsx catalogMetadata: cinsiyet sayfaları için kalıp "Bollmark X koleksiyonunu keşfedin." yerine cinsiyete özel 140-160 karakterlik açıklamalar kullan (Kadın, Erkek, Çocuk, Unisex için birer metin; yalnız o cinsiyette gerçekten ürünü olan ana kategorilerin adlarını DB'den çekip metne en fazla 4 tane yerleştir, uydurma kategori yazma). Kategori metaDescription boşken kullanılan kalıp metni de "{label} modelleri Bollmark'ta: sezonun yeni parçaları, kolay iade ve hızlı kargo." gibi daha bilgilendirici yap. Uzunluğu mevcut truncateDescription ile sınırla.
6. Ana sayfa title: şimdilik değiştirme. Bana iki seçenek sun ("Bollmark | Modern Giyim" mevcut, "Bollmark | Kadın & Erkek Giyim – Karacabey" öneri). Ben seçince uygularsın.

Doğrulama (localhost, production build: npm run build && npm start):
- curl -I http://localhost:3000/yapim-asamasinda → 301, Location: /
- curl -s http://localhost:3000/sepet | grep -i "noindex" (veya curl -I ile X-Robots-Tag)
- curl -s http://localhost:3000/robots.txt çıktısı
- /kadin ve /erkek <head> içindeki title ve description

Bitince bana göster. Onayımdan sonra önce DEPLOY_STATUS.md'ye not düş, sonra yerel commit at. Ben söylemeden push etme.
```

---

## 6. Güncelleme (13 Ekim 2026): kapı kapanıyor, prompt yenilendi

**Karar:** Kullanıcı önizleme kapısının şimdi kapatılmasını istedi. Kapı açıkken Google hangi adrese girerse girsin "Çok yakında" içeriğini görüyordu (`proxy.ts` her mağaza adresini `/yapim-asamasinda`'ya rewrite ediyor, 200 dönüyor). Kapı kapanmadan bu plandaki hiçbir düzeltme işe yaramazdı.

**Bölüm 2 maddesi 1'de değişiklik (önemli):** Gate sayfasının `metadata`'sına `noindex` **eklenmeyecek**. Kapı ileride tekrar açılırsa bütün mağaza adresleri bu sayfaya rewrite edildiği için `noindex` tüm siteye bulaşır ve bollmark.com Google'dan tamamen düşer. Bunun yerine:
- Kapı kapalıyken: `/yapim-asamasinda` → 301 `/`.
- Kapı açıkken: yalnız `/yapim-asamasinda` adresine **doğrudan** gelen istekte `X-Robots-Tag: noindex` başlığı verilir. Rewrite edilen mağaza adreslerine bu başlık verilmez.

**Kapıyı kapatma:** Vercel production env'inde `PREVIEW_GATE=off` yapılır ve redeploy edilir (env değişikliği otomatik yansımaz). `PREVIEW_PASSWORD` silinmez, ileride kapıyı tekrar açmak için `PREVIEW_GATE`'i silmek ya da `on` yapmak yeterli olur. Bu adım kod değişiklikleriyle **aynı push'ta** yapılır, böylece site açıldığı anda yönlendirme ve `noindex`'ler hazır olur.

**Site açılınca dikkat:** iyzico canlıda. Açılıştan itibaren gerçek sipariş ve ödeme gelebilir.

### Prompt (bölüm 5'in yerine bunu kullan)

```
Bollmark projesinde docs/planlar/GOOGLE_ARAMA_SONUCLARI_DUZELTME_PLANI.md dosyasını baştan sona oku; bölüm 6 bölüm 5'in yerine geçer. Yüklü skill'leri kullan (karpathy-guidelines: cerrahi, minimum değişiklik). Önce DEPLOY_STATUS.md'yi oku.

1. src/proxy.ts: guardPreview'daki "kapı devre dışı mı" koşulunu (PREVIEW_GATE=off veya PREVIEW_PASSWORD tanımsız) küçük bir isPreviewGateActive() yardımcısına çıkar, guardPreview de onu kullansın. Proxy'de PREVIEW_GATE_PATH için şu an yapılan erken NextResponse.next() dalını değiştir:
   - kapı devre dışıysa: 301 ile "/"'a yönlendir;
   - kapı aktifse: sayfayı göster ama yanıta X-Robots-Tag: "noindex, nofollow" başlığı ekle.
   guardPreview'ın mağaza adreslerini gate'e rewrite ettiği yanıta bu başlığı EKLEME. yapim-asamasinda/page.tsx metadata'sına robots/noindex EKLEME (nedeni planın 6. bölümünde; koda kısa yorum yaz).
2. Sepet, hesap (tüm alt sayfalar, giriş dahil), ödeme (basarisiz/tesekkurler dahil) ve siparis-durumu sayfalarına noindex ekle. Client component olanlar için ya klasöre yalnız metadata export eden bir layout.tsx koy ya da next.config.mjs headers() ile X-Robots-Tag ver; hangisini neden seçtiğini söyle. Sepet sayfasının başlığı "Sepetim" olsun.
3. src/app/robots.ts: "*" kuralının disallow listesinden "/hesap", "/odeme", "/sepet" satırlarını kaldır (Google sayfaya girip noindex'i görebilsin diye; yoruma yaz). "/admin", "/api/", filtre parametresi engelleri, allow satırları ve AI_BOTS kuralı AYNEN kalsın.
4. src/components/catalog-page.tsx catalogMetadata: cinsiyet sayfaları için kalıp "Bollmark X koleksiyonunu keşfedin." yerine cinsiyete özel 140-160 karakterlik açıklama üret: o cinsiyette gerçekten yayında ürünü olan ana kategorilerden en fazla 4 tanesinin adını metne yerleştir (uydurma kategori yazma; sorgu katalogdaki mevcut önbellekli veriden ya da unstable_cache ile yapılsın, CPU planına uy). Kategori metaDescription boşken kullanılan kalıbı da "{label} modelleri Bollmark'ta: sezonun yeni parçaları, kolay iade ve hızlı kargo." gibi daha bilgilendirici yap. truncateDescription ile sınırla.
5. Ana sayfa title: değiştirme; localhost raporunda bana iki seçenek sun ("Bollmark | Modern Giyim" mevcut, "Bollmark | Kadın & Erkek Giyim – Karacabey" öneri). Ben seçersem uygularsın.

Doğrulama (localhost, npm run build && npm start):
- .env.local'de kapı aktifken: / ve /urunler gate içeriğini gösteriyor ve X-Robots-Tag YOK; /yapim-asamasinda 200 + X-Robots-Tag noindex.
- PREVIEW_GATE=off ile: curl -I /yapim-asamasinda → 301 Location: /; anasayfa ve bir ürün sayfası normal açılıyor.
- /sepet, /hesap/giris, /odeme, /siparis-durumu yanıtlarında noindex (meta ya da başlık) var; bir ürün ve bir kategori sayfasında YOK.
- /robots.txt çıktısı; /kadin ve /erkek <head> title + description.
- tsc, lint, build temiz.

Bitince docs/gunluk/2026-10.md'ye not düş, bana localhost'ta neye bakacağımı söyle ve onayımı bekle. Onayımdan sonra önce DEPLOY_STATUS.md'yi güncelle, sonra yerel commit at.

PUSH ve KAPIYI KAPATMA (yalnız ben "push et" dediğimde, sırayla):
a) Vercel production env'inde PREVIEW_GATE=off yap (vercel env; varsa önce mevcut değeri kontrol et, PREVIEW_PASSWORD'e dokunma, değerleri hiçbir yere yazdırma).
b) git push (main'e push deploy tetikler; env bu deploy'a dahil olur). Push'tan önce env'in eklendiğini `vercel env ls` ile doğrula.
c) Deploy bitince canlıda doğrula: https://bollmark.com/ cookie'siz açılınca mağaza görünüyor, /yapim-asamasinda 301, /robots.txt yeni hali, bir ürün sayfası 200.
d) DEPLOY_STATUS.md "Önizleme kapısı" satırını "kapalı (2026-10-13), site herkese açık; tekrar açmak için PREVIEW_GATE env'ini sil/on yap + redeploy" olarak güncelle, plan dosyasının durumunu "kod uygulandı, kullanıcının Search Console adımları bekliyor" yap, yerel commit at (yalnız .md, deploy tetiklemez) ve push et.
```

### Push'tan sonra senin yapacakların (bölüm 3, kısaltılmış)
1. Search Console: mülk yoksa ekle, `sitemap.xml` gönder.
2. URL Denetleme: `/`, `/kadin`, `/erkek` ve 4–5 ürün sayfası için "Dizine eklenmesini iste".
3. Kaldırmalar: `/yapim-asamasinda` ve `/sepet` için geçici kaldırma.
4. Google İşletme Profili (Karacabey mağazası, web sitesi: bollmark.com).
