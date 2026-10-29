# Bollmark - Güncel Durum

Son güncelleme: 2026-10-29

Bu dosya projenin **şu anki** durumunu kısa tutar. Yeni bir oturumda kaldığın
yerden devam etmek için önce bunu, sonra gerekirse ilgili günlük dosyasını oku.

- Oturum günlükleri (ne yapıldı, neden, nasıl doğrulandı): `docs/gunluk/`
- Planlar (açık olanlar ve arşiv): `docs/planlar/README.md`

## Altyapı

- **Canlı site:** Vercel, proje `bollmark`; domain `bollmark.com`, DNS Cloudflare'de.
  `main`'e push otomatik deploy tetikler. Yalnız `.md` değişen commit'ler deploy
  ETMEZ (`vercel.json` `ignoreCommand`).
- **Repo:** https://github.com/R7Zenith/bollmark.git (`main`)
- **Veritabanı:** Neon Postgres, Prisma 7. Yerel geliştirme ve canlı site **AYNI**
  veritabanını kullanır; yerelde yazan her test canlı veriye yazar.
- **Görseller:** hepsi Cloudflare R2'de (`img.bollmark.com`). Eski Vercel Blob
  görselleri 2026-10-12'de taşındı; Blob deposu henüz silinmedi (aşağıda).
- **Önizleme kapısı:** kapalı (2026-10-13), site herkese açık; tekrar açmak için
  `PREVIEW_GATE` env'ini sil/`on` yap + redeploy (`src/proxy.ts`).
- **Ödeme:** iyzico sanal POS canlıda (kullanıcı teyidi, 2026-10-09).
- **Vega:** Ticimax taklidi SOAP servisi (`src/app/Servis`) çalışıyor (2026-09-11). Vega'daki Site Adı `vega.bollmark.com` (2026-10-25); Cloudflare Worker `vega-bridge-worker` hem bu adı hem `www.` ekli halini hem eski workers.dev adresini taşıyor.
- **Cron (Vercel, günde 1):** sepet hatırlatma, ödeme mutabakatı, Instagram kareleri (`/api/cron/instagram`).
- **Yeni bilgisayarda kurulum:** `KURULUM-NOTLARI.md` ve `.env.example`.

## Açık işler

