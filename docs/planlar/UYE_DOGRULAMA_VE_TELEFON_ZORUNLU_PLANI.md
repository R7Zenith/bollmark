# Üye Doğrulama + Zorunlu Telefon + SMS/WhatsApp Doğrulama Araştırması (2026-11-04)

## Tetikleyen olay

Reklamlar 2026-11-03 gecesi başladı, sabaha 3 yeni üye geldi, üçü de e-postasını doğrulamamış.

## Koddan tespitler

- `src/app/(site)/hesap/(auth)/giris/page.tsx` → `handleRegister`: kayıt başarılı olunca otomatik `signIn` yapıp
  `afterAuthPath()` ile direkt `/hesap`'a (ya da Kalp Topla akışında ürün sayfasına) gidiyor. Üyeye
  "sana doğrulama e-postası gönderdik" diyen **hiçbir ekran yok**.
- `src/app/(site)/hesap/(panel)/page.tsx` (Hesap Özeti) doğrulanmamış üyeye uyarı/banner göstermiyor.
- `src/app/(site)/api/musteri-kayit/route.ts`: `phone: z.string().optional()`, formda "Telefon (opsiyonel)",
  biçim kontrolü/normalizasyon yok.
- Doğrulama e-postası `sendVerificationEmail` → `sendMail` (Resend) ile gidiyor; `sendMail` hata olursa
  sadece loglayıp yoksayıyor. `.env.example`'da varsayılan `MAIL_FROM="Bollmark <onboarding@resend.dev>"`.
  **Şüphe:** Vercel Production'da `MAIL_FROM` bollmark.com gibi doğrulanmış bir alan adına ayarlı değilse ya da
  Resend'de alan adı doğrulanmamışsa, e-postalar üyelere hiç ulaşmıyor olabilir (Resend'in test adresi sadece hesap
  sahibine gönderim yapar). Yani sorun "üye doğrulamadı" değil "e-posta hiç gitmedi" de olabilir — önce bu kontrol edilmeli.
- Doğrulama Kalp Topla için de önemli: doğrulanmamış üyenin kalpleri sayılmıyor (`activatePendingHearts`).

## SMS / WhatsApp araştırması (ücretsiz mi?)

