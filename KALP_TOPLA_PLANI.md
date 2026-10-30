# Kalp Topla Kampanyası — Plan

Durum: Plan kesinleşti, uygulamaya hazır

(Plan 2026-10-29'da hazırlandı. T1–T17 ve Y1–Y15 kararlarının tamamı işlendi.)

Bu dosya yalnız plandır, kod yazılmadı. Uygulama ayrı bir görevde, fazlar halinde yapılacak.

---

## 1. Özet ve amaç

- **Ne:** "Kalp Topla — 10 kalp, yarı fiyat". Üye beğendiği ürüne kalp verir. Bir üründe 10 kalp
  dolunca o turda kalbi olan herkes hesabına %50'lik, 48 saat geçerli, tek ürünlük kupon kazanır.
  Davet linkiyle gelen ve e-postasını doğrulayan yeni üye, davet edenin barına +2 kalp ekler.
- **Amaç:** siteye ziyaretçi çekmek ve üye sayısını artırmak. Kalp verileri aynı zamanda ürün bazında
  talep verisi olarak raporlanır.
- **Teknik özet:**
  - Kampanya mevcut `Coupon` sistemine eklenmez. Kendi tablolarıyla ayrı bir modül olur (`src/lib/kalp-topla/`).
  - Sepet, ödeme ve sipariş tek bir fiyat fonksiyonunu (`priceCart`) kullanır (T17).
  - Siparişte kuponlu ürün adedi ayrı bir sipariş satırına bölünür ve kuponlu fiyatla yazılır.
  - Kampanyanın üç modu var: **Kapalı**, **Gizli yayın** (yalnız seçili test hesapları) ve **Açık** (Y10).
  - Favori butonu kampanyadan önce "Kaydet / Kaydedilenler"e (yer imi ikonu) dönüşür (T9).
  - Web push yalnız destekleyen tarayıcılarda (Android, masaüstü) sunulur. iPhone/iPad'de push yoktur (T15).

---

## 2. Kesinleşmiş kurallar

> Aşağıdaki kurallar kullanıcının kesinleşmiş kararlarıdır, metinleri değiştirilmedi. Sonradan "Teknik
> kararlar" (12. bölüm) ile ayrıntılanan ya da değişen yerlerin altına **→ Tn / Yn** notu düşüldü.
> Çelişki halinde not geçerlidir.

### Genel
- Kampanya adı: "Kalp Topla". Slogan: "10 kalp, yarı fiyat".
- Tek cümlelik anlatım: "Beğendiğin ürüne kalp ver, 10 kalp dolunca kalp verenler yarı fiyatına alsın."
- Müşteriye 3 adımlı anlatım: 1) Kalp ver: üye ol, beğendiğin ürünün kilidine katıl. 2) Arkadaşını çağır: senin linkinle gelen arkadaşın barına +2 kalp ekler. 3) %50'ni kap: bar dolunca kuponun hesabına gelir, 48 saat geçerli.
  - **→ Kullanıcı kararı (2026-10-30, Faz 4):** davet zorunluymuş gibi anlaşılmasın diye "Nasıl çalışır?" penceresinde 2. adım: "Bar birlikte dolar. Başka üyeler de kalp verdikçe bar dolar. Hızlandırmak istersen arkadaşını çağır, +2 kalp eklesin." Pencere üç animasyonlu görselle gösterilir.
- Kampanyanın amacı siteye ziyaretçi çekmek ve üye sayısını artırmak.

### Kapsam ve bar
- Bar tüm ürünlerde görünür. Admin panelinde ürün bazında "Kalp Topla dışı" seçeneği olacak. İşaretlenen üründe bar görünmez ve o ürüne kupon uygulanamaz. Varsayılan: tüm ürünler kampanyada.
  - **→ Y10:** "Gizli yayın" modunda bar ve tüm kampanya öğeleri yalnız seçili test hesaplarına görünür.
- Eşik 10 kalp. Eşik ve diğer kampanya değerleri admin panelinden ayarlanabilir olsun, varsayılan değerler bu plandakiler.
  - **→ T16:** Eşik değişikliği yalnız yeni başlayan turlara uygulanır. Açık turlar başladıkları eşikle devam eder.
- "Kalp" mevcut favori (wishlist) butonundan AYRI bir aksiyondur. Normal favori listesi sınırsız ve aynı şekilde çalışmaya devam eder. Kalp Topla için ayrı bir "Kalp ver" butonu olur.
  - **→ T9:** Favori butonu yer imi ikonuna ve "Kaydet / Kaydedilenler" adına geçer, verisi korunur. Kalp ikonu yalnız Kalp Topla'nındır.
- Kalp hakkı: her üye aynı anda en fazla 3 ürüne kalp verebilir. Bar dolunca ya da üye kalbini geri çekince o hak boşalır.
  - **→ T1:** "Bekliyor" durumundaki kalp de bir hak kullanır.
- Kalp geri çekme: üye, bar dolmadan kalbini geri çekebilir. Bu durumda o üyenin kalbi ve o üyeye ait davet bonusları o turdan düşer.
  - **→ Y8:** Kampanya kapalıyken (barlar donukken) de geri çekilebilir. Hak boşalır, donmuş barın sayısı azalır.
- Tur sistemi: bar 10'a ulaşınca (ya da davet bonusuyla 10'u geçince) o tur kapanır, kazananlara kupon verilir, bar sıfırlanır ve aynı üründe yeni tur başlar.
  - **→ Y5/Y11:** Tur eşiğe ulaşınca kapanır. Davet bonusunun eşiği aşan kısmı (ör. bar 9'dayken gelen +2'nin artan 1 kalbi) yanmaz: sahibinin bekleyen bonusuna döner, 30 günü baştan başlar ve Y5 kuralıyla dağıtılır.
- Tekrar katılım serbest: aynı üye aynı üründe sonraki turlara da katılabilir.
- Bar sayımı atomik olmalı: aynı anda gelen kalplerde çift sayım ya da çift tur kapanışı olmamalı (transaction/kilitleme).
- Üye olmayan ziyaretçi barı görür. "Kalp ver"e basınca "Üye ol, bu ürünün indirimini birlikte açalım" penceresi açılır. Üyelik/giriş sonrası aynı ürüne geri döner ve kalbi verilmiş olur.
  - **→ T1:** Kayıt sonrası kalp "bekliyor" olarak kaydedilir, e-posta doğrulanınca otomatik sayılır.
- Sayaca yalnızca e-postası doğrulanmış üyeler girer.
  - **→ T12/Y7:** En az bir ödenmiş siparişi (Y7 tanımı) olan mevcut üyeler doğrulanmış kabul edilir.

### Bar durum mesajları (ürün sayfası)
- 0 kalp: "İlk kalbi sen ver, %50'nin kilidini birlikte açalım"
- 1–7 kalp: "6/10 kalp · 4 kalp kaldı" (sayılar dinamik)
- 8–9 kalp: "Son 1 kalp! İstersen arkadaşını çağır, +2 eklesin" (sayılar dinamik)
- Bar doldu, kullanıcı katılımcıysa: "Kilit açıldı! Kuponun hesabında, 48 saat"
- Bar doldu, kullanıcı katılımcı değilse: "Bu tur doldu, yeni tur başladı"
- Barın yanında "Nasıl çalışır?" linki olur, tıklanınca 3 adımlı kısa pencere açılır.
- Ürün kartlarında (katalog) küçük bir bar/rozet gösterimi de planla, ama sayfa performansını bozmayacak şekilde.

### Davet
- Her üyenin davet linki olur. Ürün sayfasındaki "Arkadaşını çağır / Paylaş" butonu o ürüne bağlı link üretir. "Hesabım > Kalplerim" sayfasındaki genel davet linkinde üye, +2'nin aktif kalp verdiği ürünlerden hangisine gideceğini seçer.
- Davetle gelen kişi yeni üye olup hesabını doğrulayınca davet edenin ilgili ürün barına +2 eklenir.
- Davet edilen arkadaşın aynı ürüne kalp vermesi ZORUNLU DEĞİL. Arkadaş kendi 3 kalp hakkını istediği ürünlere kullanır.
- Davet bonusunda üst sınır YOK.
- Sahte hesapları önlemek için davet bonusunun sayılması telefon doğrulamasına bağlanacak. Mevcut altyapıda SMS/telefon doğrulama yoksa bunu "Teknik açık noktalar"a seçenekleriyle yaz (sağlayıcı, maliyet, alternatif).
  - **→ T2/Y2/Y4:** İlk sürümde telefon doğrulama yok (Faz 2). Bonus, davetlinin e-posta doğrulamasıyla sayılır.
    - **Cihaz ve IP kuralları** üyeliği, kalp vermeyi, kupon kazanmayı ve kullanmayı **engellemez**. Yalnız +2 davet bonusunu etkiler. Aynı evdeki aile üyeleri ve aynı mobil operatör IP'sini paylaşanlar normal katılır. Bu ilke geçici e-posta engelini kapsamaz (Y14).
    - Bonus yalnız şu hallerde "incelemede" durumuna düşer: aynı cihaz kimliğinden açılan ikinci ve sonraki hesaplar, davet eden ile davetlinin aynı cihaz kimliği. Admin tek tıkla onaylar ya da iptal eder.
    - Aynı IP özetinden 24 saatte 3 ya da daha fazla yeni hesap açılırsa bu yalnız Davetler ekranında "aynı IP" işaretiyle gösterilir, bonus normal işlenir.
    - Eşikler admin'den ayarlanır. Admin bonusları iptal edebilir.
    - Geçici e-posta alan adları kayıtta engellenir (npm paketi + admin ek listesi), mesaj: "Lütfen kalıcı bir e-posta adresi kullan" (Y14).
- Davet bonusu yalnızca davet edenin o ürüne aktif kalbi varken ve o turda geçerlidir.
  - **→ T4/Y5:** Bonus şu sırayla yerleşir:
    1. linkin bağlı olduğu üründeki aktif kalp,
    2. davet edenin dolmaya en yakın aktif barı,
    3. hiç aktif kalbi yoksa 30 gün geçerli "bekleyen bonus"; verdiği ilk kalbin barına eklenir.
    Bir bara eklenmiş bonus o turda geçerlidir: kalp geri çekilirse düşer, tur kapanırsa sona erer.
- Mevcut bir üye davet linkine tıklarsa bonus oluşmaz. Aynı kişi birden fazla kez davet edilmiş sayılamaz.

### Kupon
- Bir tur dolduğunda o turda kalbi olan her üye 1 kupon kazanır. Her dolan bar = 1 kupon = 1 ürün.
- Kupon %50 indirimdir. Oran sabit, ürün bazında değişmez.
- Kupon kişiye özeldir, hesaba bağlıdır, başkasına devredilemez. Kullanmak için giriş yapmış olmak gerekir.
- Geçerlilik: barın dolduğu andan itibaren 48 saat. Her kuponun süresi kendi barından başlar.
- Kupon herhangi bir ürüne uygulanabilir (Kalp Topla dışı işaretli ürünler hariç), kalp verilen ürünle sınırlı değildir.
- Kupon tek bir ürünün tek adedine uygulanır. Sepette aynı üründen 2 adet varsa yalnızca birine uygulanır.
- Kupon tutarında üst sınır YOK.
- İndirimli ürün kuralı: %50, ürünün indirimsiz orijinal fiyatı üzerinden hesaplanır, mevcut indirim yok sayılır. Ancak ürünün mevcut indirimli fiyatı kuponlu fiyattan zaten düşükse düşük olan fiyat geçerli olur. Müşteri hiçbir durumda kuponla daha pahalıya ödememeli. Kupon başka kampanyalarla üst üste binmez.
  - **→ T7:** Kuponlu satıra sadakat puanı harcanamaz. Diğer satırlarda puan normal kullanılır. Puan kazanımı fiilen ödenen tutar üzerinden hesaplanır.
- Birden fazla kupon aynı sepette birlikte kullanılabilir, her kupon farklı bir ürün satırına uygulanır.

### Sepet deneyimi
- Müşteri kod yazmak zorunda değildir. Giriş yapmış ve kuponu olan müşterinin sepetinin üstünde şu kutu görünür: "❤️ X Kalp Topla kuponun var · %50 indirim uygulandı. En pahalı X ürününe otomatik uyguladık."
  - **→ T5:** Metin "…En çok kazandıran X ürününe otomatik uyguladık." olarak güncellendi.
- Kuponlar otomatik olarak sepetteki en pahalı uygun ürünlere uygulanır.
  - **→ T5:** Kupon, müşteriye en çok kazanç (satış fiyatı − kuponlu fiyat) sağlayan uygun satırlara sırayla uygulanır.
- Her ürün satırında kupon durumu görünür: kuponlu satırda üstü çizili eski fiyat, yeni fiyat ve "Kupon uygulandı [Kaldır]"; kuponsuz satırda "[Kupon uygula]". Müşteri sahip olduğu kupon sayısından fazla satır seçemez.
- Normal kupon kodu kutusu diğer kampanyalar için yerinde kalır. Kalp Topla kodu bu kutuya yazılırsa sistem onu tüm sepete değil, kuponsuz kalan en pahalı tek ürüne uygular.
  - **→ T5:** "En pahalı" yerine "kuponsuz kalan, en çok kazanç sağlayan tek satır".
- Siparişte hangi kuponun hangi sipariş satırına uygulandığı kaydedilir.

### İade ve değişim
- Değişimde yeni ürün aynı kuponlu fiyattan verilir.
  - **→ T6:** Aynı ürünün başka beden/rengiyle değişimde fiyat aynı kalır. Farklı ürünle değişimde:
    - Kupon yeni ürüne taşınır. Yeni fiyat = yeni ürünün orijinal fiyatının %50'si (mevcut indirimli fiyatı daha düşükse o).
    - Yeni ürün "Kalp Topla dışı" ise kupon taşınmaz, kalan süresiyle hesaba geri yüklenir. Değişim normal fiyattan yapılır.
  - **→ Y6:** Fark sistemde hesaplanıp admin ekranında gösterilir. Tahsilat/iade elle yapılır, admin "tahsil edildi / iade edildi" diye işaretler (denetim kaydına yazılır).
- Tam iadede kupon kalan süresiyle hesaba geri yüklenir. İade onaylandığında kuponun süresi zaten dolmuşsa 24 saatlik yeni süre verilir (bu süre admin ayarından değiştirilebilsin).
  - **→ T6:** Geri yükleme anı iade **TAMAMLANDI** durumudur. "Tam iade" = kuponlu ürün geri alındı **ve** ücreti iade edildi.

### Bildirimler (ilk sürüm)
- Kanallar: site içi bildirim (zil ikonu + Hesabım), e-posta, web push (tarayıcı bildirimi, izin istenerek).
  - **→ T15:** Web push yalnız tarayıcısı doğrudan destekleyen cihazlarda (Android, masaüstü). iPhone/iPad'de push sunulmaz.
- Bildirim olayları:
  1. Kalp verilen ürünün barı doldu: "Kalp verdiğin ürünün kilidi açıldı! %50 kuponun hesabında, 48 saat geçerli" (kupon kodu da e-postada yer alır).
  2. Bar 8/10'a ulaştı: "Son 2 kalp kaldı, arkadaşını çağır" (sayılar dinamik).
  3. Davet edilen arkadaş üye oldu: "Arkadaşın üye oldu, barına +2 eklendi".
  4. Kuponun bitmesine 6 saat kaldı: "Kuponunun son 6 saati".
- Aynı olay için tekrarlı bildirim gönderilmemeli.
  - **→ T3/T11/Y1:** "Kupon kazandın" ve "son 6 saat" (kupon başına en çok 1) e-postaları günlük sınırın dışındadır, zamanında gider. "Son 2 kalp" ve "arkadaşın katıldı" için kişi başı günde (İstanbul saati) en çok 1 e-posta gider: günün ilk olayıyla anında. Aynı gün sonraki olaylar yalnız site içi/push ile iletilir, ertesi güne taşınmaz.
- Kampanya içerikli e-posta ve push için kayıt sırasında ve hesap ayarlarında ayrı, açık onay kutusu olmalı (KVKK ve İYS/ticari ileti uyumu). Onayı olmayana yalnızca site içi bildirim gösterilir.
  - **→ T3/T15:** İlk sürümde İYS kaydı ve entegrasyonu yapılmaz. E-posta onay kutusu üç yerde gösterilir: kayıt formu, hesap ayarları, ilk kalp penceresi. Push sorusu yalnız push'u destekleyen tarayıcıda, ilk kalp penceresinde sorulur. Onaysız üye site içi bildirimi ve (izin verdiyse) push'u alır.
