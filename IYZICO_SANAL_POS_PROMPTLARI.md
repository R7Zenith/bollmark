# iyzico Sanal POS — Claude Code Promptları (4 faz, sırayla)

Spesifikasyon: `IYZICO_SANAL_POS_PLANI.md` (her fazda önce onu baştan sona oku).
Sıra önemli: Faz 1 → (kullanıcı sandbox anahtarlarını panele girer) → Faz 2 → Faz 3 → Faz 4.
Her faz ayrı oturumda/prompt ile verilir; bir faz bitmeden sonrakine geçilmez.

---

## ORTAK KURALLAR (her promptun başına eklenir)

```
Bu iş ödeme entegrasyonu: hata payı yok. Şu kurallara uy:
- Yüklü skill'leri kullan (özellikle karpathy-guidelines): sadece istenen değişiklik, cerrahi dokunuş, varsayımı açıkça yaz, doğrulanabilir başarı ölçütü.
- AGENTS.md uyarısı geçerli: bu Next.js 16; kod yazmadan önce node_modules/next/dist/docs/ içindeki ilgili rehberi (route handler, server actions, proxy, cookies/headers, searchParams) oku.
- IYZICO_SANAL_POS_PLANI.md'yi baştan sona oku, spesifikasyona uy. Plandaki "doğrulanamayanlar" (bölüm 1.9) için varsayım yapma: sandbox'ta gözlemle, sonucu DEPLOY_STATUS.md'ye ve (Faz 4'te) IYZICO_TEST_RAPORU.md'ye yaz.
- Veritabanı yerel ve canlıda ORTAK (Neon). Şema değişiklikleri SADECE eklemeli olacak (yeni tablo, nullable/varsayılanlı sütun). Hiçbir mevcut sütunu silme/yeniden adlandırma. `prisma db push` öncesi değişikliği bana özetle, sonra uygula.
- Gizli bilgiler (API key, secret, PAYMENT_ENCRYPTION_KEY) hiçbir dosyaya, loga, commit'e, çıktıya yazılmaz. .env dosyaları commit edilmez. .env.example'a sadece boş anahtar adı ve açıklama eklenir.
- Vercel işlemlerini (env ekleme, deploy izleme) Vercel CLI ile SEN yap; bana manuel iş bırakma. Sadece senin yapamayacağın bir adım kalırsa (ör. tarayıcı girişi) dur ve tek cümleyle ne yapmam gerektiğini söyle.
- Vercel env değişikliği yeni deploy gerektirir: değişikliği commit edip main'e push et, deploy'un Ready olduğunu doğrula.
- Bitirdiğinde: `npm run lint` ve `npx tsc --noEmit` temiz olmalı; DEPLOY_STATUS.md'nin sonuna tarihli not düş (ne yapıldı, hangi env eklendi, hangi testler geçti, açık kalanlar).
- Belirsiz bir noktada tahmin yürütme; plana aykırı bir durumla karşılaşırsan işi durdur ve bana sor.
```

---

## FAZ 1 — Altyapı + Sistem > Sanal POS paneli

