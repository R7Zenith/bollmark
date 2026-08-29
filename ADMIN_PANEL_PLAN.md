# Bollmark Admin Paneli - Yenileme Plani (taslak)

Bu dosya, mevcut admin panelini Shopify tarzi profesyonel bir panele donusturmek
icin Claude ile birlikte cikarilan plani icerir. Netlesince bu dosya Claude
Code'a okutulup adim adim uygulanacak. Henuz kod degisikligi yapilmadi.

Karar verilenler (kullanicidan alindi):
- Kapsam: tasarim sistemi + tum sayfalar bastan
- Yeni ozellikler: arama/filtreleme, toplu islem (checkbox), dashboard grafikleri
- Gorsel kimlik: notr "yonetim paneli" temasi (magaza markasindan ayri)
- Navigasyon: yeni bolumler de eklenecek (Musteriler, Ayarlar)
- Vurgu rengi: SaaS hissi veren indigo/mor tonu (marka altini degil)
- Ayarlar > magaza bilgileri (StoreSettings, schema degisikligi dahil) ilk fazda yapilacak
- Siparis listesinde odeme durumu + kargo durumu iki ayri renkli badge olarak gosterilecek
- Ust barda hizli arama ilk fazda geliyor

**Plan netlesti - bir sonraki adim Claude Code ile uygulamaya baslamak.**

**Durum (guncel):** Faz 1 - Temel, Faz 2 - Urunler & Kategoriler ve Faz 3 -
Siparisler & Kargolar & Musteriler tamamlandi (bkz. asagida 4. bolum ve
DEPLOY_STATUS.md). Sirada **Faz 4 - Dashboard** var.

## 1) Tasarim sistemi

**Renk paleti (yeni, panele ozel - magaza tarafina dokunulmuyor):**
- Arka plan: acik gri `#f6f6f7`
- Yuzey/kart: beyaz `#ffffff`
- Kenarlik: `#e3e3e5`
- Ana metin: `#1a1a1a`, ikincil metin: `#6b6b6f`
- Vurgu (accent): **karar: SaaS hissi veren indigo** - `#4f46e5`
  (Tailwind `indigo-600`). Butonlar, aktif nav ogesi, linkler, odak
  (focus ring) icin kullanilir. Magaza tarafindaki alti rengine dokunulmaz.
