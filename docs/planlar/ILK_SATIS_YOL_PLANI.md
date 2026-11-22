# İlk Satış Yol Planı

Durum: taslak, kullanıcıyla birlikte netleştiriliyor (2026-10-19)

Amaç: bollmark.com'dan **ilk gerçek siparişi** almak. Ardından ilk 10 siparişe çıkıp
reklama hazır, ölçülebilir bir düzen kurmak.

---

## 1. Şu an neredeyiz (2026-10-19 incelemesi)

**Hazır olanlar (çok güçlü bir temel):**
- Site 13 Ekim'den beri herkese açık, iyzico sanal POS canlıda. Gerçek sipariş alınabilir durumda.
- Yaklaşık 270 ürün var (Kadın 160, Erkek 74, Ayakkabı 14, Aksesuar 23). Sateen, Dilvin, Quzu, Slazenger, Koton markaları.
- Admin panel çok kapsamlı: kampanya ve kupon, terk edilmiş sepet maili, stok bildirimi, iade/değişim, müşteri hesabı ve sadakat puanı, yorum, favoriler, raporlar.
- SEO altyapısı kurulu: sitemap, yapısal veri, Search Console'a kayıt ve dizine ekleme istekleri (13 Ekim). Google Merchant Center hesabı ve ürün feed'i (`/feed/google.xml`) 1 Ekim'de kuruldu.
- Görseller R2'de, Vercel Pro'da. Altyapı sorunu yok.

**İlk satışın önündeki engeller (incelemede bulunanlar):**

| # | Bulgu | Neden önemli |
|---|---|---|
| E1 | **Kargo firması hâlâ seçilmedi** (B.3 ertelendi) | Site açık ve ödeme alıyor. Bugün sipariş gelse gönderim düzeni yok. |
| E2 | **Sitede hiçbir ölçüm yok**: Meta Pixel, Conversions API, Google Analytics yok | Reklam verilirse Meta kimin aldığını öğrenemez. Kaç kişi geldi, nerede bıraktı, bilinemez. |
| E3 | **Telefon ve WhatsApp yok.** İletişim sadece e-posta ve form üzerinden | Yeni bir siteden ilk kez alan Türk müşteri "arayıp sorabileceğim biri var mı" diye bakar. |
| E4 | **Ana sayfada "Yeni Gelenler" ile "Çok Satanlar" aynı**: ikisi de aynı 2 çantanın 8 rengi | Henüz satış olmadığı için çok satanlar listesi yeni ürünlere düşüyor. Ziyaretçi sitede sadece çanta var sanıyor, "çok satan" iddiası da inandırıcı değil. |
| E5 | **"SEZON FIRSATI: %20'ye varan indirim" bandı var ama indirimli ürün görünmüyor** | Güven kaybettirir. Gerçek bir indirim yoksa tüketici mevzuatı açısından da riskli. |
| E6 | 217 özgün ürün açıklaması onay bekliyor | Admin'den "Taslakları Onayla" ile toplu onaylanabilir. SEO için gerekli. |
| E7 | Hiç yorum yok, sosyal kanıt yok | İlk alıcıların fotoğraflı yorumu sonraki satışları kolaylaştırır. |
| E8 | Google İşletme Profili "Koton Leventoğlu" adında, siteye bağlı değil | Karacabey'den aramalar siteye yönlenmiyor. |
| E9 | `destek@bollmark.com` adresi hâlâ yer tutucu | Müşteri maili cevapsız kalabilir. |

---

## 2. Diğerleri ilk satışı nasıl yakalıyor? (araştırma özeti)

1. **İlk satış neredeyse her zaman sıcak çevreden gelir**, reklamdan değil. Tavsiye edilen sıra şöyle: tanıdıklar ve mevcut müşteriler, sosyal medya takipçileri, ücretsiz Google trafiği, en son ücretli reklam. Sıfırdan başlayan mağazalarda ilk satış çoğunlukla 25–35 gün sürüyor. Bizim büyük avantajımız var: 40 yıllık bir mağaza, hazır bir müşteri kitlesi ve yerel bir Instagram hesabı.
2. **Lansman indirimi ve kuponu**: ilk alıcılara özel kod (%10–30) ve tanıdıklardan yorum istemek standart yöntem.
3. **Güven unsurları**: detaylı açıklama, beden tablosu, net iade ve kargo bilgisi, birden çok ödeme yolu, ulaşılabilir iletişim. Bizde beden tablosu ve iade sayfası var. İletişim ve yorum eksik.
4. **Meta reklamlarında veri şartı var**: Advantage+ satış kampanyalarının iyi çalışması için haftada yaklaşık 25 satın alma öneriliyor. Bu sayının altında manuel kampanyayla başlamak, Pixel ve CAPI'nin önceden kurulu olması ve en az 5 farklı reklam görseli/videosu öneriliyor. Türkiye'de giyimde tıklama başı maliyet yaklaşık 3–8 TL. Sağlıklı öğrenme için günlük 150–300 TL öneriliyor.
5. **Google ücretsiz ürün listelemeleri**: Merchant Center'a feed girilince ürünler Arama, Görseller ve Lens'te ücretsiz çıkabiliyor. Gösterim garanti değil. Giyimde renk, beden, cinsiyet ve yaş grubu alanları zorunlu.
6. **Fiziki mağazası olanlar**: kasada ve poşette QR kod, WhatsApp üzerinden iletişim ve "online sipariş ver, mağazadan teslim al" ile mağaza müşterisini siteye taşıyorlar.
7. **Yasal hazırlık**: kendi sitesinden satış yapanlar için ETBİS kaydı, sitede ticari bilgiler (unvan, vergi no, iletişim), ön bilgilendirme ve mesafeli satış sözleşmesi, KVKK ve çerez metinleri, e-posta/SMS için açık onay, e-Arşiv fatura.