| Yöntem | Maliyet | Gereken | Not |
|---|---|---|---|
| SMS OTP (Netgsm, iletiMerkezi vb.) | Ücretsiz değil, kredi/paket | BTK onaylı SMS başlığı (e-Devlet onayı), abonelik | iletiMerkezi yeni hesaba 100 SMS hediye veriyor; sonrası ücretli |
| Firebase Phone Auth (SMS) | SMS başına ücretli (Blaze planı) | Google Cloud faturalandırma | Türkiye'ye yerel başlıksız gider, önerilmez |
| WhatsApp OTP (biz kod göndeririz, authentication şablonu) | Türkiye: mesaj başı ~$0.0009 (Nisan 2026'dan beri) | WhatsApp Cloud API, Meta işletme hesabı, onaylı şablon | 1000 doğrulama ≈ 1 dolar — pratikte bedava |
| WhatsApp "kullanıcı bize yazar" doğrulaması (ters OTP) | **Ücretsiz** (gelen mesaj ve 24 saat içindeki cevap ücretsiz) | Cloud API webhook; mevcut Bulutfon numarası Coexistence ile hem WhatsApp Business uygulamasında hem API'de kalabilir | Üye "WhatsApp ile doğrula"ya basar, hazır kodlu mesaj açılır, gönderir, sistem numarayı doğrular |

Sonuç: Tamamen ücretsiz SMS yok. WhatsApp'ta iki yol var: ters doğrulama tamamen ücretsiz, OTP şablonu ise neredeyse
ücretsiz. İkisi de Meta tarafında kurulum istiyor (Meta geliştirici uygulaması, WhatsApp Cloud API, Coexistence ile
mevcut numaranın bağlanması, OTP için şablon onayı). Coexistence'ın bizim numaramızda açılıp açılmadığı ancak kurulumda
görülür (yeni/az kullanılmış numaralar kontrolden geçemeyebiliyor).

## Önerilen yol

- **Faz 1 (şimdi, ücretsiz, bu prompt):** e-posta teslimini kontrol et + kayıttan sonra "e-postanı doğrula" sayfası +
  Hesabım'da banner + telefonu zorunlu ve Türkiye cep formatında yap + telefonu olmayan eski üyelere telefon ekleme kutusu.
- **Faz 2 (kullanıcı kararından sonra):** WhatsApp ile telefon doğrulama (ters doğrulama ya da OTP şablonu).
  E-posta doğrulamanın yerine değil, yanına alternatif olarak (ikisinden biri yeterli olabilir — karar verilecek).

## Faz 1 için Claude Code promptu

Bkz. aşağıdaki blok (kullanıcıya da aynen verildi).

```
Yüklü skill'leri kullan. Bollmark'ta yeni üyelerin e-posta doğrulamasını artırmak ve telefonu zorunlu yapmak
istiyorum. Reklamlar dün gece başladı, sabah 3 yeni üye geldi, üçü de e-postasını doğrulamamış. Aşağıdakileri sırayla yap.

### 0. Önce teşhis (kod değiştirmeden, bulguları bana raporla)

1. Vercel Production'da MAIL_FROM değişkeni ne? (`vercel env ls production` ile var mı yok mu bak; değeri okunamıyorsa
   sadece var/yok söyle.) Tanımlı değilse src/lib/mail.ts varsayılanı "onboarding@resend.dev" kullanılıyor demektir;
   bu Resend test adresi, üyelere e-posta gitmez.
2. Resend'de bollmark.com alan adı doğrulanmış mı, son 3 gündeki gönderimlerde bu 3 yeni üyenin doğrulama e-postası
   "delivered" mı, "bounced"/hata mı? (Yerel .env'deki RESEND_API_KEY ile Resend API'den listele: GET
   https://api.resend.com/emails. Anahtarı hiçbir yere yazma/loglama.)
3. Canlı DB'de son 3 günde oluşan Customer kayıtlarını (id, createdAt, emailVerifiedAt, phone dolu mu) ve her biri için
   EmailVerificationToken satırı oluşmuş mu, sadece SELECT ile listele. E-posta adreslerini raporda maskeleyerek göster.
4. Bulguları özetle. E-postalar gitmiyorsa bunu açıkça yaz ve nasıl düzeltileceğini öner (MAIL_FROM ayarı / Resend
   alan adı doğrulaması); Vercel env değişikliğini benim onayım olmadan YAPMA.

### 1. Kayıttan sonra "E-postanı doğrula" sayfası

- Yeni sayfa: src/app/(site)/hesap/(auth)/dogrulama-bekleniyor/page.tsx (server component, robots noindex, mevcut
  /hesap/dogrula sayfasının tasarım diliyle aynı).
- Giriş yapmış üyenin e-postasını maskeli göster (örn. "oz***@gmail.com"), metin: "Hesabın oluşturuldu. E-posta
  adresine bir doğrulama bağlantısı gönderdik. Bağlantıya tıklayarak hesabını doğrula. Göremiyorsan Spam / Gereksiz
  klasörüne bak."
- "Doğrulama e-postasını tekrar gönder" butonu: server action, mevcut sendVerificationEmail'i kullanır (10 dakika
  sınırı zaten var). Sonuç sayfada gösterilsin ("Gönderildi" / "Son 10 dakika içinde zaten gönderdik, biraz bekle").
- "Alışverişe devam et" butonu: ?devam= parametresindeki yola döner. Bu parametreyi sadece site içi yol olarak kabul et
  (giris/page.tsx'teki afterAuthPath'in açık yönlendirme korumasıyla aynı kural); geçersizse /hesap.
- Üye zaten doğrulanmışsa sayfa direkt devam yoluna (ya da /hesap'a) yönlendirsin. Giriş yoksa /hesap/giris'e.
- giris/page.tsx handleRegister: kayıt + otomatik giriş başarılı olunca router.push(afterAuthPath(searchParams))
  yerine `/hesap/dogrulama-bekleniyor?devam=${encodeURIComponent(afterAuthPath(searchParams))}` adresine gitsin.
  Kalp Topla akışı (callbackUrl + kalp parametresi) böylece bozulmaz, sadece araya bu sayfa girer. Giriş sekmesinin
  davranışı DEĞİŞMESİN.

### 2. Hesabım'da doğrulanmamış üye uyarısı

- src/app/(site)/hesap/(panel)/layout.tsx (veya Hesap Özeti sayfası, hangisi tüm panel sayfalarında görünüyorsa)
  üstüne, emailVerifiedAt boşsa ince bir uyarı şeridi: "E-posta adresin henüz doğrulanmadı." + "Tekrar gönder"
  (aynı server action) linki. Doğrulanınca görünmesin. Sorgu tek alan (emailVerifiedAt) çeksin, Neon transferini
  şişirmesin.

### 3. Telefon zorunlu + Türkiye cep formatı

- Yeni yardımcı: src/lib/phone.ts → normalizeTrMobile(input): string | null. Kabul: "0532 123 45 67", "532 123 45 67",
  "+90 532 123 45 67", "905321234567", boşluk/tire/parantez temizlenir. Çıktı E.164: "+905321234567". 5 ile
  başlamayan ya da 10 haneye inmeyen her şey null. Aynı dosyaya formatTrMobile (gösterim için "0532 123 45 67") ekle.
  Birim testi yaz (mevcut *.test.ts deseniyle).
- api/musteri-kayit/route.ts: phone zorunlu olsun; normalizeTrMobile null dönerse 400 + "Geçerli bir cep telefonu
  numarası gir (05xx xxx xx xx)." Normalize edilmiş değeri kaydet ve Meta CAPI'ye de normalize değeri gönder.
- giris/page.tsx kayıt formu: etiket "Telefon" (opsiyonel yazısı kalksın), input required, placeholder
  "05xx xxx xx xx", inputMode="tel", autoComplete="tel". İstemcide de aynı normalize ile kontrol edip hatayı formda
  göster.
- Telefon numarasında unique kısıtı EKLEME (şema değişikliği yok).
- Telefonu boş olan mevcut üyeler için: Hesap Özeti'nde küçük bir "Telefon numaranı ekle" kutusu (server action,
  aynı normalize kuralı, sadece kendi kaydını günceller, requireCustomer ile). Telefon doluysa kutu görünmesin.
- Ödeme sayfasında (checkout-form.tsx) telefon alanı varsa ve üyenin kayıtlı telefonu varsa varsayılan olarak
  doldurulsun mu bak; zaten dolduruluyorsa dokunma, doldurulmuyorsa bana sadece raporla (bu turda değiştirme).

### 4. Test

1. npx tsc --noEmit, npm run lint (değişen dosyalar), birim testleri ve npm run build hatasız.
2. Yerel dev sunucuda Playwright ile (MAIL_DEV_REDIRECT açık olduğundan e-postalar bana gelir):
   - Telefonsuz kayıt denemesi reddediliyor; "05321234567" ile kayıt başarılı, DB'de "+905321234567" kaydedilmiş.
   - Kayıt sonrası /hesap/dogrulama-bekleniyor açılıyor, maskeli e-posta görünüyor, "tekrar gönder" ilk basışta
     "biraz bekle" diyor (kayıtta zaten gönderildiği için), "Alışverişe devam et" doğru yola dönüyor.
   - Kalp Topla akışı: /hesap/giris?sekme=kayit&callbackUrl=/urunler/<bir-urun>&kalp=<id> ile kayıt olunca bekleme
     sayfası çıkıyor, devam butonu ?kalp= ile ürüne dönüyor.
   - Hesabım'da doğrulanmamış uyarısı görünüyor; doğrulama linkine tıklayınca kayboluyor.
   - devam=//evil.com gibi bir değer /hesap'a düşüyor.
   - 1280 ve 375 genişlikte ekran görüntüleri, 375'te yatay taşma yok.
3. Test için oluşturduğun üyeleri işin sonunda canlı DB'den sil (geliştirme canlı DB'de yapılıyor, isTest/test listesi
   kurallarına uy) ve sildiğini raporla.

Önce localhost'ta göstereceğim, onayımdan sonra: önce DEPLOY_STATUS.md'ye not düş, sonra yerel commit at. Benim
onayım olmadan push etme ve Vercel env değişikliği yapma. Bitince teşhis bulgularını, git diff özetini ve ekran
görüntülerini paylaş.
```

## Sonraki adım / açık karar

- Teşhis sonucu: e-postalar gerçekten gidiyor mu? Gitmiyorsa MAIL_FROM/Resend alan adı düzeltmesi öncelikli.
- Faz 2 kararı: WhatsApp ters doğrulama (ücretsiz, Coexistence + webhook) mı, WhatsApp OTP şablonu (~$0.0009/mesaj) mı?
  İkisi de Meta Cloud API kurulumu ister; kullanıcı Meta Business hesabını/Coexistence'ı kurmaya hazır mı sorulacak.
- Doğrulama kuralı: e-posta VEYA telefon doğrulaması yeterli mi (Kalp Topla açısından da), yoksa ikisi de mi?