- Durum renkleri (badge'ler icin): sari=beklemede, mavi=hazirlaniyor/kargoda,
  yesil=tamamlandi/odendi, kirmizi=iptal/iade, gri=taslak

**Tipografi:** Panelde marka fontlari (Fraunces serif) yerine sade bir
sans-serif (mevcut `--font-sans`) tüm baslik ve govde metninde kullanilir -
Shopify gibi okunakli/islevsel gorunum icin serif basliklar kaldirilir.

**Ortak bilesenler (once bunlar kurulacak, sonra sayfalar bunlari kullanacak):**
- `Button` (primary / secondary / danger / ghost varyantlari)
- `Badge` (durum renkleri ile)
- `Card` (baslik + icerik + opsiyonel aksiyon alani)
- `DataTable` (checkbox kolonu, tiklanabilir siralama, bos durum mesaji)
- `SearchInput` + `FilterBar` (durum/tarih filtresi dropdown'lari)
- `Pagination`
- `BulkActionBar` (satir secilince tablonun ustunde beliren "3 secili: [Sil] [Durum degistir]" cubugu)
- `Toast` bildirimleri (kaydet/sil basarili-basarisiz)
- `EmptyState` (ikon + mesaj + "Ilk urunu ekle" gibi CTA)
- `StatCard` (dashboard sayilari icin, opsiyonel trend oku)
- `Sidebar` (ikonlu, gruplu) + `Topbar` (arama + kullanici menusu)

**Ikonlar:** `lucide-react` eklenmesi onerilir (hafif, Tailwind ile uyumlu,
Shopify Polaris'e yakin sade cizgi ikonlar).

## 2) Navigasyon (yeni sidebar)

```
Bollmark [panel adi]
────────────────────
📊 Panel (Dashboard)
🛍️ Urunler
🏷️ Kategoriler
📦 Siparisler
🚚 Kargolar
👥 Musteriler      <- YENI
⚙️ Ayarlar         <- YENI
────────────────────
[admin email]
[Cikis Yap]
```

Ust kisimda Shopify'daki gibi bir urun/siparis hizli arama kutusu olacak -
**ilk fazda geliyor** (Topbar bileseniyle birlikte kurulur).

## 3) Sayfa sayfa plan

### Dashboard (Panel)
- Mevcut 4 sayi karti kalir ama `StatCard` bileseniyle yeniden tasarlanir
  (ikon + sayi + kisa trend metni, ornegin "bu ay +12").
- **Yeni:** Son 30 gunluk siparis/ciro grafigi (basit cizgi/bar grafik -
  `recharts` kutuphanesi ile).
- **Yeni:** "Son Siparisler" mini listesi (son 5 siparis, durum badge'i ile,
  tikla-detaya-git).
- **Yeni:** "Stogu azalan urunler" mini listesi (opsiyonel, stok<5 gibi).

### Urunler (liste)
- Tabloya urun kucuk resmi eklenir.
- Durum artik renkli `Badge` (Taslak=gri, Yayinda=yesil, Arsiv=gri-kirik).
- Arama kutusu (isme gore) + durum filtresi + kategori filtresi.
- Checkbox ile coklu secim + toplu durum degistirme / silme.
- Siralama: isim, fiyat, stok, olusturulma tarihine gore tiklanabilir basliklar.
- Bos durum: "Henuz urun yok" + "Ilk urununu ekle" butonu (`EmptyState`).

### Urun detay/duzenle + Yeni urun
- Tek uzun form yerine bolumlere ayrilir: Temel Bilgiler / Fiyatlandirma /
  Varyantlar (beden-renk-stok) / Gorseller / Kategori-Durum.
- Degisiklik yapinca sayfa ustunde/altinda sabit bir "Kaydedilmemis
  degisiklikler var - [Kaydet] [Vazgec]" cubugu (Shopify'in "save bar"i).
- Kaydettikten sonra toast bildirimi.

### Kategoriler
- Mevcut basit liste + ekleme formu korunur ama `Card`/`Badge` ile
  gorsel olarak toparlanir; urun sayisi badge olarak gosterilir.
- Silme/duzenleme eklenir (su an sadece ekleme var).

### Siparisler (liste)
- Durum artik renkli badge.
- Arama (siparis no / musteri adi) + durum filtresi + tarih araligi filtresi.
- Checkbox ile coklu secim + toplu durum guncelleme.
- **Karar:** Tabloda odeme durumu (Order.status) ve kargo durumu
  (Shipment.status) ayri iki renkli badge olarak yan yana gosterilecek
  (su an tek "status" gorunuyor, kargo bilgisi ayri sayfadaydi - liste
  sorgusuna `include: { shipment: true }` eklenmesi yeterli, schema
  degisikligi gerekmez).

### Siparis detay
- Musteri bilgisi, urun kalemleri, kargo durumu tek sayfada bolumlere
  ayrilir (Shopify'in siparis detay sayfasi gibi: ust ozet + zaman
  cizelgesi/timeline + yan panelde musteri/adres karti).
- Durum degistirme aksiyonlari buton olarak (dropdown yerine "Odendi
  Olarak Isaretle", "Kargola" gibi acik butonlar - daha az tiklama).

### Kargolar
- Mevcut form-liste yapisi `DataTable` + inline duzenleme olarak
  toparlanir; durum renkli badge olur.
- Arama/filtre (siparis no, durum).

### Musteriler (YENI - simdi veritabaninda ayri Customer tablosu yok)
- **V1 (schema degisikligi gerektirmez):** Orders tablosundan
  `customerEmail`'e gore gruplanip turetilen bir liste: isim, email,
  toplam siparis sayisi, toplam harcama, son siparis tarihi. Tikla ->
  o musterinin tum siparisleri.
- **V2 (ileride, istersen):** Gercek bir `Customer` modeli eklenir (adres
  defteri, kayitli musteri girisi vb.) - bu ayri bir sema degisikligi,
  simdilik plana "ileride" olarak not dusuyorum.

### Ayarlar (YENI)
- **Karar: ilk fazda yapiliyor** (schema degisikligi dahil, sonraya
  birakilmiyor).
- Admin hesap bilgileri: isim, email goruntuleme + sifre degistirme formu
  (su an sifre sadece seed ile degisiyor, panelden degistirme yok - bu
  eklenecek, `bcrypt` ile hash guncellenecek).
- Genel magaza bilgileri icin yeni bir `StoreSettings` tablosu eklenir
  (tek satirlik "singleton" kayit): magaza adi, iletisim email/telefon,
  varsayilan kargo ucreti gibi alanlar - su an bunlar kod icinde sabit
  degerler, panelden duzenlenebilir hale gelir. Bu bir Prisma migration
  gerektirir (`npm run db:push`).
- PREVIEW_PASSWORD panelden goruntulenip degistirilemez (Vercel env
  degiskeni oldugu icin) - "Ayarlar" sayfasinda bir bilgi notu olarak
  belirtilir, degistirmek icin hala Vercel dashboard gerekiyor.

## 4) Uygulama fazlari (Claude Code ile yapilacak sira)

1. **Faz 1 - Temel (tamamlandi):** Tasarim sistemi bilesenleri (`Button`, `Badge`, `Card`,
   `DataTable`, `Sidebar`, `Topbar` + calisan hizli arama, `Toast`,
   `EmptyState`) + yeni indigo renk paleti + `lucide-react` kurulumu.
   Sidebar'a Musteriler/Ayarlar linkleri eklenir. `StoreSettings` modeli
   semaya eklenir ve migration (`db:push`) calistirilir. Ayarlar sayfasi
   (hesap bilgisi + magaza bilgileri formu) bu fazda tam olarak yapilir.
2. **Faz 2 - Urunler & Kategoriler (tamamlandi):** Liste + detay sayfalari yeni bilesenlerle
   yeniden yazilir, arama/filtre/toplu islem eklenir.
3. **Faz 3 - Siparisler & Kargolar & Musteriler (tamamlandi):** Liste + detay
   sayfalari yenilendi (siparis listesinde odeme+kargo icin iki ayri badge),
   Musteriler (V1, turetilen) sayfasi eklendi.
4. **Faz 4 - Dashboard:** Grafikler + "son siparisler" / "stogu azalan
   urunler" mini listeleri eklenir.

Her faz kendi icinde test edilip commit'lenir (once yerelde `npm run dev`
ile kontrol, sonra push -> Vercel otomatik deploy).

## 5) Netlesmesi gereken acik noktalar

Hepsi netlesti - acik nokta kalmadi. Plan uygulamaya hazir.