- Kayıt formuna ve hesap ayarlarına opsiyonel telefon alanı ve "WhatsApp'tan kampanya bildirimi almak istiyorum" onay kutusu şimdiden eklensin. Bu veri ikinci aşamadaki WhatsApp entegrasyonunda kullanılacak.

### Sayfalar ve alanlar
- Kampanya sayfası (ör. /kalp-topla): 3 adım, en çok dolan ürünler, sık sorulan sorular, kampanya koşulları. Instagram ve reklamlardan gelen trafik buraya yönlenecek.
- Üst duyuru şeridi: "10 kalp = %50 · Nasıl mı?" (kampanya sayfasına link).
- İlk ziyaret penceresi: kampanyayı anlatan kısa pencere, kullanıcı başına bir kez gösterilir.
- Hesabım > Kalplerim: aktif kalpler ve barları, kalan kalp hakkı, kazanılan kuponlar ve kalan süreleri, kişisel davet linki, WhatsApp'ta paylaş butonu, davet geçmişi.
  - **→ T4/Y5:** Bekleyen bonuslar ve kalan süreleri (30 gün) de burada görünür.
- Kampanya koşulları metni (yasal sayfa olarak) yukarıdaki kuralları sade dille anlatmalı.

### Admin paneli
- Kampanya ayarları: aç/kapat, eşik (varsayılan 10), indirim oranı (varsayılan %50), kupon süresi (varsayılan 48 saat), kalp hakkı (varsayılan 3), davet bonusu (varsayılan +2), iade sonrası ek süre (varsayılan 24 saat).
  - **→ T14/Y8:** Kapatınca kazanılmış kuponlar süreleri boyunca geçerli kalır. Açık barlar dondurulur: yeni kalp ve bonus alınmaz, geri çekme serbesttir. Yeniden açılınca barlar kaldığı yerden devam eder.
  - **→ Y10/Y12:** Aç/kapat yerine üç mod: Kapalı / Gizli yayın (seçili test hesapları) / Açık. Gizli modda turlar ayrı "test eşiği" (varsayılan 2) ile açılır. Herkese açılırken test verisi onay adımıyla sıfırlanır.
  - **→ Y2/Y4:** Kötüye kullanım eşikleri ve ek engelli e-posta alan adı listesi de bu ekrandadır.
- Ürün düzenleme ekranında "Kalp Topla dışı" seçeneği.
- Rapor ekranı: en çok dolan ürünler, aktif barlar, kapanan turlar, verilen / kullanılan / süresi dolan kuponlar, kupon kaynaklı ciro ve indirim tutarı, davetle gelen yeni üye sayısı.
  - **→ T2/T3:** Davet bonusları listesi (inceleme/onay/iptal) ve e-posta onay kayıtlarının CSV dışa aktarımı eklenir.
- Kalp verme verisi aynı zamanda talep verisi olarak raporlansın (hangi ürün ne kadar isteniyor).
- Önemli kampanya işlemleri mevcut denetim kaydı sistemi varsa ona yazılsın.

---

## 3. Mevcut durum analizi

İnceleme 2026-10-29'da yapıldı. Dosya yolları `src/` altındadır.

| Konu | Bugün ne var | Kalp Topla için eksik / dikkat |
|---|---|---|
| **Altyapı** | Next.js 16.4, Prisma 7 + `@prisma/adapter-neon` (Neon Postgres), Vercel **Pro**, şema değişiklikleri `prisma db push` ile. | Yerel ve canlı bugün **aynı DB**'yi kullanıyor. **T13:** geliştirme ve test için ayrı Neon branch, canlı DB'de test yok. Function boyutu hassas (`VERCEL_FUNCTION_STORAGE_PLANI.md`). Yeni paketler küçük seçilir. |
| **Üyelik / kayıt** | `Customer` (email, name, phone?, passwordHash). Kayıt `api/musteri-kayit/route.ts`, form `app/(site)/hesap/(auth)/giris/page.tsx` (telefon opsiyonel var). Oturum ayrı NextAuth (`lib/customer-auth.ts`). | **E-posta doğrulama yok**, şifre sıfırlama yok. `callbackUrl` taşınmıyor. Geçici e-posta engeli, cihaz/IP kaydı yok. |
| **Favori** | `WishlistItem`, misafirde localStorage (`lib/wishlist.tsx`), `api/favoriler`, `hesap/(panel)/favorilerim`. Kalp ikonu ve "Favori" metinleri: `components/product-card.tsx`, `product-viewer.tsx`, `favorilerim-grid.tsx`, `hesap-nav.tsx`, `lib/meta/track.ts`. | **T9:** yer imi ikonu, "Kaydet / Kaydedilenler". Veri aynen kalır. |
| **Kupon / indirim** | `Coupon` (PERCENT/FIXED/FREE_SHIPPING, kodlu/otomatik, kısıtlar). `lib/coupons.ts` `resolveBestDiscount`; esas fiyat `compareAtCents ?? priceCents`. Bundle `lib/bundles.ts`, puan `lib/loyalty.ts`. | Kişiye bağlı, süreli, tek adet kupon kavramı yok. İndirim sırası `api/kuponlar/dogrula` ve `api/orders` içinde **ayrı ayrı** kurulu (T17 birleştirir). |
| **Sepet / fiyat** | `lib/cart.tsx` (misafirde localStorage, üyede `CustomerCart`). Satır fiyatı her okumada DB'den (`lib/cart-lines.ts`). Sepet `sepet/cart-view.tsx`, ödeme `odeme/checkout-form.tsx`. | Kalp ataması ve satır bazlı gösterim. |
| **Sipariş** | `api/orders/route.ts` tek `$transaction`. Sipariş `PENDING_PAYMENT/UNPAID` açılır, ödenmezse `lib/payment/orders/expire.ts` kuponu/puanı geri verir. iyzico sepeti `basket.ts` toplam indirimi satırlara **orantılı** dağıtır. Durumlar: `REVENUE_STATUSES` = PAID, PREPARING, SHIPPED, DELIVERED (`lib/orders.ts`), ödeme durumu `paymentStatus` (… REFUNDED). | Kuponlu adet ayrı `OrderItem`'a bölünür (5.6). |
| **Sadakat puanı** | Kullanım: `resolveLoyaltyRedemption`. Kazanım: `awardLoyaltyPoints`, DELIVERED'da `Order.totalCents` üzerinden. | **T7:** kullanım tavanı kuponsuz satırlar. Kazanım zaten ödenen tutar üzerinden. |
| **İade / değişim** | `ReturnRequest` (IADE/DEGISIM, `itemsJson`, TALEP_EDILDI→ONAYLANDI/REDDEDILDI→KARGODA→TAMAMLANDI). Admin `admin/iadeler/page.tsx` server action. Para iadesi ayrı (`refund.ts`, `PaymentRefund`, `OrderItem.refundedCents`). | Değişim ürünü kaydedilmiyor, fark sistem dışında elle çözülüyor (Y6: ilk sürümde de elle, sistem hesaplar ve işaretletir). |
| **E-posta** | `lib/mail.ts` `sendMail` (Resend, best-effort). | Kampanya şablonları, `List-Unsubscribe` (`sendMail`'e `headers`). |
| **Bildirim / push** | Yok. Service worker yok, `web-push` yok. | Site içi bildirim, zil, push aboneliği, VAPID, `sw.js`. **Manifest eklenmez** (T15/Y9). |
| **Zamanlanmış işler** | `vercel.json` crons (günde 1), `CRON_SECRET` deseni. | Saatlik bir cron + günlük bir temizlik cron'u. |
| **Admin** | Sunucu bileşeni + server action. `admin/ayarlar`, `admin/raporlar` (recharts), `admin/islem-gecmisi`, ürün formu `admin/urunler/[id]`, `yeni`. Roller ADMIN/PERSONEL. | Yeni `/admin/kalp-topla` sayfaları, ürün checkbox'ı, iade ekranında değişim alanları. |
| **Denetim kaydı** | `AuditLog`, `lib/audit-log.ts`, `lib/audit-actions.ts`. | Yeni eylem kodları. |
| **KVKK / onay** | Çerez rızası `ConsentLog` (ham IP saklanmıyor). Gizlilik Politikası "IP saklanmaz" ilkesine dayanıyor (Meta CAPI, çerez rızası). | Üye bazında e-posta onayı ve ispat kaydı yok. **Y3:** onay kaydında ham IP (3 yıl kuralı), kötüye kullanım verisi 90 gün. Gizlilik ve Çerez metinleri güncellenecek (8. bölüm taslakları). |
| **Önbellek** | Ürün sayfası `revalidate = 3600`, katalog `unstable_cache`. | Bar ve tüm kampanya görünürlüğü istemci tarafında oturuma göre çözülür (gizli yayın modu için şart). |
| **Yasal sayfalar** | `LegalPage`, `/sayfa/[slug]`, `prisma/legal-pages-content.ts`. Çerez politikası `app/(site)/cerez-politikasi`. | `kalp-topla-kosullari`, Gizlilik ve Çerez metni güncellemesi. |
| **Görseller** | R2 (`img.bollmark.com`), WebP + `.jpg` kopyaları. | E-postada `.jpg` kopyaları. |

---

## 4. Veri modeli

Tüm değişiklikler eklemeli ve kullanıcı onayıyla `prisma db push` ile canlı DB'ye uygulanır (T13 güncel). Kısmi unique indeks Prisma şemasında `partialIndexes` önizleme özelliğiyle tanımlanır, ayrı SQL dosyası yoktur (kullanıcı kararı 2026-10-30: ayrı SQL olsaydı sonraki her `db push` onu silmek isterdi).

### 4.1 Mevcut tablolara eklenecek alanlar

```prisma
model Product {
  kalpToplaExcluded Boolean @default(false) // "Kalp Topla dışı": bar görünmez, kupon uygulanmaz/taşınmaz
}

model Customer {
  emailVerifiedAt       DateTime?
  referralCode          String?  @unique   // kişisel davet kodu (ilk ihtiyaçta üretilir)
  referredById          String?            // davet eden üye (bir kez yazılır)
  inviteTargetProductId String?            // genel davet linkinde +2'nin hedef ürünü
  marketingEmailAt      DateTime?          // dolu = e-posta onayı var (her değişiklik MarketingConsentLog'a da)
  marketingWhatsappAt   DateTime?          // Faz 2 için toplanır, ilk sürümde ileti yok
  pushPromptDismissedAt DateTime?          // push sorusu reddedildi: 7 gün sorulmaz
  // phoneVerifiedAt Faz 2'de eklenecek (T2). Cihaz/IP verisi Customer'da değil, CustomerDevice'ta (90 gün).
}

model OrderItem {
  kalpCouponId          String?           // bu satıra uygulanan Kalp Topla kuponu (tekil değil: geri dönen kupon yeniden kullanılır, indeksli)
  kalpOriginalUnitCents Int?              // kuponsuz olsaydı ödenecek birim fiyat
  kalpRestoredAt        DateTime?         // kupon bu satırdan bir kez geri yüklendi
}

model Order {
  kalpDiscountCents Int @default(0)       // rapor ve özet için
  kalpTestAt        DateTime?             // Y12: test kuponuyla verilmiş sipariş; kampanya raporlarından hariç
}

model CustomerCart {
  kalpSelectionJson String @default("{}") // { manual: variantId[], removed: variantId[] }
}

model ReturnRequest {
  exchangeVariantId      String?   // değişim ürünü/varyantı (T6)
  exchangeUnitCents      Int?      // değişim ürününün hesaplanan birim fiyatı
  exchangeDiffCents      Int?      // + müşteriden alınacak, - müşteriye ödenecek
  exchangeDiffSettledAt  DateTime? // Y6: admin "tahsil edildi / iade edildi" işaretledi
  exchangeDiffSettledBy  String?   // işaretleyen admin e-postası
  kalpHandledAt          DateTime? // kupon geri yükleme/taşıma bir kez yapılsın diye
}
```

### 4.2 Yeni tablolar

```prisma
model KalpToplaSettings {
  id                 String   @id @default("singleton")
  mode               String   @default("OFF")  // OFF | HIDDEN | LIVE (Y10)
  testerCustomerIds  String[] @default([])     // HIDDEN modunda kampanyayı görenler
  threshold          Int      @default(10)     // yalnız YENİ turlara uygulanır (T16)
  testThreshold      Int      @default(2)      // Y12: yalnız HIDDEN modda açılan (test) turlara uygulanır
  discountPercent    Int      @default(50)
  couponHours        Int      @default(48)
  heartQuota         Int      @default(3)
  inviteBonus        Int      @default(2)
  refundExtraHours   Int      @default(24)
  // Y2 kötüye kullanım eşikleri (yalnız davet bonusunu etkiler, üyeliği/kalbi/kuponu engellemez)
  sameDeviceMaxAccounts Int   @default(1)      // aynı cihazdan bu sayıyı aşan hesapların bonusu "incelemede" (1 = ikinci ve sonrası)
  sameIpWindowHours  Int      @default(24)
  sameIpMinAccounts  Int      @default(3)      // pencere içinde aynı IP özetinden bu kadar ya da fazla yeni hesap → yalnız "aynı IP" işareti
  updatedAt          DateTime @updatedAt
}

// Y4: npm paketine ek, admin'in elle engellediği alan adları.
model BlockedEmailDomain {
  id             String   @id @default(cuid())
  domain         String   @unique   // küçük harf, ör. "ornekmail.com"
  createdByEmail String
  createdAt      DateTime @default(now())
}

// Y2/Y3: kötüye kullanım kontrolü için cihaz ve IP görülmeleri. 90 gün sonra silinir.
// Kayıt ve girişte yazılır (davet edenin cihazı da eşleşebilsin diye).
model CustomerDevice {
  id         String   @id @default(cuid())
  customerId String
  deviceId   String             // bm_cihaz çerezindeki rastgele kimlik
  ipHash     String?            // IP'nin tuzlanmış SHA-256 özeti (ham IP tutulmaz)
  event      String             // SIGNUP | LOGIN
  createdAt  DateTime @default(now())
  @@index([deviceId, createdAt])
  @@index([ipHash, event, createdAt])
  @@index([customerId])
  @@index([createdAt])          // 90 gün temizliği
}

model KalpBar {
  productId      String   @id
  currentRoundId String   @unique
  points         Int      @default(0)   // açık turdaki ACTIVE kalp + APPLIED bonus toplamı
  closedRounds   Int      @default(0)
  updatedAt      DateTime @updatedAt
}

model KalpRound {
  id        String    @id @default(cuid())
  productId String
  roundNo   Int
  threshold Int                          // tur açıldığı andaki eşik (T16); test turunda testThreshold (Y12)
  status    String    @default("OPEN")   // OPEN | CLOSED
  isTest    Boolean   @default(false)    // HIDDEN modunda açılan test turu (Y12)
  closedAt  DateTime?
  createdAt DateTime  @default(now())
  @@unique([productId, roundNo])
}

model KalpHeart {
  id         String    @id @default(cuid())
  customerId String
  productId  String
  roundId    String
  // PENDING (doğrulanmamış, hak kullanır) | ACTIVE | WITHDRAWN | WON
  status     String    @default("ACTIVE")
  createdAt  DateTime  @default(now())
  endedAt    DateTime?
  @@index([customerId, status])
  @@index([roundId, status])
  @@index([productId, createdAt])
}
// Şemada: @@unique([customerId, productId], where: raw("status = ANY (ARRAY['PENDING'::text, 'ACTIVE'::text])")) (partialIndexes; Postgres'in sakladığı biçim)

model KalpInvite {
  id              String    @id @default(cuid())
  inviterId       String
  inviteeId       String    @unique      // bir kişi yalnız bir kez davet edilmiş sayılır
  productId       String?                // linkin bağlı olduğu ürün
  // PENDING_VERIFICATION | UNDER_REVIEW | CREDITED (bonus kredisi oluştu, bkz. KalpBonusCredit)
  // | CANCELLED (admin)
  status          String    @default("PENDING_VERIFICATION")
  reviewReasons   String[]  @default([]) // incelemeye düşüren nedenler: SAME_DEVICE | SAME_DEVICE_AS_INVITER
  sameIpFlagAt    DateTime?              // Y2/Y13: yalnız işaret, durumu ve bonusu etkilemez
  isTest          Boolean   @default(false) // HIDDEN modda oluşan test daveti (Y12)
  reviewedByEmail String?
  reviewedAt      DateTime?
  createdAt       DateTime  @default(now())
  verifiedAt      DateTime?
  @@index([inviterId, status])
  @@index([status, createdAt])
}

// Bonus puanlarının nerede durduğunu tutar. Bir davet tek kredi ile başlar.
// Bonus bir barı eşiğin üstüne taşırsa kredi bölünür: eşiğe kadar olan kısım
// ROUND_CLOSED, artan kısım yeni bir WAITING kredisi olur, 30 gün baştan (Y11).
model KalpBonusCredit {
  id         String    @id @default(cuid())
  inviteId   String
  customerId String               // bonusun sahibi (davet eden)
  points     Int                  // bu kredideki puan
  // WAITING (bekleyen bonus) | APPLIED (bir bardaki kalbe bağlı) | ROUND_CLOSED (işini gördü)
  // | VOID_WITHDRAWN (bağlı kalp geri çekildi) | EXPIRED (30 gün doldu) | CANCELLED (admin)
  status     String    @default("WAITING")
  heartId    String?              // APPLIED iken bağlı kalp
  roundId    String?
  splitFromId String?             // Y11: artan kısımdan doğduysa ana kredi
  expiresAt  DateTime?            // WAITING iken bitiş (30 gün, kampanya kapalıyken de işler; bölünmede baştan)
  isTest     Boolean   @default(false)
  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt
  @@index([customerId, status])
  @@index([heartId, status])
  @@index([status, expiresAt])
}

model KalpCoupon {
  id              String    @id @default(cuid())
  code            String    @unique      // ör. "KALP-7KD2QX"
  customerId      String
  roundId         String
  discountPercent Int
  expiresAt       DateTime
  status          String    @default("AVAILABLE") // AVAILABLE | RESERVED | USED | TEST_CANCELLED (Y15)
  usedAt          DateTime?
  restoredAt      DateTime?
  expiringEmailAt DateTime?              // "son 6 saat" e-postası/olayı üretildi (kupon başına 1, Y1)
  isTest          Boolean   @default(false) // test turundan kazanılan kupon (Y12)
  createdAt       DateTime  @default(now())
  @@index([customerId, status, expiresAt])
}

model Notification {
  id          String    @id @default(cuid())
  customerId  String
  type        String    // COUPON_WON | BAR_NEAR | INVITE_JOINED | COUPON_EXPIRING | BONUS_EXPIRED | COUPON_RESTORED
  eventKey    String    @unique
  title       String
  body        String
  link        String?
  payloadJson String    @default("{}")
  readAt      DateTime?
  // PENDING | SENT | SKIPPED_DAILY_LIMIT | SKIPPED_NO_CONSENT | NOT_APPLICABLE | FAILED
  emailStatus String    @default("PENDING")
  pushStatus  String    @default("PENDING")
  createdAt   DateTime  @default(now())
  @@index([customerId, createdAt])
  @@index([emailStatus, createdAt])
}

// Y1: BAR_NEAR ve INVITE_JOINED e-postaları için kişi başı günde 1 (İstanbul günü).
model ReminderEmailDay {
  id             String   @id @default(cuid())
  customerId     String
  dayKey         String   // "2026-11-03" (istanbulDateKey)
  notificationId String   // o günün e-postasını alan olay
  createdAt      DateTime @default(now())
  @@unique([customerId, dayKey])
}

model PushSubscription {
  id         String   @id @default(cuid())
  customerId String
  endpoint   String   @unique
  p256dh     String
  auth       String
  createdAt  DateTime @default(now())
}

model MarketingConsentLog {
  id          String    @id @default(cuid())
  customerId  String
  email       String
  channel     String    // EMAIL | PUSH | WHATSAPP
  granted     Boolean
  source      String    // KAYIT_FORMU | HESAP_AYARLARI | KALP_PENCERESI | ABONELIK_IPTAL_LINKI
  ip          String?   // Y3: ham IP; onay geri çekildikten 3 yıl sonra null'lanır
  ipPurgedAt  DateTime?
  textVersion String
  createdAt   DateTime  @default(now())
  @@index([customerId, channel, createdAt])
  @@index([createdAt])
}

model EmailVerificationToken {
  id         String    @id @default(cuid())
  customerId String
  tokenHash  String    @unique
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())
}
```

İlişki özeti:
- `Product 1—1 KalpBar 1—n KalpRound 1—n KalpHeart`
- `KalpInvite 1—n KalpBonusCredit n—0..1 KalpHeart`
- `KalpRound 1—n KalpCoupon 1—0..1 OrderItem`
- `Customer 1—n` kalp, kupon, davet, kredi, cihaz, bildirim, push, onay

Kalp hakkı = `heartQuota − count(KalpHeart where status in (PENDING, ACTIVE))`. Sayım `Customer` satırı kilitliyken yapılır.

---

## 5. Sunucu tarafı mantığı

Yeni klasör `src/lib/kalp-topla/`:

| Dosya | İçerik |
|---|---|
| `settings.ts` | `getKalpSettings()`, `campaignStateFor(customerId)` → `OFF` / `FROZEN` / `ACTIVE` / `INVISIBLE` (Y10) |
| `bar.ts` | kalp verme, geri çekme, PENDING→ACTIVE, tur kapanışı |
| `invite.ts` | davet kodu, çerez, şüphe kontrolü (Y2), admin onay/iptal |
| `bonus.ts` | bonus kredisi yerleştirme (T4/Y5), artan kısmın beklemeye dönmesi, 30 gün dolumu |
| `devices.ts` | `bm_cihaz` çerezi, `CustomerDevice` yazımı, IP özeti |
| `coupons.ts` | kupon üretimi, rezervasyon, iade geri yükleme, değişimde taşıma |
| `pricing.ts` | saf fonksiyonlar: kupon fiyatı, atama (`pricing.test.ts`) |
| `notifications.ts` | outbox, push, e-posta kuralları (Y1), onay kontrolü |
| `emails.ts` | e-posta şablonları (7.4) |
| `consent.ts` + `consent-texts.ts` | onay ver/geri çek + log, metin sürümleri |
| `email-domain-check.ts` | geçici alan adı kontrolü: npm paketi + `BlockedEmailDomain` (Y4) |
| `messages.ts` | bar durum mesajları (sunucu/istemci ortak) |

Fiyatın tek kaynağı: `src/lib/pricing/price-cart.ts` (5.6).

### 5.0 Kampanya modu ve görünürlük (Y10, T14)

`campaignStateFor(customerId)`:

| Ayar `mode` | Test hesabı | Diğer üye / misafir |
|---|---|---|
| `OFF` + hiç tur yok | INVISIBLE | INVISIBLE |
| `OFF` (önceden açılmış) | FROZEN | FROZEN |
| `HIDDEN` | ACTIVE | INVISIBLE |
| `LIVE` | ACTIVE | ACTIVE |

- **ACTIVE:** her şey çalışır.
- **FROZEN (T14/Y8):** bar/şerit/pencere/rozet gizli. Yeni kalp ve bonus ekleme kapalı. **Geri çekme açık.** Kalplerim ve kuponlar görünür, kuponlar sepette geçerli.
- **INVISIBLE:** hiçbir kampanya öğesi görünmez. Uç noktalar 404 döner. Kampanya kuponu olmayan biri için sepet etkisi yoktur.
- Tüm site öğeleri (bar, rozet, şerit, ilk ziyaret penceresi, zil içeriği, kampanya sayfası, Kalplerim menüsü) görünürlüğü **istemcide oturuma göre** `GET /api/kalp-topla/durum` ile çözer. Böylece ISR önbelleği gizli modu sızdırmaz.
- `/kalp-topla` sayfası HIDDEN'da test hesabı olmayana 404 döner (dinamik render).
- Katalog rozet ucu (`barlar`) LIVE'da CDN önbellekli ve herkese açıktır. HIDDEN'da `no-store` çalışır ve yalnız test hesabına veri döner.
- **Test turları (Y12):** HIDDEN modda açılan turlar `isTest=true` olur ve `testThreshold` (varsayılan 2) ile açılır. Bu turlardan doğan kalpler, davetler, bonus kredileri ve kuponlar da `isTest` taşır.
- **Herkese açılış sıfırlaması (Y12, Y15):** `isTest` veri varken **herhangi bir** moddan LIVE'a geçişte çalışır, HIDDEN→OFF→LIVE dahil (kullanıcı onaylı).
  - **Onay penceresi:** "Herkese açılınca test verisi sıfırlanacak: N test turu, N kalp, N davet, N bekleyen bonus, N kullanılmamış test kuponu (iptal edilecek)."
  - **Ödenmemiş test siparişleri (Y15):** RESERVED test kuponu taşıyan ödenmemiş siparişler pencerede listelenir (sipariş no, müşteri, tutar, oluşturma zamanı). İki seçenek sunulur: **"Siparişleri iptal et ve devam et"** / **"Vazgeç"**. Vazgeç'te hiçbir şey değişmez.
  - Onaylanınca:
    1. **Ödenmemiş test siparişleri iptal edilir.** Mevcut `lib/payment/orders/expire.ts` iptal yolu kullanılır: normal kupon hakkı ve puan geri verilir. Tek fark, Kalp kuponu `AVAILABLE`'a dönmek yerine `TEST_CANCELLED` olur. Bir siparişte iyzico ödeme denemesi hâlâ canlıysa (expire.ts'in "deneme ölmeden iptal etme" kontrolü) o sipariş iptal edilmez. Geçiş durur, admin'e "Ödeme işlemi sürüyor, birkaç dakika sonra tekrar deneyin" denir. Böylece parası alınmış bir sipariş yanlışlıkla iptal edilmez.
    2. Aynı transaction'da:
       - test turları, test kalpleri, test davetleri ve test bonus kredileri silinir;
       - test turu olan ürünlerin `KalpBar` satırları silinir; bütün barlar ilk kalpte normal eşikle sıfırdan açılır;
       - **kullanılmamış** (`AVAILABLE`) test kuponları silinmez, `TEST_CANCELLED` olur. Sepette ve siparişte geçersizdir, raporlardan hariç tutulur, Kalplerim'de görünmez;
       - **ödenmiş** test siparişleri ve kullandıkları (`USED`) kuponlar silinmez: kupon `isTest` kalır, siparişe `kalpTestAt` yazılır, ikisi de raporlardan hariç tutulur.
    3. Denetim kaydı `KALP_TOPLA_TEST_SIFIRLANDI` (sayılar ve iptal edilen sipariş numaralarıyla).
    4. Mod LIVE olur.

