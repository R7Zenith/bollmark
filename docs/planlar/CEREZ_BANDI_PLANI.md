# Çerez Bandı ve Rıza Yönetimi Planı (KVKK)

Durum: devam ediyor (2026-10-24): kod yayında; ConsentLog tablosu (db push) kullanıcı onayı bekliyor.

Amaç: Bollmark sitesine KVKK uyumlu bir çerez onay bandı ve rıza yönetimi altyapısı kurmak. Bileşenler sitenin mevcut tasarım diliyle (Release teması esinli font, renk, boşluklar) birebir uyumlu olacak. Yüklü tasarım skill'leri (özellikle frontend-design) kullanılacak.

## Adım 0 — Planı kaydet
Bu plan proje kök klasörüne `CEREZ_BANDI_PLANI.md` olarak kaydedilir, sonra uygulamaya geçilir.

## Adım 1 — Mevcut durumu incele (kod yazmadan önce)
- Sitede analitik, pixel, takip scripti ya da üçüncü taraf script (Google Analytics, gtag, Meta Pixel, Hotjar vb.) var mı? Varsa listelenecek.
- Sitenin kendi çerezleri listelenecek (NextAuth oturum çerezleri, sepet, bm_preview vb.). Bunlar "zorunlu" kategorisindedir.
- Çerez Politikası sayfası ve footer'daki yasal sayfa linkleri kontrol edilecek.
- Bulgular kısa liste halinde raporlanacak, ardından devam edilecek.

## Adım 2 — Rıza kategorileri
1. **Zorunlu çerezler:** her zaman açık, kapatılamaz (oturum, sepet, güvenlik, rıza tercihinin kendisi).
2. **Analitik çerezler:** varsayılan KAPALI (ileride Google Analytics 4).
3. **Pazarlama/Reklam çerezleri:** varsayılan KAPALI (ileride Meta Pixel ve Google Ads).

## Adım 3 — Çerez bandı
- Sayfanın altında, içeriği kapatmayan, mobilde düzgün görünen bir bant. "Çerez duvarı" olmayacak; kullanıcı bandı görmezden gelip gezinebilir (bu durumda zorunlu dışındaki her şey kapalı kalır).
- Üç buton: "Tümünü Kabul Et", "Tümünü Reddet", "Tercihleri Yönet". "Tümünü Reddet" ile "Tümünü Kabul Et" aynı boyut ve görünürlükte olacak.
- Kısa açıklama metni + "Çerez Politikası" linki.
- "Tercihleri Yönet" bir modal açar: her kategori için açıklama ve aç/kapat düğmesi. Zorunlu kategori kilitli açık; diğerleri varsayılan kapalı, önceden işaretli değil. Altta "Seçimlerimi Kaydet" ve "Tümünü Kabul Et".
- Bant `/admin` altındaki sayfalarda görünmeyecek.
- Mobilde ürün sayfasındaki sepete ekle alanını veya sabit alt barları kapatmayacak; layout shift oluşturmayacak.
- Klavye ile kullanılabilir ve erişilebilir (odak yönetimi, aria etiketleri).
- Hafif, abartısız bir giriş animasyonu olabilir.

## Adım 4 — Tercihin saklanması
- Tercih birinci taraf bir çerezde (`bm_consent`) saklanır: kategoriler, rıza versiyonu, tarih. Süre 12 ay. Süre dolunca veya rıza versiyonu değişince bant tekrar çıkar.
- Rıza kaydı (ispat): Her seçimde veritabanına küçük bir kayıt düşülür. Prisma'ya `ConsentLog` modeli eklenir: id, anonim ziyaretçi kimliği (rastgele üretilmiş, çerezde tutulan), seçilen kategoriler, rıza versiyonu, tarih, giriş yapmış müşteriyse userId (opsiyonel). Ham IP adresi saklanmaz. Kayıt tek bir hafif API çağrısıyla yapılır; sayfa yüklemelerinde ekstra istek ve CPU yükü olmaz.
- Migration hazırlanır; Neon prod ve local aynı veritabanını paylaştığı için uygulamadan önce kullanıcıya sorulur.

## Adım 5 — İleriye dönük rıza altyapısı (Pixel/GA hazırlığı)
- Merkezi rıza modülü/hook'u: `useConsent` ve `hasConsent('analytics' | 'marketing')`. Tercih değişince `bm-consent-change` window olayı yayınlanır.
- Google Consent Mode v2 varsayılanları: `ad_storage`, `analytics_storage`, `ad_user_data`, `ad_personalization` varsayılan `denied`; onay verilirse ilgili kategori değerleri `granted` olacak şekilde güncelleme fonksiyonu. gtag yüklü değilse yalnızca altyapı hazır kalır, script eklenmez.
- Meta Pixel için rıza kontrol noktası (pazarlama onayı yoksa pixel hiç yüklenmez). Pixel şimdi eklenmez.
- Rıza olmadan hiçbir zorunlu olmayan script yüklenmez.

## Adım 6 — Tercihleri sonradan değiştirme
- Footer'a "Çerez Tercihleri" linki; tıklayınca tercih modali açılır.
- Rıza geri çekilirse ilgili kategorinin bilinen çerezleri (`_ga`, `_fbp` vb.) temizlenmeye çalışılır.

## Adım 7 — Çerez Politikası sayfası
- Yoksa `/cerez-politikasi` oluşturulur, varsa güncellenir. İçerik: çerez nedir, kategoriler, Adım 1'deki çerezlerin envanter tablosu (ad, sağlayıcı, amaç, süre, kategori), tercihlerin nasıl değiştirileceği, KVKK kapsamındaki haklar, iletişim bilgileri.
- İşletme bilgileri mevcut yasal sayfalardan/ayarlardan alınır; bulunamayan bilgi kullanıcıya listelenir, uydurulmaz.
- Sayfa sonuna "bilgilendirme amaçlıdır" gibi ibare konmaz; metin düzgün ve resmi yazılır.
- Footer'daki yasal linkler arasına eklenir.

## Adım 8 — Performans ve kısıtlar
- Cookiebot, OneTrust gibi hazır CMP kütüphanesi kullanılmaz; kendi hafif bileşenimiz yazılır.
- Bant yalnızca istemci tarafında, küçük ve lazy çalışır; sunucuda ekstra hesaplama veya her istekte veritabanı sorgusu olmaz.
- Mevcut hiçbir sayfanın işleyişi bozulmaz.

## Adım 9 — Test ve onay süreci
- Değişiklikler localhost'ta çalıştırılır ve test adımları listelenir: ilk girişte bant, reddet/kabul/tercih kaydetme, yenilemede tekrar çıkmaması, footer linkinden modal, mobil görünüm, `/admin`'de görünmemesi, ConsentLog kaydı.
- Kullanıcı localhost'ta onaylayana kadar commit atılmaz.
- "Yerel commit at" denildiğinde: önce `DEPLOY_STATUS.md`'ye Türkçe not eklenir, sonra yerel commit atılır.
- Açıkça söylenmeden push edilmez.
