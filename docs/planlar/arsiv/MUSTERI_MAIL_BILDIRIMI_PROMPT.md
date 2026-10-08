# Claude Code için prompt: Müşteriye otomatik sipariş maili

## Durum tespiti (Cowork tarafında yapıldı)

- `src/lib/mail.ts` → `sendMail()`: Resend üzerinden mail atan tek merkezi fonksiyon, zaten var ve çalışıyor.
- `src/lib/order-notifications.ts`:
  - `notifyAdminNewOrder(order)` → sipariş oluşunca **admin'e** ("Yeni sipariş: ...") mail atıyor. `src/app/(site)/api/orders/route.ts` içinde sipariş kaydından hemen sonra çağrılıyor. **Bu çalışıyor.**
  - `notifyCustomerStatusChange(order, status)` → sipariş durumu PAID/SHIPPED/DELIVERED olunca **müşteriye** mail atmak için yazılmış ama kod tabanında **hiçbir yerden çağrılmıyor** (dead code).
  - `notifyReturnStatusChange(order, status)` → iade durumu değişince müşteriye mail atmak için yazılmış, o da çağrılıp çağrılmadığı kontrol edilmeli.
- Vercel production ortam değişkenlerinde `RESEND_API_KEY` ve `MAIL_FROM` tanımlı, yani mail altyapısı canlıda çalışır durumda — sadece bağlantılar eksik.

## İstenen değişiklikler

1. **Sipariş oluşturulduğunda müşteriye de onay maili gitsin.** Şu an sadece admin'e mail gidiyor, müşteri hiçbir onay almıyor. `order-notifications.ts` içine `notifyCustomerOrderReceived(order)` gibi yeni bir fonksiyon ekle (mevcut `notifyAdminNewOrder` ile aynı `sendMail` deseninde). Mail içeriği: sipariş numarası, ürün/adet/fiyat özeti (varsa `order.items` ilişkisinden), toplam tutar, teslimat adresi, "siparişinizi bollmark.com/siparis-durumu üzerinden takip edebilirsiniz" gibi bir not. `src/app/(site)/api/orders/route.ts` içinde, `notifyAdminNewOrder(order)` çağrısının yanına bunu da ekle (aynı fire-and-forget / `.catch(...)` deseniyle — asıl sipariş akışını ASLA bloklamamalı, mevcut kod tabanındaki yorum satırındaki prensip budur).

2. **`notifyCustomerStatusChange` fonksiyonunu gerçekten bağla.** Admin panelinde sipariş durumu güncellenen yeri bul (muhtemelen `src/app/(admin)/admin/siparisler/[id]/page.tsx` içindeki bir server action, veya `src/app/api/admin/siparisler/**` altında bir route) ve durum PAID/SHIPPED/DELIVERED'a geçtiğinde `notifyCustomerStatusChange(order, yeniDurum)` çağrısını oraya ekle. Toplu durum güncelleme varsa (`src/app/api/admin/siparisler/bulk/route.ts`) onu da unutma.

3. **`notifyReturnStatusChange` için de aynısını kontrol et.** İade/değişim talebinin durumu admin panelinden güncellendiğinde bu fonksiyon çağrılıyor mu, çağrılmıyorsa bağla (muhtemelen `src/app/(admin)/admin/iadeler/` altında).

4. Tüm yeni mail gönderimleri, mevcut `sendMail()` içindeki "hata olursa sadece logla, asıl işlemi durdurma" prensibine uymalı — yeni kod da aynı fire-and-forget + `.catch(console.error)` desenini kullanmalı.

5. Değişiklikten sonra local'de test edilemeyeceği için (RESEND_API_KEY sadece Vercel production'da tanımlı, local `.env`'de yok), test yerine kodun mantığını iki kez gözden geçir ve mevcut `notifyAdminNewOrder` çağrısıyla birebir aynı deseni kullandığından emin ol.
