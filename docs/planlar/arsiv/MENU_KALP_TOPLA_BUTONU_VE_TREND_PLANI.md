# Menü "Kalp Topla" Butonu + Trend Kalpler Planı

Tarih: 16 Kasım 2026
Durum: uygulandı (2026-11-16, bkz. DEPLOY_STATUS.md notu)

## Amaç
Üst menünün sonuna (Aksesuar'dan sonra) sürekli hareketli bir **KALP TOPLA** butonu eklemek. Buton `/kalp-topla` sayfasına gider; sayfanın en üstünde (hero'nun hemen altında) **"Trend kalpler — bu hafta en çok kalp alanlar"** bölümü görünür.

## Mevcut durum (koddan tespit)
- `/kalp-topla` sayfası var: `src/app/(site)/kalp-topla/page.tsx`. Bölümler: Hero → Nasıl çalışır? → Dolmak üzere (4) → En çok dolan ürünler (6) → SSS.
- Listeler `src/lib/kalp-topla/vitrin.ts` → `loadVitrin()` / `getVitrin(mode)` (60 sn `unstable_cache`).
- `KalpHeart` modelinde `@@index([productId, createdAt])` var → "son 7 günde en çok kalp alan" sorgusu için hazır indeks.
- Masaüstü menü: `site-header.tsx` → `DesktopNav` (link sınıfı: 10px, uppercase, tracking 1.4px). Mobil menü: aynı dosyada kök ekran listesi (Tüm Ürünler, Kadın, Erkek, Çocuk, Aksesuar, Giriş, Sepet).
- Header anasayfada şeffaf (`text-cream`, koyu hero üstünde), kaydırınca beyaz zemin → butonun renkleri iki durumda da okunmalı.
- Kampanya durumu istemcide `useKalpDurumDetay()` ile çözülüyor (`KalpVitrin` aynısını kullanıyor). Sayfa INVISIBLE'da 404 dönüyor.
- Kullanıcı kararı (9 Kasım 2026): animasyonlar `prefers-reduced-motion`'a bakmadan her durumda oynasın — aynı karar menü butonu için de geçerli.

## Kararlar / öneriler
1. **Görünürlük:** Buton yalnız kampanya `ACTIVE` iken görünür (FROZEN'da listeler gizli, INVISIBLE'da sayfa 404). Durum istemcide çözüldüğü için ISR'li header gizli yayını sızdırmaz.
2. **Animasyon (kombine, hafif):**
   - Yazı: "KALP TOPLA" metni pembe→kırmızı→mercan arasında yavaşça akan gradient (`background-clip:text`, ~4 sn döngü). Şeffaf header'da açık tonlar (#FFB3C1→#FF4D6D→#FFD1DC), beyaz header'da koyu tonlar (sale kırmızısı → #C2185B → sale).
   - Kalp ikonu: solunda küçük dolu kalp, ~2.4 sn'de bir "küt-küt" atar; her atışta etrafına 6 minik kalp/nokta patlar (scale+opacity, 600 ms) ve söner.
   - Sadece CSS keyframes + `transform/opacity` (GPU dostu), JS zamanlayıcı yok; sekme gizliyken tarayıcı zaten durdurur.
   - Hover'da patlama bir kez daha tetiklenir, gradient durmaz.
3. **Mobil:** Menü çekmecesinin kök listesinde Aksesuar'ın altına aynı animasyonlu satır (kalp + gradient yazı). Mobil üst barda ek ikon yok (kalabalık olmasın).
4. **Trend bölümü:** `vitrin.ts`'e `trend` listesi eklenir — ayrı cache anahtarı açılmaz, mevcut 60 sn'lik `getVitrin` içinde döner (Neon transferini artırmamak için tek sorgu turu).
   - Sorgu: `KalpHeart.groupBy({ by: ["productId"], where: { createdAt >= şimdi-7 gün, status in ["ACTIVE","WON"] }, _count, orderBy _count desc, take 30 })` → yayındaki, `kalpToplaExcluded=false` ürünlerle eşle → ilk 8.
   - Kart: mevcut `NearCard` stiline benzer; görsel, ad, "♥ 23 kalp bu hafta" rozeti ve mevcut bar ilerlemesi (points/threshold).
   - 3'ten az ürün varsa bölüm gizlenir (boş görünmesin).
   - Sıra: Hero → **Trend kalpler** → Nasıl çalışır? → Dolmak üzere → En çok dolan → SSS.
5. **Ölçüm:** Butona tıklamada GA4 `select_promotion` (promotion_name: "kalp_topla_menu") gönder — mevcut `lib/ga4.ts` yardımcıları varsa onlarla.

## Kabul kriterleri
- Masaüstünde Aksesuar'dan sonra animasyonlu "KALP TOPLA" görünür, şeffaf ve beyaz header'da okunaklı.
- Mobil çekmecede aynı satır var.
- Kampanya ACTIVE değilken buton hiç görünmez, layout kaymaz.
- `/kalp-topla`'da hero altında trend bölümü 7 günlük kalp sayısına göre sıralı.
- `npm run build`, lint ve mevcut testler geçer; localhost'ta kontrol edilir.
