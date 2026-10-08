# iyzico Canlıya Geçiş — Tek Sayfa

Bu sayfayı **iyzico başvurunuz onaylandıktan sonra** uygulayın. Kod ve sistem hazır; sizin yapacağınız iş anahtarları girip modu açmak. Toplam süre: yaklaşık 20 dakika.

**Başlamadan önce elinizde olsun:** iyzico'dan gelen *canlı* API Key ve Secret Key (`sandbox-` ile **başlamaz**), kendi banka kartınız.

---

## 1. Canlı anahtarları girin
1. `bollmark.com/admin` adresinden yönetici olarak girin (personel hesabı bu sayfayı göremez).
2. Sol menüden **Sistem → Sanal POS**'a girin.
3. **Canlı anahtarlar** kutusundaki **Canlı API Key** ve **Canlı Secret Key** alanlarına anahtarları yapıştırın. Başında/sonunda boşluk kalmasın.
4. **Mod** kutusunu şimdilik **Test (Sandbox)** bırakın. **Ayarları Kaydet**'e basın.
   - Kayıttan sonra alanlarda yalnızca "•••• son 4" görünür. Bu normaldir, anahtarlar şifreli saklanır.
   - "Canlı anahtarlar sandbox- ile başlamamalı" uyarısı çıkarsa yanlış anahtarı yapıştırmışsınız demektir.

## 2. Canlı bağlantıyı test edin
1. Aynı sayfada **Bağlantıyı Test Et** kutusundaki **Canlı bağlantıyı test et** düğmesine basın.
2. Üstteki **Durum** kartında "Canlı bağlantı testi başarılı" görmelisiniz. Para hareketi olmaz.
3. Başarısız olursa: anahtarları yeniden yapıştırıp kaydedin, tekrar deneyin. Hâlâ olmuyorsa iyzico'ya "canlı anahtarım çalışmıyor" diye yazın; **bir sonraki adıma geçmeyin.**

## 3. iyzico panelinde webhook adresini girin
1. iyzico merchant paneline girin: **Ayarlar → Firma Ayarları**.
2. Webhook adresi alanına şunu yazın (Sanal POS sayfasındaki **Entegrasyon Adresleri** kutusundan kopyalayabilirsiniz):
   `https://bollmark.com/api/odeme/iyzico/webhook`
3. **entegrasyon@iyzico.com** adresine "Webhook imza özelliğini (X-IYZ-SIGNATURE-V3) hesabım için açar mısınız?" diye e-posta atın. Cevap gelmese de site çalışır; imza açıldığında ek güvenlik sağlar.
4. Ayrıca iyzico'ya şunları sorun (ayrıntı: `IYZICO_TEST_RAPORU.md` bölüm 7): taksit, kimlik numarası alanı ve aynı gün iade davranışı.

## 4. Modu Canlı'ya alın
1. **Sistem → Sanal POS → Ayarlar** bölümünde **Sanal POS aktif** kutusunu işaretleyin.
2. **Mod** kutusunu **Canlı** yapın. **Maksimum taksit**i **Tek çekim** bırakın (taksit için iyzico'nun teyidini bekleyin).
3. **Ayarları Kaydet**'e basın. Çıkan uyarıyı okuyup onaylayın: "Bundan sonra müşterilerin kartından gerçek para çekilir."
4. **Durum** kartında rozet **Canlı** olmalı ve **"Ödeme almaya hazır."** yazmalı. Yazmıyorsa kırmızı çarpılı satır neyin eksik olduğunu söyler.

## 5. Kendi kartınızla gerçek bir deneme yapın
Bu adım **zorunludur**; para akışını siz görmeden müşteriye açık bırakmayın.
1. Sitede en ucuz ürünü sepete atın, kendi bilgilerinizle sipariş verin, **Ödemeye Geç**'e basın. Bu sırada sayfada "Test ödeme modu" uyarısı **görünmemeli**.
2. Kendi kartınızla ödeyin (3D Secure kodu telefonunuza gelir).
3. Teşekkür sayfasını görün. **Admin → Siparişler**'de siparişin **Ödendi** olduğunu, sipariş sayfasındaki **Ödeme** kartında tutarı, kart son 4 hanenizi ve "iyzico paymentId"yi kontrol edin.
4. Aynı sipariş sayfasında **Ödeme** kartından **tam iade** yapın (sebep: Diğer). Sipariş durumu **İade Edildi** olmalı.
5. iyzico merchant panelinde işlemi ve iadeyi görün. Karta yansıması bankaya göre birkaç gün sürebilir.

Hepsi tamamsa gerçek müşteri ödemesi açıktır.

---

## Bir sorun olursa: geri dönüş (30 saniye)
- **Ödemeyi tamamen durdurmak:** Sanal POS sayfasında **Sanal POS aktif** kutusunu kaldırıp **Ayarları Kaydet**. Site sipariş almayı durdurur ("Ödeme sistemi şu an kullanılamıyor"). Mevcut siparişler etkilenmez.
- **Test moduna dönmek:** **Mod**'u **Test (Sandbox)** yapıp kaydedin. Gerçek para çekilmez.

## Bilmeniz gerekenler
- **Yerel bilgisayar ve önizleme adresleri her zaman test modunda çalışır**; canlı anahtarla yanlışlıkla gerçek para çekilmez.
- Bir sipariş ödemesi tamamlanmadan bırakılırsa `Sanal POS` sayfasındaki **Sipariş bekleme süresi** (varsayılan 60 dk) sonunda otomatik iptal edilir, kupon ve puanlar geri verilir.
- Siparişlerde **"Dikkat gerekiyor"** rozeti görürseniz (sol menüde Siparişler yanında sayı çıkar) siparişi açıp nedenini okuyun; ör. aynı siparişe iki ödeme yapılması. **Çift ödeme için panelde iade düğmesi yok**: iyzico panelinden iade edip sipariş sayfasında "Uyarıyı kapat"a basın.
- Bir sipariş ödeme durumunda **"İnceleniyor"** görünüyorsa iyzico dolandırıcılık kontrolü yapıyordur; **kargolamayın**, iyzico onaylayınca otomatik güncellenir (Ödeme kartından "iyzico'dan durumu sorgula" ile de kontrol edebilirsiniz).
- Kupon ve sadakat puanı, iade edilen siparişlerde geri verilmez.
- Bir sorunda **Sanal POS → Ödeme Günlüğü** tablosuna bakın (tür, sonuç ve sipariş numarasıyla filtrelenir); kart veya anahtar bilgisi içermez.
