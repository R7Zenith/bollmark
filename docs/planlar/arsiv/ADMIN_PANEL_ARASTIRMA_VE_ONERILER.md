# Bollmark Admin Paneli — Sektör Araştırması ve Geliştirme Önerileri

Bu belge, "admin panelimiz hâlâ yalın, giyim firmaları panellerinde başka
neler var" sorusuna yanıt olarak hazırlandı. Önce Bollmark'ın mevcut admin
panelinin gerçek kapsamı (repo + proje planları) çıkarıldı, sonra Shopify,
Ticimax, ikas, T-Soft/IdeaSoft gibi platformlar ile genel giyim e-ticareti
best-practice kaynakları araştırıldı. Sonunda boşluk analizi ve fazlı bir
öncelik sırası var. Kaynaklar belgenin sonunda listelidir.

## 1) Bollmark'ın admin panelinde şu an ne var (özet)

Önceki fazlarda (Admin Panel Yenileme, Varyant Yönetimi V1/V2, Ürün Bilgisi
Paketi) kurulanlar:

- **Tasarım sistemi:** Button/Badge/Card/DataTable/Sidebar/Topbar/Toast/
  EmptyState/StatCard, indigo vurgu renkli SaaS teması, `lucide-react` ikonlar.
- **Dashboard:** son 30 gün ciro/sipariş grafiği, son siparişler mini listesi,
  stoğu azalan ürünler mini listesi, 4 özet kart.
- **Ürünler:** arama/filtre, checkbox ile toplu durum değiştirme/silme,
  varyant editörü (özellik havuzundan beden/renk seçimi, otomatik kombinasyon,
  barkod alanı, renk hex kodu), görsel yönetimi (URL + bilgisayardan yükleme,
  renk bazlı çoklu galeri — bu son parça henüz uygulanmadı, planı hazır),
  marka/kategori/etiket alanları, materyal/menşei/bakım talimatı/cinsiyet,
  "öne çıkan ürün" işareti.
- **Kategoriler:** üst/alt kategori hiyerarşisi, kategori bazlı beden tablosu
  metni.
- **Markalar:** ayrı yönetim sayfası.
- **Siparişler:** ödeme durumu + kargo durumu ayrı rozetler, arama/tarih
  filtresi, toplu durum güncelleme, sipariş detayında zaman çizelgesi tarzı
  görünüm.
- **Kargolar:** liste + durum rozetleri (kargo firması API'siyle otomatik
  değil, panelden elle giriliyor).
- **Müşteriler:** V1 — ayrı bir müşteri tablosu yok, sipariş verilerinden
  türetilen liste (isim/email/toplam sipariş/toplam harcama).
- **Ayarlar:** hesap bilgisi + şifre değiştirme, mağaza bilgileri
  (StoreSettings), varyant özellikleri yönetimi.
- **Üst bar hızlı arama.**

Kendi planlarınızda bilinçli olarak **kapsam dışı bırakılmış** olanlar da var:
SEO altyapısı (metadata/sitemap/robots/JSON-LD), ikna/dönüşüm unsurları
(yorum-puanlama, stok azlığı mesajı, ilgili ürün, wishlist), yasal sayfalar
(iade/kargo/gizlilik/hakkımızda, checkout onay kutusu), gerçek `Customer`
modeli (hesap, adres defteri). Bunlar zaten sırada bekliyor — aşağıdaki
araştırmada bunlarla örtüşen maddeleri de işaretledim.

## 2) Sektör araştırması

### 2.1 Shopify (global referans)

Shopify admin paneli şu ana bölümlerden oluşuyor: Orders, Products,
Customers, **Analytics & Reports**, **Marketing & Promotions**,
**Discounts**, **Sales Channels** (mağazayı Instagram/TikTok/Amazon gibi
kanallara açma), Apps, Settings, ayrıca **rol bazlı personel izinleri**
(staff permissions) ve ana sayfada görev hatırlatıcılı gerçek zamanlı
metrik paneli. Bollmark'ta bunların **Discounts, gelişmiş Analytics,
Marketing/Kampanya, çoklu satış kanalı ve personel rolleri** karşılığı yok.

### 2.2 Türkiye pazarı (Ticimax, ikas, T-Soft/IdeaSoft)

Türkiye'deki hazır e-ticaret altyapılarının panellerinde öne çıkan, Bollmark'ta
olmayan modüller:

