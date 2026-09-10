Az önce Cowork (bulut) tarafında, benim build/test/commit çalıştıramadığım bir
oturumda şu iki özellik için kod değişikliği yapıldı ve dosyalar doğrudan
projeye yazıldı - ama hiç doğrulanmadı, test edilmedi, commit'lenmedi:

1. **Admin panel - Ürünler listesi**: Ürünlerin birden fazla rengi varsa
   listede bunu gösteren bir "Renkler" kolonu eklendi (birden fazla renkte
   rozet + renk sayısı, tek renkte düz metin, renksizde "—").
2. **Canlı site - Ürün kataloğu (/urunler)**: Birden fazla rengi olan bir
   ürün artık kataloğa renk başına ayrı bir kart olarak düşüyor (her kart
   kendi renk fotoğrafıyla), tıklanınca ürün sayfası o renk seçili açılıyor
   (`?renk=...` query param'ı ile).

Değişen dosyalar:
- `src/lib/catalog.ts` (yeni `getCatalogEntries` fonksiyonu eklendi)
- `src/components/product-card.tsx` (opsiyonel `colorLabel` alanı + linke
  `?renk=` eklenmesi)
- `src/components/product-viewer.tsx` (opsiyonel `initialColor` prop'u,
  ilk renk/beden seçimi buna göre yapılıyor)
- `src/app/(site)/urunler/page.tsx` (artık `getCatalogEntries` kullanıyor)
- `src/app/(site)/urunler/[slug]/page.tsx` (`?renk=` query param'ını okuyup
  `ProductViewer`'a `initialColor` olarak geçiriyor)
- `src/app/(admin)/admin/urunler/page.tsx` (ürün sorgusuna varyant
  seçenekleri dahil edildi, renk listesi hesaplanıyor)
- `src/components/admin/products-table.tsx` (yeni "Renkler" kolonu)

Lütfen şunları yap:

1. Bu 7 dosyadaki mevcut hâli oku, yukarıdaki açıklamayla tutarlı mı
   (mantık hatası, eksik durum, tip hatası) kontrol et - gerekirse düzelt.
2. `npx tsc --noEmit` ve `npm run build` çalıştır, temiz geçene kadar
   düzelt.
3. Gerçek Neon DB'ye karşı doğrula: birden fazla rengi olan bir ürünle
   admin ürünler listesinde "Renkler" kolonunun doğru göründüğünü, canlı
   `/urunler` sayfasında bu ürünün renk başına ayrı kart olarak çıktığını,
   bir renge tıklayınca ürün sayfasının o renk seçili açıldığını (ve o
   rengin varsa stoklu bir bedeninin otomatik seçildiğini), tek rengi
   olan/renksiz ürünlerin eskisi gibi tek kart kaldığını test et.
4. Her şey doğrulandıktan sonra uygun bir commit mesajıyla commit'le
   (bu projede izlenen üslupla: Türkçe açıklama, ne değişti + neden).

Bir sorun bulursan (ör. renk/beden eşleşmesi, sıralama, mevcut akışlarda
regresyon) düzelt ve neyi neden değiştirdiğini kısaca özetle.
