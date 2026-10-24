# AVIF Görsel Yükleme Desteği Planı

Tarih: 2026-10-13
Durum: uygulandı (2026-10-13), push edildi

## Sorun

Twister ürün fotoğrafları `.avif` formatında. Admin panelde ürüne fotoğraf
eklerken site bunları kabul etmiyor.

## Neden

İzin verilen formatlar üç yerde ayrı ayrı `JPG / PNG / WEBP` olarak sabitlenmiş:

| Dosya | Satır | Etki |
|---|---|---|
| `src/components/admin/multi-image-field.tsx` | `ACCEPTED_TYPES` (~32), filtre (~144), `accept` (~367) | AVIF dosyalar seçim/sürükle-bırakta **sessizce** listeden atılıyor, kullanıcıya hata bile gösterilmiyor. |
| `src/components/admin/image-field.tsx` | `accept="image/jpeg,image/png,image/webp"` (~92) | Dosya seçme penceresinde AVIF görünmüyor. |
| `src/app/api/admin/upload/route.ts` | `ALLOWED_TYPES` | Sunucu "Sadece JPG, PNG veya WEBP" hatasıyla reddediyor. |

Asıl zorluk yok: sunucu her görseli zaten `sharp` ile **WebP'ye çevirip** R2'ye
yazıyor (`src/lib/image-compress.ts`). sharp'ın hazır paketi AVIF okuyabiliyor.
Yani AVIF sadece kapıdan geçebilmeli; sitede yine WebP olarak saklanır,
müşteri tarafında hiçbir şey değişmez.

## Yapılacaklar

1. İzin verilen tipleri tek yerde topla (ör. `src/lib/client-image-resize.ts`
   içinde ya da yeni küçük bir sabit): `image/jpeg, image/png, image/webp, image/avif`.
   Üç dosya da bunu kullansın.
2. Tarayıcı bazen `.avif` için `file.type`'ı boş verebiliyor (özellikle Windows).
   Tip boşsa uzantıya bak (`.avif`, `.jpg`, `.jpeg`, `.png`, `.webp`) – hem
   istemci filtresinde hem sunucu kontrolünde.
3. `multi-image-field.tsx`: desteklenmeyen dosya atıldığında sessiz kalmasın,
   "X dosya desteklenmeyen formatta olduğu için eklenmedi" gibi kısa bir uyarı göstersin.
4. Hata mesajlarını güncelle: "JPG, PNG, WEBP veya AVIF".
5. `compressImage` / `image-storage.ts` değişmez (çıktı WebP kalır).

## Doğrulama (localhost)

- Bir Twister AVIF fotoğrafını ürün düzenleme sayfasından yükle → önizlemede
  görünsün, kaydettikten sonra R2'deki dosya `.webp` olsun.
- JPG/PNG/WEBP yükleme eskisi gibi çalışsın.
- Desteklenmeyen bir dosya (ör. .gif/.pdf) seçilince uyarı çıksın.
- `npm run lint`, `npx tsc --noEmit` temiz.
- Not: yerel ve canlı aynı veritabanı + aynı R2'yi kullanıyor; test fotoğrafını
  taslak (DRAFT) bir Twister ürününe yükle.
