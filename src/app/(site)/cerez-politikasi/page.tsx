import type { Metadata } from "next";
import Link from "next/link";
import { ConsentPreferencesButton } from "@/components/consent/consent-preferences-button";

// Statik sayfa (DB yok). Cerez envanteri CEREZ_BANDI_PLANI.md Adim 1'deki
// tespitten gelir - siteye yeni bir cerez/script eklenirse bu tabloyu ve
// gerekiyorsa src/lib/consent.ts'teki CONSENT_VERSION'i guncelleyin.
// Isletme bilgileri gizlilik-politikasi metniyle (prisma/legal-pages-content.ts) ayni.

export const metadata: Metadata = {
  title: "Çerez Politikası",
  description:
    "Bollmark'ta kullanılan çerezler, kategorileri, saklama süreleri ve çerez tercihlerinizi nasıl değiştirebileceğiniz hakkında bilgi.",
  alternates: { canonical: "/cerez-politikasi" }
};

const SON_GUNCELLEME = "25 Ekim 2026";

type CookieRow = { name: string; provider: string; purpose: string; duration: string; category: string };

const COOKIES: CookieRow[] = [
  {
    name: "musteri-oturum-token",
    provider: "Birinci taraf (bollmark.com)",
    purpose: "Müşteri hesabına giriş yapıldığında oturumun açık kalmasını sağlar.",
    duration: "30 gün",
    category: "Zorunlu"
  },
  {
    name: "next-auth.csrf-token",
    provider: "Birinci taraf (bollmark.com)",
    purpose: "Giriş ve oturum işlemlerini sahte isteklere (CSRF) karşı korur.",
    duration: "Oturum süresince",
    category: "Zorunlu"
  },
  {
    name: "next-auth.callback-url",
    provider: "Birinci taraf (bollmark.com)",
    purpose: "Giriş yaptıktan sonra kaldığınız sayfaya geri dönmenizi sağlar.",
    duration: "Oturum süresince",
    category: "Zorunlu"
  },
  {
    name: "next-auth.session-token",
    provider: "Birinci taraf (bollmark.com)",
    purpose: "Yalnızca yetkili personelin yönetim paneli oturumunu tutar; müşterilere bırakılmaz.",
    duration: "30 gün",
    category: "Zorunlu"
  },
  {
    name: "bm_preview",
    provider: "Birinci taraf (bollmark.com)",
    purpose: "Site yayına hazırlık aşamasındayken önizleme erişimini doğrular.",
    duration: "30 gün",
    category: "Zorunlu"
  },
  {
    name: "bm_consent",
    provider: "Birinci taraf (bollmark.com)",
    purpose:
      "Çerez tercihlerinizi, tercih tarihini ve rızanızın kaydı için rastgele oluşturulmuş anonim bir ziyaretçi kimliğini saklar.",
    duration: "12 ay",
    category: "Zorunlu"
  },
  {
    name: "_ga",
    provider: "Google (üçüncü taraf, Google Analytics)",
    purpose: "Ziyaretçileri birbirinden ayırt ederek sitenin ve ürünlerin nasıl kullanıldığını istatistiksel olarak ölçmemizi sağlar.",
    duration: "2 yıl",
    category: "Analitik"
  },
  {
    name: "_ga_YGXJVLGKJG",
    provider: "Google (üçüncü taraf, Google Analytics)",
    purpose: "Google Analytics'te ziyaret (oturum) bilgisini tutar; sayfa görüntülemeleri ve alışveriş adımlarının aynı ziyarete bağlanmasını sağlar.",
    duration: "2 yıl",
    category: "Analitik"
  },
  {
    name: "_fbp",
    provider: "Meta Platforms (üçüncü taraf, Meta Pixel)",
    purpose:
      "Tarayıcınızı ziyaretler arasında tanıyarak reklamlarımızın etkisini ölçmemizi ve Facebook/Instagram'da size ilgili ürünleri göstermemizi sağlar.",
    duration: "90 gün",
    category: "Pazarlama"
  },
  {
    name: "_fbc",
    provider: "Meta Platforms (üçüncü taraf, Meta Pixel)",
    purpose: "Siteye bir Facebook/Instagram reklamına tıklayarak geldiyseniz bu tıklamayı kaydeder; reklam dönüşümlerini ölçmek için kullanılır.",
    duration: "90 gün",
    category: "Pazarlama"
  },
  {
    name: "fr",
    provider: "Meta Platforms (üçüncü taraf, facebook.com)",
    purpose: "Meta'nın kendi alan adında, Facebook hesabınız açıksa reklam gösterimi ve ölçümü için kullandığı çerezdir.",
    duration: "90 gün",
    category: "Pazarlama"
  }
];

