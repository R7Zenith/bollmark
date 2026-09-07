# Siparişler Sayfası Zenginleştirme Planı (taslak)

Bu belge, paylaştığınız Shopify "Siparişler" ekran görüntüsü referans alınarak
hazırlandı. Amaç: `/admin/siparisler` sayfasını, Shopify'daki gibi üstte özet
kartlar + sekmeler + zengin filtre çubuğu olan bir görünüme taşımak. **Ben
(Claude, planlayıcı) burada mevcut kodu inceleyip fizibilite + fazlı bir plan
çıkardım; uygulama Claude Code ile yapılacak, henüz kod değişikliği
yapılmadı.**

## 1) Mevcut durum (kod incelemesi)

`src/app/(admin)/admin/siparisler/page.tsx` şu an:
- Sayfa başlığı + tek bir filtre çubuğu (`orders-filters.tsx`: arama, ödeme
  durumu, kargo durumu, tarih aralığı) + tek bir tablo (`orders-table.tsx`).
- Üstte özet kart, sekme veya dönem seçici **yok**.
- Sorgu tüm eşleşen siparişleri tek seferde çekiyor (`prisma.order.findMany`,
  `skip/take` yok) — `Pagination` bileşeni projede var ama bu sayfada
  kullanılmıyor. Sipariş sayısı arttıkça bu performans sorunu olur (aşağıda
  ayrıca not ettim, madde 5).
- `StatCard` bileşeni zaten var ve dashboard'da (`admin/page.tsx`) kullanılıyor
  — trend oku (yukarı/aşağı yüzde) destekliyor. Siparişler sayfasında hiç
  kullanılmıyor, doğrudan yeniden kullanılabilir.
- Şema (`prisma/schema.prisma`) şu veriyi zaten tutuyor: `Order.status`,
  `Order.createdAt`, `OrderItem.quantity`, `Shipment.status/shippedAt/
  deliveredAt`, `ReturnRequest.itemsJson` (iade edilen kalemler JSON olarak).
  Yani aşağıdaki kartların **hiçbiri yeni migration gerektirmiyor** — hepsi
  mevcut tablolardan hesaplanabilir.

## 2) Ekran görüntüsündeki elemanların dökümü

| Shopify'da ne var | Ne işe yarıyor | Bollmark'ta uygulanabilir mi |
|---|---|---|
| Üst araç çubuğu: "Dışa aktar", "Diğer işlemler", **"Sipariş oluştur"** | CSV dışa aktarma, manuel/telefon siparişi girme | Dışa aktar: kolay. Sipariş oluştur: orta-büyük efor (yeni form+akış) — dükkanınız da olduğu için telefon/mağaza içi satış için değerli olabilir |
| "Bugün ▾" dönem seçici | Hazır tarih aralıkları (bugün/dün/7 gün/30 gün/bu ay) | Kolay — mevcut tarih filtresinin üstüne hazır seçenekler eklenir |
| 5 özet kart: Siparişler, Sipariş edilen ürünler, İade edilen ürünler, Gönderilen ürünler, Gönderim süresi (hepsi trend yüzdesi + mini sparkline ile) | Seçili dönemin özeti, bir önceki dönemle kıyaslama | Sparkline hariç hepsi kolay-orta; veri şemada zaten var (bkz. madde 3) |
| Sekmeler: Tümü / Ödenmedi / Açık / Kapatıldı | Hızlı durum filtresi | Kolay — mevcut `status` alanından türetilir |
| "Konum: Tüm konumlar" | Çoklu depo/mağaza filtresi | Bollmark tek depo/mağaza — **uygulanmaz, atlanacak** |
| Sütunlar / Sırala / Filtre / "..." butonları | Tablo görünümünü kişiselleştirme | Filtre ve Sırala zaten var (dropdown yerine buton olabilir); Sütunlar (kolon göster/gizle) orta efor |
| Tablo satırı: kanal ikonu ("Online Store"), ödeme durumu, gönderim durumu | Çoklu satış kanalı ayrımı | Bollmark tek kanal (kendi sitesi) — kanal kolonu şimdilik anlamsız, atlanacak |

## 3) Özet kartlar — nasıl hesaplanır (Prisma sorgu planı)

Seçili dönem `[baslangic, bitis)` ve bir önceki eşit uzunluktaki dönem
`[oncekiBaslangic, oncekiBitis)` olmak üzere:

1. **Siparişler** — `prisma.order.count({ where: { createdAt: {...} } })`,
   trend = aynı sayının önceki dönemle yüzde farkı.
2. **Sipariş edilen ürünler** — `prisma.orderItem.aggregate({ _sum: { quantity: true }, where: { order: { createdAt: {...} } } })`.
3. **İade edilen ürünler** — `ReturnRequest`'in `itemsJson` alanı
   `[{orderItemId, quantity}]` formatında düz metin olarak tutuluyor (ilişkisel
   değil), bu yüzden dönemdeki `ReturnRequest` kayıtları çekilip JS tarafında
   `JSON.parse` ile adetler toplanır.
4. **Gönderilen ürünler** — `prisma.orderItem.aggregate({ _sum: { quantity: true }, where: { order: { shipment: { shippedAt: {...} } } } })`
   (dönemde *kargoya verilen* siparişlerin kalemleri — sipariş tarihine değil
   kargolanma tarihine göre).