- **Kampanya/indirim motoru** — Ticimax "250+ kampanya modeli" diye
  pazarlıyor (yüzde/tutar indirimi, kupon kodu, ücretsiz kargo eşiği, X al Y
  öde, kategori/marka bazlı kampanya). Bu, Türk pazarında neredeyse standart
  bir modül; Bollmark'ta indirim kodu/kampanya sayfası hiç yok.
- **Sepet ve ödeme hatırlatma** (terk edilmiş sepet e-postası/SMS'i) —
  dönüşümü doğrudan artıran, sektörde yaygın bir özellik.
- **Pazaryeri entegrasyonları** — Trendyol, Hepsiburada, N11, Çiçeksepeti,
  Amazon gibi kanallara ürün/stok/sipariş senkronizasyonu. Türkiye'de
  giyim satan hemen her firma bir noktada pazaryerlerine de satış yapıyor;
  panelden tek yerden yönetim büyük operasyonel kazanç.
- **Kargo firması API entegrasyonu** (Yurtiçi, Aras, MNG, PTT vb.) —
  panelden tek tıkla barkod/takip numarası üretme. Bollmark'ın "Kargolar"
  sayfası şu an muhtemelen elle giriş; otomatik entegrasyon zaman kazandırır.
- **e-Fatura / e-Arşiv Fatura entegrasyonu** — bu bir "nice to have" değil,
  **yasal bir eşik meselesi**: 2026 itibarıyla e-ticaret sektöründe brüt
  satış hasılatı 500.000 TL'yi aşan işletmeler e-Fatura'ya geçmek zorunda;
  nihai tüketiciye yapılan tek işlem 6.900 TL'yi aşarsa e-Arşiv fatura
  kesme zorunluluğu doğuyor. Bollmark büyüdükçe bu eşiklere yaklaşacaktır —
  kesin durumunuz için mali müşavirinize danışmanızı öneririm, ama panelin
  bir muhasebe/e-fatura sağlayıcısıyla (Paraşüt, Foriba, Logo vb.)
  entegre olabilecek şekilde tasarlanması ileride büyük bir zaman
  kazandırır.
- **Depo Yönetim Sistemi (WMS)** — çoklu depo/mağaza stok senkronizasyonu
  (Bollmark tek depo/stok varsayımıyla çalışıyor gibi görünüyor, şu an için
  muhtemelen öncelikli değil ama fiziksel mağaza açılırsa gerekir).
- **Native mobil uygulama / Dashboard app** — büyüme sonrası düşünülecek
  bir yatırım, şimdilik öncelikli değil.

### 2.3 Giyime özgü özellikler

Genel e-ticaret best-practice kaynakları giyim/moda mağazaları için özellikle
şunları öne çıkarıyor:

- **Beden tablosu ve fit bilgisi** — Bollmark'ta kategori bazlı beden tablosu
  zaten var, bu iyi bir başlangıç. Sektörde ayrıca "model şu bedeni giyiyor,
  boyu şu kadar" gibi referans bilgisi de yaygın (opsiyonel, küçük ekleme).
- **Stokta azalma / tükendi göstergesi ve "haber ver" bildirimi** — belirli
  bir bedende stok azaldığında müşteriye gösterilen uyarı + stok gelince
  e-posta ile haber verme. Bollmark'ta dashboard'da "stoğu azalan ürünler"
  admin tarafında var ama müşteri tarafında yok.
- **Ön sipariş (pre-order)** — yeni koleksiyon lansmanlarında stok gelmeden
  satışa açma; giyim/moda markalarında viral ürün lansmanlarında sık kullanılan
  bir taktik.
- **Set/bundle indirimi** — "bu tişört + bu pantolon birlikte al %10 indirim"
  gibi çapraz satış; kampanya motorunun bir parçası olarak gelir.
- **İade/değişim (RMA) süreci** — giyimde iade oranı diğer kategorilere göre
  yapısal olarak yüksektir (beden/renk uyuşmazlığı). Şu an Bollmark'ta ne
  müşteri tarafında iade talebi oluşturma ne de admin tarafında bir "iade
  yönetimi" ekranı var; siparişler sayfasında durum elle değiştiriliyor
  olabilir ama ayrı bir süreç/rapor yok.
- **Ürün yorumu + fotoğraf** — zaten kendi planınızda "ikna/dönüşüm unsurları"
  başlığı altında ayrı bir iş olarak not edilmiş, doğru bir sıralama.

### 2.4 Operasyon ve yönetim tarafı (platform bağımsız, genel best practice)

- **Personel hesapları ve rol bazlı yetkilendirme** — şu an tek bir admin
  girişi var. Mağaza büyüyüp ikinci bir kişi (kargo/sipariş hazırlayan,
  ürün giren) eklendiğinde herkesin aynı tam yetkiye sahip olması hem
  güvenlik hem hesap verebilirlik açısından risk. Shopify'da bu "staff
  permissions" olarak temel bir özellik.
- **Toplu ürün içe/dışa aktarma (CSV/Excel)** — yüzlerce ürünü tek tek
  elle girmek yerine toplu yükleme; stok sayımı için dışa aktarma.
  Bollmark'ta toplu *işlem* (bulk update/delete) var ama toplu *içe
  aktarma* göze çarpmıyor.
- **Fatura/irsaliye ve kargo etiketi yazdırma** — sipariş hazırlarken
  panelden doğrudan yazdırılabilir irsaliye/etiket, kargo entegrasyonuyla
  birlikte gelir.
- **İşlem geçmişi / denetim kaydı (audit log)** — "bu siparişin durumunu
  kim ne zaman değiştirdi" gibi bir kayıt; personel sayısı arttıkça
  önem kazanır.
- **Otomatik bildirimler** — yeni sipariş geldiğinde admin'e e-posta/SMS/
  push, müşteriye sipariş durumu değiştiğinde otomatik e-posta.
- **Gelişmiş raporlama** — dashboard'daki genel grafiklerin ötesinde: en
  çok satan ürün/varyant, kâr marjı, kategori/marka bazlı satış kırılımı,
  müşteri yaşam boyu değeri (LTV), terk edilmiş sepet oranı gibi raporlar.

## 3) Boşluk analizi (özet tablo)

| Özellik alanı | Bollmark'ta durum | Sektörde yaygınlık | Etki |
|---|---|---|---|
| İndirim kodu / kampanya motoru | Yok | Çok yaygın (Ticimax'ın amiral özelliği) | Yüksek |
| Terk edilmiş sepet hatırlatma | Yok | Yaygın, dönüşüme doğrudan etki | Yüksek |
| Stok azlığı/tükendi — müşteri bildirimi | Kısmen (sadece admin dashboard'unda) | Yaygın | Orta-Yüksek |
| İade/değişim (RMA) süreci | Yok | Giyimde kritik | Yüksek |
| Personel hesapları/roller | Yok (tek admin) | Standart | Orta-Yüksek |
| Kargo firması API entegrasyonu | Yok (elle giriş) | Yaygın | Orta |
| Toplu ürün içe/dışa aktarma (CSV) | Yok | Yaygın | Orta |
| Fatura/kargo etiketi yazdırma | Yok | Yaygın | Orta |
| Gelişmiş raporlama (en çok satan, kâr marjı, LTV) | Kısmen (dashboard temel grafikler) | Yaygın | Orta |
| Otomatik e-posta/SMS bildirimleri | Belirsiz/yok | Standart | Orta |
| Pazaryeri entegrasyonu (Trendyol vb.) | Yok | Türkiye'de çok yaygın | Büyüme aşamasında yüksek |
| e-Fatura/e-Arşiv entegrasyonu | Yok | Yasal eşik meselesi | Ciro büyüdükçe zorunlu |
| Bundle/set indirimi, ön sipariş | Yok | Giyimde yaygın taktik | Düşük-Orta |
| Gerçek Customer modeli + sadakat programı | Yok (V1 türetilen liste) | Yaygın | Orta |
| Denetim kaydı (audit log) | Yok | Personel arttıkça önemli | Düşük (şimdilik) |
| Ürün yorumu + fotoğraf, wishlist, SEO, yasal sayfalar | Bilinçli olarak ayrı işte bekliyor | Standart | Zaten planlı |

## 4) Önerilen fazlı yol haritası

Önceliklendirme, "işe en çok etkiyi en az efor ile yapan" mantığıyla sıralandı;
istediğiniz sırayla değiştirebiliriz.

**Faz A — Kısa vade (satışı ve operasyonu hemen etkiler):**
1. İndirim kodu / kampanya modülü (yüzde-tutar indirim, kupon kodu, ücretsiz
   kargo eşiği). Kampanya motorunun ilk basit sürümü.
2. Terk edilmiş sepet e-posta hatırlatma (mevcut sepet altyapısına oturur).
3. Müşteri tarafında stok azlığı/tükendi göstergesi + "stok gelince haber
   ver" e-posta kaydı.
4. Toplu ürün içe aktarma (CSV/Excel) — özellikle yeni sezon koleksiyonu
   girişini hızlandırır.

**Faz B — Orta vade (operasyonu büyütmeye hazırlar):**
5. İade/değişim (RMA) süreci — müşteri iade talebi oluşturur, admin
   panelinde ayrı bir "İadeler" ekranı ve durum akışı.
6. Personel hesapları + temel rol yetkilendirme (örn. "sadece sipariş
   hazırlar", "tam yetkili").
7. Kargo firması API entegrasyonu (en az kullandığınız 1-2 firma ile
   otomatik takip no/etiket).
8. Otomatik e-posta bildirimleri (yeni sipariş → size, durum değişince →
   müşteriye).
9. Gelişmiş raporlama sayfası (en çok satan ürün/varyant, kâr marjı,
   kategori/marka kırılımı).

**Faz C — Uzun vade (büyüme/ölçek):**
10. Pazaryeri entegrasyonu (önce Trendyol, sonra Hepsiburada/N11).
11. e-Fatura/e-Arşiv entegrasyonu — ciro eşiğine yaklaşırken mali
    müşavirinizle birlikte zamanlaması netleştirilmeli.
12. Gerçek `Customer` modeli (hesap girişi, adres defteri) + basit sadakat/
    puan programı.
13. Bundle/set indirimi, ön sipariş (pre-order) desteği.
14. Denetim kaydı (audit log) — personel sayısı arttığında.

**Zaten planlı, unutulmamalı:** Ürün yorumu+fotoğraf, ilgili ürün, wishlist,
SEO altyapısı ve yasal sayfalar (iade/kargo/gizlilik/hakkımızda, checkout
onay kutusu) kendi notlarınızda ayrı iş olarak duruyor — bunlar da bu yol
haritasına satış açılmadan önce dahil edilmeli, özellikle yasal sayfalar ve
SEO launch öncesi kritik.

## 5) Sonuç ve önerilen sıradaki adım

Bollmark'ın admin paneli tasarım/kullanılabilirlik açısından zaten Shopify
tarzı profesyonel bir temele oturmuş durumda (Faz 1-4 tamamlandı) — asıl
boşluk **görünüm değil, iş fonksiyonları**: kampanya/indirim, iade süreci,
personel yetkilendirme ve kargo/pazaryeri/fatura entegrasyonları gibi
"panel var ama içi eksik" alanlarda. Öneriler yukarıdaki gibi 3 faza
ayrıldı; hangi fazdan başlamak istediğinizi (örn. önce Faz A'nın tamamı, ya
da sadece belirli maddeler) söylerseniz, bunun için kendi conventionunuza
uygun ayrıntılı bir uygulama planı (`*_PLANI.md`) çıkarıp Claude Code ile
uygulamaya geçebiliriz.

## 6) Kaynaklar

- [Shopify Admin Overview](https://help.shopify.com/en/manual/shopify-admin/shopify-admin-overview)
- [Ticimax — Özellikler](https://www.ticimax.com/ozellikler/)
- [ikas.com/tr](https://ikas.com/tr)
- [T-Soft — Kampanya Yönetimi Modülü](https://www.tsoft.com.tr/kampanya-ozellikleri)
- [1center — Top Features Every Apparel eCommerce Website Must Have](https://www.1center.co/top-features-every-apparel-ecommerce-website-must-have-in-2025/)
- [LitExtension — 30+ eCommerce Website Features](https://litextension.com/blog/ecommerce-website-features/)
- [Charle Agency — Shopify Features: The Complete List](https://www.charleagency.com/articles/features-for-shopify/)
- [IdeaSoft — E-Ticaret için e-Fatura Zorunluluğu](https://www.ideasoft.com.tr/e-ticaret-icin-e-fatura-zorunlulugu/)
- [Shopify TR — E-ticaret İadeleri: Ortalama İade Oranı](https://www.shopify.com/tr/blog/e-ticaret-iadeleri)