### 5.1 Kalp verme (`POST /api/kalp-topla/kalp`)

1. Oturum zorunlu. Durum `ACTIVE` olmalı (FROZEN → 409 "Kampanya şu an duraklatıldı"). Ürün `PUBLISHED` ve `kalpToplaExcluded=false`.
2. `$transaction`, sabit kilit sırası: `Customer` satırı → `KalpBar` satırı (`SELECT ... FOR UPDATE`).
3. Hak kontrolü: `PENDING + ACTIVE` < `heartQuota`.
4. `KalpBar` yoksa oluşturulur. Mod HIDDEN ise tur `isTest=true` ve `threshold = testThreshold`, değilse `threshold` = güncel ayar. P2002'de bir kez yeniden denenir.
5. E-posta doğrulanmışsa `ACTIVE`, `points += 1`. Değilse `PENDING` + doğrulama e-postası (10 dakikada en çok bir kez).
6. Kalp `ACTIVE` olduysa üyenin **bekleyen bonusları** yerleştirilir (5.6.1).
7. `points >= round.threshold` ise tur kapanışı (5.2).
8. `round.threshold − 2` aşağıdan yukarı geçildiyse katılımcılara `BAR_NEAR` (tur başına üye başına bir kez).
9. Yanıt: bar durumu, kalan hak, `isFirstHeart`, `pushSupported` istemcide ayrıca tespit edilir.

Hız sınırı: üye başına dakikada en çok 20 kalp işlemi.

### 5.2 Tur kapanışı

1. `KalpRound` CLOSED, `closedAt`.
2. `ACTIVE` kalpler `WON` olur, `PENDING` kalpler yeni tura taşınır.
3. Her `WON` kalp için `KalpCoupon` (`expiresAt = closedAt + couponHours`).
4. Tura bağlı `APPLIED` krediler `ROUND_CLOSED` olur. **Artan kısım (Y11):**
   - Turu kapatan işlem bir bonus kredisinin eklenmesiyse ve `points > threshold` olduysa, aşan puan (`points − threshold`, en çok o kredinin puanı kadar) kredinin kendisinden ayrılır.
   - Ayrılan kısım yeni bir `WAITING` kredi olur: `splitFromId` = ana kredi, `expiresAt = şimdi + 30 gün` (baştan başlar), aynı davete ve sahibine bağlı.
   - Bu kredi aynı transaction'da Y5 kuralıyla yerleştirilmeye çalışılır: sahibinin diğer aktif barlarından dolmaya en yakın olanı, yoksa bekler ve verdiği bir sonraki kalbe eklenir.
     - **→ Kullanıcı kararı (2026-10-30, Faz 5):** artan kısım önce bekleyen kredi olarak yazılır, başka bara **ayrı işlemde** yerleşir (bir işlem iki bar kilitlemez). Yarıda kalırsa bekler, kalp verme ya da bar/Kalplerim açılışında yerleşir. Tekrar yerleşme DB'de engelli (T13 notu).
   - Birden fazla bekleyen kredi birlikte eklenip eşik aşıldıysa aşan puan, eklenme sırasında **son eklenen** kredilerden geriye doğru ayrılır.
   - Kalp (+1) ile kapanan turda artan olmaz.
5. Yeni tur: `roundNo + 1`, `points = 0`. `threshold` = güncel ayar; mod HIDDEN ise `testThreshold` ve `isTest=true`.
6. `COUPON_WON` bildirimleri outbox'a yazılır, denetim kaydı `KALP_TOPLA_TUR_KAPANDI`.

### 5.3 Kalp geri çekme (`DELETE /api/kalp-topla/kalp`)

- Durum `ACTIVE` **veya** `FROZEN` (Y8). Kilit sırası aynı.
- `ACTIVE` kalpte: `points −= 1 + Σ(bağlı APPLIED kredilerin puanları)`, krediler `VOID_WITHDRAWN` olur. Kural gereği beklemeye dönmezler.
- Hak boşalır. Donmuş barın sayısı da azalır.

### 5.4 E-posta doğrulama, mevcut üyeler, kayıt kontrolleri

- Doğrulama tokenı 32 bayt, DB'de SHA-256, 24 saat, tek kullanımlık. `/hesap/dogrula?token=`.
- Doğrulanınca `PENDING` kalpler sırayla `ACTIVE` olur: her biri kendi barını kilitler, bekleyen bonuslar yerleşir, gerekirse tur kapanır. Ardından davet adımı (5.5).
- **T12 + Y7:** `scripts/kalp-topla-dogrulanmis-uyeler.ts` (varsayılan kuru çalıştırma) aşağıdaki koşulları sağlayan üyelerin `emailVerifiedAt`'ini ilk böyle siparişin tarihine set eder:
  - `Order.status` ∈ {PAID, PREPARING, SHIPPED, DELIVERED},
  - `deletedAt` null,
  - `paymentStatus` ≠ REFUNDED (tamamı iade edilmemiş; kısmi iade sayılır),
  - `customerId` = üye **veya** `customerEmail` üyenin e-postasıyla büyük/küçük harf duyarsız eşit (misafir siparişleri dahil).

  Diğer mevcut üyeler ilk kalpte doğrulama e-postası alır.
  - **Kullanıcı kararı (2026-10-30, Faz 3):** her yeni kayıtta, kampanya modundan bağımsız, kampanyadan bahsetmeyen genel bir doğrulama e-postası gider. Script şimdi yalnız kuru çalıştırılır, gerçek çalıştırma yayın fazında (9.1 madde 2).
