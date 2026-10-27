# WhatsApp Business + Sitede WhatsApp Butonu Planı

Tarih: 2026-10-27 · Durum: devam ediyor (Bölüm 2 localhost'ta; Bölüm 1, 3, 4 kullanıcı yapar)

## Arka plan

- 27 Ekim 2026: Bulutfon sabit hattı (+90 224 323 01 21) aktifleşti, WhatsApp Business
  uygulaması bu numarayla kuruldu. İşletme adı: **Bollmark**.
- Numara yalnız WhatsApp için; aramalar açılmıyor (bkz. `ILETISIM_TELEFON_VE_INSTAGRAM_DM_PLANI.md`).
- Kodda altyapı hazır: `STORE_INFO.phone`, `STORE_INFO.whatsappActive` (şu an `false`),
  `whatsappHref()`, `WhatsAppLink` (footer, iletişim, anasayfa kartı), `trackContact("whatsapp")`.
- Kullanıcı kararları (2026-10-27):
  - Sağ alttaki yüzen buton: **WhatsApp + Instagram** (tek buton, iki seçenekli küçük menü).
  - Ürün sayfası: **"WhatsApp'tan sor" büyük buton**, altında küçük **"veya Instagram'dan sor"** linki.

---

## 1. WhatsApp Business profil ayarları (kullanıcı, telefondan)

Ayarlar → İşletme araçları → İşletme profili:

| Alan | Değer |
|---|---|
| İşletme adı | Bollmark |
| Kategori | Giyim Mağazası (ikinci: Alışveriş ve Perakende) |
| Profil fotoğrafı | Instagram ile aynı "b" logosu |
| Açıklama | Karacabey'in giyim adresi Bollmark'a hoş geldiniz! 👋 Kadın, erkek ve çocuk giyimde yeni sezon ürünler burada. Stok, beden ve fiyat sorularınız için bize yazın. Siteden aldığınız ürünleri mağazamızda kolayca değiştirebilirsiniz. |
| Adres | Runguçpaşa Mah. 75. Sk. No:6/A, 16700 Karacabey/Bursa (harita pini kontrol) |
| Çalışma saatleri | Pzt–Cmt 10:00–19:00, Pazar kapalı |
| E-posta (profilde görünen) | bilgi@bollmark.com |
| Web sitesi 1 | https://bollmark.com |
| Web sitesi 2 | Instagram profili (1 Kasım'da kullanıcı adı değişince güncellenir) |

Güvenlik: Ayarlar → Hesap → **İki adımlı doğrulama** açık (6 haneli PIN + kurtarma e-postası).
Numara sanal olduğu için zorunlu sayılır.

### Karşılama mesajı (İşletme araçları → Karşılama mesajı)

> Merhaba, Bollmark'a hoş geldiniz! 👋 Size nasıl yardımcı olabiliriz? Bir ürünü soruyorsanız ürün adını, kodunu ya da fotoğrafını göndermeniz yeterli. Pazartesi–Cumartesi 10:00–19:00 arası hızlıca dönüş yapıyoruz.

### Uzakta mesajı (İşletme araçları → Uzakta mesajı → Zamanlama: "Çalışma saatleri dışında")

> Merhaba, şu an mesai saatlerimiz dışındayız (Pzt–Cmt 10:00–19:00). Mesajınızı aldık, ilk fırsatta dönüş yapacağız. 🙏 Siparişinizin durumunu bollmark.com/siparis-durumu adresinden de takip edebilirsiniz.

### Hızlı yanıtlar (İşletme araçları → Hızlı yanıtlar; sohbette "/" ile çağrılır)

- **/kargo**
  > Siparişleriniz 1–3 iş günü içinde kargoya verilir, kargoda ortalama 1–3 iş günü sürer. 1.500 TL ve üzeri alışverişlerde kargo ücretsizdir, altındaki siparişlerde kargo ücreti ödeme sayfasında gösterilir.
- **/degisim**
  > Siteden aldığınız ürünleri Karacabey mağazamızda (Runguçpaşa Mah. 75. Sk. No:6/A) değiştirebilirsiniz; ürünün etiketi üzerinde ve kullanılmamış olması yeterli. Kargoyla iade için teslimden itibaren 14 gün cayma hakkınız var, iade kargo ücreti alıcıya aittir.
- **/beden**
  > Hangi ürün için beden soruyorsunuz? Boyunuzu, kilonuzu ve genelde giydiğiniz bedeni yazarsanız size en uygun bedeni önerelim. Ürün sayfasındaki beden tablosuna da bakabilirsiniz.
- **/siparis**
  > Siparişinizin durumunu bollmark.com/siparis-durumu adresinden sipariş numaranız ve e-postanızla görebilirsiniz. Sipariş numaranızı buraya yazarsanız biz de hemen kontrol edelim.
- **/adres**
  > Mağazamız: Runguçpaşa Mah. 75. Sk. No:6/A, Karacabey/Bursa. Pazartesi–Cumartesi 10:00–19:00 arası açığız, Pazar kapalıyız.

> Not: Fiyat/kargo ücreti metne sabit yazılmadı (panelden değişebiliyor); 1.500 TL eşiği değişirse /kargo güncellenir.

### Katalog

Şimdilik gerek yok. 1.600+ ürünü WhatsApp kataloğuna elle girmek anlamsız; Meta kataloğu
("Bollmark Katalog") WhatsApp'a bağlanabiliyorsa 3. bölümdeki bağlantıdan sonra değerlendirilir.

---

## 2. Sitede WhatsApp (Claude Code)

### 2.1 Bayrak
- `STORE_INFO.whatsappActive` → `true`. Footer, iletişim sayfası ve anasayfa kartındaki
  mevcut `WhatsAppLink`'ler bununla görünür hale gelir.
- `tel:` linki ve JSON-LD `telephone` **eklenmez** (aramalar açık değil, karar değişmedi).

### 2.2 `whatsappHref` hazır mesaj desteği
- `whatsappHref(phone, text?)` → `text` varsa `https://wa.me/902243230121?text=<encodeURIComponent>`.
- Numara yine yalnız `STORE_INFO.phone`'dan okunur.

### 2.3 Yüzen buton: WhatsApp + Instagram (tek buton, açılır menü)
- `FloatingInstagramButton` yerine `FloatingContactButton` (aynı yer, aynı görünme kuralları:
  `/odeme` akışında gizli, çerez bandı açıkken gizli, footer ekrandayken gizli; mobil sabit
  "sepete ekle" çubuğuyla çakışmaz).
- Kapalı halde: mevcut ink/cream hap butonu; ikon olarak sohbet balonu, masaüstünde yazı "Bize yaz".
- Tıklayınca butonun üstünde küçük bir menü açılır, iki satır:
  1. WhatsApp ikonu + "WhatsApp'tan yaz" → `whatsappHref(phone, "Merhaba, bilgi almak istiyorum.")`
  2. Instagram ikonu + "Instagram'dan yaz" → `INSTAGRAM_DM_URL`
- Menü: dışarı tıklama ve `Escape` ile kapanır; `aria-expanded`, `aria-haspopup="menu"`,
  klavyeyle gezilebilir. Sayfa değişince kapanır.
- `whatsappActive` false ise menü açılmaz, buton bugünkü gibi doğrudan Instagram DM'e gider.
- Olay: menüyü **açmak** olay göndermez; bir seçeneğe tıklamak `trackContact("whatsapp")` /
  `trackContact("instagram")` gönderir (mevcut rıza kuralları: Meta pazarlama, GA4 analitik).

### 2.4 Ürün sayfası: "WhatsApp'tan sor"
- `AskOnInstagramButton`'ın yerine (`product-viewer.tsx`) `AskOnWhatsAppButton`:
  - Büyük, mevcut Instagram butonuyla aynı ölçüde (h-[46px], hap). WhatsApp ikonu + "WhatsApp'tan sor".
  - Hazır mesaj: `Merhaba, bu ürün hakkında bilgi almak istiyorum: <ürün adı> – <renk / beden> – Ürün kodu: <kod> – <sayfa URL>`
    (renk/beden seçilmemişse o parça atlanır — bugünkü Instagram metniyle aynı mantık).
  - `wa.me?text=` ile açılır; panoya kopyalama gerekmez. Pencere aynı tıklamada açılır (popup engelleyici).
  - `trackContact("whatsapp", productCode)`.
- Altında küçük, ortalı metin linki: "veya Instagram'dan sor" → bugünkü Instagram davranışı aynen
  korunur (ürün bilgisini panoya kopyala, "kopyalandı" notu, DM aç, `trackContact("instagram", productCode)`).
- `whatsappActive` false ise bugünkü `AskOnInstagramButton` olduğu gibi gösterilir.

### 2.5 Mobil / masaüstü
- Mobilde `wa.me` WhatsApp uygulamasını açar; masaüstünde WhatsApp Web / masaüstü uygulamasına
  yönlendiren sayfa açılır (yeni sekme). Ek bir ayrım kodlanmaz.

### 2.6 Kontrol (localhost)
- Footer, iletişim, anasayfa kartında WhatsApp linki görünüyor ve `wa.me/902243230121` açıyor.
- Yüzen buton: menü açılıyor/kapanıyor (dışarı tık, Esc), ödeme sayfasında, çerez bandı açıkken
  ve footer görünürken gizli; mobilde sepete ekle çubuğuyla çakışmıyor.
- Ürün sayfası: hazır mesaj doğru (Türkçe karakterler bozulmadan), renk/beden seçili/seçisiz.
- Rızasız: olay gitmiyor; rızalı: Meta `Contact` ve GA4 `contact` (`method`, `product_code`).
- 390px ve 1600px ekran görüntüsü.

---

## 3. Meta İş Portföyü bağlantısı (kullanıcı)

- "WhatsApp'a mesaj gönder" (Click-to-WhatsApp) reklamları için WhatsApp Business numarasının
  Facebook sayfasına / Meta İş Portföyü'ne **bağlı olması gerekir**. API'ye (Cloud API) geçmek gerekmez;
  uygulama yeterli.
- Yol (biri yeterli; menü adları sürüme göre değişebilir):
  - WhatsApp Business uygulaması → Ayarlar → İşletme araçları → "Facebook ve Instagram" → Facebook sayfasını bağla.
  - veya Meta Business Suite → Ayarlar → Hesaplar → WhatsApp hesapları → Ekle (kod WhatsApp'a gelir).
- Bağlandıktan sonra reklam oluştururken hedef "Mesajlar → WhatsApp" seçilebilir.
- Advantage+ katalog reklamı önceliği değişmez; WhatsApp reklamı ikinci aşamada.

## 4. Google İşletme Profili ve Instagram (kullanıcı)

- **Google İşletme Profili ("Koton Leventoğlu"):** numara aramaya kapalı olduğu için telefon alanına
  **yazılmaz** (Google "Ara" butonu gösterir, müşteri ulaşamaz). Web sitesi `https://bollmark.com`.
  Profil düzenle → İletişim bölümünde "Sohbet / WhatsApp" seçeneği çıkıyorsa `https://wa.me/902243230121` eklenir.
- **Instagram:** Profili düzenle → İletişim seçenekleri / "WhatsApp" → numarayı bağla (kod WhatsApp'a gelir);
  profilde "WhatsApp" butonu çıkar. Kullanıcı adı 1 Kasım'da değişse de bu bağlantı etkilenmez.
