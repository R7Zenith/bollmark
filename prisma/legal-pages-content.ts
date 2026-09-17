// Yasal sayfalarin (LegalPage) gercek metinleri - HUKUKI_SAYFALAR_ICERIK_VE_PLAN.md
// kaynak alinarak hazirlandi. Hem prisma/seed.ts (yeni ortam kurulumu, create-only)
// hem de scripts/push-yasal-sayfalar-icerik.ts (mevcut DB'ye gercek metni yazmak
// icin, update dahil) tarafindan kullanilir - tek kaynaktan yonetilir.
//
// LegalPage.content duz metin alanidir (whitespace-pre-line ile render edilir,
// markdown ayristirilmaz) - bu yuzden basliklar "## " isareti olmadan, bos
// satirlarla ayrilmis duz metin olarak yazilmistir.

const YAYIN_TARIHI = "18 Eylül 2026";

export type LegalPageSeed = { slug: string; title: string; content: string };

export const legalPagesContent: LegalPageSeed[] = [
  {
    slug: "hakkimizda",
    title: "Hakkımızda",
    content: `Bollmark, 40 yılı aşkın bir ticaret geçmişine sahip bir aile işletmesidir. 2016 yılından bu yana Koton'un Corner Mağazası olarak hizmet vermekte, aynı zamanda kadın, erkek ve çocuk ayakkabı, valiz ve aksesuar kategorilerinde çeşitli markalara ait ürünleri müşterilerimizle buluşturmaktayız.

Yılların verdiği tecrübeyle, müşteri memnuniyetini ve güler yüzlü hizmeti her zaman önceliğimiz olarak görüyoruz. Karacabey'deki mağazamızda sunduğumuz aynı özenli hizmeti, artık bollmark.com üzerinden online alışveriş deneyimimizle de sürdürüyoruz.

Bollmark ailesi olarak, kaliteli ürünü uygun fiyatla ve güvenilir bir alışveriş deneyimiyle sizlere ulaştırmayı amaçlıyoruz.`
  },
  {
    slug: "gizlilik-politikasi",
    title: "Gizlilik Politikası ve Kişisel Verilerin Korunması Aydınlatma Metni",
    content: `Bu Gizlilik Politikası ve Aydınlatma Metni, bollmark.com ("Site") üzerinden gerçekleştirdiğiniz alışverişler ve site kullanımınız sırasında elde edilen kişisel verilerinizin, 6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") kapsamında nasıl işlendiğini açıklamak amacıyla hazırlanmıştır.

1. Veri Sorumlusunun Kimliği

Veri sorumlusu: Oğuzhan Leventoğlu (Bollmark)
Vergi Dairesi / No: Karacabey Vergi Dairesi – 6080753452
Adres: Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa
E-posta: bilgi@bollmark.com

2. İşlenen Kişisel Veriler

Sitemiz üzerinden alışveriş yapmanız veya üye olmanız halinde; ad-soyad, teslimat ve fatura adresi, telefon numarası, e-posta adresi, sipariş ve ödeme geçmişi bilgileri ile site kullanımınıza ilişkin IP adresi ve çerez verileri işlenebilir. Ödeme kartı bilgileriniz tarafımızca saklanmaz; ödeme işlemleri doğrudan iyzico'nun güvenli ödeme altyapısı üzerinden gerçekleştirilir.

3. Kişisel Verilerin İşlenme Amaçları

- Sipariş süreçlerinin yürütülmesi, ürünlerin teslimatının sağlanması
- Fatura ve muhasebe kayıtlarının tutulması (yasal yükümlülük)
- Müşteri hizmetleri süreçlerinin yürütülmesi, taleplerin cevaplanması
- Cayma hakkı ve iade süreçlerinin yönetilmesi
- Dolandırıcılık ve kötüye kullanımın önlenmesi
- Yasal düzenlemelerden doğan yükümlülüklerin yerine getirilmesi

4. Kişisel Veri İşlemenin Hukuki Sebebi

Kişisel verileriniz, KVKK'nın 5. maddesi uyarınca; bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması, hukuki yükümlülüğün yerine getirilmesi ve veri sorumlusunun meşru menfaati hukuki sebeplerine dayanılarak işlenmektedir.

5. Kişisel Verilerin Aktarılması

Kişisel verileriniz; siparişin teslimatının sağlanması amacıyla anlaşmalı kargo firmamız ile, ödeme işlemlerinin gerçekleştirilmesi amacıyla iyzico ödeme kuruluşu ile ve yasal olarak talep edilmesi halinde yetkili kamu kurum ve kuruluşları ile paylaşılabilir.

6. Kişisel Veri Toplama Yöntemi

Kişisel verileriniz, sitemiz üzerindeki sipariş formu, üyelik formu ve iletişim formu aracılığıyla elektronik ortamda, doğrudan sizin tarafınızdan sağlanan veriler olarak toplanmaktadır.

7. Saklama Süresi

Kişisel verileriniz, işleme amacının gerektirdiği süre ve ilgili mevzuatta (Vergi Usul Kanunu, Türk Ticaret Kanunu, Tüketicinin Korunması Hakkında Kanun) öngörülen zamanaşımı süreleri boyunca saklanır; fatura ve sipariş kayıtları bu kapsamda en az 10 yıl saklanmaktadır.

8. Veri Güvenliği

Kişisel verilerinizin güvenliğini sağlamak amacıyla SSL sertifikası ile şifreli veri iletimi kullanılmakta, verilere erişim yetkilendirilmiş kişilerle sınırlandırılmakta ve ödeme bilgileri iyzico'nun PCI-DSS uyumlu altyapısında işlenmektedir.

9. Haklarınız (KVKK m.11)

KVKK'nın 11. maddesi uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde/dışında aktarıldığı üçüncü kişileri bilme, eksik/yanlış işlenmişse düzeltilmesini isteme, silinmesini/yok edilmesini isteme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerin münhasıran otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.

Bu haklarınızı kullanmak için taleplerinizi bilgi@bollmark.com adresine veya Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa adresine yazılı olarak iletebilirsiniz.

10. Çerez Politikası

Sitemizde; sitenin çalışması için zorunlu çerezler ile site trafiğini analiz etmeye yönelik çerezler kullanılmaktadır. Tarayıcı ayarlarınızdan çerezleri yönetebilir veya silebilirsiniz.

11. Değişiklikler

Bu Gizlilik Politikası, yasal düzenlemelerdeki değişiklikler veya işleme faaliyetlerimizdeki güncellemeler doğrultusunda revize edilebilir. Güncel metin her zaman bu sayfada yayınlanır.

Son güncelleme: ${YAYIN_TARIHI}`
  },
  {
    slug: "mesafeli-satis-sozlesmesi",
    title: "Mesafeli Satış Sözleşmesi ve Ön Bilgilendirme Formu",
    content: `Madde 1 – Taraflar

SATICI
Unvan: Oğuzhan Leventoğlu (Bollmark)
Vergi Dairesi / No: Karacabey Vergi Dairesi – 6080753452
Adres: Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa
E-posta: bilgi@bollmark.com

ALICI
Sipariş sırasında girilen ad-soyad, adres, telefon ve e-posta bilgileri esas alınır; bu bilgiler işbu sözleşmenin ayrılmaz parçasıdır.

Madde 2 – Konu

İşbu sözleşmenin konusu, ALICI'nın bollmark.com üzerinden elektronik ortamda siparişini verdiği, sözleşmede belirtilen nitelik ve satış fiyatı gösterilen ürün/ürünlerin satışı ve teslimi ile ilgili olarak 6502 sayılı Tüketicinin Korunması Hakkında Kanun ve Mesafeli Sözleşmeler Yönetmeliği hükümleri gereğince tarafların hak ve yükümlülüklerinin belirlenmesidir.

Madde 3 – Sözleşme Konusu Ürün/Ödeme/Teslimat Bilgileri

Ürünün cinsi, miktarı, marka/modeli, rengi, adedi, satış bedeli (KDV dahil) ve ödeme şekli, ALICI'nın sipariş sırasında sitede görüntülediği ve onayladığı sipariş özeti ile faturada belirtilmiştir; bu bilgiler işbu sözleşmenin eki ve ayrılmaz parçası sayılır. Ödeme, iyzico güvenli ödeme altyapısı üzerinden kredi/banka kartı ile yapılır. Teslimat, sipariş onayından itibaren ortalama 1-3 iş günü içinde, ALICI'nın bildirdiği teslimat adresine anlaşmalı kargo firmamız aracılığıyla yapılır; kargo ücreti ödeme sayfasında ayrıca gösterilir.

Madde 4 – Genel Hükümler

ALICI, sipariş vermeden önce Site'de yer alan Ön Bilgilendirme Formu'nu okuduğunu ve elektronik ortamda onayladığını kabul eder. SATICI, sipariş konusu ürünün stok/tedarik sorunları veya mücbir sebep halinde ALICI'yı bilgilendirmek koşuluyla siparişi iptal edebilir ve ödenen bedeli iade eder. Sipariş onayı, ALICI'nın bildirdiği e-posta ve/veya SMS ile iletilir.

Madde 5 – Cayma Hakkı

ALICI, hiçbir hukuki ve cezai sorumluluk üstlenmeksizin ve hiçbir gerekçe göstermeksizin, ürünün kendisine veya gösterdiği adresteki üçüncü kişiye tesliminden itibaren 14 (on dört) gün içinde cayma hakkına sahiptir. Cayma hakkının kullanılması için bu süre içinde SATICI'ya yazılı olarak (bilgi@bollmark.com adresine e-posta ile) bildirimde bulunulması yeterlidir.

Cayma hakkının kullanılması halinde:
- Ürünün faturası, kutusu, ambalajı, varsa standart aksesuarları ile birlikte eksiksiz ve hasarsız olarak iade edilmesi gerekir.
- İade kargo ücreti ALICI'ya aittir.
- Ürün, işyeri adresimize (Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa) gönderilir.
- Cayma bildiriminin SATICI'ya ulaşmasından ve ürünün SATICI'ya ulaşıp kontrolünün yapılmasından itibaren en geç 14 gün içinde ürün bedeli ALICI'ya iade edilir.

Madde 6 – Cayma Hakkının Kullanılamayacağı Ürünler

Mesafeli Sözleşmeler Yönetmeliği'nin 15. maddesi uyarınca; ambalajı, bandı, mührü, etiketi açılmış olan ve sağlık/hijyen açısından iadesi uygun olmayan ürünlerde (iç giyim, mayo, bikini gibi ürünler dahil) cayma hakkı kullanılamaz. Bu tür ürünler, orijinal ambalajı açılmamış ve etiketi çıkarılmamış olması koşuluyla iade edilebilir.

Madde 7 – Temerrüt Hali

ALICI'nın ödemeyi banka veya kredi kartı ile yaptığı hallerde, temerrüde düşmesi durumunda kart sahibi banka ile arasındaki kredi kartı sözleşmesi hükümlerine göre faiz ödeyeceğini ve bankaya karşı sorumlu olacağını kabul eder.

Madde 8 – Yetkili Merciler

İşbu sözleşmeden doğan uyuşmazlıklarda, Ticaret Bakanlığınca her yıl belirlenen parasal sınırlar dahilinde ALICI'nın veya SATICI'nın yerleşim yerindeki Tüketici Hakem Heyetleri, bu sınırları aşan uyuşmazlıklarda ise Tüketici Mahkemeleri yetkilidir.

Madde 9 – Yürürlük

ALICI, Site üzerinden verdiği siparişe ait ödemeyi gerçekleştirdiğinde işbu sözleşmenin tüm koşullarını kabul etmiş sayılır.

Son güncelleme: ${YAYIN_TARIHI}`
  },
  {
    slug: "kargo-bilgisi",
    title: "Teslimat Şartları",
    content: `Siparişleriniz, ödemenin onaylanmasının ardından 1-3 iş günü içinde hazırlanıp kargoya teslim edilir.

Kargonuz yola çıktığında takip bilgileri e-posta ve/veya SMS ile tarafınıza iletilir.

Teslimat, sipariş sırasında belirttiğiniz adrese anlaşmalı kargo firmamız aracılığıyla yapılır.

Resmi tatiller ve yoğun kampanya dönemlerinde teslimat süresi uzayabilir; böyle bir durumda tarafınıza bilgi verilir.

İade koşulları için "İade Koşulları" sayfamızı inceleyebilirsiniz. Sorularınız için bilgi@bollmark.com adresinden bize ulaşabilirsiniz.

Son güncelleme: ${YAYIN_TARIHI}`
  },
  {
    slug: "iade-kosullari",
    title: "İade Koşulları",
    content: `Mesafeli Satış Sözleşmesi'nde belirtildiği üzere, teslim aldığınız üründen 14 gün içinde, hiçbir gerekçe göstermeksizin cayma hakkınızı kullanabilirsiniz.

İade adımları:

1. bilgi@bollmark.com adresine sipariş numaranızla birlikte iade talebinizi iletin.
2. Ürünü faturası, orijinal kutusu/ambalajı ve etiketleriyle birlikte, kullanılmamış ve hasarsız şekilde paketleyin.
3. Ürünü Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa adresine gönderin.
4. İade kargo ücreti alıcıya aittir.
5. Ürün elimize ulaşıp kontrolü tamamlandıktan sonra bedeli, en geç 14 gün içinde ödemeyi yaptığınız yönteme iade edilir.

İade edilemeyecek ürünler: İç giyim, mayo, bikini gibi hijyen açısından hassas ürünlerde, ambalajı/etiketi açılmış veya kullanılmışsa cayma hakkı kullanılamaz.

Sorularınız için bilgi@bollmark.com adresinden bize ulaşabilirsiniz.

Son güncelleme: ${YAYIN_TARIHI}`
  }
];