- **Geçici e-posta (Y4):** `api/musteri-kayit` tüm kayıtlarda alan adını kontrol eder:
  - (1) `disposable-email-domains-js` paketi,
  - (2) `BlockedEmailDomain` tablosu. Alt alan adları da üst alan adıyla eşleşir.
  - Mesaj: "Lütfen kalıcı bir e-posta adresi kullan" (Y14).
  - Bu engel Y2'deki "üyeliği engellemez" ilkesinin dışındadır. O ilke yalnız cihaz ve IP kurallarını kapsar (Y14).
  - **Paket seçimi ve gerekçe:**
    - `disposable-email-domains-js` (npm, lisans CC0, bağımlılıksız, ~190 KB, 2026-09'da güncellenmiş) topluluğun en yaygın kullanılan ve sürekli bakımı yapılan `disposable-email-domains` listesini sarar. Bu liste yanlış pozitifleri azaltmak için ayrıca izinli liste tutar.
    - Küçük boyutu, Vercel function boyutu hassasiyeti için önemli.
    - Alternatif `mailchecker` (~1 MB, daha agresif liste) daha büyük, daha çok yanlış pozitif riski taşır.
    - `disposable-email-domains` adlı eski paket 2022'den beri güncellenmiyor.
    - Uygulamada sürüm sabitlenir. Paket güncellemesi bağımlılık güncellemeleriyle birlikte yapılır.
- **Cihaz ve IP kaydı (Y2/Y3):** kayıt ve girişte `CustomerDevice` satırı yazılır: `bm_cihaz` kimliği + IP'nin tuzlanmış özeti (tuz env'de, `DEVICE_IP_SALT`). Ham IP burada tutulmaz.

### 5.5 Davet

- **Link:** `/davet/{referralCode}` ve `/davet/{referralCode}?urun={slug}`. Route handler `bm_davet` çerezini yazar: birinci taraf, işlevsel, 7 gün, yalnız `{code, productId}`. Ardından yönlendirir. HIDDEN modda davet eden test hesabı değilse çerez yazılmaz.
- **Kayıt:** form davet kodunu ve ürünü gizli alanla da gönderir (T8). `api/musteri-kayit` `referredById` yazar, `KalpInvite(PENDING_VERIFICATION)` açar. Mevcut üye linke tıklarsa davet oluşmaz.
- **Kötüye kullanım kontrolü (Y2):** cihaz ve IP kuralları üyeliği, kalp vermeyi, kupon kazanmayı ya da kullanmayı engellemez, yalnız davet bonusunu etkiler. Davetli e-postasını doğruladığında:
  - **İncelemeye düşüren nedenler** (`reviewReasons`):
    - `SAME_DEVICE`: davetlinin kayıt cihaz kimliğiyle daha önce kayıt olmuş hesap sayısı ≥ `sameDeviceMaxAccounts` (ikinci ve sonraki hesap). Pencere: elde tutulan veri süresi (90 gün).
    - `SAME_DEVICE_AS_INVITER`: davetlinin cihaz kimliği, davet edenin herhangi bir `CustomerDevice` kaydında görülmüş.
  - **Yalnız işaret (aynı IP):** davetlinin kayıt IP özetiyle son `sameIpWindowHours` saatte açılan yeni hesap sayısı (kendisi dahil) ≥ `sameIpMinAccounts` ise:
    - davetin `sameIpFlagAt` alanı dolar;
    - aynı gruptaki **önceki** hesapların davetlerine de yalnız bu işaret yazılır (Y13). Önceki hesapların durumu, kredisi ya da bara eklenmiş bonusu **değişmez**, geriye dönük işlem yapılmaz;
    - işaret bonusu etkilemez.
  - `reviewReasons` boş değilse davet `UNDER_REVIEW` olur, kredi oluşmaz. Boşsa (aynı IP işareti olsa bile) davet `CREDITED`, `inviteBonus` puanlık bir `KalpBonusCredit` oluşur ve yerleştirilir (5.6.1). `INVITE_JOINED` bildirimi gider.
- **Kampanya FROZEN iken doğrulama (Y5):** kredi oluşur ama yerleştirilmez, `WAITING` kalır (30 gün işler). Kampanya ACTIVE olunca cron/ilk olay T4 kuralıyla yerleştirir.
- **Admin onay/iptal:**
  - `UNDER_REVIEW` → **Onayla**: kredi oluşur, onay anındaki duruma göre T4 sırasıyla yerleşir (Y5).
  - `UNDER_REVIEW` → **İptal**: `CANCELLED`, kredi oluşmaz.
  - `CREDITED` → **İptal (Y11):** davetin her kredisi durumuna göre işlenir:
    - `WAITING` (henüz bara eklenmemiş, artan kısımdan doğanlar dahil) → silinir (`CANCELLED`);
    - `APPLIED` ve tur açık → puanı bardan düşer, `CANCELLED`;
    - `ROUND_CLOSED` → dokunulmaz, kupon geri alınmaz. Kayıt düşer: davet `CANCELLED`, rapordaki "geçerli davet" sayısından çıkar.
  - Tek tıkla Onayla / İptal (Y2). İptal için açıklama alanı opsiyonel.
  - Hepsi denetim kaydı (`KALP_TOPLA_DAVET_ONAYLANDI`, `KALP_TOPLA_DAVET_IPTAL`).

### 5.6 Fiyat hesaplama: tek fonksiyon (T17)

**Seçilen yöntem:** `src/lib/pricing/price-cart.ts` → `priceCart(tx, { customerId, lines, couponCode, kalpSelection, pointsToRedeem, mode: "PREVIEW" | "ORDER" })`.

- **Kullananlar:**
  - Yeni `POST /api/sepet/fiyat`: sepet ve ödeme, `PREVIEW`, kilitsiz, `no-store`.
  - `api/orders/route.ts`: transaction içinde `ORDER`.
  - `api/kuponlar/dogrula` geçişte ince sarmalayıcı olur, sonra kaldırılır.
- **Gerekçe:** indirim sırası bugün iki ayrı yerde kurulu. Kalp kuponu bu sırayı değiştirdiği için tek fonksiyon, gösterilen ve tahsil edilen tutarın ayrışmasını önler. İstemci yalnız satır kimliği, kod, seçim ve puan miktarı gönderir. Tutarlar her zaman sunucuda, DB'den hesaplanır.

**Hesap sırası:**
1. Güncel fiyatlar (`effectivePrice`, `effectiveCompareAt`) ve otomatik kampanya fiyatı (`resolveProductDisplayPrice` mantığı).
2. **Kalp ataması** (`pricing.ts`):
   - `esasFiyat = compareAtCents ?? priceCents`
   - `kuponFiyati = round(esasFiyat × (100 − %) / 100)`
   - `mevcutEnIyi = min(priceCents, otomatik kampanya fiyatı)`
   - `kazanc = mevcutEnIyi − kuponFiyati`; ≤ 0 ise kupon atanmaz.
   - Aday satır: `kalpToplaExcluded=false` ve `kazanc > 0`, satır başına tek adet.
   - Sıra: önce `manual`, sonra en yüksek kazançlı satırlar (T5), eşitlikte sepete ekleme sırası. `removed` otomatiğe girmez. Süresi en erken dolan kupon önce kullanılır.
   - Kampanya FROZEN ise kuponlar yine uygulanır (T14). INVISIBLE ise (HIDDEN modda test dışı üye) kuponu da yoktur.
3. **Kod kutusu:** kod üyeye ait geçerli bir `KalpCoupon` ise `manual`'e eklenir, kuponsuz kalan en çok kazançlı tek satıra gider. Başkasının kodu reddedilir. Kalp kodu `resolveBestDiscount`'a gitmez.
4. Kuponlu adet **çıkarılmış** satırlarla bundle ve `resolveBestDiscount` (otomatik + kodlu) hesaplanır. Üst üste binme olmaz.
5. **Puan (T7):** tavan = kuponsuz satırların bundle/kupon sonrası net tutarı.
6. Kargo net tutardan.

**`ORDER` modu:**
- `Customer` satırı kilitlenir. Kuponlar koşullu `updateMany` ile `RESERVED` olur. Eksik kalırsa `KalpCouponInvalidError`.
- Kuponlu satır iki `OrderItem`'a bölünür: 1 adet kuponlu net fiyat + `kalpCouponId` + `kalpOriginalUnitCents`, kalan adetler normal.
- `Order.kalpDiscountCents` yazılır. `expectedPriceCents` net fiyatla kontrol edilir.
- PAID'de (`reconcile.ts`) `USED`.
- Ödenmeyen sipariş süresi dolunca (`expire.ts`) `AVAILABLE` (süresi geçtiyse geçersiz kalır).
- Puan kazanımı `Order.totalCents` üzerinden (değişiklik yok).

#### 5.6.1 Bonus kredisi yerleştirme (T4, Y5) — `bonus.ts`

