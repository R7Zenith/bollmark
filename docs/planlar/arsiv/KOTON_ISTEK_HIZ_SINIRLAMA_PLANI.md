# Koton İstek Hız Sınırlama Planı (Büyük Excel'de bot algılanması)

Tarih: 2026-09-25
Durum: İptal (2026-10-09), gerek kalmadı. Uygulanmadı.

## 1. Sorun: kod incelemesi

`src/lib/koton-images.ts` incelendi. Büyük Excel yüklendiğinde:

| Nokta | Şu anki davranış | Sonuç |
|---|---|---|
| Ürünler arası bekleme | `REQUEST_DELAY_MS = 900` (1 saniyenin altında) | Ürünler art arda işleniyor |
| Görsel indirme | Renk başına 6 görsel, **hiç beklemeden** art arda (`applyKotonProductData` içindeki döngü) | 4 renkli bir ürün birkaç saniyede ~24 istek gönderiyor |
| Arama sırası | Önce **barkod**, bulamazsa ürün kodu, sonra Google | Ürün başına 1-3 arama isteği |
| Arama adresi | `autocomplete/?search_text=`: robots.txt bu adresi yasaklıyor | En çok dikkat çeken istek türü |
| Kaynak | Vercel sunucu IP'leri (veri merkezi) | Veri merkezi IP'lerinden gelen yoğun trafik zaten şüpheli sayılıyor |

Kaba hesap: 4 renkli 100 ürünlük bir liste, sadece görsellerden **~2.400 istek** demek ve bunlar
birkaç dakikaya sıkışıyor. Bot algılanmasının asıl sebebi bu.

Not: `USER_AGENT` zaten dürüst ("BollmarkImportBot"). Böyle kalmalı. Sorun kim olduğumuz değil, istek hızı.

## 2. Çözüm: yavaş, sıralı, kuyruklu çalışma

1. **Excel yüklemesi görsel çekmesin.** Ürünler hemen oluşturulsun, görsel/açıklama işi bir
   **kuyruğa** eklensin (ürün başına "bekliyor" durumu).
2. **Kuyruk küçük parçalarla işlensin.** Her çalışmada en fazla N ürün (ör. 5) işlensin.
   Tetikleme: admin panelde "Sıradaki 5 ürünü işle" butonu ve/veya Vercel cron.
3. **Her istek arasında bekleme, görseller dahil.** Tüm Koton istekleri (arama, JSON, her görsel)
   tek bir yardımcıdan geçsin, her istek arasında en az 2-4 sn beklensin.
4. **Günlük üst sınır.** Ör. günde en fazla 30 ürün. Aşılınca kuyruk ertesi güne kalsın.
5. **Önce ürün kodu ile arama.** Aynı ürün kodunun tüm renkleri tek JSON'da geliyor. Barkod
   araması sadece ürün kodu bulamazsa denensin.
6. **Engel sinyalinde tamamen durma.** 403/429/5xx veya zaman aşımı gelirse kuyruk en az 24 saat
   dursun. Panelde "Koton geçici olarak yanıt vermiyor" yazsın, otomatik tekrar deneme olmasın.
7. **Aynı şeyi iki kez istememe.** Başarıyla işlenen ürün kodu işaretlensin, tekrar yüklemede
   siteye gidilmesin. Sadece "yeniden ara" butonu bunu atlasın.
8. **Görsel sayısı ayarlanabilir.** Renk başına 6 yerine ör. 4 görsel (istek sayısı %33 düşer).

Beklenen etki: 4 renkli bir ürün ~26 istek × ~3 sn ≈ 1,5 dk. Günde 30 ürün ≈ 45 dk,
parçalara bölünmüş şekilde. Anlık yük yaklaşık 20-30 kat düşer.

Yapılmayacaklar: IP/proxy değiştirme, sahte tarayıcı kimliği, User-Agent gizleme, paralel istek.

## 3. Paralel olarak: resmi kanal

Bollmark, 2016'dan beri Koton Corner Mağazası. Bölge sorumlusuna / bayi kanalına ürün
görsellerinin ve açıklamalarının toplu olarak (portal, FTP, Excel/XML) verilip verilmediği
sorulmalı. Varsa bu kodun Koton tarafına hiç ihtiyaç kalmaz, telif konusu da çözülür.

## 4. Claude Code prompt'u

```
Görev: Koton görsel/açıklama çekimini bot gibi algılanmayacak şekilde yavaşlat ve kuyruğa al.
Plan: KOTON_ISTEK_HIZ_SINIRLAMA_PLANI.md (önce oku).

Mevcut durum (src/lib/koton-images.ts):
- Ürünler arası sadece 900 ms bekleme var, görseller renk başına 6 adet hiç beklemeden
  art arda indiriliyor; büyük Excel'de birkaç dakikada binlerce istek gidiyor.
- Arama önce barkodla, sonra ürün koduyla yapılıyor.

Yapılacaklar:
1. Önce mevcut kodu oku: koton-images.ts, excel-import.ts, brand-image-sources.ts,
   excel-aktar/gorsel-getir ve [id]/gorsel-yenile, gorsel-renk-ara, gorsel-ekle route'ları,
   EXCEL_BUYUK_LISTE_TIMEOUT_VE_ILERLEME_PLANI.md. Gerçek dosya adlarına göre kısa bir
   uygulama planı yaz, bana göster, onaydan sonra başla.
2. Tüm marka sitesi istekleri (autocomplete, ?format=json, görsel indirme) tek bir
   "politeFetch" yardımcısından geçsin: istekler sıralı, aralarında 2-4 sn rastgele bekleme.
   Google CSE istekleri bu sınıra dahil değil.
3. Excel yüklemesi artık görsel çekmesin; yeni ürünler için bir kuyruk durumu tut
   (bekliyor / işlendi / bulunamadı / hata). Şema değişikliği gerekiyorsa en küçük hali.
4. Admin panelde "Sıradaki 5 ürünün görselini getir" butonu: bir çağrıda en fazla 5 ürün
   işlesin (Vercel function süre sınırını aşmasın). Kalan sayıyı göster.
5. Günlük üst sınır (env: KOTON_DAILY_PRODUCT_LIMIT, varsayılan 30) ve renk başına görsel
   sayısı (env: KOTON_MAX_IMAGES_PER_COLOR, varsayılan 4).
6. Arama sırası: önce ürün kodu, bulunamazsa barkod, en son Google CSE.
7. 403/429/5xx ya da zaman aşımında kuyruğu 24 saat durdur, panelde açık bir uyarı göster,
   otomatik tekrar deneme yapma.
8. İşlenmiş ürün kodu için tekrar istek atma; sadece "yeniden ara" butonu bunu atlasın.
9. USER_AGENT dürüst kalsın. IP/proxy değiştirme, tarayıcı taklidi, User-Agent gizleme
   gibi hiçbir şey ekleme.

Kurallar:
- Yüklü skill'leri kullan (karpathy-guidelines: küçük ve cerrahi değişiklik).
- Önce localhost'ta göster; test için Koton'a en fazla 1-2 ürünle istek at.
- Onayımdan sonra yerel commit at, ben söylemeden push etme.
- İş bitince DEPLOY_STATUS.md'ye not düş.
```