5. **Gönderim süresi** — dönemde kargoya verilmiş `Shipment` kayıtları
   (`shippedAt` dolu) çekilip her biri için `shippedAt - order.createdAt`
   farkı hesaplanır, ortalaması alınıp "X saat Y dakika" biçiminde
   gösterilir. Şu an hiçbir yerde bu metrik yok — operasyonel olarak faydalı
   yeni bir gösterge olur.

Sparkline (mini grafik) Shopify'da her kartın altında var; bunun için
`orders-chart.tsx`'te zaten kullanılan grafik kütüphanesi (muhtemelen
`recharts`) yeniden kullanılabilir ama bu görsel bir "nice to have" —
ilk fazda trend yüzdesi (ok + %) yeterli, sparkline'ı 2. faza bırakmayı
öneririm (efor/etki oranı düşük).

## 4) Sekmeler — durum eşlemesi

- **Tümü** — filtre yok.
- **Ödenmedi** — `status = PENDING_PAYMENT`.
- **Açık** — `status IN (PAID, PREPARING, SHIPPED)` (ödenmiş ama henüz
  teslim edilmemiş/kapanmamış siparişler).
- **Kapatıldı** — `status IN (DELIVERED, CANCELLED, REFUNDED)`.

Her sekmenin yanında Shopify'daki gibi küçük bir sayı rozeti gösterilebilir
(`prisma.order.groupBy(['status'], { _count: true })` ile tek sorguda
alınır). Sekmeler seçildiğinde mevcut `durum` query param'ıyla çakışmaması
için ayrı bir `sekme` param'ı kullanılması öneririm (durum dropdown'u zaten
tekil statü seçiyor, sekme birden çok statüyü kapsıyor).

## 5) Önerilen fazlı uygulama planı

**Faz 1 — Görsel iskelet + gerçek veri (yüksek etki, düşük-orta efor):**
1. Sayfaya dönem seçici eklenir (Bugün / Dün / Son 7 gün / Son 30 gün / Bu ay
   / Özel aralık — özel aralık mevcut başlangıç/bitiş tarih inputlarını
   kullanır).
2. 5 özet kart eklenir (`StatCard` bileşeni yeniden kullanılır), madde 3'teki
   sorgularla gerçek veriden hesaplanır, trend oku önceki dönemle kıyaslanır.
3. Tümü/Ödenmedi/Açık/Kapatıldı sekmeleri eklenir (sayı rozetli).
4. "Dışa aktar" butonu — filtrelenmiş sonucu CSV olarak indirir (basit bir
   API route, mevcut filtre mantığı yeniden kullanılır).

**Faz 2 — Tablo kişiselleştirme (orta efor):**
5. "Sütunlar" — kolon göster/gizle (tercih tarayıcıda localStorage'da
   tutulur, `DataTable` bileşenine kolon-görünürlük desteği eklenir).
6. Sıralama ve filtre butonları Shopify'daki gibi tek bir açılır panelde
   toplanır (şu an ayrı dropdown'lar hâlinde — işlevsel olarak aynı, sadece
   görsel toparlama).
7. Kart altına sparkline (mini trend grafiği) eklenir.

**Faz 3 — Yeni operasyonel akış (büyük efor, isteğe bağlı):**
8. "Sipariş oluştur" — admin panelden manuel sipariş girme (telefonla/mağaza
   içi satış için). Dükkânınız olduğu için bu, hem online hem mağaza içi
   satışları tek yerden takip etmenizi sağlar; ama yeni bir form + stok
   düşme + ödeme durumu akışı gerektirdiği için ayrı bir plan/faz olarak ele
   alınmalı.

## 6) Bu arada fark edilen, ilişkili bir teknik not

Sayfa şu an sayfalama (pagination) yapmadan filtreye uyan **tüm** siparişleri
tek seferde çekip tarayıcıda gösteriyor. Sipariş sayınız arttıkça bu yavaşlar.
Bu plana dahil değil ama siz de dokunacağımız için, Faz 1 ile birlikte
`skip/take` + mevcut `Pagination` bileşeninin bu sayfaya bağlanmasını da
ekleyebiliriz (küçük ek efor, ileride sorun çıkmasını önler).

## 7) Netleştirilmesi gereken noktalar

- Dönem seçici varsayılanı "Bugün" mü yoksa "Son 30 gün" mü olsun? (Shopify
  varsayılanı "Bugün" ama düşük sipariş hacminde "Son 30 gün" daha bilgilendirici
  olabilir.)
- "Sipariş oluştur" (Faz 3) şimdilik kapsamda olsun mu, yoksa ayrı bir işe mi
  bırakalım?
- Dışa aktarma formatı CSV yeterli mi, yoksa Excel (.xlsx) mi istersiniz?
  (Ürün Excel aktarımında zaten `excel-import.ts`/`excel-aktar` altyapısı
  var, aynı kütüphane siparişler için de kullanılabilir.)

## 8) Sonraki adım

Faz 1'i onaylarsanız, bu belgeyi Claude Code'a okutup adım adım
uygulatabiliriz (önce dönem seçici + özet kartlar + sekmeler, sonra dışa
aktar). İsterseniz sırayı veya kapsamı değiştirebiliriz.
