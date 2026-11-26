# İade Talebi Sistemi — Tamamlama Planı

Tarih: 2026-11-26 · Durum: uygulandı (2026-11-26), push edildi. DB (customerReply, customerReplyAt) ve İade Koşulları cümlesi canlıda; localhost'ta kullanıcı onaylı. Kalan: deploy sonrası canlıda ilk gerçek talebin izlenmesi. İsteğe bağlı "kargo takip no gir" alanı yapılmadı.

## 1. Mevcut durum (kodda incelendi)

Sistemin iskeleti zaten var:

| Parça | Dosya | Durum |
|---|---|---|
| Müşteri formu | `src/components/hesap-order-card.tsx` (Hesabım → Siparişlerim) | Var. Yalnız teslim edilmiş siparişte "İade/Değişim Talebi Oluştur" açılıyor; tür, ürün, sebep, not seçiliyor. |
| API | `src/app/(site)/api/iade-talebi/route.ts` | Var. Sipariş no + e-posta ile doğruluyor, aynı ürüne ikinci açık talebi engelliyor, `ReturnRequest` oluşturuyor. **Mail atmıyor.** |
| DB | `ReturnRequest` (type, reason, itemsJson, status, customerNote, adminNote, değişim alanları) | Var. Müşteriye görünen yanıt alanı yok. |
| Admin | `src/app/(admin)/admin/iadeler/page.tsx` + `returns-table.tsx` | Var. Durum + `adminNote` güncelleniyor, değişim farkı hesaplanıyor. |
| Durum mailleri | `returnStatusEmail` (`src/lib/email/order-emails.ts`), `notifyReturnStatusChange` | Var. Yalnız ONAYLANDI / REDDEDILDI / TAMAMLANDI. |
| Mağaza bilgisi | `src/lib/store-info.ts` → `returnCarrier: "Yurtiçi Kargo"` | Var. **Anlaşma kodu ve iade adresi yok.** ONAYLANDI mailinde "sana iletilen iade kodu" deniyor ama kod hiçbir yerde iletilmiyor. |

## 2. Eksikler

1. Talep oluşunca **müşteriye "Talebin alındı" maili** ve **bize (admin) "Yeni iade talebi" maili** gitmiyor.
2. Admin'in **müşteriye yanıtı** yok: `adminNote` iç not olarak kullanılıyor, müşteri hesabında ve mailde görünmüyor.
3. **Yurtiçi anlaşma kodu ve iade adresi** hiçbir ekranda/mailde yazmıyor.
4. Müşteri ekranlarında **ne yapacağını adım adım anlatan rehber** yok; hesapta talepler tek satır metin.
5. KARGODA durumunda müşteriye mail yok (opsiyonel, önerilir).

## 3. Sabit bilgiler

`src/lib/store-info.ts` içine (tek kaynak, başka dosyaya elle yazılmaz):

```ts
returnCarrierCode: "1287643200",            // Yurtiçi Kargo anlaşma (iade) kodu
returnAddress: "Runguçpaşa Mh. 75.Sk No:6/A Karacabey Bursa", // iade adresi, birebir bu yazımla
returnRecipient: "Bollmark (Oğuzhan Leventoğlu)"
```

Mevcut `address` (SEO/yasal metinler) değişmez; iade ekranları ve mailleri `returnAddress`'i birebir kullanır.

**Kodun görünürlüğü (öneri):** Anlaşma kodu herkese açık sayfalarda değil, **talep onaylandıktan sonra** müşterinin hesabında ve onay mailinde gösterilir (kod açıkta olursa herkes bize ücretsiz gönderi yapabilir). Form ekranında genel adımlar yazar, "kod talebin onaylanınca burada görünecek" denir.

## 4. Yapılacaklar

### 4.1 DB (yalnız ekleme)
`ReturnRequest`'e:
- `customerReply String?` — müşteriye görünen yanıt (admin yazar).
- `customerReplyAt DateTime?`
`adminNote` iç not olarak kalır (müşteri görmez). Canlı DB'ye uygulama kullanıcı onayıyla, `migrate diff` kontrolüyle (HepsiJET Faz 2'deki gibi).

