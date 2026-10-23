# Anasayfa "Ne arıyorsun?" kutularında aynı görselin tekrarı — Plan

Tarih: 2026-10-23
Durum: uygulandı (2026-10-23)

## Sorun
Yeni eklenen çanta hem **Kadın** hem **Aksesuar** kutusunda görünüyor.

## Neden
`src/app/(site)/page.tsx` her kutunun görselini birbirinden habersiz seçiyor:
- Kadın/Erkek/Çocuk: `newestProductImage(inGender(...), true)` → o cinsiyetteki en yeni (önce öne çıkan) ürün.
- Ayakkabı/Aksesuar: `categoryBoxImage(slug)` → kategorinin admin `imageUrl`'i, yoksa ağaçtaki en yeni ürün.
Çanta hem "Kadın" cinsiyetinde hem "aksesuar" ağacında olduğu için iki kutu da onu seçiyor.

## Çözüm
1. **Cinsiyet kutuları giyimi tercih etsin:** Kadın/Erkek/Çocuk görseli seçilirken ayakkabı ve aksesuar ağacındaki ürünler önce dışarıda bırakılır. Giyim ürünü yoksa eski davranışa düşülür (tüm ürünler).
2. **Tekrar yasağı:** Kutular sırayla seçilir. Önce admin görseli olan kategori kutuları (Ayakkabı/Aksesuar) ayrılır, sonra Kadın → Erkek → Çocuk → Ayakkabı → Aksesuar. Daha önce kullanılan **ürün** ve **görsel URL'i** atlanır. Uygun aday kalmazsa kutu yine görselli olsun diye tekrar edilebilir.
3. Admin'in kategoriye verdiği `imageUrl` her zaman öncelikli kalır; dokunulmaz.

Kapsam: yalnız anasayfadaki 5 kutu. Yuvarlak kategori şeridine dokunulmaz.
Veritabanı/migration değişikliği yok.

## Doğrulama
- Localhost anasayfada Kadın ve Aksesuar kutusunda farklı görseller.
- Erkek/Çocuk/Ayakkabı kutuları önceki gibi görselli.
- `npm run lint`, `npx tsc --noEmit`, mevcut testler geçiyor.
