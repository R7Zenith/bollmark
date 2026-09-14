# Lansman Sayacı Deploy'da Sıfırlanıyor — Kök Neden ve Çözüm Planı

## Sorun
"Yapım aşamasında" sayfasındaki ("Çok Yakında") geri sayım, her deploy'da başa (30 gün) sarıyor.

## Kök Neden
`src/app/(gate)/yapim-asamasinda/page.tsx` içinde:

```ts
const DEFAULT_LAUNCH_DATE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
const launchDateIso = process.env.NEXT_PUBLIC_LAUNCH_DATE || DEFAULT_LAUNCH_DATE;
```

- Hedef tarih `NEXT_PUBLIC_LAUNCH_DATE` ortam değişkeninden okunuyor; bu değişken tanımlı değilse "şu an + 30 gün" hesaplanan bir varsayılana düşülüyor.
- İncelenen dosyalarda bu değişken **sadece `.env.example` içinde** var (`NEXT_PUBLIC_LAUNCH_DATE="2026-10-14T00:00:00"`). `.env` ve `.env.local` dosyalarında yok, ve muhtemelen canlı deploy ortamında (Vercel proje ayarları) da tanımlı değil.
- Sonuç: her deploy'da (build zamanında) sayfa yeniden derleniyor, env değişkeni bulunamıyor, "şu an + 30 gün" yeniden hesaplanıyor → sayaç deploy anına göre sıfırlanıyor.

## Çözüm Yönü
1. Sabit bir lansman tarihi belirlenmeli (ör. gerçek lansman günü/saati, İstanbul saatiyle).
2. Bu tarih **Vercel proje ayarlarında** (Production + Preview) `NEXT_PUBLIC_LAUNCH_DATE` ortam değişkeni olarak, ISO 8601 formatında (`2026-10-14T00:00:00`) tanımlanmalı — kod değişikliği gerekmez, sadece env var eklenir.
3. Yerel geliştirme için `.env` / `.env.local` dosyasına da aynı değişken eklenmeli ki yerelde de doğru tarih görünsün.
4. Ek güvenlik önlemi (opsiyonel ama önerilir): `NEXT_PUBLIC_LAUNCH_DATE` tanımsızsa "şimdi + 30 gün" gibi hareketli bir varsayılana düşmek yerine, kod içinde **sabit** bir fallback tarihi kullanılmalı (ör. build script'inde de tanımlanmış aynı tarih). Böylece ileride env var yanlışlıkla silinirse/unutulursa sayaç yine "her deploy'da sıfırlanma" hatasına düşmez, en azından sabit kalır (yanlış da olsa tutarlı kalır) ve fark edilmesi kolaylaşır.
5. Env var eklendikten sonra bir deploy yapıp sayacın bir önceki deploy'daki değerle aynı kaldığını doğrulamak gerekir.

## Claude Code için Prompt (uygulama için Claude Code'a verilecek)

```
src/app/(gate)/yapim-asamasinda/page.tsx içindeki lansman geri sayımı her deploy'da
sıfırlanıyor. Kök neden: NEXT_PUBLIC_LAUNCH_DATE ortam değişkeni tanımlı değilse kod
"Date.now() + 30 gün" şeklinde HAREKETLİ bir varsayılana düşüyor (DEFAULT_LAUNCH_DATE),
bu da her build'de farklı bir tarih üretiyor.

Yapman gerekenler:
1. page.tsx içindeki DEFAULT_LAUNCH_DATE fallback'ini "şimdi + 30 gün" yerine SABİT
   bir ISO tarih string'i yap (ör. "2026-10-14T00:00:00"), böylece env var eksik olsa
   bile her build'de aynı sonucu üretsin.
2. .env.example içinde zaten NEXT_PUBLIC_LAUNCH_DATE="2026-10-14T00:00:00" tanımlı;
   bunu gerçek/güncel lansman tarihiyle güncelle (benimle teyit et) ve .env.local
   dosyasına da aynı satırı ekle.
3. Bana Vercel proje ayarlarında (Production ve Preview ortamları için)
   NEXT_PUBLIC_LAUNCH_DATE değişkenini nereye ve nasıl ekleyeceğimi adım adım anlat
   (kendin Vercel'e dokunma, ben ekleyeceğim).
4. Değişikliği yaptıktan sonra DEPLOY_STATUS.md'ye not düş: hangi dosya değişti,
   neden değişti, Vercel'de env var eklenmesi gerektiği ve bunun benim tarafımdan
   yapılması gerektiği.
5. Kullandığımız skill'leri kullan (proje talimatları gereği).
```

## Not
Bu değişiklik sonrası kod, env var doğru şekilde eklenmeden de artık "sürekli hareket eden" değil sabit bir tarihe düşeceği için sorunun kaynağı ortadan kalkar; ama gerçek lansman tarihinin canlıda doğru yansıması için Vercel'de env var eklenmesi şart.
