# Aktif Sepetler Sayfası — Plan

Tarih: 2026-11-23
Durum: Faz 1 uygulandı (2026-11-23). Kullanıcı kararıyla sidebar'da "Müşteriler" grubunda. Ek olarak Terk Edilmiş Sepetler'e "Üye Sepetleri" bölümü (24 saat dokunulmamış üye sepetleri, yalnız elle hatırlatma) eklendi. Faz 2 (misafir sepet takibi, `GuestCart`) 2026-11-27'de uygulandı: tüm misafirler, çerez onayı aranmadan (kullanıcı kararı, metinler güncellenmedi).

## Amaç
Admin panelde sitede oluşturulan sepetleri görmek: kim, hangi ürünleri, kaç adet, toplam ne kadar, en son ne zaman güncelledi.

## Mevcut durum (koddan tespit)
- **Üye müşteriler:** Sepet `CustomerCart` tablosunda tutuluyor (`customerId` başına tek satır, `linesJson` = `[{productId, variantId, quantity}]`, `couponCode`, `kalpSelectionJson`, `updatedAt`). Her değişiklikte `PUT /api/sepet` ile DB'ye yazılıyor. Bu veri panelde hiçbir yerde gösterilmiyor.
- **Misafirler:** Sepet yalnızca tarayıcının localStorage'ında duruyor, sunucuya hiç gelmiyor. Ödeme sayfasında e-posta girip ayrılırlarsa `AbandonedCart` tablosuna düşüyor ve bu kayıtlar zaten `/admin/terk-edilmis-sepetler` sayfasında görünüyor.
- Sonuç: Yeni tablo veya ek DB yazımı olmadan **üye sepetleri** hemen listelenebilir. E-postasını bırakmayan misafirlerin sepetini görmek için yeni bir takip altyapısı kurmak gerekir.

## Karar: Faz 1 (önerilen) — Üye sepetleri sayfası
- Yeni sayfa: `/admin/sepetler` ("Aktif Sepetler"), sidebar'da "Kampanyalar" grubunda "Terk Edilmiş Sepetler"in hemen üstünde.
- Kaynak: `CustomerCart`; `linesJson` değeri `"[]"` olan boş sepetler listelenmez.
- Satır bilgileri: müşteri adı + e-posta + telefon (müşteri detayına link), ürün özeti "Ürün (Renk, Beden) ×Adet", toplam adet, güncel fiyatla tutar, kupon kodu, son güncelleme ("3 saat önce" + tarih).
- Satıra tıklayınca açılan detay: ürün görseli, adı, beden/renk, adet, birim fiyat, stok durumu (tükendi/yayından kalktı rozeti).
- Filtreler: arama (ad/e-posta/telefon), son güncelleme dönemi (mevcut `OrdersPeriodSelect`), sıralama (en yeni / en yüksek tutar).
- Üstte 3 kart: aktif sepet sayısı, sepetlerdeki toplam tutar, ortalama sepet tutarı.
- Müşteri detay sayfasına (`/admin/musteriler/[id]`) "Şu anki sepeti" kartı eklenir.
- Misafirler için sayfada not ve link: "E-posta bırakan misafir sepetleri → Terk Edilmiş Sepetler".

### Performans (Neon transfer planına uygun)
- Sayfalama: sayfa başına 50 sepet.
- Ürün çözümlemesi: sayfadaki tüm sepetlerin productId'leri toplanır ve **tek** `product.findMany` sorgusuyla çekilir; sepet başına ayrı sorgu atılmaz. Fiyat/isim mantığı `resolveCartLines` ile aynı kalır (gerekirse toplu çalışan bir versiyonu eklenir, mevcut fonksiyon bozulmaz).
- Sayfa yalnızca admin açınca çalışır; müşteri tarafına ek yük gelmez.

## Faz 2 (isteğe bağlı, şimdilik yapılmıyor) — Anonim misafir sepet takibi
- Yeni `GuestCart` tablosu + anonim çerez kimliği; misafirin her sepet değişikliğinde (debounce ile) DB'ye yazılır.
- Artısı: hangi ürünler sepete atılıp alınmıyor görülür.
- Eksileri: kim olduğu bilinmez (yalnızca "Misafir #a3f2"), her ziyaretçi için ek function çağrısı ve Neon yazımı olur, KVKK/çerez onayı gerekir.
- Önerilen hafif alternatif: kişi bazlı değil **ürün bazlı sayaç** (hangi ürün kaç kez sepete eklendi). Bunu GA4 `add_to_cart` olayı zaten veriyor.