Her çağrı davet edenin `Customer` satırı kilitliyken yapılır.
1. Davetin `productId`'sinde davet edenin `ACTIVE` kalbi varsa → o bar.
2. Yoksa davet edenin `ACTIVE` kalplerinden dolmaya en yakın bar (en küçük `threshold − points`, eşitlikte en eski kalp).
3. Hiç `ACTIVE` kalbi yoksa → `WAITING`, `expiresAt = oluşturma + 30 gün`.
- **Birden fazla `WAITING` kredi** varsa davet edenin ilk `ACTIVE` olan kalbinin barına **hepsi birlikte** eklenir (Y5). Bar dolarsa artan kısım 5.2 adım 4'e göre yeni bir bekleyen kredi olur ve 30 günü baştan başlar (Y11).
- Tek bir kredi de (ör. bar 9'dayken +2) barı aşarsa aynı kural uygulanır: artan 1 puan bekleyen bonusa döner (Y11).
- Yerleştirme `KalpBar` kilidi altında yapılır: `points += kredi.points`, kredi `APPLIED` (+ `heartId`, `roundId`), eşik kontrolü.
- Kampanya FROZEN iken yerleştirme yapılmaz.
- 30 gün dolan `WAITING` krediler günlük cron'da `EXPIRED` olur ve sahibine site içi bildirim "Bekleyen bonusun süresi doldu" gider.

### 5.7 Süre dolumu

Kupon geçerliliği her okumada `expiresAt > now` ile kontrol edilir. "Süresi dolan" raporu `AVAILABLE AND expiresAt < now` ile hesaplanır.

### 5.8 İade ve değişim (T6, Y6)

- **Tam iade → geri yükleme:** iki koşul birlikte aranır:
  - kuponlu satırı içeren IADE talebi **TAMAMLANDI**,
  - o satırın ücreti iade edilmiş (`refundedCents ≥ paidCents ?? unitPriceCents`).

  Kontrol hem `admin/iadeler` TAMAMLANDI geçişinden hem `refund.ts` başarılı iadesinden tetiklenir. Kalan süre = `expiresAt − usedAt`; sıfır ya da negatifse `refundExtraHours`. `kalpHandledAt` ile tek sefer çalışır. Denetim kaydı ve `COUPON_RESTORED` site içi bildirimi yazılır.
- **Değişim:** admin değişim ürünü/varyantını seçer. Sistem `exchangeUnitCents` ve `exchangeDiffCents` hesaplar ve gösterir:
  - aynı ürün başka beden/renk → fark 0;
  - farklı kampanyalı ürün → kupon taşınır, yeni fiyat `min(esas × %50, mevcutEnIyi)`;
  - farklı "Kalp Topla dışı" ürün → kupon TAMAMLANDI'da kalan süresiyle geri yüklenir, fark = yeni ürünün güncel fiyatı − ödenen kuponlu fiyat.
- **Fark (Y6):** otomatik tahsilat/iade yok. Ekranda açıkça "Müşteriden alınacak: X TL" ya da "Müşteriye ödenecek: X TL" yazar. Tahsilat/iade bugünkü gibi elle yapılır. Admin **"Fark tahsil edildi"** / **"Fark iade edildi"** butonuyla işaretler: `exchangeDiffSettledAt/By`, denetim kaydı `KALP_TOPLA_DEGISIM_FARK_KAPANDI`. Fark kapanmadan talep TAMAMLANDI yapılırsa uyarı çıkar (engellemez).
- **Kullanıcı kararı (2026-10-31):** kargodan önce ödemesi iptal edilen ya da tam iade edilen kuponlu satırda iade talebi aranmaz; kupon iyzico başarısından sonra döner. Süresi dolmuşsa dönmez, denetim kaydı ve sipariş notu olur. Kalan süre: iade anında süre bitmemişse `expiresAt − usedAt`, bitmişse kargolanmış iadede `refundExtraHours`.
- Admin iade ekranında kuponlu satır "Kalp Topla kuponlu · ödenen X TL (normal Y TL)" etiketiyle görünür.

### 5.9 Veri saklama ve temizlik (Y3)

Günlük temizlik cron'u (`/api/cron/kalp-topla-temizlik`, günde 1):
- `CustomerDevice` satırları 90 günden eskiyse silinir.
- `MarketingConsentLog`: aynı müşteri+kanal için onay şu an **geri çekilmiş** durumdaysa ve geri çekme kaydı 3 yıldan eskiyse, o kanalın o tarihe kadarki tüm satırlarında `ip = null`, `ipPurgedAt = now`. Onay geçerli olduğu sürece IP korunur.
- Kullanılmış ya da süresi geçmiş doğrulama tokenları (7 gün sonra) silinir.
- 30 günü dolan `WAITING` bonus kredileri `EXPIRED` yapılır.

### 5.10 Güvenlik özeti

- Tutarlar yalnız sunucuda (`priceCart`). Kupon sahibi her kullanımda kontrol edilir.
- Kalp, geri çekme, bonus: kilitli transaction + kısmi unique indeks.
- Tahmin edilemeyen davet ve kupon kodları. İmzalı/hash'li tokenlar.
- Bar uçları katılımcı kimliği vermez.
- Onay kayıtları, CSV ve davet inceleme ekranı yalnız ADMIN'e açık, indirmeler denetim kaydına yazılır.
- Gizli yayın modu tüm kampanya uçlarında sunucu tarafında kontrol edilir, yalnız arayüzde değil.
- Kötüye kullanım kuralları (cihaz/IP) hiçbir zaman kayıt, giriş, kalp ya da kupon isteğini reddetmez. Yalnız davet bonusunun durumunu belirler (Y2).

---

## 6. Arayüz

### 6.0 Favori → Kaydedilenler (T9, kampanyadan önce ayrı faz)
- İkon `Heart` → `Bookmark`. Etiketler "Kaydet / Kaydedildi". Hesabım menüsü ve sayfa "Kaydedilenler". `/hesap/kaydedilenler`, eski `/hesap/favorilerim` 301 ile yönlenir.
- Dosyalar: `product-card.tsx`, `product-viewer.tsx`, `favorilerim-grid.tsx`, `hesap-nav.tsx`, favorilerim sayfası (taşınır) ve sitedeki "Favori" metinleri (uygulamada `grep` ile tam liste).
- Değişmeyenler: `WishlistItem`, `lib/wishlist.tsx`, `api/favoriler`, localStorage anahtarı, Meta `AddToWishlist` / GA4 `add_to_wishlist`.

### 6.1 Ürün sayfası
- `components/kalp-topla/kalp-bar.tsx`, `GET /api/kalp-topla/bar?productId=` (`no-store`). Durum INVISIBLE ise hiç render edilmez, FROZEN ise gizli.
- Yerleşim: fiyatın altında. Bar + mesaj (turun eşiğiyle) + "❤ Kalp ver / Kalbimi geri çek" + "Arkadaşını çağır" + "Nasıl çalışır?".
- **Misafir:** "Üye ol, bu ürünün indirimini birlikte açalım" penceresi açılır → `/hesap/giris?sekme=kayit&callbackUrl=/urunler/{slug}&kalp={productId}`. Dönüşte kalp otomatik verilir. `PENDING` ise "E-postanı doğrula, kalbin sayılsın" + tekrar gönder.
- **Kullanıcı kararı (2026-10-31, aşağıdaki pencerede e-posta kutusunun yerine geçer):** kalp verene e-posta sorulmaz, onay otomatik açılır. Kalp ver butonunun altında tek satır not görünür. Kayıt `MarketingConsentLog` kaynak `KALP_VERME`, metin sürümü `EMAIL-KALP-2026-10-31`. Bir kez çıkmış üye yeniden açılmaz. Aşağıdaki ilk kalp penceresi tümüyle kaldırıldı (push sorusu dahil); push yalnız Hesabım > İletişim Tercihleri'nden açılır. `Customer.pushPromptDismissedAt` kullanılmıyor.
- **İlk kalp penceresi (T3, T15):** ilk kalpten sonra tek pencere açılır.
  - Başlık: "Bar dolunca sana haber verelim mi?"
  - ☐ "Kalp Topla ve kampanya bildirimlerini e-postayla almak istiyorum." (işaretsiz; onay zaten varsa gizli)
  - **Push bölümü yalnız** `"serviceWorker" in navigator && "PushManager" in window && "Notification" in window` ise ve izin `default` durumundaysa ve `pushPromptDismissedAt` 7 günden eski ya da boşsa görünür: kısa açıklama + [Evet, haber ver] [Şimdi değil].
    - "Evet": e-posta kutusu işaretliyse onay kaydı (`KALP_PENCERESI`) yazılır, ardından `Notification.requestPermission()` → abonelik.
    - "Şimdi değil": tarayıcı izni tetiklenmez, `pushPromptDismissedAt` yazılır.
  - Push desteklenmiyorsa (iPhone/iPad dahil) push bölümü hiç çıkmaz. Pencerede yalnız e-posta kutusu ve [Kaydet] [Kapat] bulunur. Ana ekran yönergesi **yoktur**.
  - E-posta onayı zaten varsa ve push bölümü de gösterilmeyecekse pencere hiç açılmaz.
- Hak dolu uyarısı, "Arkadaşını çağır" (Web Share API / kopyala / `wa.me`).

### 6.2 Katalog kartı
- Tek toplu istek `GET /api/kalp-topla/barlar?ids=...` (≤60). LIVE'da `s-maxage=60, stale-while-revalidate=300`, HIDDEN'da `no-store` + oturum kontrolü.
- `points > 0` ise rozet "❤ 6/10", son 2 kalpte vurgulu. Kartta kalp verme butonu yok.

### 6.3 Sepet ve ödeme
- Fiyatlar `POST /api/sepet/fiyat`'tan gelir (T17).
- Üst kutu: "❤️ X Kalp Topla kuponun var · %50 indirim uygulandı. En çok kazandıran X ürününe otomatik uyguladık." Uygun satır yoksa: "❤️ X Kalp Topla kuponun var. Sepetine kampanyalı bir ürün ekle, otomatik uygulayalım."
- Satır kontrolleri: kuponlu satırda ~~eski~~ yeni + "Kupon uygulandı [Kaldır]", kuponsuz uygun satırda "[Kupon uygula]".
- Seçim `CustomerCart.kalpSelectionJson`'da tutulur. Puan alanında "Puan, Kalp Topla kuponlu ürüne uygulanmaz" notu. Ödeme özetinde "Kalp Topla indirimi".

### 6.4 Hesabım > Kalplerim
- `hesap-nav.tsx`'e "Kalplerim" ve "Bildirimler" eklenir (INVISIBLE durumda gizli).
- Bölümler:
  - kalan hak (bekleyen kalpler dahil)
  - aktif ve bekleyen kalpler: bar, geri çek, "+2 bu ürüne gitsin" seçimi
  - **bekleyen bonuslar (Y5):** her biri için "+N kalp · {kalan gün} gün içinde ilk kalbinin barına eklenecek"
  - kuponlar: kod, geri sayım, durum, geri yüklendi etiketi
  - davet linki + kopyala + WhatsApp'ta paylaş
  - davet geçmişi (maskelenmiş ad; doğrulama bekliyor / incelemede / bekleyen bonus / +N eklendi / düştü / süresi doldu / iptal)
- Doğrulanmamış e-posta uyarısı.
- FROZEN'da "Kampanya duraklatıldı, barların korunuyor. Kalbini istersen geri çekebilirsin." notu.

### 6.5 Hesap ayarları: İletişim tercihleri (`hesap/(panel)/tercihler`)
- Telefon (opsiyonel).
- ☐ e-posta onayı (`HESAP_AYARLARI`).
- Tarayıcı bildirimleri aç/kapat: **yalnız push destekleniyorsa** görünür. Desteklenmiyorsa bu satır hiç gösterilmez. (Kullanıcı kararı 2026-10-30: bu satır push altyapısıyla birlikte Faz 8'de eklenir.)
- ☐ WhatsApp onayı ("yakında" notu).
- Her değişiklik `MarketingConsentLog`'a yazılır (IP + metin sürümü).

### 6.6 Kayıt formu
- Telefon (opsiyonel), ☐ e-posta onayı (`KAYIT_FORMU`), ☐ WhatsApp onayı, Aydınlatma Metni linki.
- Gizli alanlar: davet kodu, davet ürünü (T8). Cihaz kimliği sunucuda `bm_cihaz` çerezinden okunur.
- Push izni kayıtta istenmez.

### 6.7 Bildirim zili
- `site-header.tsx`'e zil (yalnız üyede, INVISIBLE durumda gizli). `GET /api/bildirimler?ozet=1`. Açılır liste + Hesabım > Bildirimler.

### 6.8 Kampanya sayfası `/kalp-topla`
- Hero, 3 adım, en çok dolan ürünler, dolmak üzere olanlar, SSS, koşullar linki, OG görseli.
- HIDDEN'da test hesabı olmayana 404. iPhone/ana ekran yönergesi **yoktur**.

### 6.9 Duyuru şeridi ve ilk ziyaret penceresi
- Şerit ve pencere istemcide `durum` yanıtına göre render edilir (ISR sızıntısı olmasın).
- Pencere localStorage `bm_kalp_tanitim=1` ile bir kez, çerez bandından sonra. `/kalp-topla`, ödeme ve hesap sayfalarında çıkmaz.

### 6.10 Abonelikten çıkma sayfası
- `/abonelik/iptal?t={imzalı token}`: girişsiz. Sayfa açılınca istemciden otomatik POST gönderilir, sonuç gösterilir. JS yoksa tek buton görünür.
- GET işlem yapmaz: e-posta güvenlik tarayıcıları linki önceden açabilir. `List-Unsubscribe-Post` aynı uca POST eder.

### 6.11 Admin
- **`admin/kalp-topla` Ayarlar:**
  - **Mod:** Kapalı / Gizli yayın / Açık. Gizli yayın seçiliyken **test hesapları** seçicisi (müşteri e-postasıyla ara-ekle) ve **"Test eşiği"** alanı (varsayılan 2, yalnız gizli moddaki test turlarına uygulanır, Y12).
  - **Açık'a geçiş onayı (Y12/Y15):** test verisi varsa kaydetmeden önce onay penceresi açılır:
    - "Herkese açılınca test verisi sıfırlanacak" + sayılar;
    - kullanılmamış test kuponlarının iptal edileceği (test-iptal) notu;
    - ödenmiş test siparişlerinin silinmeyip raporlardan hariç tutulacağı notu;
    - ödenmemiş test siparişi varsa bunların listesi ve **"Siparişleri iptal et ve devam et"** / **"Vazgeç"** seçenekleri.

    Onaylanmadan mod değişmez.
  - Açıklamalar:
    - "Gizli yayında kampanyayı yalnız bu hesaplar görür."
    - "Kapalı: barlar dondurulur, kalp verilemez ama geri çekilebilir, kazanılmış kuponlar süreleri boyunca geçerli."
  - Kampanya değerleri (7 alan).
  - Eşik altında sabit uyarı: "Eşik değişikliği yalnız yeni başlayan turlara uygulanır. Şu an açık N tur, başladıkları eşikle devam eder." (T16)
  - **Kötüye kullanım (Y2):**
    - "Aynı cihazdan bonusu otomatik sayılan hesap sayısı" (varsayılan 1; sonrakiler incelemede),
    - "Aynı IP penceresi (saat)" (24),
    - "Aynı IP işareti için yeni hesap sayısı" (3).
    - Açıklama: "Bu kurallar üyeliği, kalbi ya da kuponu engellemez, yalnız +2 davet bonusunu etkiler. Aynı IP yalnız işarettir, bonusu durdurmaz."
  - **Engelli e-posta alan adları (Y4):** ekle/sil listesi, npm paketindeki listeye ektir.
  - Tüm değişiklikler denetim kaydı (`KALP_TOPLA_AYAR_DEGISTI`, `KALP_TOPLA_MOD_DEGISTI`, `KALP_TOPLA_ALAN_ADI_ENGELLENDI`).
- **Rapor:**
  - kartlar ve tablolar (dolan ürünler, aktif barlar, talep tablosu, kupon sayıları, ciro, indirim, geçerli davet sayısı)
  - bekleyen/süresi dolan bonus sayıları
  - test verisi (`isTest` turlar/kuponlar, `kalpTestAt` dolu siparişler) raporlardan hariç (Y12)
- **Davetler (T2/Y2/Y5/Y13):**
  - Filtreler: incelemede / kredilendi / bekleyen / iptal / **aynı IP işaretli**.
  - Sütunlar: davet eden, davetli, inceleme nedenleri (aynı cihaz, davet edenle aynı cihaz), **"aynı IP" rozeti** (yalnız bilgi), aynı cihaz/IP özetinden hesap sayısı, kredi durumu (uygulanan / bekleyen / artan kısımdan doğan).
  - Tek tıkla **Onayla** / **İptal** (iptal için açıklama opsiyonel). "Aynı IP" işaretli ama incelemede olmayan bir daveti admin isterse yine iptal edebilir.
- **Onaylar (T3):** liste + CSV (`GET /api/admin/kalp-topla/onaylar.csv`, tarih aralığı, UTF-8 BOM). Sütunlar: müşteri id, e-posta, kanal, verildi/geri çekildi, tarih-saat (İstanbul), kaynak, IP (silinmişse "silindi (3 yıl)"), metin sürümü. İndirme denetim kaydına yazılır (`KALP_TOPLA_ONAY_CSV_INDIRILDI`).
- **Ürün formu:** "Kalp Topla dışı" checkbox'ı.
- **İade ekranı:** kuponlu satır etiketi, değişim ürünü seçimi, hesaplanan fiyat, **"Müşteriden alınacak / Müşteriye ödenecek: X TL"**, "Fark tahsil edildi" / "Fark iade edildi" butonları (Y6).
- **Menü:** "Kalp Topla" (Ayarlar / Rapor / Davetler / Onaylar), yalnız ADMIN.
- **Müşteri detayı:** doğrulama, kalpler, kuponlar, bonus kredileri, onaylar, cihaz eşleşmeleri; kupon iptal/süre uzatma (denetim kaydıyla).

---

## 7. Bildirimler

### 7.1 Kanallar ve kurallar

| Olay | Site içi | Web push (destekleyen tarayıcı + izin) | E-posta (yalnız onaylı üye) |
|---|---|---|---|
| **Kupon kazandın** | anında | anında | **anında, sınırsız** |
| **Kuponunun son 6 saati** | anında (cron) | anında | **zamanında, kupon başına en çok 1, günlük sınır dışı** (Y1) |
| **Son 2 kalp** | anında | anında | günlük sınıra tabi |
| **Arkadaşın katıldı** | anında | anında | günlük sınıra tabi |
| Bekleyen bonusun süresi doldu / Kupon geri yüklendi | anında | — | — |

- **Günlük sınır (Y1):**
  - Kişi başı, İstanbul günü (`Europe/Istanbul`, `istanbulDateKey`) başına en çok 1 e-posta. Yalnız "son 2 kalp" ve "arkadaşın katıldı" bu sınıra tabidir.
  - Günün ilk böyle olayı **anında** tek e-postayla gider (`ReminderEmailDay` satırı atomik olarak yazılır).
  - Aynı gün sonraki olayların e-postası **gönderilmez** (`SKIPPED_DAILY_LIMIT`). Bu olaylar yalnız site içi ve (varsa) push ile iletilir, ertesi güne **taşınmaz**.
  - Birleştirme/özet e-postası **yoktur**.
- Onaysız üye: site içi + (destekleniyor ve izin verilmişse) push. Kuponlar her durumda Kalplerim'de.
- Aynı olay tekrar üretilemez (`eventKey` unique).

### 7.2 Akış (outbox)
1. Olayı doğuran transaction `Notification` satırını yazar (`createMany({ skipDuplicates: true })`).
2. Commit sonrası, yanıtı bekletmeden (`after()` – Next 16, uygulamada `node_modules/next/dist/docs` ile teyit):
   - push varsa gönderilir;
   - e-posta 7.1 kurallarına göre ve onay o an yeniden okunarak gönderilir.
3. Saatlik cron `PENDING/FAILED` olanları (24 saatten genç) yeniden dener. Günlük sınır hesabı denemede de aynı kuralla yapılır.

### 7.3 Onay kontrolü ve çıkış
- E-posta yalnız `marketingEmailAt != null` olana gider.
- Her e-postada "Bu bildirimleri almak istemiyorum" → `/abonelik/iptal?t=...` (HMAC imzalı, girişsiz, süresiz). Başlıklar: `List-Unsubscribe` (https + mailto) ve `List-Unsubscribe-Post: List-Unsubscribe=One-Click`. `sendMail`'e `headers` parametresi eklenir.
- Çıkış: `marketingEmailAt = null` + `MarketingConsentLog(granted=false, source=ABONELIK_IPTAL_LINKI, ip)`.

### 7.4 E-posta şablonları (örnek metinler)

Ortak tasarım:
- logo, 600px tek sütun, ürün görseli (R2 `.jpg`), tek ana buton;
- altta kampanya koşulları linki ve "Bu bildirimleri almak istemiyorum";
- HTML + düz metin.

**1) Kupon kazandın** (anında, sınırsız)
- Konu: `🎉 Kilit açıldı! %50 kuponun hazır`
- Ön izleme: `48 saat içinde istediğin ürünü yarı fiyatına al.`
- Gövde:
  > **Tebrikler {Ad}, kilidi birlikte açtınız! ❤️**
  > Kalp verdiğin **{Ürün adı}** {10} kalbe ulaştı. %50 indirim kuponun hesabında.
  > [Ürün görseli]
  > **Kupon kodun: KALP-7KD2QX**
  > ⏳ **{5 Kasım, 14:30}**'a kadar geçerli (48 saat).
  > Kuponunu sepetinde en çok kazandıran ürüne otomatik uygularız. Dilersen başka bir ürün de seçebilirsin.
  > **[Alışverişe başla]**
  > Kupon tek ürünün tek adedinde geçerlidir, başka kampanyalarla birleşmez.

**2) Son 2 kalp** (günlük sınıra tabi)
- Konu: `❤️ Son 2 kalp kaldı! Arkadaşını çağır`
- Ön izleme: `{Ürün adı} %50'ye çok yakın.`
- Gövde:
  > **{Ürün adı}** barı **{8}/{10}**. Kilidin açılmasına sadece **{2} kalp** kaldı!
  > [Ürün görseli + bar]
  > Senin linkinle üye olan her arkadaşın barına **+2 kalp** ekler.
  > **[WhatsApp'ta paylaş]** · [Linki kopyala]

**3) Arkadaşın katıldı** (günlük sınıra tabi)
- Konu: `🙌 Arkadaşın katıldı, barına +2 kalp eklendi`
- Ön izleme: `{Ürün adı} barı şimdi {7}/{10}.`
- Gövde:
  > Davet ettiğin arkadaşın Bollmark'a katıldı, **{Ürün adı}** barına **+2 kalp** eklendi. 🎉
  > Bar şimdi **{7}/{10}**. {3} kalp daha, kilit açılsın!
  > **[Barı gör]** · [Bir arkadaşını daha çağır]
  > *(Bonus bekleyen bonusa yazıldıysa:)* Şu an aktif bir kalbin yok. +2 kalbin {30} gün içinde vereceğin ilk kalbin barına eklenecek. **[Kalp vermeye başla]**

**4) Kuponunun son 6 saati** (kupon başına 1, sınır dışı)
- Konu: `⏰ Kuponunun son 6 saati!`
- Ön izleme: `%50 kuponun bugün {20:30}'da sona eriyor.`
- Gövde:
  > {Ad}, %50 Kalp Topla kuponunun süresi **{bugün 20:30}**'da doluyor.
  > **Kupon kodun: KALP-7KD2QX**
  > Sepetinde en çok kazandıran ürüne otomatik uygulanır.
  > **[Alışverişe başla]**

**Doğrulama e-postası** (işlemsel, onaydan bağımsız): Konu `Bollmark: e-postanı doğrula, kalbin sayılsın ❤️`, buton `[E-postamı doğrula]`, 24 saat. Kayıtta giden doğrulama e-postası (Faz 3 kararı) kampanyadan bahsetmez: konu `Bollmark: e-posta adresini doğrula`.