```
[ORTAK KURALLAR]

Görev: iyzico Sanal POS altyapısını ve admin panelindeki "Sistem > Sanal POS" sayfasını kur. Bu fazda checkout akışına DOKUNMA.

1) Şema (plan bölüm 4): PaymentSettings, PaymentAttempt, PaymentRefund, PaymentLog modellerini ve Order/OrderItem'a plandaki ek alanları ekle. Sadece eklemeli. Şemayı özetle, sonra `npm run db:push`.

2) Şifreleme: src/lib/payment/crypto.ts — AES-256-GCM (node:crypto), anahtar PAYMENT_ENCRYPTION_KEY (base64, 32 bayt). encrypt/decrypt; anahtar yoksa/uzunluk yanlışsa açık hata. Birim testleri: gidiş-dönüş, bozulmuş ciphertext reddi, yanlış anahtar reddi. Rastgele bir anahtar üret, yerel .env'ye ve Vercel'e (production + preview + development) ekle. .env.example'a açıklamalı boş satır ekle. SITE_URL env'ini de tanımla: Vercel'de birincil alan adını oku (www mu, çıplak alan mı; callback host'u kanonik olmalı, plan 3/9) ve https://<kanonik-alan> değerini ekle. order-notifications.ts'deki sabit "https://bollmark.com" adreslerini SITE_URL'ye bağla.

3) İyzico istemcisi: src/lib/payment/iyzico/ altında (fetch + node:crypto, resmi npm paketi YOK):
   - client.ts: plan 1.2'deki IYZWSv2 imzası ile POST; base URL moda göre; yalnızca sunucu tarafı ("server-only").
   - money.ts: kuruş <-> ondalık string, float çarpma yok, sondaki sıfır atma (imza için), decimal string -> kuruş ayrıştırma.
   - signature.ts: plan 1.4 (başlatma ve sorgulama yanıt imzası) ve 1.5 (webhook V3) doğrulayıcıları, timingSafeEqual.
   - mode.ts: resolveMode() — LIVE yalnızca VERCEL_ENV==="production" ve DB'de LIVE ise; aksi halde SANDBOX. getCredentials(mode) şifreyi çözer.
   - errors.ts: iyzico hata kodu -> Türkçe kullanıcı mesajı eşlemesi (plan 1.8) + bilinmeyen için genel mesaj.
   - Birim testleri (Vitest/tsx ile, projede test aracı yoksa en hafif seçeneği kur ve nedenini yaz): para yardımcıları, imza doğrulayıcıları (dokümandaki formüllerle üretilmiş örnek vektörler), mode çözümlemesi.

4) Panel: src/app/(admin)/admin/sanal-pos/ — plan bölüm 6 birebir (durum kartı, ayarlar formu, 4 anahtar alanı, taksit, süre, Bağlantıyı Test Et, entegrasyon adresleri, ödeme günlüğü tablosu, sandbox test rehberi). Mevcut admin bileşenlerini (Card, Button, Badge, data-table, settings-feedback vb.) ve mevcut sayfa desenlerini kullan, aynı görsel dil. Server action'lar: sadece ADMIN (requireAdmin); secret'ı istemciye ASLA geri gönderme; boş bırakılan alan değişmez; sandbox-/canlı anahtar öneki doğrulaması; audit-actions.ts'e plandaki eylemleri ekle ve anahtar DEĞERLERİNİ loglama.
   Bağlantı testi: POST /payment/bin/check ile yan etkisiz doğrulama; sonucu PaymentSettings.lastTest* alanlarına yaz ve PaymentLog'a kaydet.
   Sidebar: "Sistem" grubuna CreditCard ikonlu "Sanal POS" (/admin/sanal-pos). roles.ts ile PERSONEL'in erişemediğini doğrula.

5) Doğrulama: PERSONEL hesabıyla /admin/sanal-pos erişimi reddediliyor; ADMIN ile sayfa açılıyor; anahtar kaydet -> sayfada sadece "son 4" görünüyor, HTML/network yanıtında secret yok; hatalı anahtar -> testte 1000/1001 Türkçe mesaj; sandbox öneki olmayan anahtar sandbox alanına girilince reddediliyor.
6) Deploy (main'e push), canlıda /admin/sanal-pos'un açıldığını doğrula, DEPLOY_STATUS.md notu.
Bitince bana yalnızca şunu söyle: "Panel hazır; sandbox anahtarlarını Sistem > Sanal POS'a girebilirsiniz."
```

---

## FAZ 2 — Ödeme akışı (checkout, callback, sipariş yaşam döngüsü)

Ön koşul: kullanıcı sandbox API Key + Secret'ı panele girmiş ve "Bağlantıyı Test Et" başarılı olmuş. Anahtar yoksa kodu yaz, birim testlerini çalıştır ve "sandbox anahtarı bekleniyor" diye durdur (uçtan uca testleri atlama, yapıldı deme).