---

## 3. Yol planı (önerilen sıra)

### FAZ 0: Satışa hazırlık (bu hafta, 3–5 gün)
Hedef: bir sipariş geldiğinde sorunsuz teslim edebilmek ve gelen ziyaretçiyi ölçebilmek.

| İş | Kim | Not |
|---|---|---|
| 0.1 Kargo çözümü | Sen | Seçenekler: (a) bir kargo firmasıyla kurumsal anlaşma (Aras, Yurtiçi, MNG, PTT vb.), (b) anlaşmasız gönderim yapan kargo entegratörleri, (c) ilk siparişlerde şubeden elle gönderim. İlk 10 sipariş için (c) bile yeterli. API entegrasyonu sonra. |
| 0.2 Uçtan uca gerçek test siparişi | Sen + Claude Code | Kendi kartınla gerçek bir ürün al: ödeme, mail, admin'e düşmesi, fatura, kargolama ve iade/iptal. Bütün zinciri bir kez yaşamak. |
| 0.3 Ölçüm kurulumu: Meta Pixel + Conversions API + GA4 | Claude Code (sen sadece hesapları açıp ID'leri vereceksin) | Olaylar: ürün görüntüleme, sepete ekleme, ödemeye başlama, satın alma. Çerez onayıyla uyumlu olacak. **Reklamdan en az 1 hafta önce kurulmalı.** |
| 0.4 WhatsApp butonu + telefon | Claude Code | Ürün sayfasında "WhatsApp'tan sor" (ürün adı ve linki hazır mesajla), footer ve iletişim sayfasında telefon. |
| 0.5 Ana sayfa düzeltmeleri | Claude Code | "Çok Satanlar" satış olana kadar gizlenecek ya da "Editörün Seçimi" yapılıp elle ürün seçilecek. Yeni Gelenler'de aynı ürünün renkleri tek kart olacak, kategoriler karışık gelecek. |
| 0.6 İndirim bandı | Sen karar ver, Claude Code uygular | Ya gerçek bir sezon indirimi açılır (admin'de kampanya var) ya da bant kaldırılır. |
| 0.7 217 açıklamanın onayı | Sen (yaklaşık 30 dk) | Admin, Ürünler, `?aciklama=taslak`, toplu onay. |
| 0.8 Yasal kontrol | Sen | ETBİS kaydı yapıldı mı? Fatura nasıl kesilecek (ilk siparişler için GİB e-Arşiv portalı yeterli olabilir, mali müşavirle teyit)? `destek@` adresi çalışıyor mu? |

### FAZ 1: Sıcak kitleden ilk satış (1.–2. hafta)
Hedef: **ilk sipariş + ilk 10 sipariş**. Bütçe neredeyse sıfır.

1. **Mağazadan Teslim Al seçeneği** (Claude Code): ödemede "Karacabey mağazasından ücretsiz teslim al". Kargo sorununu ilk günlerde ortadan kaldırır. Mağaza müşterisi siteye alışır, ürünü mağazaya almaya gelince ek alışveriş de yapabilir. Site satışlarının mağazayı azaltma endişesine de cevap verir: satış yine mağazada tamamlanıyor.
2. **Mağazada QR**: kasanın yanında küçük bir stand ve poşete/fişe kart: "Tüm koleksiyon bollmark.com'da, ilk online siparişe özel kod: HOSGELDIN". Kupon admin'den açılır. Kod sadece bu kartla dağıtılır; böylece mağaza fiyatıyla çakışmaz ve kaç satışın mağazadan geldiği ölçülür.
3. **Instagram (koton.karacabey)**: profil linkine bollmark.com, açılış duyurusu (gönderi + 3–5 hikâye), haftada 3–4 Reels ile ürün tanıtımı ("bu ceket 3 farklı kombin"), hikâyelerde link çıkartması.
4. **WhatsApp**: mağazanın rehberindeki müşterilere WhatsApp Business durumu/katalog ve kısa bir duyuru. Toplu ileti gönderilmeyecek, ticari ileti onayı kuralları geçerli.
5. **Tanıdıklar**: aile ve arkadaşlardan 5–10 kişiye "siteden gerçekten al, fotoğraflı yorum yaz" ricası. Hem ilk siparişler gelir hem yorumlar oluşur hem de ödeme ve kargo zinciri gerçek müşteriyle test edilir.

### FAZ 2: Ücretsiz Google trafiği (2.–4. hafta, Faz 1 ile paralel)
1. **Merchant Center**: feed onaylandı mı, kaç ürün reddedildi, kontrol edilecek (sen ekran görüntüsü at, ben yorumlayayım). Reddedilenler Claude Code ile düzeltilir. Ücretsiz listelemeler açık olmalı.
2. **Google İşletme Profili**: adı Koton tabelasıyla uyumlu kalabilir ama **web sitesi alanına bollmark.com** girilmeli. Ürünler bölümü doldurulmalı, haftada 1 gönderi.
3. **Search Console takibi**: dizine eklenen sayfa sayısı haftalık izlenir.

### FAZ 3: Küçük ücretli test (3.–6. hafta, Pixel en az 1 hafta veri topladıktan sonra)
1. **Meta (Instagram/Facebook)**: önce **yerel** başlangıç: Karacabey, Mustafakemalpaşa, Bursa ve çevresi. Manuel satış kampanyası, günlük 150–300 TL, 5–8 reklam. Gerçek ürün fotoğrafları + yapay zekâ ile üretilmiş kısa videolar, katalog (feed) reklamı. Haftada 25 satışa yaklaşınca Türkiye geneli ve Advantage+.
2. **Google Alışveriş / Performance Max**: aynı feed ile küçük bütçe.
3. **Yerel mikro influencer**: Bursa'dan 2–3 hesap, ürün karşılığı ya da kupon koduyla komisyon.
4. Reklamlarda marka dili "Bollmark". Koton logosu ve adı reklam metninde kullanılmamalı (marka hakları riski).

### FAZ 4: Tekrar satın alma (ilk 10 siparişten sonra)
Sadakat puanı, terk edilmiş sepet maili ve stok bildirimi zaten var. Bunları çalışır hale getirmek, mail izni toplamak (ilk siparişe indirimli bülten) ve yorum isteme maili.

---

## 4. Takip edilecek sayılar

| Hafta | Ziyaretçi | Sepete ekleme | Sipariş |
|---|---|---|---|
| 1 | 100+ | 5+ | **1 (ilk satış)** |
| 2 | 300+ | 15+ | 3–5 |
| 4 | 1.000+ | 40+ | 10+ |

Faz 0.3'teki ölçüm kurulmadan bu sayılar görülemez. Bu yüzden 0.3 öncelikli.

---

## 5. Kullanıcıdan karar bekleyen sorular

1. Kargo: şimdilik hangi yol? (anlaşma / entegratör / şubeden elle)
2. Aylık reklam bütçesi ne kadar olabilir?
3. Mağazada müşteri telefon listesi var mı (Vega'da)? SMS/WhatsApp izni alınmış mı?
4. "Mağazadan Teslim Al" seçeneği eklensin mi?
5. Sezon indirimi gerçekten açılacak mı, yoksa bant kalksın mı?
6. ETBİS kaydı yapıldı mı? Faturayı kim, nasıl kesecek?
7. Instagram hesabının adı koton.karacabey olarak mı kalacak, yoksa ayrı bir @bollmark hesabı mı açılacak?

Kararlar netleşince her faz için Claude Code promptları hazırlanacak.

## Kaynaklar
- Meta Advantage+ veri eşikleri: https://www.1clickreport.com/blog/advantage-plus-shopping-25-conversions-2026-guide
- İlk 10 satış yöntemleri: https://kiwisizing.com/blog/10-ways-to-get-your-first-10-sales/
- 30 günlük ilk satış planı ve kıyas sayıları: https://tenten.co/shopify/first-sale-shopify-30-day-action-plan/
- Google ücretsiz ürün listelemeleri: https://support.google.com/merchants/answer/13889434?hl=tr
- Türkiye Instagram reklam maliyetleri: https://braverytechnology.com/tr/instagram-reklam-fiyatlari/
- E-ticaret hukuki yükümlülükleri: https://www.ffkpartnerhukuk.com.tr/e-ticaret-sitelerinin-hukuki-yukumlulukleri-2026-guncel-rehber/
