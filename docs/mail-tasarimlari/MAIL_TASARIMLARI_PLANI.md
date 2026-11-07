# Müşteri Mailleri Tasarım Yenileme Planı

Tarih: 2026-11-08 · Durum: uygulama bekliyor

## Amaç

Müşteriye giden düz metin mailleri, Kalp Topla maillerindeki görsel dile (logo, bej zemin `#f4f1ee`, beyaz kart, siyah yuvarlak buton, ürün fotoğrafı) geçirmek. Kalp Topla kampanyası açıkken e-posta doğrulama mailleri için iki yeni, dikkat çekici kampanya tasarımı eklemek.

## Görsel referanslar

Bu klasördeki `0x-*.html` ve `1x-*.html` dosyaları kullanıcının onayladığı tasarımlar. Tarayıcıda açıp bakılabilir.

- Bunlar **yalnızca görsel referanstır, e-posta HTML'i değildir** (flex, inline SVG kullanıyorlar). Mailler, mevcut `src/lib/kalp-topla/notification-emails.ts` gibi e-posta istemcisi uyumlu yazılmalı: `table role="presentation"`, satır içi stil, en fazla 600px tek sütun, `Arial, Helvetica, sans-serif`.
- SVG ve flex kullanılmayacak (Gmail/Outlook desteklemiyor). Kalpler ve ikonlar emoji/Unicode ile yapılacak. Mevcut `heartsRow` bunu zaten yapıyor:
  - ❤️ verilen kalp · 🤍 boş · 🧡 arkadaş bonusu · 🩷 "senin kalbin, onay bekliyor"
  - Rozetlerdeki ikonlar yerine ✓ gibi düz karakter, ya da sadece metin.
- Logo şimdiki gibi sabit canlı adresten: `https://bollmark.com/logo.png`. Ürün görselleri DB'deki canlı URL'lerden (`jpegCopyUrl` deseni, `notifications.ts > productInfo`). Localhost adresi maile asla girmesin.
- Referanslardaki isimler, fiyatlar ve sayılar örnektir. Gerçek mailde veriden gelir. `[SİPARİŞ NO]` gibi köşeli parantezli alanlar gerçek değerle dolar.

## Ortak yapı

- Yeni ortak şablon yardımcısı: `src/lib/email/` altında (örn. `layout.ts`). Logo, beyaz kart, başlık, paragraf, buton, ikincil link, ürün satırı, toplam bloğu, bilgi kutusu, durum adımları (stepper) ve footer içersin. Her mail `{ subject, html, text }` döndürsün (düz metin sürümü zorunlu).
- Önizleme metni (preheader) her mailde olsun. Referanslarda "Önizleme metni:" diye yazan satır gizli preheader'dır, görünür metin değildir.
- İşlem maili footer'ı (01–08): Sipariş durumu · İade ve değişim · İletişim · Instagram linkleri, WhatsApp numarası, `bilgi@bollmark.com`, mağaza adresi. Hepsi `src/lib/store-info.ts` içindeki `STORE_INFO`'dan alınsın, elle yazılmasın. Sayfa yolları sitedeki gerçek sayfalardan bulunsun.
- Referanslardaki "aboneliği iptal et" linki: sepet hatırlatma ve stok maili için gerçek bir abonelikten çıkma mekanizması yoksa link **eklenmesin**, uydurma link olmasın.
- Kullanıcı girdisi (isim, adres, ürün adı) maile girmeden önce HTML kaçışlansın.
- `sendMail` (`src/lib/mail.ts`) değişmesin: en fazla `text` alanını doldurmak yeterli.
- Kalp Topla'nın mevcut 4 maili (10–13, `notification-emails.ts`) **değişmeyecek**, kullanıcı onlardan memnun. Yalnızca doğrulama maili değişiyor (aşağıda).
- Admin'e giden mailler (yeni sipariş, ödeme dikkat, iletişim formu) değişmeyecek.

## Mail mail yapılacaklar

