# İletişim: Sabit Telefon + Instagram DM Planı

Tarih: 2026-10-26 · Durum: Uygulanacak (Claude Code)

## Arka plan

- Mesafeli Sözleşmeler Yönetmeliği 5/1-c: ön bilgilendirmede satıcının "açık adresi,
  telefon numarası ve benzeri iletişim bilgileri" zorunlu.
- E-ticaret hizmet sağlayıcı yönetmeliği (29.12.2022, değ. 08.03.2025): sitede ana
  sayfadan ulaşılan "İletişim" başlığı altında telefon, e-posta, KEP adresi; tacirse
  ticaret unvanı + MERSİS, esnafsa ad soyad + VKN, merkez adresi.
- Karar (2026-10-26): Bulutfon üzerinden coğrafi sabit numara alındı:
  **+90 224 323 01 21** (başvuru inceleme aşamasında). Aramalar Bulutfon mobil
  uygulamasına düşüyor; kullanıcının kişisel cep numarası sitede yer almaz.
- WhatsApp şimdilik yok; ileride WhatsApp Business bu numaraya sesli kodla açılabilir.
- **Karar değişikliği (2026-10-26, uygulama sırasında):** numara yalnız WhatsApp
  Business için kullanılacak, aramalar açılmayacak. Bu yüzden sitede `tel:` linki
  yok ve JSON-LD'de `telephone` yazılmıyor. Yasal metinlerde (Ön Bilgilendirme,
  Mesafeli Satış Sözleşmesi, Gizlilik, iletişim sayfasındaki Satıcı Bilgileri)
  "Telefon / WhatsApp: 0 (224) 323 01 21" düz metin olarak yer alıyor. `wa.me`
  linkleri (footer, iletişim, anasayfa kartı) `STORE_INFO.whatsappActive` false
  olduğu için gizli; WhatsApp Business açılınca bu bayrak true yapılır.
  Mesafeli Satış Sözleşmesi ve Gizlilik Politikası DB kayıtlarına MERSİS ve
  "Telefon / WhatsApp" satırları `scripts/yasal-satici-iletisim-guncelle.ts` ile
  yalnız bu iki kayıt hedeflenerek yazıldı. Açılmayan numaranın yasal yeterliliği
  muhasebeci/avukatla teyit edilecek; Bulutfon'da "WhatsApp'tan yazın" karşılama
  mesajı önerildi.
- Instagram DM ek kanal olarak eklenecek (telefonun yerine geçmez).

## Yapılacaklar

### 1. Telefon (store-info.ts tek kaynak)
- `STORE_INFO.phone` = `"+90 224 323 01 21"`.
- Yardımcılar: ekranda gösterim `0 (224) 323 01 21`, `tel:` linki `+902243230121`.
- Telefonun göründüğü yerler: footer, iletişim sayfası (çalışma saatiyle birlikte:
  Pzt–Cmt 10:00–19:00), Ön Bilgilendirme Formu (statik, kodda), anasayfa JSON-LD
  (`telephone`). Sabit değer kopyalanmaz, hepsi `STORE_INFO`'dan okur.
- Mesafeli Satış Sözleşmesi / KVKK / Gizlilik / İletişim gibi metinler DB'deyse ve
  satıcı iletişim bilgisi içeriyorsa: önce rapor, kullanıcı onayı olmadan DB'ye
  yazılmaz (yerel ve canlı aynı Neon DB).

### 2. Yasal kimlik alanları (değer uydurulmaz)
- `STORE_INFO`'ya `legalName`, `mersisNo`, `taxNo` (VKN), `taxOffice`, `kepAddress`
  alanları `null` olarak eklenir; `null` olanlar hiçbir yerde gösterilmez.
- Kullanıcı tacir/esnaf durumunu ve KEP adresini muhasebeciyle netleştirince doldurulur.
- **Durum (2026-10-26):** MERSİS No (`1667655626000001`) ve VKN (`6080753452`)
  kullanıcıdan alındı, `STORE_INFO`'ya girildi. Ticaret unvanı
  (`Oğuzhan Leventoğlu (Bollmark)`) ve vergi dairesi (`Karacabey Vergi Dairesi`),
  kullanıcı onayıyla Mesafeli Satış Sözleşmesi / Gizlilik Politikası'nda zaten
  yazan değerlerden dolduruldu; unvanın tacir/esnaf durumuna göre doğruluğu
  muhasebeciyle teyit bekliyor. **KEP adresi bekliyor** (`null`, gösterilmiyor).

### 3. Instagram DM
- `STORE_INFO.instagramUsername` (şu an `koton.karacabey`, ileride `bollmark`);
  `instagramUrl` ve DM linki (`https://ig.me/m/<kullanıcı adı>`) bundan türetilir.
- Sağ altta yüzen "Instagram'dan yaz" butonu (ödeme, admin ve hesap/ödeme akışında gizli;
  çerez bandı ve mobil sabit sepete ekle çubuğuyla çakışmaz).
- Ürün sayfasında "Instagram'dan sor": ürün adı + seçili renk/beden + ürün kodu + URL
  panoya kopyalanır, kısa bilgi mesajı gösterilir, DM yeni sekmede açılır.
- İletişim sayfası ve footer'da Instagram DM linki.
- Olaylar mevcut rıza altyapısına bağlı: Meta `Contact` (pazarlama rızası), GA4
  `contact` (analitik rızası), parametre `method: "instagram"` / `"phone"`.
  Telefon linkine tıklama da aynı olayları `method: "phone"` ile gönderir.

## Kontrol
- Localhost'ta: footer, iletişim, Ön Bilgilendirme, ürün sayfası, mobil görünüm,
  JSON-LD, rızasız/rızalı olay gönderimi.
- Push, numara aktifleşip test araması uygulamaya düştükten sonra yapılır.