```
[ORTAK KURALLAR]

Görev: plan bölüm 2 (a–j, m), 3, 5.A–5.C ve 5.E'yi uygula.

1) Sanal POS hazır değilse /api/orders 503 döner (plan 3/6). Sandbox modunda checkout'ta görünür "Test ödeme modu: gerçek kart çekilmez" uyarısı (canlıda yok).
2) /api/orders: sipariş PENDING_PAYMENT + paymentStatus UNPAID + paymentExpiresAt; mail YOK, sepet temizleme YOK; orderNumber çakışmasında yeniden dene (generateOrderNumber'ı bozma, çağıran tarafta döngü). Mevcut kupon/bundle/puan hesaplarına dokunma.
3) src/lib/payment/orders/: 
   - buildBasket (plan 5.A): OrderItem başına tek kalem + kargo kalemi, largest-remainder indirim dağıtımı, sıfır kalemi 1 kuruşa sabitleme, Σ==totalCents kontrolü. Birim testleri: en az 1000 rastgele senaryo, %100 indirim, ücretsiz kargo, tek kalem, kuruş kalıntıları.
   - buyer/adres oluşturucu: telefon +90 normalizasyonu, ad/soyad bölme, identityNumber placeholder, IP çıkarımı.
   - initializePayment(orderNumber)
   - reconcile(token): plan 5.B'deki TÜM doğrulamalar; koşullu updateMany ile tek-sefer yan etki; PAID transaction (durum, itemTransactions -> paymentTransactionId eşlemesi, atomik stok düşümü, needsAttention durumları), çift ödeme ve geç ödeme kuralları, fraudStatus 1/0/-1.
   - releaseOrder(orderId): kupon usedCount -1, puan iadesi (LoyaltyTransaction + bakiye), attempt'leri EXPIRED yap; süre dolumu için expirePendingOrders(batch) (önce reconcile, sonra iptal).
4) Rotalar: POST /api/odeme/baslat (hız sınırı: sipariş başına 10 dk'da 5), POST /api/odeme/iyzico/callback (303 yönlendirme, try/catch, force-dynamic, Node runtime), GET /api/odeme/durum?siparis= (yalnızca durum döner, kişisel veri yok), günlük cron /api/cron/odeme-mutabakat (CRON_SECRET deseni; vercel.json'a ekle, plan limitlerini kontrol et).
5) Sayfalar: /odeme/tesekkurler (DB durumuna göre 3 durum + yoklama + sepeti sadece PAID iken temizle), /odeme/basarisiz (Türkçe sebep + Tekrar dene). checkout-form.tsx: iyzico akışına geçir ("Ödemeye Geç"), paymentPageUrl'e yönlendir. Sandbox'ta paymentPageUrl gelmezse checkoutFormContent ile gömülü form kullan (birini seç, sonucu yaz). /odeme ve /api/odeme noindex.
6) Mailler: ödeme doğrulanınca admin "Yeni sipariş" + müşteri tek birleşik onay maili (notifyCustomerStatusChange'in PAID maili otomatik geçişte tetiklenmesin — çift mail olmasın). Mail hatası akışı bozmaz.
7) Admin sipariş sayfası: ödemesi iyzico ile denenmiş siparişte "Ödendi Olarak İşaretle" gizle; diğerlerinde onay + denetim kaydı. Sipariş listesinde Ödeme rozeti ve "Dikkat gerekiyor" filtresi.
8) Sandbox uçtan uca (production alan adında, POS modu SANDBOX; Chrome/Playwright ile gerçek 3DS akışı, OTP 123456): plan bölüm 8'deki 1–4, 6–10 ve 12, 14. Bilinmeyenleri (plan 1.9) gözlemle ve DEPLOY_STATUS.md'ye yaz. Yanıt imzası dokümandaki formülle uyuşmuyorsa imza kontrolünü KAPATMA; gerçek yanıtı (anahtarsız, kart bilgisiz) inceleyip nedenini bul, bana raporla.
9) Deploy + DEPLOY_STATUS.md notu. Sonda: geçen/geçmeyen test listesi.
```

---

## FAZ 3 — Webhook, iade/iptal, admin ödeme kartı