| # | Referans | Kodda nerede | Not |
|---|---|---|---|
| 01 | `01-siparis-alindi.html` | `order-notifications.ts > notifyCustomerOrderReceived` | Ürünler küçük fotoğraflı (renk · beden · adet · tutar), ara toplam, kargo, toplam, teslimat adresi kutusu, "Siparişimi takip et" butonu. Görsel için sipariş kaleminin ürün/varyant görseli bulunsun. Bulunamazsa satır görselsiz çıksın. |
| 02 | `02-kargoya-verildi.html` | `notifyCustomerStatusChange` (SHIPPED) | 4 adımlı stepper (alındı › hazırlanıyor › kargoda › teslim). Kargo firması ve takip numarası: Order/Shipment modelinde bu alanlar varsa göster, takip butonu varsa takip linkine gitsin. Yoksa o blok ve buton gizlensin, buton sipariş durumu sayfasına gitsin. **Yeni DB alanı ekleme, önce bana sor.** |
| 03 | `03-teslim-edildi.html` | `notifyCustomerStatusChange` (DELIVERED) | Stepper son adımda, ürünler, "X gün içinde kolay değişim" kutusu (`STORE_INFO.returnDays`), ikincil link: iade/değişim talebi sayfası. |
| — | (PAID durumu) | `notifyCustomerStatusChange` (PAID) | Hangi durumlarda mail gittiğine dokunma, sadece tasarımı ortak şablona geçir (02 ile aynı stil, uygun başlık ve stepper adımı). |
| 04 | `04-iade-yapildi.html` | `notifyCustomerRefund` | Ortada büyük iade tutarı kutusu, kısmi/tam iade metni korunacak, "Tutar ne zaman yansır?" kutusu. |
| 05 | `05-iade-talebi-durumu.html` | `notifyReturnStatusChange` | Rozet ve başlık gerçek duruma göre (`returnStatusLabel`), durum stepper'ı gerçek iade/değişim akışının adımlarından, ilgili ürün(ler), "Sıradaki adım" kutusu duruma göre. Bir durum için uygun "sıradaki adım" metni yoksa kutu gizlensin. |
| 06 | `06-dogrulama-sade.html` | `kalp-topla/email-verification.ts > sendVerificationEmail` | **Kampanya kapalıyken** giden doğrulama maili (iki amaç için de). |
| 07 | `07-sepet-hatirlatma.html` | `abandoned-carts.ts > buildAbandonedCartReminderHtml` (cron + admin elle gönderim) | Ürünler fotoğraflı, toplam, "Sepetime dön". Sepet anlık görüntüsünde görsel yok: `api/sepet-kaydet` kaydına ürün görsel URL'si eklensin (geriye uyumlu, eski kayıtlarda görsel yoksa görselsiz satır). Cron ve admin aynı fonksiyonu kullanmaya devam etsin. |
| 08 | `08-tekrar-stokta.html` | `stock-alerts.ts > sendRestockNotifications` | Büyük ürün fotoğrafı, ürün adı, varyant (renk · beden, varsa), "Hemen incele" butonu. Görsel için kuyruğa ürün görsel URL'si eklenebilir. |

## Kalp Topla açıkken doğrulama mailleri (YENİ)

Seçim kuralı (`sendVerificationEmail`):

| Durum | Kampanya açık | Kampanya kapalı |
|---|---|---|
| Kalp verince doğrulama (`purpose === "KALP"`) | **14** `14-dogrulama-kalp-verince-KAMPANYA.html` | **06** sade |
| Normal üyelik doğrulaması | **15** `15-dogrulama-uyelik-KAMPANYA.html` | **06** sade |

- "Kampanya açık" bilgisi mevcut Kalp Topla ayar/durum fonksiyonundan (`src/lib/kalp-topla/settings.ts`) alınsın. Test turu durumu da mevcut kurala göre değerlendirilsin, yeni kural uydurulmasın.
- 10 kalp, %50, 48 saat, +2 kalp gibi sayılar **elle yazılmayacak**. `threshold`, `discountPercent`, `couponHours`, `inviteBonus` ayarlardan gelsin.

### 14 – Kalp verince (kampanya açık)

- Kırmızı (`#c0392b`) üst bant, beyaz daire içinde büyük kalp, "KALP TOPLA" etiketi, "Kalbin sayılmayı bekliyor, {ad}!" başlığı.
- Kalp verilen ürün kartı: ürün fotoğrafı, ürün adı, barın **o anki** durumu. Doğrulanmamış kalp 🩷 ile ayrı gösterilsin, yanında "senin kalbin onay bekliyor" yazsın. Bunun için doğrulama mailini tetikleyen kalp akışından `productId` `sendVerificationEmail`'e geçirilmeli. Ürün bulunamazsa kart gizlensin, mail yine gitsin.
- Ana buton "E-postamı doğrula, kalbim sayılsın" (doğrulama linki). Altında "Bar {threshold} kalbe ulaşınca %{discountPercent} indirim kuponu kazanırsın."
- Turuncu "EN HIZLI YOL / Ne kadar çok arkadaş, o kadar hızlı kilit!" kutusu. "Senin linkinle üye olan her arkadaşın barına +{inviteBonus} kalp ekler." Altında senaryo satırları: tek başına, 1, 2, 3… arkadaş. Her satırda 10'luk kalp sırası ve sonuç (örn. 6/10, son satırda "Kilit açıldı!"). Senaryolar barın gerçek mevcut puanından ve ayarlardan hesaplansın. Kilit açılana kadar en fazla 4 satır. Altında renk açıklaması: ❤️ verilen kalpler · 🩷 senin kalbin · 🧡 arkadaş bonusu.
- "Nasıl çalışır?" 3 adım: doğrula › arkadaşlarını çağır › %{discountPercent} kuponunu kap ({couponHours} saat içinde kullan).
- İkinci buton (kırmızı): "Doğrula ve arkadaşlarını çağır". Bu da doğrulama linkine gitsin.
- Altta bağlantının geçerlilik süresi (`TOKEN_HOURS`) ve "Bu hesabı sen oluşturmadıysan…" notu. Footer: Kampanya koşulları · İletişim · adres.
- Konu: "❤️ Kalbin sayılmayı bekliyor! Tek tıkla doğrula" · Önizleme: "Doğrula, kalbin bara eklensin. Arkadaşlarını çağır, kilit daha hızlı açılsın."