| İş | Durum | Plan |
|---|---|---|
| Blob'dan R2'ye görsel taşıma | Taşıma (2026-10-12) ve Faz 3 kod temizliği (2026-10-13) bitti; kod artık Blob'a hiç yazmıyor/okumuyor. Kalan Faz 4: Blob deposunu kapatma, kullanıcı, 1–2 gün Blob grafiği izlendikten sonra. | `docs/planlar/BLOB_TAMAMEN_KALDIRMA_PLANI.md` |
| Meta Pixel + Conversions API | Push edildi (2026-10-24). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_META_PIXEL_ID` ve `META_CAPI_ACCESS_TOKEN` (sensitive) CLI ile eklendi; `META_TEST_EVENT_CODE` Vercel'de YOK (yalnız yerel `.env`). Ayrı redeploy yapılmadı, bu push'un yayını değişkenleri alır. `CONSENT_VERSION` 2 (herkese bant yeniden çıkar). `Order.metaCapiContext` / `metaPurchaseSentAt` db push ile eklendi. Gizlilik Politikası Meta maddeleri DB'ye hedefli yazıldı. Kalan: canlıda Olay Yöneticisi'nde AddToCart/InitiateCheckout/Purchase sunucu olaylarının ve tekilleştirmenin doğrulanması. | `docs/planlar/META_PIXEL_CAPI_PLANI.md` |
| Google Analytics 4 (GA4) + KDV oranları | Push edildi (2026-10-25). Vercel'e yalnız **Production** ortamına `NEXT_PUBLIC_GA4_MEASUREMENT_ID` CLI ile eklendi (ayrı redeploy yok, bu push'un yayını alır); `NEXT_PUBLIC_GA4_DEBUG` yalnız yerel `.env`. `CONSENT_VERSION` 3 (herkese bant yeniden çıkar). `Category.vatRate` / `Product.vatRate` db push ile eklendi; kategori oranları girildi (Parfüm, Takı & Bijuteri, Saç Aksesuarları %20; diğer 40 kategori %10). Vega `SelectUrun` artık bu oranı gönderiyor. Gizlilik Politikası (`gizlilik-politikasi`) GA4/Google maddeleri push ile birlikte DB'ye yalnız bu kayıt hedeflenerek yazıldı. Kalan: canlıda Realtime/DebugView'da olayları ve `purchase`'ı doğrulamak. | `GA4_KURULUM_PLANI.md` |
| Ön Bilgilendirme Formu + ödeme onay kutusu + kargo bilgisi | Push edildi (2026-10-25, GA4 ile birlikte). `/on-bilgilendirme-formu` (statik, kod tarafında), ödemede iki belge pencerede açılıyor (Ön Bilgilendirme siparişe özel). Ürün sayfası ve sepette kargo ücreti (panel > Ayarlar, şu an 350 TL), 1.500 TL eşiği ve 1-3 iş günü notu. DB değişikliği yok. Kalan: canlıda kutu işaretlenince "Ödemeye Geç"in açıldığının denenmesi (yerelde ödeme kapalı). Satıcı telefonu (Telefon / WhatsApp) ve MERSİS 2026-10-26'da eklendi (aşağıdaki satır). | — |
| İletişim telefonu + Instagram DM | Push edildi (2026-10-26). Bulutfon numarası (+90 224 323 01 21) 26 Ekim'de alındı; yalnız WhatsApp Business için kullanılacak, aramalar açılmayacak: sitede `tel:` linki yok, JSON-LD'de `telephone` yok, yasal metinlerde "Telefon / WhatsApp" düz metin. WhatsApp Business 27 Ekim'de açıldı ve `whatsappActive` = true yapıldı (2026-10-27, `docs/planlar/WHATSAPP_BUSINESS_VE_SITE_BUTONU_PLANI.md`). Değişenler: footer, iletişim sayfası ve anasayfa kartında WhatsApp linki; yüzen "Bize yaz" butonunda WhatsApp + Instagram menüsü (marka renkli ikonlar); ürün sayfasında Beden Tablosu'nun altında "Sorunuz mu var? WhatsApp · Instagram" satırı (WhatsApp hazır mesajla `wa.me?text=` açılıyor); "Hemen Al" butonu kaldırıldı; çalışma saati 19:30. MERSİS ve VKN girildi; unvan ve vergi dairesi mevcut sözleşme metninden (kullanıcı onayı); KEP boş. Mesafeli Satış Sözleşmesi ve Gizlilik Politikası DB kayıtlarına MERSİS + Telefon/WhatsApp hedefli yazıldı (`scripts/yasal-satici-iletisim-guncelle.ts`). Instagram DM: yüzen buton, ürün sayfasında "Instagram'dan sor", footer/iletişim linki; Meta `Contact` / GA4 `contact` rızaya bağlı. Kalan: KEP adresi; açılmayan numaranın yasal yeterliliğinin muhasebeci/avukatla teyidi; canlıda olayların doğrulanması. 27 Ekim 2026: Instagram kullanıcı adı koton.karacabey → bollmarkcom; sitedeki Instagram DM butonları, footer bağlantısı ve diğer referanslar güncellendi; canlıda (push d976a0a). | `docs/planlar/ILETISIM_TELEFON_VE_INSTAGRAM_DM_PLANI.md` |
| Meta katalog bağlantısı | Uygulandı (2026-10-26, `main` 63f284b). `/feed/meta.xml` (availability boşluklu, görseller R2 `.jpg` kopyaları, başlıkta renk/beden "Baş Harf Büyük"); `getItemGroupId` feed'ler, JSON-LD ve AddToWishlist'te ortak; yeni yüklemelerde R2'ye `.jpg` kopyası otomatik. R2 toplu JPEG işi bitti (2188 dosya, hata 0). Canlı `meta-feed-kontrol`: 1661 item, 2179 görsel `image/jpeg`, sorun yok. `/feed/google.xml` değişmedi. `meta-externalagent` UA canlıda 403 (Vercel Firewall AI Bots = Deny), `facebookexternalhit` 200. Commerce Manager (2026-10-26): mevcut katalog "Tüm Ürünler" kullanıldı; eski XMLExport akışı silindi, yeni planlı akış "Bollmark Site Feed (meta.xml)" 3 saatte bir; yükleme 1,7 B ürün, sorun 0 (Firewall engellemedi). Pixel (`bollmark.com` veri seti, 1458383412848656) kataloğa bağlandı; eski "eski salaklık" veri seti ve piksel kaynağı ayrıldı. Kalan: 29–30 Ekim'de eşleşme oranı kontrolü (hedef ≥%90), 2026 ürün setleri, Instagram ürün etiketleme uygunluğu (bkz. plan, "Commerce Manager kontrolü (2026-10-27)"). | `docs/planlar/META_KATALOG_PLANI.md` |
| Vega sipariş aktarımı | Canlıda (2026-10-26). Vega Site Adı `vega.bollmark.com` (sipariş isteği `www.` ekli geliyor; Worker'a iki özel alan adı bağlı). Ödenmiş siparişler (2026-10-26 00:00 sonrası) Vega'ya düşüyor, Vega stoğu ayırıp kullanılabilir stoğu geri gönderiyor (doğrulandı), sitede stok koruması aktif; fatura tutarı/KDV, firma adı, Site Adresi `bollmark.com` doğru. Arctos fatura serisi KOTON şubesi ETicaretSeri = `BLM` (kullanıcı). Acil kapatma `VEGA_SIPARIS_AKTARIM=off`. Kalan: Vega "Sipariş No" sütunu boş (veriyle dolmuyor, Vega/Arctos desteğine sorulacak); Vega'da iptal siteye bildirilmiyor (elle); ilk gerçek siparişte BLM fatura serisinin entegratörde kabulü | `docs/planlar/VEGA_SIPARIS_AKTARIM_PLANI.md` |
| Kalp Topla kampanyası | Plan kesinleşti, uygulamaya hazır (2026-10-29): T1–T17 ve Y1–Y15 kararlarının tamamı işlendi, açık nokta kalmadı; kod yazılmadı. Kalan: uygulamaya başlama onayı; uygulama 12 fazda (0–11), ilk faz test Neon branch'i, yayın gizli yayın modunda Vega kontrolüyle. | `KALP_TOPLA_PLANI.md` |
| Parfüm → Aksesuar alt kategorisi | Uygulandı (2026-10-28). DB'de parentId Aksesuar (ortak DB, canlıda da geçerli); Çok Satanlar'a Aksesuar sekmesi, diğer sekmeler yalnız giyim. Adresler değişmedi. Kalan: Aksesuar kutusu şu an parfüm görseli gösteriyor; istenirse admin'den Aksesuar kategorisine görsel. | `docs/gunluk/2026-10.md` |

## Bu dosya nasıl güncellenir

- Oturum notu **buraya değil**, o ayın günlük dosyasının sonuna eklenir
  (`docs/gunluk/2026-10.md`; yeni ayda yeni dosya).
- Bu dosyaya yalnız güncel durum değiştiğinde dokunulur: bir açık iş bittiğinde
  satırı silinir, yeni bir açık iş çıktığında eklenir.
- Biten planın dosyası `docs/planlar/arsiv/` altına taşınır.
- Şifre, API anahtarı, token gibi değerler hiçbir dosyaya yazılmaz.