### 7.5 Web push (T15)
- Yalnız tarayıcıda doğrudan destekleyen cihazlarda sunulur (Android ve masaüstü tarayıcılar). Desteği özellik tespiti belirler (`serviceWorker`, `PushManager`, `Notification`).
- **iPhone/iPad için push yapılmaz:** web app manifest eklenmez, "ana ekrana ekle" yönergesi gösterilmez. Bu cihazlarda push sorusu hiç çıkmaz, kullanıcı e-posta onay kutusunu görür ve bildirimleri e-posta (onaylıysa) ve site içi alır.
- `public/sw.js` (yalnız `push` ve `notificationclick`), `web-push` paketi, VAPID env'leri (`NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`).
- 404/410 dönen abonelikler silinir.

### 7.6 Zamanlanmış işler (Vercel)
- `vercel.json`:
  - `{ "path": "/api/cron/kalp-topla", "schedule": "0 * * * *" }` (saatlik)
  - `{ "path": "/api/cron/kalp-topla-temizlik", "schedule": "30 3 * * *" }` (günde 1)
- Saatlik görevler:
  - 6 saatten az kalmış `AVAILABLE` kuponlara `COUPON_EXPIRING` olayı ve e-postası. `expiringEmailAt` ile kupon başına bir kez, 5–6 saat kala.
  - Outbox tekrar denemeleri.
  - Kampanya FROZEN'dan ACTIVE'e döndüyse bekleyen kredilerin yerleştirilmesi.
- Günlük görevler: 5.9 temizlikleri ve 30 günü dolan bekleyen bonuslar.

---

## 8. Yasal ve uyum

- **E-posta ve push onayı (T3):**
  - ayrı, işaretsiz kutular;
  - kayıt: kullanıcı, tarih-saat, kaynak, IP, metin sürümü;
  - tek tık çıkış + `List-Unsubscribe`;
  - CSV dışa aktarım.
  - İlk sürümde İYS kaydı ve entegrasyonu yapılmaz (Faz 2 notu).
- **Veri saklama (Y3):**
  - onay kaydındaki IP, onay geçerli olduğu sürece ve geri çekildikten sonra 3 yıl tutulur, sonra otomatik silinir;
  - kötüye kullanım kontrolü için cihaz kimliği ve IP özeti 90 gün tutulur.
- **Çerezler:**
  - `bm_davet`: birinci taraf, işlevsel, 7 gün, yalnız davet kodu ve ürün (T8).
  - `bm_cihaz`: birinci taraf, işlevsel, rastgele cihaz kimliği, 1 yıl (Y2).
  - İkisi de Çerez Politikası'na eklenir. **Davet çerezinin (ve cihaz çerezinin) işlevsel sınıflandırması hukuki olarak teyit edilecek.**
- **Gizlilik Politikası'nın güncellenmesi:** bugünkü "IP saklanmaz" ifadeleri Kalp Topla kapsamı için düzeltilir. Taslak aşağıda.
- **Kampanya koşulları** (`LegalPage` slug `kalp-topla-kosullari`), sade dille:
  - üyelik ve e-posta doğrulama, 3 kalp hakkı ve bekleyen kalp, tur ve eşik değişikliği;
  - davet ve +2, bekleyen bonus (30 gün, ilk kalbe eklenir, artan kısım yeniden bekler);
  - şüpheli davetlerin incelenmesi ve iptali, geçici e-posta adreslerinin kabul edilmemesi;
  - kupon %50 / 48 saat / tek ürün tek adet, orijinal fiyat kuralı, birleşmeme, puan kullanılamaması;
  - iade (TAMAMLANDI + ücret iadesi sonrası geri yükleme) ve değişim (fark elle tahsil/iade);
  - kampanyanın duraklatılabilmesi, kuponların korunması, duraklatmada kalp geri çekilebilmesi;
  - kötüye kullanımda iptal.
- **Mesafeli satış / ön bilgilendirme:** kuponlu satır net fiyatla görünür (uygulamada kontrol).
- **İndirim gösterimi:** %50 kişisel ve koşullu, ürün sayfasında indirimli fiyat gibi gösterilmez.

### 8.1 Gizlilik Politikası'na eklenecek metin (taslak)

> **Kalp Topla kampanyası kapsamında işlenen veriler**
>
> Kalp Topla kampanyasına katıldığınızda şu verileri işleriz:
> - **Kampanya verileri:** kalp verdiğiniz ürünler, kalp verme ve geri çekme zamanları, kazandığınız ve kullandığınız kuponlar, davet kodunuz, davet ettiğiniz ve sizi davet eden üyeler. Amaç: kampanyayı yürütmek, kuponlarınızı hesabınıza tanımlamak ve hangi ürünlere ne kadar talep olduğunu analiz etmek. Hukuki sebep: sözleşmenin kurulması ve ifası, meşru menfaat (talep analizi). Bu veriler üyeliğiniz süresince saklanır.
> - **E-posta doğrulama:** e-posta adresinizin size ait olduğunu doğrulamak için tek kullanımlık bir doğrulama bağlantısı göndeririz.
> - **Kötüye kullanımın önlenmesi:** davet bonusunun sahte hesaplarla kullanılmasını önlemek için, üye olurken ve giriş yaparken tarayıcınıza yerleştirdiğimiz rastgele cihaz kimliğini ve IP adresinizin geri döndürülemez özetini (ham IP adresi değil) kaydederiz. Amaç: aynı cihazdan ya da kısa sürede aynı ağdan açılan çok sayıda hesabı tespit etmek. Hukuki sebep: meşru menfaat. Bu veriler **90 gün** sonra otomatik silinir.
> - **Ticari elektronik ileti onayı:** kampanya e-postası almayı kabul ettiğinizde ya da onayınızı geri çektiğinizde; tarih ve saat, işlemi yaptığınız yer (kayıt formu, hesap ayarları, kampanya penceresi ya da e-postadaki bağlantı), onay metninin sürümü ve **o andaki IP adresiniz** kaydedilir. Amaç: onayınızı ispatlayabilmek. Hukuki sebep: hukuki yükümlülük ve bir hakkın tesisi/korunması. Onayınız geçerli olduğu sürece ve geri çektiğiniz tarihten itibaren **3 yıl** saklanır, ardından IP adresi otomatik silinir.
> - **Tarayıcı bildirimleri:** izin verirseniz tarayıcınızın bildirim aboneliği bilgileri (bildirim adresi ve şifreleme anahtarları) saklanır. İzni tarayıcı ayarlarından ya da Hesabım > İletişim Tercihleri'nden istediğiniz an kaldırabilirsiniz.
> - **Telefon ve WhatsApp onayı:** telefon numaranızı ve WhatsApp kampanya onayınızı paylaşırsanız ileride WhatsApp bildirimleri için saklarız. Bu kanaldan şu an ileti gönderilmemektedir.
> - **Davet edenle paylaşılan bilgi:** davet ettiğiniz arkadaşınızın üyeliği, size yalnızca kısaltılmış adıyla (ör. "A*** K.") gösterilir.
>
> Kampanya e-postalarından her e-postanın altındaki "Bu bildirimleri almak istemiyorum" bağlantısıyla, giriş yapmanıza gerek kalmadan ayrılabilirsiniz.

Not: mevcut metindeki "IP adresiniz saklanmaz" ifadesi şöyle değiştirilecek: "Çerez tercihleriniz ve reklam ölçümü için IP adresiniz saklanmaz; yalnızca yukarıda Kalp Topla bölümünde açıklanan durumlarda ve sürelerde saklanır."

### 8.2 Çerez Politikası'na eklenecek satırlar (taslak)

| Çerez | Sağlayıcı | Tür | Süre | Amaç |
|---|---|---|---|---|
| `bm_davet` | Bollmark (birinci taraf) | İşlevsel | 7 gün | Bir davet bağlantısıyla geldiğinizde, üye olursanız davet eden arkadaşınızı tanımak için yalnızca davet kodunu ve ilgili ürünü tutar. |
| `bm_cihaz` | Bollmark (birinci taraf) | İşlevsel | 1 yıl | Davet bonusunun sahte hesaplarla kötüye kullanılmasını önlemek için rastgele bir cihaz kimliği tutar. Kimliğinizi ya da tarayıcı özelliklerinizi içermez. |
| `bm_kalp_tanitim` (yerel depolama) | Bollmark | İşlevsel | süresiz | Kampanya tanıtım penceresinin size bir kez gösterilmesi için. |

---

## 9. Uygulama fazları ve sırası

Her faz localhost'ta, **canlı veritabanına** bağlı olarak test edilir (T13 güncel: test branch'i yok). Her faz sonunda tsc, `npm test`, değişen dosyalarda lint, 1280/375 ekran görüntüleri ve kullanıcı onayı. Şema değişiklikleri yalnız eklemelidir ve her biri kullanıcı onayıyla uygulanır (T13 kural 1–2). Kampanya test verisi `isTest` ile işaretlenir ve Açık'a geçişte temizlenir (T13 kural 3).