### 15 – Normal üyelik (kampanya açık)

- Aynı kırmızı üst bant. "KALP TOPLA BAŞLADI" etiketi, "Hoş geldin {ad}!" başlığı, "E-postanı doğrula, hemen kalp vermeye başla ve %{discountPercent} indirim kazanma şansını yakala."
- "Beğen, kalp ver, indirimi kap" bölümü: **3 ürün kartı** yan yana (fotoğraf, sağ altta kalp rozeti, ad, boş 10'luk mini bar). Kullanıcının onayladığı 3 ürün:
  1. Kadın kaban (`bollmark-kalp-topla-urunler/1-kadin-kaban-*`)
  2. Erkek deri ceket (`4-erkek-deri-ceket-*`)
  3. Simli kazak (`2-simli-kazak-*`)
  Bu ürünleri DB'de bul (Kalp Topla vitrin ürünleri, `src/lib/kalp-topla/vitrin.ts`). Slug'larını tek bir sabitte tut. Bir ürün bulunamaz, yayından kalkmış ya da stokta değilse yerine vitrindeki sıradaki uygun ürün gelsin. Hiçbirini bulamazsan uydurma, bana sor. Kartlar ürün sayfasına linklensin. Mini bardaki dolu kalp sayısı o ürünün gerçek bar durumu olabilir; zorlaşırsa boş bar kalsın.
- Ana buton "E-postamı doğrula". Altında "Doğrulamadan verdiğin kalpler bara sayılmaz." (bu kural kodda gerçekten böyle mi kontrol et, değilse metni doğru kurala göre düzelt).
- Aynı "EN HIZLI YOL" arkadaş kutusu. Burada kişinin kendi kalbi henüz yok: örnek senaryo ayarlardan hesaplansın. Açıklamada ❤️ senin/diğer kalpler, 🧡 arkadaş bonusu.
- "Nasıl çalışır?" 4 adım: doğrula › beğendiğin ürüne kalp ver › arkadaşlarını çağır › %{discountPercent} kuponunu kap.
- İkinci buton (kırmızı) "Doğrula ve kalp vermeye başla".
- Konu: "🎉 Hoş geldin! Kalp Topla başladı, e-postanı doğrula" · Önizleme: "Beğendiğin ürüne kalp ver, bar dolunca %{discountPercent} indirim senin."

## Test mailleri

İş bitince her mail tipinden bir test maili kullanıcının gelen kutusuna gönderilecek: **ozilevent@gmail.com**.

- `scripts/` altına tek bir test betiği (örn. `scripts/mail-test-gonder.ts`, mevcut script çalıştırma düzenine uygun). Her şablonu render edip `sendMail` ile göndersin.
- Konu başına `[TEST 01/16]` gibi numara eklensin, sırası:
  1. Sipariş alındı
  2. Ödendi (PAID durum maili)
  3. Kargoya verildi
  4. Teslim edildi
  5. İade yapıldı (tam)
  6. Kısmi iade
  7. İade talebi durumu
  8. Doğrulama sade (kampanya kapalı)
  9. Doğrulama kalp verince (kampanya açık, 14)
  10. Doğrulama üyelik (kampanya açık, 15)
  11. Sepet hatırlatma
  12. Tekrar stokta
  13. Kalp: kupon kazandın
  14. Kalp: son kalpler kaldı
  15. Kalp: arkadaşın katıldı
  16. Kalp: kupon bitiyor
- Veri: mümkünse DB'deki gerçek ürün ve görseller (okuma), sipariş için mevcut gerçek bir sipariş kopyalanarak, yoksa örnek veri. Kampanya açık/kapalı varyantları betikte doğrudan seçilsin, ayar değiştirilmesin.
- **DB'ye hiçbir şey yazılmasın**: doğrulama token'ı, bildirim, kupon üretilmesin. Linkler gerçek sayfalara gitsin, doğrulama linki örnek token'lı olsun.
- `MAIL_DEV_REDIRECT` tanımlıysa test mailleri yine ozilevent@gmail.com'a ulaşacak şekilde ayarlansın.
- Resend gönderim limitine dikkat: mailler arasında kısa bekleme olsun. Hata veren olursa sonunda listelensin.

## Sınırlar

- Yalnızca bu plandaki mailler. Başka davranış değişikliği yok (hangi durumda mail gittiği aynı kalır; tek yeni kural kampanya açık/kapalı doğrulama seçimi).
- Yeni DB alanı ya da migration gerekirse önce kullanıcıya sor.
- Mevcut testler geçmeli. Şablon seçimi (kampanya açık/kapalı × amaç) ve arkadaş senaryosu hesabı için küçük birim testler eklensin.