const STORAGE: { name: string; purpose: string }[] = [
  { name: "bollmark-cart", purpose: "Sepetinizdeki ürünleri ve uyguladığınız kupon kodunu hatırlar." },
  { name: "bollmark-wishlist", purpose: "Giriş yapmadan favorilere eklediğiniz ürünleri hatırlar." },
  { name: "bollmark:recent-searches", purpose: "Son aramalarınızı arama panelinde göstermek için saklar." }
];

const h2Class = "mt-12 font-display text-xl text-ink";
const pClass = "mt-4 text-sm leading-relaxed text-ink/80";
const thClass = "border-b border-line py-3 pr-4 text-left text-xs font-medium text-ink";
const tdClass = "border-b border-line py-3 pr-4 align-top text-sm text-ink/80";

export default function CookiePolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-display text-3xl">Çerez Politikası</h1>

      <p className={pClass}>
        Bu Çerez Politikası, bollmark.com (&quot;Site&quot;) üzerinde kullanılan çerezler ve benzeri teknolojiler hakkında, 6698
        sayılı Kişisel Verilerin Korunması Kanunu (&quot;KVKK&quot;) kapsamında sizi bilgilendirmek amacıyla hazırlanmıştır.
        Kişisel verilerinizin işlenmesine ilişkin genel bilgiler için{" "}
        <Link href="/sayfa/gizlilik-politikasi" className="text-ink underline underline-offset-2">
          Gizlilik Politikası ve Aydınlatma Metni
        </Link>
        &apos;ni inceleyebilirsiniz.
      </p>

      <h2 className={h2Class}>1. Veri Sorumlusu</h2>
      <p className={`${pClass} whitespace-pre-line`}>
        {`Veri sorumlusu: Oğuzhan Leventoğlu (Bollmark)
Vergi Dairesi / No: Karacabey Vergi Dairesi – 6080753452
Adres: Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa
E-posta: bilgi@bollmark.com`}
      </p>

      <h2 className={h2Class}>2. Çerez Nedir?</h2>
      <p className={pClass}>
        Çerezler, bir internet sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin
        dosyalarıdır. Çerezler sayesinde site, oturumunuzu, tercihlerinizi ve benzeri bilgileri sonraki sayfalarda ve
        ziyaretlerde hatırlayabilir. Çerezler, siteyi işleten tarafından yerleştirildiğinde birinci taraf, başka bir
        hizmet sağlayıcı tarafından yerleştirildiğinde üçüncü taraf çerez olarak adlandırılır.
      </p>

      <h2 className={h2Class}>3. Çerez Kategorileri</h2>
      <p className={pClass}>
        <span className="font-medium text-ink">Zorunlu çerezler:</span> Sitenin temel işlevlerinin (oturum açma, güvenli
        alışveriş, çerez tercihinizin hatırlanması) çalışması için gereklidir. KVKK&apos;nın 5/2 maddesi kapsamında bir
        sözleşmenin kurulması ve ifası ile veri sorumlusunun meşru menfaati hukuki sebeplerine dayanılarak kullanılır ve
        kapatılamaz.
      </p>
      <p className={pClass}>
        <span className="font-medium text-ink">Analitik çerezler:</span> Sitenin nasıl kullanıldığını ölçerek hizmetimizi
        geliştirmemize yardımcı olur. Yalnızca açık rızanız ile kullanılır; varsayılan olarak kapalıdır.
      </p>
      <p className={pClass}>
        <span className="font-medium text-ink">Pazarlama çerezleri:</span> İlginizi çekebilecek ürün ve kampanyaları
        diğer sitelerde ve sosyal medyada göstermek için kullanılır. Yalnızca açık rızanız ile kullanılır; varsayılan
        olarak kapalıdır.
      </p>
      <p className={pClass}>
        Sitemizde analitik kategorisinde Google Analytics (Google), pazarlama kategorisinde Meta Pixel (Meta Platforms)
        kullanılmaktadır. Google Analytics ve çerezleri yalnızca analitik çerezlere, Meta Pixel ve çerezleri yalnızca
        pazarlama çerezlerine açık rıza vermeniz halinde yüklenir.
      </p>
      <p className={pClass}>
        Analitik çerezlere açık rıza vermeniz halinde; çerez verileriniz, IP adresiniz, tarayıcı ve cihaz bilgileriniz ile
        site üzerindeki etkileşimleriniz (görüntülediğiniz sayfa ve ürünler, sepete ekleme ve satın alma işlemleri gibi),
        sitenin kullanımının ölçülmesi ve geliştirilmesi amacıyla analitik hizmet sağlayıcımız Google Ireland Limited (Google
        Analytics) ile paylaşılır. Google&apos;ın sunucuları yurt dışında bulunduğundan bu paylaşım KVKK&apos;nın 9.
        maddesi kapsamında yurt dışına aktarım niteliğindedir ve yalnızca açık rızanıza dayanır. Rızanızı geri almanız
        halinde Google&apos;a yeni veri aktarılmaz ve Google Analytics çerezleri cihazınızdan silinir; daha önce aktarılmış
        veriler Google&apos;ın kendi gizlilik politikasına tabidir.
      </p>
      <p className={pClass}>
        Pazarlama çerezlerine açık rıza vermeniz halinde; çerez verileriniz, IP adresiniz ve tarayıcı bilgileriniz ile tek
        yönlü şifrelenmiş (hashlenmiş) olarak e-posta adresiniz, telefon numaranız, adınız-soyadınız, şehir ve posta
        kodunuz ve müşteri numaranız, reklam ölçümü ve hedefleme amacıyla reklam/ölçüm hizmet sağlayıcımız Meta Platforms
        Ireland Ltd. (Facebook/Instagram) ile paylaşılır. Meta&apos;nın sunucuları yurt dışında bulunduğundan bu paylaşım
        KVKK&apos;nın 9. maddesi kapsamında yurt dışına aktarım niteliğindedir ve yalnızca açık rızanıza dayanır. Rızanızı
        geri almanız halinde Meta&apos;ya yeni veri aktarılmaz; daha önce aktarılmış veriler Meta&apos;nın kendi gizlilik
        politikasına tabidir.
      </p>

      <h2 className={h2Class}>4. Kullanılan Çerezler</h2>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Çerez adı</th>
              <th scope="col" className={thClass}>Sağlayıcı</th>
              <th scope="col" className={thClass}>Amaç</th>
              <th scope="col" className={thClass}>Süre</th>
              <th scope="col" className={thClass}>Kategori</th>
            </tr>
          </thead>
          <tbody>
            {COOKIES.map((cookie) => (
              <tr key={cookie.name}>
                <td className={`${tdClass} whitespace-nowrap font-medium text-ink`}>{cookie.name}</td>
                <td className={tdClass}>{cookie.provider}</td>
                <td className={tdClass}>{cookie.purpose}</td>
                <td className={`${tdClass} whitespace-nowrap`}>{cookie.duration}</td>
                <td className={tdClass}>{cookie.category}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={pClass}>
        Güvenli bağlantı (HTTPS) üzerinden kullanılan oturum çerezlerinin adları tarayıcı güvenlik kuralları gereği
        &quot;__Secure-&quot; veya &quot;__Host-&quot; ön ekiyle başlayabilir.
      </p>

      <h2 className={h2Class}>5. Yerel Depolama</h2>
      <p className={pClass}>
        Aşağıdaki bilgiler çerez yerine tarayıcınızın yerel depolama (localStorage) alanında tutulur, sunucularımıza
        gönderilmez ve siz tarayıcı verilerinizi silene kadar cihazınızda kalır. Sitenin işleyişi için gerekli olduklarından
        zorunlu kategorisindedir.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse">
          <thead>
            <tr>
              <th scope="col" className={thClass}>Anahtar</th>
              <th scope="col" className={thClass}>Amaç</th>
            </tr>
          </thead>
          <tbody>
            {STORAGE.map((item) => (
              <tr key={item.name}>
                <td className={`${tdClass} whitespace-nowrap font-medium text-ink`}>{item.name}</td>
                <td className={tdClass}>{item.purpose}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={h2Class}>6. Üçüncü Taraf İçerikler</h2>
      <p className={pClass}>
        İletişim sayfamızdaki mağaza haritası Google Haritalar (Google LLC) tarafından sunulmaktadır. Haritayı
        görüntülediğinizde Google kendi çerezlerini kullanabilir; bu çerezler Google&apos;ın gizlilik politikasına tabidir.
        Ödeme işlemleri sırasında yönlendirildiğiniz iyzico ödeme sayfası da kendi alan adı üzerinde, iyzico&apos;nun
        politikalarına tabi çerezler kullanabilir.
      </p>

      <h2 className={h2Class}>7. Çerez Tercihlerinizi Yönetme</h2>
      <p className={pClass}>
        Siteyi ilk ziyaretinizde gösterilen çerez bildirimi üzerinden tüm çerezleri kabul edebilir, reddedebilir veya
        kategorilere göre seçim yapabilirsiniz. Bildirime yanıt vermeden siteyi kullanmaya devam etmeniz halinde yalnızca
        zorunlu çerezler kullanılır. Tercihiniz 12 ay boyunca saklanır; bu sürenin sonunda veya politikamızda esaslı bir
        değişiklik olduğunda tercihiniz yeniden sorulur.
      </p>
      <p className={pClass}>
        Verdiğiniz rızayı dilediğiniz zaman, her sayfanın altında yer alan &quot;Çerez Tercihleri&quot; bağlantısından
        veya aşağıdaki düğmeden geri alabilir ya da değiştirebilirsiniz. Rızanızı geri aldığınızda ilgili kategoriye ait
        çerezler cihazınızdan silinir.
      </p>
      <ConsentPreferencesButton className="mt-6 flex h-[44px] items-center justify-center rounded-[50px] border border-ink px-8 text-[10px] uppercase tracking-[1px] text-ink transition duration-300 hover:bg-ink hover:text-cream focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink">
        Çerez Tercihlerini Değiştir
      </ConsentPreferencesButton>
      <p className={pClass}>
        Ayrıca tarayıcınızın ayarlarından çerezleri silebilir veya engelleyebilirsiniz. Zorunlu çerezlerin engellenmesi
        halinde oturum açma ve alışveriş gibi bazı işlevler çalışmayabilir.
      </p>

      <h2 className={h2Class}>8. KVKK Kapsamındaki Haklarınız</h2>
      <p className={pClass}>
        KVKK&apos;nın 11. maddesi uyarınca; kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi
        talep etme, işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme, yurt içinde veya yurt dışında
        aktarıldığı üçüncü kişileri bilme, eksik veya yanlış işlenmişse düzeltilmesini isteme, silinmesini veya yok
        edilmesini isteme, bu işlemlerin aktarıldığı üçüncü kişilere bildirilmesini isteme, işlenen verilerin münhasıran
        otomatik sistemlerle analiz edilmesi suretiyle aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve kanuna aykırı
        işleme sebebiyle zarara uğramanız halinde zararın giderilmesini talep etme haklarına sahipsiniz.
      </p>

      <h2 className={h2Class}>9. İletişim</h2>
      <p className={pClass}>
        Haklarınızı kullanmak ve bu politikaya ilişkin sorularınız için taleplerinizi{" "}
        <a href="mailto:bilgi@bollmark.com" className="text-ink underline underline-offset-2">
          bilgi@bollmark.com
        </a>{" "}
        adresine veya Runguçpaşa Mah. 75. Sk. No:6/A Karacabey/Bursa adresine yazılı olarak iletebilirsiniz. Başvurularınız
        en geç otuz gün içinde ücretsiz olarak sonuçlandırılır.
      </p>

      <p className="mt-12 text-xs text-stone">Son güncelleme: {SON_GUNCELLEME}</p>
    </div>
  );
}