| Faz | Kapsam | Test / tamamlanma koşulu |
|---|---|---|
| **0. Yerel ortam güvenliği (T13 güncel)** ✅ Tamamlandı (2026-10-30) | Test branch'i yok, localhost canlı DB'yi kullanır (`.env` veritabanı ayarına dokunulmaz). 1) Yerelde gönderilen TÜM e-postalar yalnız ozilevent@gmail.com'a gider, konuya "[TEST → asıl alıcı: ...]" eklenir; yalnız yerel ortam değişkeniyle (`MAIL_DEV_REDIRECT`) çalışır, Vercel'de tanımsız. 2) Localhost'ta web push yalnız kullanıcının kendi hesaplarına gönderilir (push kodu Faz 8'de bu kuralla yazılır). 3) Localhost'ta iyzico sandbox kontrolü. 4) Localhost'tan Vega'ya istek gitmediğinin kontrolü. **Karar (2026-10-30):** Localhost test siparişleri Vega'ya düşebilir, kabul edildi; gerekirse Vega'dan elle silinir. Vega tarafında önlem ya da kod değişikliği yapılmaz. 5) Vercel, canlı deploy, Neon, iyzico/Vega/e-posta/DNS/Meta panellerine dokunulmaz. | E-posta yönlendirmesi, iyzico ve Vega kontrollerinin sonucu kullanıcıya raporlanır. Canlı siteye dokunulmadığı doğrulanır. |
| **1. Kaydedilenler (T9)** ✅ Tamamlandı (2026-10-30) | Favori → yer imi + "Kaydet / Kaydedilenler", sayfa taşıma + 301. Ayrı yayınlanabilir. | Kaydet/çıkar, misafir senkronu, eski URL, Meta/GA4 olayları. |
| **2. Temel** ✅ Tamamlandı (2026-10-30) | Şema (tümü), ayarlar (mod + test hesapları + test eşiği + kötüye kullanım eşikleri + engelli alan adları), ürün checkbox'ı, denetim eylemleri, `campaignStateFor` + `durum` ucu. Mod `OFF`. | Ayarlar, mod geçişleri, işlem geçmişi. |
| **3. Üyelik ve onay** ✅ Tamamlandı (2026-10-30) | E-posta doğrulama (her yeni kayıtta e-posta), T12/Y7 script'i (şimdi kuru, gerçek yayın fazında), geçici e-posta engeli (paket + admin listesi), `bm_cihaz` + `CustomerDevice`, kayıt formu, İletişim tercihleri (push satırı Faz 8'de), `MarketingConsentLog` (ham IP), abonelikten çıkma, onay CSV'si, temizlik cron'u. | Doğrulama akışı. Geçici alan adıyla kayıt reddi. Onay log satırları. Girişsiz çıkış. CSV. Temizlik cron'u tarih kaydırılmış test verisinde IP'leri siler. |
| **4. Bar ve kalp** ✅ Tamamlandı (2026-10-30) | `bar.ts`, kalp uçları, ürün sayfası bileşeni, misafir akışı, ilk kalp penceresi (e-posta kutusu; push bölümü Faz 8'de bağlanır), katalog rozeti, Kalplerim (kalpler, hak), FROZEN/INVISIBLE davranışı, gizli mod görünürlüğü, test turları (test eşiği) ve Açık'a geçişte test sıfırlaması (Y12). | Eşik 3 ile tur kapanışı. Eşzamanlılık script'i. HIDDEN'da test dışı hesap hiçbir öğe görmez, test turları test eşiğiyle açılır. FROZEN'da geri çekme çalışır. 10.9 sıfırlama senaryosu. |
| **5. Davet** ✅ Tamamlandı (2026-10-30) | Davet kodu, `/davet/...`, çerez + gizli alan, cihaz kuralları (inceleme) ve aynı IP işareti (Y2/Y13), bonus kredileri ve yerleştirme (T4/Y5), artan kısmın bölünüp beklemeye dönmesi (Y11), 30 gün dolumu, admin Davetler ekranı (tek tık onay/iptal, Y11 iptal kuralı). | 10.2 senaryoları. |
| **6. Fiyat, sepet ve sipariş** ✅ Tamamlandı (2026-10-30; kullanıcı kararıyla ödemeyi yarıda bırakma, 2 adet + puan ve 1280/375 ekran görüntüleri yapılmadan kapatıldı, yayın öncesi bakılacak) | `priceCart` + `api/sepet/fiyat`, `pricing.ts` + testler, sepet/ödeme arayüzü, puan tavanı, `api/orders` bölme ve rezervasyon, USED/serbest bırakma. | Sandbox ödeme. iyzico sepet toplamı = sipariş toplamı. Vega'ya gidecek sipariş yanıtının (`vega-siparis.ts`) bölünmüş satırlarla doğru üretildiği birim testle doğrulanır. Canlı Vega kontrolü yayın fazında yapılır (Y10). Localhost sandbox test siparişlerinin (ortak DB üzerinden) Vega'ya düşmesi kabul edildi, bu faz için açık nokta değildir; gerekirse Vega'dan elle silinir (Faz 0 kararı). |
| **7. İade ve değişim** ✅ Tamamlandı (2026-10-31) | TAMAMLANDI + ücret iadesiyle geri yükleme, değişim ürünü/fiyat/fark, "fark tahsil/iade edildi" işaretleme. | 10.7 senaryoları. |
| **8. Bildirimler** ✅ Tamamlandı (2026-10-31; kullanıcı kararıyla ilk kalp penceresi kalktı, gerçek push testi yapılmadı, yayın öncesi bakılacak) | Outbox, zil, 4 e-posta şablonu, günlük sınır (Y1), "son 6 saat" sınır dışı, push (özellik tespiti, sw.js, VAPID, ilk kalp penceresinin push bölümü, İletişim tercihlerindeki push satırı), saatlik cron. Localhost'ta push yalnız kullanıcının kendi hesaplarına gönderilir (Faz 0 kural 2). | 10.10 senaryoları. Push Chrome masaüstü ve Android'de. iPhone Safari'de push bölümünün hiç çıkmadığı kontrol edilir. |
| **9. Vitrin** | `/kalp-topla`, duyuru şeridi, ilk ziyaret penceresi, kampanya koşulları, Gizlilik ve Çerez metinleri (8.1, 8.2). | Ekran görüntüleri, çerez bandıyla çakışma. |
| **10. Rapor** | Rapor, talep, bonus sayıları, müşteri detayı. | Test verisiyle elle sayım. |
| **11. Yayın** | Aşağıdaki kontrol listesi. | Listenin tamamı. |

### 9.1 Yayın fazı kontrol listesi (Y10)
1. Canlı DB'ye şema (`db push`, kısmi indeks dahil). Vercel'e env'ler: VAPID, abonelik HMAC anahtarı, `DEVICE_IP_SALT`.
2. T12/Y7 script'i canlıda önce kuru çalıştırılır, sayılar kullanıcıya gösterilir, onayla gerçek çalıştırılır.
3. Gizlilik, Çerez ve Kampanya koşulları metinleri DB'ye hedefli yazılır (kullanıcı onayıyla).
4. Admin'de mod **Gizli yayın**. Test hesapları olarak kullanıcının kendi hesabı ve en az bir ek hesap eklenir (test eşiği varsayılan 2). İki test hesabı aynı ürüne kalp verir, test turu dolar, kuponlar oluşur (Y12).
5. Kullanıcı kendi hesabıyla **gerçek bir kuponlu sipariş** verir (iyzico canlı).
6. Kontrol:
   - siparişin admin'de iki ayrı satırla (kuponlu + normal) göründüğü,
   - Vega'ya ayrı satırlarla ve doğru tutarlarla düştüğü,
   - fatura tarafında (Arctos/BLM serisi) satır tutarlarının ve KDV'nin doğru olduğu.
7. Gerekirse sipariş iptal/iade edilir. Kuponun geri yüklenmesi de bu sırada doğrulanır.
8. Mod **Açık**'a alınır. Onay penceresinde test verisi sayıları ve varsa ödenmemiş test siparişleri kontrol edilip onaylanır (Y12/Y15). Kontrol:
   - test turlarının, kalplerin, davetlerin ve bekleyen test bonuslarının silindiği,
   - kullanılmamış test kuponlarının `TEST_CANCELLED` olduğu ve sepette uygulanmadığı,
   - ödenmemiş test siparişi varsa iptal edildiği,
   - test siparişinin silinmeyip `kalpTestAt` ile işaretlendiği ve rapordan hariç olduğu,
   - test edilen ürünün barının normal eşikle (10) 0'dan başladığı.
9. Canlıda test hesabı olmayan bir ziyaretçi hesabıyla bar, şerit ve kampanya sayfasının göründüğü kontrol edilir.
10. DEPLOY_STATUS ve günlük güncellenir.

---

## 10. Test senaryoları

`pricing.ts`, `price-cart.ts` ve `bonus.ts` yerleştirme mantığı birim testli. DB'li senaryolar `scripts/kalp-topla-senaryo.ts` ile yalnız test branch'inde çalışır. Script canlı DB adresini görürse durur.

### 10.1 Eşzamanlı kalp
- Bar 9/10, 5 eşzamanlı kalp → tek kapanış, 10 kupon, yeni turda 4.
- Aynı üye aynı ürüne 3 eşzamanlı istek → tek kalp.
- 2 hakkı dolu üye, 3 eşzamanlı kalp → yalnız 1 kabul.
- 3 PENDING kalbi olan üye 4. kalbi veremez (T1).

### 10.2 Davet, bonus ve kötüye kullanım
- Bar 9, davetli doğrular → +2 → tur kapanır.
- Link ürününde aktif kalp yok, davet edenin barları 5/10 ve 8/10 → bonus 8/10'a.
- Davet edenin hiç aktif kalbi yok → bekleyen bonus (30 gün). İlk kalp → bar 1 + 2 = 3.
- 3 bekleyen bonus (6 puan) + ilk kalp, eşik 5:
  - bar 1 + 2 + 2 = 5'te dolar, 3. kredinin 2 puanı tamamen bekleyen bonusa döner, 30 günü baştan başlar;
  - davet edenin başka aktif barı varsa oraya eklenir (Y11).
- Bar 9, tek davet +2 → tur kapanır. Artan 1 puan yeni bekleyen kredi olur (`splitFromId` dolu, 30 gün baştan). Ana kredinin 1 puanı `ROUND_CLOSED`.
- Bar 9, kalp +1 → tur kapanır, artan yok.
- Bekleyen bonus 30 günü doldurur → EXPIRED + site içi bildirim. Kampanya kapalıyken de süre işler.
- Admin iptali (Y11), bir davetin üç kredisi var (ROUND_CLOSED 1 puan, açık barda APPLIED 1 puan, WAITING 1 puan):
  - WAITING silinir,
  - APPLIED puanı bardan düşer,
  - ROUND_CLOSED'a dokunulmaz, kupon kalır,
  - davet geçerli davet sayısından çıkar.
- Kampanya FROZEN iken davetli doğrular → kredi WAITING. Kampanya açılınca saatlik cron T4 ile yerleştirir.
- Aynı `bm_cihaz` ile ikinci hesap doğrular → UNDER_REVIEW (`SAME_DEVICE`). Ayar 2 yapılırsa ikinci hesap geçer, üçüncü incelemeye düşer.
- Davet edenin girişte görüldüğü cihazdan davetli kayıt olur → UNDER_REVIEW (`SAME_DEVICE_AS_INVITER`).
- Aynı IP özetinden 24 saatte 2 yeni hesap → işaret yok. 3. hesap doğrular:
  - bonusu **normal** uygulanır, durumu CREDITED;
  - 3 hesabın davetleri "aynı IP" işareti alır;
  - önceki iki hesabın bara eklenmiş bonusları değişmez (Y2/Y13).
- Aynı IP'deki hesaplar (aile senaryosu) üye olur, kalp verir, kupon kazanır ve kullanır. Hiçbir adım reddedilmez.
- Aynı cihazdan ikinci hesap → üyelik, kalp ve kupon çalışır, yalnız davet bonusu UNDER_REVIEW.
- Admin onayı (tek tık) → onay anında T4 sırasıyla yerleşir.
- Paket listesindeki ve admin listesindeki alan adlarıyla (alt alan adı dahil) kayıt reddedilir, mesaj "Lütfen kalıcı bir e-posta adresi kullan" (Y14).
- Mevcut üye linke tıklar → davet yok.

### 10.3 Kalp geri çekme
- Bar 7 (A'nın kalbi + 2 bonus) → A geri çeker → bar 4, krediler VOID_WITHDRAWN, hak +1.
- Kampanya FROZEN iken geri çekme → başarılı, donmuş bar azalır. FROZEN iken yeni kalp → 409.
- Tur kapandıktan sonra geri çekme reddedilir.

### 10.4 Fiyat kuralı ve kazanç
| Orijinal | Satış | Otomatik kampanya | Kuponlu fiyat | Kazanç |
|---|---|---|---|---|
| 1000 | 1000 | yok | 500 | 500 |
| 1000 | 700 (manuel) | yok | 500 | 200 |
| 1000 | 400 (manuel) | yok | 400, atanmaz | 0 |
| 1000 | 1000 | %60 (→400) | 400, atanmaz | 0 |
| 1000 | 1000 | %20 (→800) | 500 | 300 |
| Varyant 1200/900 | | | 600 | 300 |

### 10.5 Birden fazla kupon
- 2 kupon; A (1000, kazanç 500), B (1200 → manuel 700, kazanç 100), C (800, kazanç 400) → A ve C.
- 2 kupon, tek satır adet 3 → 1 adet kuponlu.
- Kaldır/uygula, excluded ürün, erken biten kupon önce, kod kutusu, başkasının kodu.
- Önizleme ve sipariş tutarı aynı.

### 10.6 Aynı üründen 2 adet + puan
- İki `OrderItem`, iyzico toplamı eşit. Bundle/otomatik yalnız kuponsuz adede.
- Yalnız kuponlu satır → puan tavanı 0. Puan kazanımı `totalCents` üzerinden.

### 10.7 İade ve değişim
- Kalan 18 saat → TAMAMLANDI + ücret iadesi → 18 saatle geri. Ücret iadesi sonra gelirse yine geri. Süresi dolmuşsa 24 saat (ayar 12 → 12). Tek seferlik.
- Değişim: aynı ürün → fark 0. Farklı ürün (1600) → 800, fark +300 "Müşteriden alınacak". Farklı ürün (manuel 350) → fark −150 "Müşteriye ödenecek". Excluded ürün (1200) → kupon geri, fark +700.
- "Fark tahsil edildi" → işaret + denetim kaydı. Fark kapanmadan TAMAMLANDI → uyarı.

### 10.8 Süre dolumu
- Süresi geçmiş kupon sepette yok. Ödeme sırasında dolarsa sipariş durur.
- RESERVED kupon, sipariş süresi dolunca AVAILABLE olur.

### 10.9 Ayar ve mod (T14, T16, Y10)
- Açık tur eşik 10 ile başladı, ayar 6 → bu tur 10'da, sonraki 6'da kapanır.
- `OFF` (önceden açılmış) → FROZEN: kalp 409, geri çekme çalışır, kupon sepette çalışır, öğeler gizli. Açılınca aynı sayıdan devam.
- `HIDDEN`:
  - test hesabı her şeyi görür;
  - test dışı üye ve misafir hiçbir öğe görmez (bar, rozet, şerit, pencere, zil, `/kalp-topla` 404, uçlar 404);
  - ISR önbellekli ürün sayfası test hesabından sonra açıldığında da öğe göstermez;
  - davet linki test dışı hesaptan çerez yazmaz;
  - test turu `testThreshold` (2) ile açılır, 2 test hesabının kalbiyle dolar, kuponlar `isTest`.
- **HIDDEN → LIVE sıfırlaması (Y12):**
  - Onay penceresi sayıları doğru gösterir, onaylanmadan mod değişmez.
  - Onayla test turları, kalpler, davetler ve bekleyen test bonusları silinir.
  - Test kuponuyla verilmiş ödenmiş sipariş ve kuponu kalır, `kalpTestAt` / `isTest` ile rapordan hariç tutulur.
  - Kullanılmamış test kuponu `TEST_CANCELLED` olur: sepette uygulanmaz, Kalplerim'de görünmez, raporda yok.
  - Ödenmemiş test siparişi varsa pencerede listelenir:
    - "Vazgeç" → hiçbir şey değişmez, mod HIDDEN kalır;
    - "Siparişleri iptal et ve devam et" → sipariş iptal, normal kupon/puan iadesi, Kalp kuponu `TEST_CANCELLED`, mod LIVE;
    - ödeme denemesi canlıysa geçiş durur ve uyarı verir.
  - Test edilen ürünün barı ilk kalpte eşik 10 ile 0'dan açılır.
  - HIDDEN → OFF → LIVE yolunda da sıfırlama çalışır.

### 10.10 Bildirim ve onay
- Onaylı üye aynı gün önce "son 2 kalp", sonra "arkadaşın katıldı" → ilki e-posta + site içi + push, ikincisi yalnız site içi + push. Ertesi gün e-posta gitmez.
- Gün sınırı İstanbul saatiyle: 23:50'de bir olay, 00:10'da bir olay → iki ayrı günün e-postası.
- Aynı gün "son 2 kalp" e-postası gittikten sonra kupon "son 6 saat"e girer → "son 6 saat" e-postası **gider** (sınır dışı). Aynı kupon için ikinci kez gitmez.
- Aynı gün 3 bar doldu → 3 "kupon kazandın" e-postası.
- Onaysız üye → e-posta yok.
- Çıkış linki girişsiz çalışır, log satırı yazılır. GET önizlemesi onayı geri çekmez. `List-Unsubscribe-Post` çalışır.
- Push: Chrome masaüstü ve Android'de soru çıkar. "Şimdi değil" → 7 gün sorulmaz. iPhone Safari'de push bölümü hiç çıkmaz, yalnız e-posta kutusu. İletişim tercihlerinde push satırı yok.

### 10.11 Veri saklama (Y3)
- 91 günlük `CustomerDevice` satırı temizlikte silinir, 89 günlük kalır.
- Onay geri çekmesi 3 yıl + 1 gün önce → o kanalın IP'leri silinir, `ipPurgedAt` dolar. Onay hâlâ geçerli olan eski kayıtta IP kalır.

---

## 11. Faz 2 (ertelenenler, bu planda uygulanmayacak)

- **WhatsApp bildirimleri:** resmi WhatsApp Cloud API ile, mevcut Bulutfon numarası Coexistence özelliğiyle hem WhatsApp Business uygulamasında hem API'de kullanılarak. Gayriresmi araçlar (Evolution API, WAHA, Baileys, whatsapp-web.js vb.) numara kapatma riski nedeniyle KESİNLİKLE kullanılmayacak. Maliyeti düşürmek için:
  - müşterinin önce yazdığı 24 saatlik pencere (aylık 1.000 ücretsiz servis mesajı),
  - Click-to-WhatsApp reklamlarından gelenler için 7 günlük ücretsiz pencere,
  - sitede "Bildirimleri WhatsApp'tan al" butonu (wa.me linkiyle müşterinin hazır bir metin göndermesi).
  - Bunların dışındaki kupon bildirimleri ücretli şablon mesajla gider.
  - Hazırlık bu planda: `Customer.phone`, `marketingWhatsappAt`, `MarketingConsentLog(WHATSAPP)`.
- **"Şimdi al" kademeli indirimi:** bar dolmadan hemen almak isteyen kalp sahibine bar seviyesine göre sabit ve düşük indirim (ör. 1–4 kalp %10, 5–7 kalp %15, 8–9 kalp %20); erken alanın kalbi barda kalır.
- **Telefon doğrulama (T2):** yerli SMS sağlayıcısıyla (ör. Netgsm, İleti Merkezi, Mutlucell) OTP telefon doğrulama. Davet bonusu buna bağlanır, `phoneVerifiedAt` + `PhoneVerification` tablosu, aynı numara tek hesapta.
- **İYS (T3):** istenirse İYS kaydı ve İYS API entegrasyonu; mevcut onay kayıtlarının İYS'ye toplu yüklenmesi.
- **Otomatik değişim farkı tahsilatı (Y6):** pozitif farklar için iyzico ödeme linki, negatif farklar için tek tık kısmi iade.

---

## 12. Teknik kararlar

Kararlar kullanıcı tarafından 2026-10-29'da verildi ve planın ilgili bölümlerine işlendi.

**T1. Kayıt sonrası kalp.**
Karar: Misafir kalp verip kayıt olursa kalp "bekliyor" durumunda kaydedilir, bar sayısına girmez, e-posta doğrulanınca otomatik sayılır. Bekleyen kalp de 3 kalp hakkından birini kullanır. (→ 4.2, 5.1, 5.4, 6.1, 10.1)

**T2. Telefon doğrulama.**
Karar: İlk sürümde yapılmayacak, Faz 2'ye ertelendi. Davet bonusu davetlinin e-posta doğrulamasıyla sayılır. Kötüye kullanım önlemleri: geçici e-posta alan adları kayıtta engelli, admin şüpheli bonusları iptal edebilir. İptal edilen bonus bardan düşer. Bar zaten dolmuşsa kupon geri alınmaz, kayıt düşülür. Cihaz/IP kuralları Y2 (güncel) ile belirlendi: yalnız aynı cihaz incelemeye düşürür, aynı IP yalnız işarettir. Faz 2'ye "yerli SMS sağlayıcısıyla telefon doğrulama" eklendi. (→ 5.5, 6.11, 11; ayrıntılar Y2, Y4, Y11)

**T3. E-posta bildirimleri ve onay.**
Karar:
- İlk sürümde İYS kaydı/entegrasyonu yok.
- Onay metni "Kalp Topla ve kampanya bildirimlerini e-postayla almak istiyorum.", işaretsiz, üç yerde: kayıt formu, hesap ayarları, ilk kalp penceresi.
- Onay kaydı: kullanıcı, tarih-saat, kaynak, IP, metin sürümü. CSV ile dışa aktarılır.
- Dört kampanya e-postası emojili, görselli, butonlu.
- "Kupon kazandın" anında ve sınırsız. Diğer hatırlatmalar günde en çok 1 (Y1 ile güncellendi: "son 6 saat" sınır dışı, birleştirme yok).
- Tek tık çıkış + `List-Unsubscribe`.
- Onaysız üye site içi + push alır, kuponlar Kalplerim'de.
- Push izni ilk kalpte açıklama penceresiyle sorulur, reddedilirse 7 gün sorulmaz (T15 ile güncellendi: yalnız destekleyen tarayıcıda).
- Telefon ve WhatsApp onayı Faz 2 için toplanır. Faz 2'ye İYS notu eklendi.

(→ 4, 6.1, 6.5, 6.6, 6.10, 6.11, 7, 8, 11)

**T4. Davet edenin aktif kalbi yoksa.**
Karar: Bonus önce davet linkinin ürünündeki aktif kalbe, yoksa dolmaya en yakın aktif bara, hiç aktif kalp yoksa "bekleyen bonus" olarak hesaba yazılır ve verdiği ilk kalbin barına otomatik eklenir. Bekleyen bonus Kalplerim'de görünür. (→ 5.6.1, 6.4, 10.2)

**T5. Kuponun uygulanacağı satır.**
Karar: En çok kazanç (satış fiyatı − kuponlu fiyat) sağlayan uygun satırlara sırayla uygulanır. Metin: "En çok kazandıran X ürününe otomatik uyguladık." (→ 5.6, 6.3, 10.4, 10.5)

**T6. İade ve değişim.**
Karar:
- Kupon iade TAMAMLANDI olunca geri yüklenir. "Tam iade" = kuponlu ürün geri alındı ve ücreti iade edildi. Kalan süre korunur, dolmuşsa ek süre (varsayılan 24 saat).
- Aynı ürünün beden/renk değişiminde fiyat aynı.
- Farklı ürünle değişimde kupon taşınır, yeni fiyat orijinalin %50'si (indirimli fiyat daha düşükse o), fark tahsil/iade edilir.
- Yeni ürün "Kalp Topla dışı" ise kupon geri yüklenir, değişim normal fiyattan yapılır.

(→ 5.8, 6.11, 10.7; fark yöntemi Y6)

**T7. Sadakat puanı.**
Karar: Kuponlu satıra puan harcanamaz, diğer satırlarda kullanılır. Puan kazanımı fiilen ödenen tutar üzerinden. (→ 5.6, 6.3, 10.6)

**T8. Davet çerezi.**
Karar: Birinci taraf, yalnız davet kodu, 7 gün, işlevsel çerez. Kayıt formunda gizli alanla da taşınır. Çerez politikasına eklenir. Sınıflandırma hukuki olarak teyit edilecek. (→ 5.5, 6.6, 8, 8.2)

**T9. İkon ayrımı.**
Karar: Kalp ikonu yalnız Kalp Topla'nın. Favori → yer imi, "Kaydet / Kaydedilenler". Tüm "Favoriler" metinleri güncellenir, veri korunur. Kampanya arayüzünden önce ayrı faz. (→ 6.0, Faz 1)

**T10. Vega.**
Karar: Kuponlu siparişin ayrı satıra bölünmesi bir test siparişiyle Vega aktarımı/fatura tarafında kontrol edilir ve fazın tamamlanma koşuludur. (Y10 ile güncellendi: canlı kontrol yayın fazında, gizli yayın modunda yapılır. Faz 6 birim testle kapanır.) (→ 9, 9.1)

**T11. "Son 2 kalp" bildirimi.**
Karar: Site içi ve push ile anında. E-posta yalnız onaylı üyelere, günlük 1 hatırlatma sınırına uyarak. (→ 7.1)

**T12. Mevcut üyeler.**
Karar: En az bir ödenmiş siparişi olan mevcut üyeler doğrulanmış kabul edilir. Diğerlerine ilk kalpte doğrulama e-postası gider, kalpleri doğrulamaya kadar "bekliyor" kalır. (→ 5.4; tanım Y7)

**T13. Veritabanı (güncel karar, 2026-10-30).**
Karar: Ayrı test branch'i kullanılmaz; geliştirme canlı veritabanında yapılır. Site herkese açık olduğu için şu kurallar bütün fazlarda bağlayıcıdır:
1. Şema değişiklikleri yalnızca EKLEME şeklinde olur: yeni tablo, yeni alan (nullable ya da varsayılan değerli), yeni index. Mevcut tablo/alan silinmez, adı değiştirilmez, tipi değiştirilmez; mevcut veri silinmez ve değiştirilmez. Böylece henüz yeni kodu almamış canlı site bu değişikliklerden etkilenmez. T9'daki Favoriler → Kaydedilenler değişikliği yalnızca arayüz metinleri ve ikonla sınırlıdır, veritabanında favori tablosuna/alanlarına dokunulmaz.
2. Her şema değişikliğinden veya veri yazan scriptten önce kullanıcıya sade Türkçeyle ne ekleneceği, mevcut veriye ve canlı siteye etkisi olup olmadığı ve çalıştırılacak tam komut yazılır; açık onay beklenir. `prisma db push` sırasında veri kaybı uyarısı çıkarsa ASLA `--accept-data-loss` kullanılmaz, durulur ve kullanıcıya bildirilir.
3. Kampanya test verisi canlı veritabanında oluşacağı için tüm kampanya kayıtları gizli yayın modunda "test" olarak işaretlenir ve Y12/Y15'teki Açık'a geçiş sıfırlamasıyla temizlenir. Test sırasında oluşan test siparişleri de "test" olarak işaretlenip raporlardan hariç tutulur.

Elle uygulanan indeksler (Faz 5, 2026-10-30): `KalpBonusCredit_splitFromId_key` ve kısmi `KalpBonusCredit_root_unique` (`WHERE "splitFromId" IS NULL`), `prisma/manual-sql/2026-10-30-kalp-bonus-credit-indeksleri.sql` ile `prisma db execute` üzerinden uygulandı. İkisi de `schema.prisma`'da tanımlıdır (kısmi olan `partialIndexes` ile), şema ve DB aynıdır.

(Önceki karar "ayrı Neon test branch'i" idi; Neon plan sınırı nedeniyle kaldırıldı. Planın diğer bölümlerindeki "test branch'i" ifadeleri bu güncel karara göre okunur.) (→ 4, 9, 10)

**T14. Kampanya kapatılınca.**
Karar: Kazanılmış kuponlar süreleri bitene kadar geçerli. Açık barlar dondurulur (yeni kalp ve bonus alınmaz, sayılar korunur), yeniden açılınca kaldığı yerden devam eder. (→ 5.0, 5.9; geri çekme Y8)

**T15. Web push kapsamı (güncel karar).**
Karar: Web push yalnız tarayıcıda doğrudan destekleyen cihazlarda (Android ve masaüstü tarayıcılar) sunulur. iPhone/iPad için web push desteği yapılmayacak: web app manifest eklenmeyecek, "siteyi ana ekrana ekle" yönergesi gösterilmeyecek. Push sorusu yalnız tarayıcı push'u destekliyorsa (özellik tespitiyle) gösterilir. Desteklemeyen cihazlarda push sorusu hiç çıkmaz, kullanıcı yalnız e-posta onay kutusunu görür ve bildirimleri e-posta ve site içinden alır. `web-push` paketi kullanılır. (→ 6.1, 6.5, 7.5, 10.10)

**T16. Eşik değişikliği.**
Karar: Yeni eşik yalnız yeni turlara uygulanır, açık turlar başladıkları eşikle devam eder, admin ekranında açıkça yazar. (→ 4.2, 5.2, 6.11, 10.9)

**T17. Fiyat hesabı.**
Karar: Teknik tercih plana bırakıldı. Şart: tek fonksiyon, Kalp ve Coupon indirimi birlikte, istemciye güvenme. Seçilen yöntem `src/lib/pricing/price-cart.ts` → `priceCart()`: sepet/ödeme `POST /api/sepet/fiyat` (PREVIEW), sipariş transaction içinde (ORDER). Gerekçe 5.6'da. (→ 5.6, 6.3)

**Y1. Günlük hatırlatma e-postası zamanlaması.**
Karar: Günlük 1 hatırlatma e-postası, o kullanıcı için günün ilk hatırlatma olayıyla anında gönderilir. Aynı gün sonraki olaylar e-postayla gönderilmez, yalnız site içi ve (varsa) push ile iletilir, ertesi güne taşınmaz. "Gün" Europe/Istanbul. "Kuponunun son 6 saati" e-postası günlük sınırın dışındadır ve her kupon için en çok 1 kez, zamanında gönderilir. "Kupon kazandın" zaten sınır dışıdır. (→ 4.2 `ReminderEmailDay`, `KalpCoupon.expiringEmailAt`, 7.1, 7.6, 10.10)

**Y2. Kötüye kullanım kuralları (güncel karar).**
Karar:
- Parmak izi kütüphanesi kullanılmaz. Birinci taraf, rastgele, uzun ömürlü, işlevsel cihaz çerezi `bm_cihaz` kullanılır (çerez politikasına eklenir).
- **Cihaz ve IP kuralları** üyeliği, kalp vermeyi, kupon kazanmayı ya da kullanmayı **engellemez**. Bu kurallar yalnız davet bonusunu (+2) etkiler. Aynı evdeki aile üyelerinin ve aynı mobil operatör IP'sini paylaşanların normal katılabilmesi esastır. İlke yalnız cihaz ve IP kurallarını kapsar. Geçici e-posta engeli (Y4) kayıtta uygulanmaya devam eder (Y14).
- **"Aynı cihaz" kuralı korunur:** aynı cihaz kimliğinden açılan ikinci ve sonraki hesapların bonusu ve davet eden ile davetlinin aynı cihaz kimliğine sahip olduğu davetlerin bonusu "incelemede" durumuna düşer. Admin tek tıkla onaylar ya da iptal eder.
- **IP kuralı hiçbir bonusu "incelemede" durumuna düşürmez.** Aynı IP özetinden 24 saat içinde 3 ya da daha fazla yeni hesap açılırsa bu hesaplar ve bonusları Davetler ekranında yalnız "aynı IP" işaretiyle gösterilir, bonuslar normal işlenir.
- Eşikler admin ayarlarından değişir.

(→ 4.2 `CustomerDevice`, ayarlar, `KalpInvite.sameIpFlagAt`, 5.4, 5.5, 5.10, 6.11, 8.2, 10.2)

**Y3. IP saklama.**
Karar: Onay kaydında ham IP tutulur. Saklama onay geçerli olduğu sürece ve geri çekildikten sonra 3 yıl, sonra IP otomatik silinir. Kötüye kullanım kontrolü için IP ve cihaz bilgisi 90 gün sonra silinir. Gizlilik ve Çerez politikası güncellenir. Taslak 8.1 ve 8.2'de. (→ 4.2, 5.9, 7.6, 8, 10.11)

**Y4. Geçici e-posta listesi.**
Karar: Güncel ve bakımı yapılan bir npm paketi kullanılır, harici API kullanılmaz, admin panelinden ek engelli alan adı listesi tutulur.
- Seçilen paket: `disposable-email-domains-js`. CC0, bağımlılıksız, ~190 KB, 2026-09'da güncel.
- Gerekçe: topluluğun en yaygın, sürekli bakımı yapılan listesini sarar. Yanlış pozitife karşı izinli liste tutar. Küçük boyutu Vercel function boyutu için uygun.

(→ 4.2 `BlockedEmailDomain`, 5.4, 6.11)

**Y5. Bekleyen ve incelemedeki bonuslar.**
Karar:
- Birden fazla bekleyen bonus, kullanıcının verdiği ilk kalbin barına birlikte eklenir. Bar dolunca artan bonus kısmı yanmaz, yeniden bekleyen bonus olur ve kullanıcının diğer aktif kalbinin (dolmaya en yakın) ya da verdiği bir sonraki kalbin barına eklenir.
- Bekleyen bonusun süresi 30 gün, süre dolunca düşer. Kalplerim'de kalan sürelerle görünür.
- Kampanya kapalıyken davetli doğrularsa bonus bekleyen bonus olarak kaydedilir, kampanya açılınca T4 kuralıyla işlenir. 30 gün kampanya kapalıyken de işler.
- Admin "incelemede" bir bonusu onaylarsa onay anındaki duruma göre T4 kuralıyla dağıtılır.

(→ 4.2 `KalpBonusCredit`, 5.2, 5.5, 5.6.1, 6.4, 10.2; bölme kuralı Y11)

**Y6. Değişim farkı.**
Karar: İlk sürümde otomatik tahsilat/iade yok. Fark sistemde hesaplanır ve admin iade/değişim ekranında açıkça gösterilir. Tahsilat/iade elle yapılır, admin "fark tahsil edildi / iade edildi" işaretler ve bu denetim kaydına yazılır. Otomatik fark tahsilatı Faz 2'de. (→ 4.1, 5.8, 6.11, 10.7, 11)

**Y7. Ödenmiş sipariş tanımı.**
Karar: Durumu "ödendi" veya sonrası (hazırlanıyor, kargoda, teslim edildi) olan, iptal edilmemiş ve tamamı iade edilmemiş sipariş. Aynı e-posta adresiyle (büyük/küçük harf duyarsız) verilmiş misafir siparişleri de sayılır. (→ 5.4)

**Y8. Kampanya kapalıyken kalp geri çekme.**
Karar: Evet, kapalıyken de geri çekilebilir. Kalp hakkı boşalır, donmuş barın sayısı azalır. Kapalıyken yeni kalp verilemez. (→ 5.0, 5.3, 6.4, 10.3)

**Y9. Ana ekran / manifest.**
Karar: Yapılmayacak. T15 güncel kararı geçerli: manifest eklenmez, iPhone push desteği ve ana ekran yönergesi plandan çıkarıldı. (→ 3, 7.5)

**Y10. Vega kontrolü.**
Karar: Kampanyaya "gizli yayın modu" eklenir: kampanya canlıda açık olsa bile yalnız admin panelinden seçilen test hesaplarına görünür ve çalışır, diğer ziyaretçiler hiçbir kampanya öğesi görmez. Yayın fazında gizli modda kullanıcının kendi hesabıyla gerçek bir kuponlu sipariş verilir, siparişin ayrı satırlarla Vega'ya düşüşü ve faturalaması kontrol edilir, gerekirse sipariş iptal/iade edilir. Kontrol tamamlanınca kampanya herkese açılır. (→ 4.2 `mode`/`testerCustomerIds`/`isTest`, 5.0, 6.11, 9.1, 10.9; test verisi Y12)

**Y11. Bar dolarken artan bonus.**
Karar: Tur eşiğe ulaşınca kapanır. Davet bonusunun eşiği aşan kısmı (ör. bar 9'dayken gelen +2'nin artan 1 kalbi) kullanıcının bekleyen bonusuna döner. Bu kısmın 30 günlük süresi dönüştüğü andan baştan başlar ve Y5 kuralıyla dağıtılır.

Admin bir daveti iptal ederse:
- yalnız o davetten kalan, henüz bir bara eklenmemiş (bekleyen) kısım silinir;
- bara eklenmiş kısım tur açıksa bardan düşer;
- tur kapanmışsa dokunulmaz (kupon geri alınmaz, kayıt düşülür).

(→ 4.2 `KalpBonusCredit.splitFromId`, 5.2 adım 4, 5.5, 5.6.1, 10.2)

**Y12. Gizli modda test.**
Karar:
- Ayarlara yalnız gizli yayın modundaki turlara uygulanan "test eşiği" alanı eklenir (varsayılan 2). Gizli modda açılan turlar bu eşiği kullanır ve "test turu" olarak işaretlenir.
- Kampanya herkese açılırken (gizli → açık) tüm test turları, test kalpleri, test davetleri ve bekleyen test bonusları sıfırlanır. Bütün barlar normal eşikle sıfırdan başlar.
- Test sırasında gerçek siparişte kullanılmış kuponlar ve siparişler silinmez, "test" olarak işaretlenir ve kampanya raporlarından hariç tutulur.
- Geçiş öncesinde admin ekranında "Herkese açılınca test verisi sıfırlanacak" uyarısı ve onay adımı gösterilir.

Ek karar (kullanıcı onaylı yorum): sıfırlama, test verisi varken **herhangi bir** moddan Açık'a geçişte çalışır (Gizli → Kapalı → Açık dahil). (→ 4.2 `testThreshold`, `isTest` alanları, `Order.kalpTestAt`, 5.0, 5.1, 5.2, 6.11, 9.1, 10.9; test kuponları Y15)

**Y13. Aynı IP'den 3. hesap açılınca önceki hesaplar.**
Karar: Geriye dönük hiçbir işlem yapılmaz. Önceki hesaplar ve bonusları yalnız Davetler ekranında "aynı IP" işaretiyle gösterilir (Y2 güncel karar). (→ 5.5, 6.11, 10.2)

**Y14. Geçici e-posta engeli ve Y2 ilkesi.**
Karar: Geçici e-posta engeli kayıt sırasında uygulanmaya devam eder. Y2'deki "hiçbir kural üyeliği, kalp vermeyi, kupon kazanmayı ya da kullanmayı engellemez" ilkesi yalnız cihaz ve IP kurallarını kapsar, Y2 metni buna göre netleştirildi. Kayıt ekranında geçici e-posta reddedildiğinde kullanıcıya "Lütfen kalıcı bir e-posta adresi kullan" mesajı gösterilir. (→ 2, 5.4, 5.5, 10.2)

**Y15. Açık'a geçişte test kuponları.**
Karar:
- Açık'a geçişte test turlarından kazanılmış ve kullanılmamış tüm test kuponları iptal edilir: silinmez, "test-iptal" (`TEST_CANCELLED`) durumuna alınır, raporlardan hariç tutulur.
- Ödenmemiş bir siparişte bekleyen test kuponu varsa geçiş onay penceresi bu siparişleri listeler ve admin'e iki seçenek sunar: "Siparişleri iptal et ve devam et" ya da "Vazgeç".
- Admin devam ederse siparişler iptal edilir, kuponlar test-iptal olur ve geçiş tamamlanır.
- Ödenmiş test siparişleri ve kullandıkları kuponlar Y12'deki gibi silinmez, test olarak işaretlenip raporlardan hariç tutulur.

Planın uygulama ayrıntısı: iptal mevcut `expire.ts` yoluyla yapılır. Ödeme denemesi hâlâ canlı olan sipariş iptal edilmez, geçiş durur. (→ 4.2 `KalpCoupon.status`, 5.0, 6.11, 9.1, 10.9)