### 4.2 Müşteri tarafı
- Hesap menüsüne **"İade Taleplerim"** (`/hesap/iade-taleplerim`): tüm talepler kart halinde — tür, ürünler (görselli), sebep, müşteri notu, durum adım çubuğu (Talep edildi → Onaylandı → Kargoda → Tamamlandı), **Bollmark yanıtı** kutusu, tarih.
- Durum **ONAYLANDI / KARGODA** ise kartta belirgin **"Ürünü nasıl gönderirim?"** kutusu:
  1. Ürünü kullanılmamış, etiketleri sökülmemiş, orijinal ambalajında, faturasıyla paketle.
  2. Paketin üstüne veya içine sipariş numaranı (BLM…) yaz.
  3. Paketi en yakın **Yurtiçi Kargo** şubesine götür.
  4. Görevliye **anlaşmalı iade kodu: 1287643200** olduğunu söyle (kopyala butonu). Gönderim ücretsizdir.
  5. Alıcı adresi: **Runguçpaşa Mh. 75.Sk No:6/A Karacabey Bursa** (kopyala butonu), alıcı Bollmark.
  6. Kargo fişindeki takip numarasını sakla. (İsteğe bağlı: kartta "Kargo takip no gir" alanı → admin'de görünür.)
  - Uyarı: Yurtiçi dışındaki firmalarla gönderimde kargo ücreti alıcıya aittir. Karacabey mağazamıza elden de getirebilirsin (çalışma saatleri `openingHoursLines()`).
  - Para iadesi: ürün ulaşıp kontrol edildikten sonra en geç 14 gün içinde ödeme yöntemine; değişimde yeni ürün kargolanır.
- Talep formunda (hesap-order-card) üstte kısa **"Nasıl işler?"** bilgisi: 14 gün süre, koşullar, "talebin onaylanınca iade kodu ve adres hesabında ve e-postanda görünecek". Başarı mesajı "Talebin alındı" + "İade Taleplerim"e link.
- Siparişlerim kartındaki talep satırları "İade Taleplerim"e bağlanır.
- Misafir (`/siparis-durumu` sipariş no + e-posta) akışı aynı API'yi kullandığı için o ekranda da onaylı talebe aynı rehber kutusu gösterilir.

### 4.3 Admin tarafı
- İadeler tablosunda talep satırı açılınca: müşteri notu, ürünler, **"Müşteriye yanıt"** metin alanı (+ "Yanıtı gönder" — maili tetikler), ayrı **"İç not"** alanı (mevcut adminNote).
- Hazır yanıt şablonları (seç → alana dolsun, düzenlenebilir): "Onaylandı, kodla gönderebilirsiniz", "Fotoğraf rica ediyoruz", "Ürün elimize ulaştı", "Reddedildi – sebep".
- Admin menüsünde İadeler'in yanında **açık talep sayısı rozeti** (TALEP_EDILDI sayısı).
- Durum değişikliği ve yanıt aynı formda kaydedilirse tek mail gider (yanıt durum mailinin içinde).

### 4.4 Mailler (renderEmail blokları, MAIL_TASARIMLARI_PLANI.md düzeni, `log.kind` ile Giden Mailler'e düşer)
| # | Mail | Alıcı | Tetik |
|---|---|---|---|
| 16 | Talebin alındı | Müşteri | `/api/iade-talebi` başarılı |
| 17 | Yeni iade/değişim talebi | Admin (`notifyAdminNewOrder`'ın kullandığı adres) | `/api/iade-talebi` başarılı |
| 18 | Talebine yanıt var | Müşteri | Admin yanıt kaydeder (durum değişmeden) |
| 05 (güncelle) | Durum mailleri | Müşteri | ONAYLANDI maili: rehber adımları + anlaşma kodu + iade adresi infoBox'ları; tüm durum maillerinde varsa "Bollmark yanıtı" kutusu. KARGODA notifiable listesine eklenir ("Kargon yolda, ulaşınca haber vereceğiz"). |

- `returnNextStep` metnindeki "sana iletilen iade kodunu kullanarak" ifadesi gerçek kodla değiştirilir.
- Her yeni mail için `docs/mail-tasarimlari/16-...html`, `17-...html`, `18-...html` önizleme dosyaları (mevcutlar gibi) üretilir; 05 önizlemesi güncellenir.
- Mail gönderimi talep oluşturmayı/kaydı bloklamaz (`.catch` + log, mevcut desen).

### 4.5 Yasal metin
"İade Koşulları" sayfası DB'de. Anlaşma kodunun yasal sayfada **yazılmaması** önerilir (bkz. 3); sayfaya "İade kodu ve adres talebin onaylanınca hesabında ve e-postanda iletilir" cümlesi eklenir (`scripts/iade-kargo-metni-guncelle.ts` deseniyle, önce kuru çalıştırma).

## 5. Test
- Birim: yeni mail render'ları (kod ve adres birebir geçiyor mu, yanıt kutusu, KARGODA), API'nin mail tetiklemesi (mock sendMail).
- Localhost'ta: TEST siparişi teslim edildi → hesap formundan talep → 16 + 17 mailleri Giden Mailler'de → admin yanıt → 18 → ONAYLANDI → hesapta rehber kutusu + kopyala butonları → KARGODA → TAMAMLANDI.
- Mobil görünüm (390 px) kontrolü.

## 6. Kurallar
- Önce localhost; kullanıcı onaylamadan commit yok, onaydan sonra önce DEPLOY_STATUS güncellenir sonra yerel commit; **push yok**.
- DB değişikliği canlı DB'ye yalnız kullanıcı onayıyla (yerel = canlı DB).
