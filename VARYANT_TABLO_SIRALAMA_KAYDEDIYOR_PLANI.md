# Varyant Tablosu — Sıralama Başlığı Formu Kaydediyor (Hata Planı)

## Sorun
Admin > Ürün düzenle > Varyantlar tablosunda "Beden ⇅" veya "Renk ⇅" başlığına tıklayınca
liste sıralanacağına form gönderiliyor: "Değişiklikler kaydedildi" mesajı çıkıyor ve sayfa yenileniyor.

## Kök neden (kodda doğrulandı)
`src/components/admin/data-table.tsx` ~198. satır — sıralama başlığındaki buton:

```tsx
<button
  onClick={() => handleSort(col.key)}
  className="inline-flex items-center gap-1 hover:text-admin-text"
>
```

`type` belirtilmemiş. HTML'de `<form>` içindeki tipi belirtilmemiş buton varsayılan olarak
`type="submit"`tir. `VariantEditor` → `DataTable` ürün düzenleme formunun içinde olduğu için tıklama
hem sıralamayı tetikliyor hem de tüm ürün formunu sunucuya gönderiyor (server action → kaydet → yenile).

Aynı dosyadaki diğer butonlarda (`Sütunlar` menüsü vb.) `type="button"` zaten var; sadece bu eksik.

## Çözüm
1. `data-table.tsx` içindeki sıralama butonuna `type="button"` ekle.
2. `src/components/admin/` altında `type` özelliği olmayan başka `<button` var mı diye tara
   (form içinde kullanılabilecek bileşenlerde aynı hata olabilir); varsa ve submit amaçlı değilse
   onlara da `type="button"` ekle. Submit amaçlı olanlara dokunma.
3. Sıralama sadece istemci tarafında kalsın (`sortedRows` useMemo) — sunucu çağrısı, kaydetme,
   router.refresh yok. Mevcut davranış bu şekilde, değiştirmeye gerek yok.

## Test (localhost)
- Ürün düzenle sayfasında Beden ve Renk başlığına art arda tıkla: liste artan/azalan sıralanmalı,
  toast çıkmamalı, sayfa yenilenmemeli, network sekmesinde POST görünmemeli.
- Sıraladıktan sonra bir stok değerini değiştirip "Kaydet"e bas: normal şekilde kaydedilmeli.
- Ürünler listesi, siparişler vb. DataTable kullanan diğer sayfalarda sıralama hâlâ çalışmalı.