```
[ORTAK KURALLAR]

Görev: plan bölüm 5.D (webhook) ve 5.F (iade/iptal) + 6/7'deki kalan panel parçaları.

1) POST /api/odeme/iyzico/webhook: plan 5.D birebir (zod, V3 imza varsa doğrula, yoksa yine reconcile(token) ile sunucu-sunucu doğrula, yanıt kuralları, CHECKOUT_FORM_AUTH dışı olaylar loglanır). Birim testleri: geçerli/hatalı/eksik imza, bilinmeyen token, tekrar bildirim (idempotent).
2) Sipariş detayında "Ödeme" kartı (yalnızca ADMIN'e iade butonları): plan 5.F. Kalem bazlı kalan iade edilebilir tutar, iade geçmişi, "iyzico'dan durumu sorgula" butonu (reconcile + denetim kaydı PAYMENT_MANUAL_RECONCILE), needsAttention notu ve kapatma.
3) İade/iptal server action'ları: PaymentRefund(PENDING) -> API -> SUCCESS/FAILED; kalan tutar transaction içinde kilitli hesap; çift tık koruması; fazla tutar reddi; sayaçlar yalnızca başarıda değişir; Order.paymentStatus/status geçişleri; isteğe bağlı stok iadesi; müşteri maili; audit-actions. Aynı gün iptal (/payment/cancel, sadece tam tutar) ve refund'ın aynı gün davranışını sandbox'ta İKİ YOLLA da dene, gerçek davranışı DEPLOY_STATUS.md'ye yaz, arayüzü buna göre yönlendir.
4) İadeler sayfasında (TAMAMLANDI talepler) ilgili siparişin ödeme kartına bağlantı.
5) Sandbox testleri: plan bölüm 8'deki 5, 11, 13, 15 (5406670000000009 başarısız iade dahil), 16. Webhook'u yerel imzalı örnek istekle (secret ile hesaplayarak) ve imzasız isteklerle test et.
6) Deploy + DEPLOY_STATUS.md notu.
```

---

## FAZ 4 — Sertleştirme, tam test, canlıya geçiş dokümanı

```
[ORTAK KURALLAR]

Görev: plan bölüm 8'deki testlerin TAMAMINI sandbox'ta koştur, güvenlik incelemesi yap, raporla.

1) Bölüm 8'deki 16 maddeyi tek tek çalıştır (gerçek 3DS akışı dahil). Sonuçları IYZICO_TEST_RAPORU.md'ye (proje ana dizinine) tablo olarak yaz: senaryo, beklenen, gerçekleşen, geçti/kaldı, not. Kalan hataları düzelt ve ilgili testi yeniden koştur.
2) Plan 1.9'daki 6 "doğrulanamayan" maddenin her biri için gözlenen gerçek davranışı rapora yaz; canlı öncesi iyzico'dan teyit gerektirenleri ("iyzico'ya sorulacaklar" listesi olarak) ayır.
3) Güvenlik geçişi (plan bölüm 7'yi madde madde kod üzerinde kontrol et): secret/anahtar sızıntısı taraması (loglar, client bundle, hata yanıtları — `grep` ile ve üretilmiş .next istemci çıktısında), LIVE'ın yalnızca production'da geçerli olduğu, tüm HMAC karşılaştırmalarının timingSafeEqual olduğu, tutarın hiçbir yerde istemciden alınmadığı, callback/webhook'un bilinmeyen girdide 500 vermediği, noindex.
4) Yedek ve geri dönüş: Sanal POS'u tek tıkla Kapalı/Test'e alma testi; kapalıyken /api/orders davranışı.
5) Canlıya geçiş adımlarını (plan bölüm 9) ekran sırasıyla, kullanıcının tek sayfada okuyabileceği sade Türkçe ile "IYZICO_CANLIYA_GECIS.md" olarak ana dizine yaz.
6) Deploy + DEPLOY_STATUS.md notu. Son mesajında: geçen/kalan test sayısı, iyzico'ya sorulacaklar listesi ve "canlıya hazır mı" net cevabı.
```

---

## Not: bağımsız ikinci göz
Faz 4 bittiğinde `IYZICO_TEST_RAPORU.md` ve değişiklik özeti (git diff istatistiği) burada paylaşılırsa ödeme koduna bağımsız inceleme yapılır.
