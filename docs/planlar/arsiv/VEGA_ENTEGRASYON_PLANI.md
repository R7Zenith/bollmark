# Vega "E-Ticaret" Entegrasyonu - Plan ve Notlar

Bu dosya, Vega programındaki "E-Ticaret" butonu ile Bollmark sitesini
baglamak icin yapilan konusmayi ve karari ozetler. Amac: Vega'yi arayip
bir sey istemeden, kendi basimiza cozmek.

## Durum

- Bollmark, Ticimax/Ikas gibi hazir bir altyapi degil; sifirdan yazilan bir
  Next.js + Prisma + PostgreSQL (Neon) projesi.
- Magazamizda kullanilan Vega programinda, Ticimax/Ikas/Pazarama gibi isimli
  butonlarin yaninda ayri bir "E-Ticaret" butonu var. Bu, isimli listede
  olmayan/ozel siteler icin Vega'nin genel API baglantisi.
- Bu buton su an Bollmark'a bagli degil; cunku Bollmark'ta bu API'yi
  karsilayacak bir uc nokta (endpoint) henuz yok.

## "E-Ticaret" Ayar Ekranindaki Alanlar (ekran goruntusunden)

Sol panel - API Ayarlari:
- E-Mail, Parola -> muhtemelen Vega'nin siteye baglanirken kullanacagi
  kimlik bilgileri (bizim tarafta olusturacagimiz bir "entegrasyon
  kullanicisi" olabilir)
- Site Adi -> muhtemelen sitenin adresi/API kok adresi
- Musteri Onek / Siparis Onek (varsayilan "ET-") -> Vega'nin bu
  entegrasyondan gelen musteri/siparis kayitlarini ayirt etmek icin
  kullandigi on ek
- Versiyon -> API surum bilgisi (bizim taraftan donmesi gereken bir deger
  olabilir)
- Stok Guncelleme -> stok senkron ayari (araligi/tetikleyicisi belirsiz)
- "E-Ticaret Sitesinde Varyasyonlari Ayri Birer Urun Olarak Ac" checkbox
- "Marka Bilgilerini Guncelle" ve "Vega Depolar" butonlari
- Site Depo Adi / Magaza Depo Adi eslestirme tablosu -> Vega, sitemizden
  depo listesini cekip kendi depolariyla eslestirecek; yani bizim bir
  "depo listesi" endpoint'i sunmamiz gerekiyor

Sag panel:
- Fiyat Ayarlari: E-Ticaret Fiyati (dropdown), Kargo Fiyati Ekle, Komisyon
  Ekle, Yuvarlama Orani, Indirim Uygula / Oran Kaynagi
- Alt Limit / Ust Limit / Tutarsal / Oransal tablosu (fiyat kurallari)
- Entegrasyon Ayarlari: Musteri Onek, Siparis Onek (sol panelle ayni
  gorunuyor, muhtemelen ikinci bir kopyasi), Odemenin Alinacagi Banka Adi
- "E-Ticaret Sitesine Varyasyonlari Ayri Birer Urun Olarak Ac" checkbox
  (sag altta, sol panelle ayni sey tekrar)

Sonuc: Bu alanlar, Bollmark tarafinda su islevleri yapan bir API'yi
gerektiriyor gibi gorunuyor: kimlik dogrulama, depo listesi verme, urun/
stok/fiyat bilgisi alisverisi, siparis alma/gonderme, marka bilgisi
guncelleme. Ama tam protokol (XML mi JSON mu, hangi adresler, hangi
authentication yontemi) ekran goruntusunden belli degil.

## Karar

Vega'yi arayip API dokumanini istemek yerine, kendimiz "canli yakalama"
yontemiyle protokolu cozecegiz:

1. webhook.site (veya benzeri ucretsiz "istegi yakala" servisi) uzerinden
   gecici bir test adresi alinacak.
2. Vega'nin "E-Ticaret" ekranindaki "Site Adi" (ve gerekirse diger)
   alanina bu test adresi yazilip "Kaydet" / senkronize etme gibi
   islemler denenecek.
3. webhook.site ekraninda gelen istegin tam icerigi (adres, format,
   headerlar, body) incelenecek.
4. Gercek istek formati netlesince, Bollmark projesine bu formati
   karsilayacak gercek API endpoint'leri yazilacak (kimlik dogrulama,
   depo listesi, urun/stok/fiyat, siparis).
5. Vega ayarlarina gercek Bollmark adresi ve entegrasyon kullanicisi
   bilgileri girilip baglanti kurulacak.

## Sonraki Adim

- Kullanicidan webhook.site (ya da benzeri) uzerinden bir test adresi
  alip Vega'da denemesi istenecek; sonuc birlikte incelenip devam
  edilecek.
- Bu is ADMIN_PANEL_ARASTIRMA_VE_ONERILER.md'deki "Pazaryeri
  entegrasyonlari" maddesiyle iliskili, oraya da referans eklenebilir.
