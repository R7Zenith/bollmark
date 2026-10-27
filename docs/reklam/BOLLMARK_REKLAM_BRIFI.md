# Bollmark — Reklam Brifi

Son güncelleme: 27 Ekim 2026. Bu dosya reklam projesinin kalıcı bilgi kaynağıdır.
Bir bilgi değişince bu dosya güncellenir ve projeye yeniden yüklenir.

## Marka

- **Bollmark** (bollmark.com): Karacabey'deki mağazanın e-ticaret sitesi.
- Mağaza 2016'dan beri **Koton Corner**. Müşteriler mağazayı "Koton Karacabey" diye
  biliyor. Mağaza kampanyalarında bu ad alt şeritte kullanılır.
- Instagram: **@bollmarkcom**. Görünen adı "Bollmark | Koton Karacabey" (eski adı
  koton.karacabey, 27 Ekim 2026'da değişti).
- İletişim: WhatsApp Business +90 224 323 01 21. Bu numaradan arama yapılmaz,
  yalnızca WhatsApp kullanılır. Instagram DM de açık.
- İzinler: Koton ve Slazenger ürünleri satılabilir, ürün görselleri kullanılabilir
  (Koton bölge sorumlusu onayladı). Bu izin markanın logosunu reklamın ana öğesi
  yapmayı ya da "resmî Koton mağazası" iddiasını kapsamaz.
- WE Company ürünleri sitede **Bollmark** markasıyla satılır.

## Ürünler (Ekim 2026)

- Yaklaşık 273 ürün ve 1.661 varyant (renk + beden).
  - Kadın ağırlıklı: yaklaşık 970 kadın, 680 erkek varyantı.
  - Çocuk ürünü az (yaklaşık 35 varyant).
- Markalar (varyant sayısına göre): KOTON, Twister, Slazenger, Sateen, Quzu, Dilvin, Bollmark.
- Fiyatlar ...90 ile biter (490, 990, 1.290 TL gibi). Fiyatlara KDV dahildir.
- Yaklaşık 166 varyantta indirimli fiyat var.

## Satış koşulları (reklamda doğru yazılmalı)

- **1.500 TL ve üzeri siparişte ücretsiz kargo.** Altında kargo ücreti 350 TL.
- Kargo süresi 1–3 iş günü. Anlaşmalı kargo firmasıyla gönderilir (kargo
  entegrasyonu henüz yok).
- Ödeme iyzico üzerinden, kredi/banka kartıyla yapılır.
- Siteden alınan ürün **yalnızca Karacabey mağazasında** değiştirilebilir.
- **Kasım 2026 "2. üründe net %60" kampanyası şu an YALNIZ MAĞAZADA geçerli.**
  Sitede sepet indirimi yok. Site reklamında bu kampanya vaat edilmez. Kullanıcı
  sitede açıldığını söylerse kullanılabilir.

## Meta altyapısı (hazır)

- Meta Pixel + Conversions API: Pixel ID 1458383412848656 (veri seti "bollmark.com").
- Olaylar: ViewContent, AddToCart, InitiateCheckout, AddPaymentInfo, Purchase,
  AddToWishlist, Search, Contact.
- GA4: G-YGXJVLGKJG.
- Katalog: Commerce Manager'da **"Tüm Ürünler"**. Feed
  https://bollmark.com/feed/meta.xml, 3 saatte bir güncellenir.
  - Kimlikler: `g:id` = varyant SKU, `item_group_id` = ürün kodu.
  - Stoksuz varyantlar "Uygun değil (Stokta yok)" olarak görünür, reklamda çıkmaz.
- Katalog eşleşme oranı: 27 Ekim'de %0 görünüyordu, çünkü hesaplama katalog
  bağlanmadan önceki döneme aitti. 29–30 Ekim'de kontrol edilecek, hedef ≥%90.
  Katalog reklamından önce bu oran doğrulanmalı.
- Ürün setleri: 2023'ten kalan eski setler var, çoğu 0 ürün gösteriyor (kullanma).
  Yeni setler "2026 -" önekiyle kurulacak:
  - 2026 - Kadın: gender female + age_group adult
  - 2026 - Erkek: gender male + age_group adult
  - 2026 - Çocuk: age_group kids
  - 2026 - Stokta: availability in stock
- Çerez rızası KVKK uyumlu. Pazarlama çerezini reddeden ziyaretçi için Pixel
  çalışmaz, bu yüzden ölçülen dönüşümler gerçek sayıdan düşük çıkabilir.

## Üretim araçları

- **ChatGPT:** reklam görselleri (görsel prompt'ları bu projede hazırlanır).
- **ComfyUI** (kullanıcının bilgisayarında, yerel): modelli fotoğrafı olmayan
  ürünler için manken/ürün görseli.
- **Remotion:** kodla video (Reels/hikâye). Kodlamayı **Claude Code** yapar. Bu
  proje yalnız Claude Code'a verilecek tam prompt'u hazırlar.
- Hazır görseller: `docs/instagram-duyuru/` (mağaza kampanyası şablonu,
  Kasım gönderisi ve hikâyesi).

## Reklam önceliği ve yol haritası

1. Advantage+ katalog reklamı (dinamik yeniden hedefleme + geniş kitle).
2. Marka/tanıtım: "Koton Karacabey artık online: Bollmark" mesajı.
3. Kampanya dönemleri: Kasım indirimleri, Efsane Cuma / Black Friday, yılbaşı.

## Kampanya kaydı

Yayına giren her reklam bu tabloya eklenir. Kullanıcı sonuçları yazdıkça güncellenir.

| Tarih | Kampanya | Amaç | Kitle | Bütçe | Kreatif | Sonuç / not |
|---|---|---|---|---|---|---|
| — | — | — | — | — | — | — |
