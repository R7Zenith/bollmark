# Varyant Özellikleri Sayfası — Açılır/Kapanır (Akordeon) Liste (Araştırma + Claude Code Promptu)

## Tetikleyen istek

Kullanıcı: "panelde varyant özellikleri sayfasında özelliklerin varyantları
arttıkça liste aşağıya doğru uzayıp gidiyor, kapanıp açılabilir yaparsak en
azından sayfanın gereksiz büyümesini engelleriz"

## Kod incelemesi — kesin durum

Sayfa: `src/app/(admin)/admin/ayarlar/varyant-ozellikleri/page.tsx`

- Sayfa bir Server Component; `prisma.variantAttribute.findMany(...)` ile
  tüm özellikleri (Beden, Renk, Kalıp vb.) ve her birinin **tüm** değerlerini
  (`values`) tek seferde çekip, her özelliği bir `Card` (`src/components/admin/card.tsx`)
  içinde, altına da o özelliğin **bütün değerlerini** (`attribute.values.map(...)`)
  tek bir dikey liste olarak basıyor.
- `Card` bileşeni tamamen durumsuz (state'siz) bir sunum bileşeni — başlık +
  aksiyon satırı + `children`'ı olduğu gibi basıyor, açılıp kapanma (collapse)
  kavramı yok.
- Bir özelliğin değer sayısı arttıkça (örn. 30+ beden ya da 40+ renk), o
  `Card`'ın içeriği tek başına sayfanın büyük bölümünü kaplıyor; birden fazla
  özellik olduğunda (Beden + Renk + Kalıp...) sayfa aşağı doğru çok uzuyor —
  kullanıcının bahsettiği sorun bu.
- Tüm CRUD işlemleri (`createAttribute`, `deleteAttribute`, `moveAttribute`,
  `createValue`, `updateValueHex`, `deleteValue`, `moveValue`) server action
  olarak tanımlı ve her biri `revalidatePath(PATH)` ile **tüm sayfayı**
  yeniden render ediyor (client-side state korunmuyor, sayfa server'dan
  taze geliyor). Yani "açık/kapalı" bilgisi sayfa state'inde tutulamaz —
  her aksiyondan sonra sıfırlanır. Bu yüzden açık/kapalı durumu **localStorage**
  gibi tarayıcı tarafında kalıcı bir yerde tutulmalı, yoksa kullanıcı bir
  değer eklediğinde/sildiğinde o özellik kartı tekrar "varsayılan" haline
  döner (can sıkıcı olur).
- `Card`, `ConfirmSubmitButton`, `ColorAutoSubmitInput` gibi bileşenlerde
  zaten server action'ları client bileşenlere prop olarak geçirme deseni
  kullanılıyor (Next.js App Router bunu destekliyor) — yeni bir client
  bileşen eklemek mevcut mimariyle tam uyumlu.

## Çözüm önerisi

Her özellik kartını (Beden, Renk, Kalıp...) **açılır/kapanır (akordeon)**
yapan yeni bir client bileşen: `VariantAttributeCard`
(`src/components/admin/variant-attribute-card.tsx`).

Özellikler:
1. Başlık satırı tıklanabilir olur (chevron ikonu + özellik adı + değer
   sayısı rozeti, örn. "Beden · 24 değer"), tıklanınca içerik (değer listesi
   + "yeni değer ekle" formu) açılır/kapanır. Yukarı/aşağı taşı ve sil
   butonları başlık satırında, tıklama alanının dışında kalır (event
   propagation durdurulur) — akordeonu tetiklemez.
2. Açık/kapalı durum `localStorage`'da özellik id'sine göre saklanır
   (`varyant-ozellik-acik:<attributeId>`), böylece:
   - Sayfa server action sonrası yeniden render olduğunda (örn. yeni değer
     eklendiğinde) kullanıcının o an açık tuttuğu kart açık kalır.
   - Kullanıcının tercihi (hangi özellikleri hep açık/kapalı tutmak
     istediği) sonraki ziyaretlerde de hatırlanır.
3. Varsayılan durum: localStorage'da kayıt yoksa (ilk kullanım), değer
   sayısı 6'dan fazla olan özellikler **kapalı**, 6 veya daha az olanlar
   **açık** başlar — asıl amaç (uzun listelerin sayfayı şişirmesini önlemek)
   ilk kullanımda da otomatik sağlanmış olur.
4. Sayfa başına küçük bir "Tümünü Aç" / "Tümünü Kapat" bağlantı çifti
   eklenir (özellik sayısı arttıkça tek tek açıp kapatmak yerine hızlı
   toplu kontrol için). Bu, `window` üzerinde basit bir custom event
   (`varyant-ozellikleri:hepsi`, detail `{ open: boolean }`) yayınlayan
   ayrı bir küçük client bileşenle yapılır; her `VariantAttributeCard` bu
   event'i dinleyip kendi durumunu ve localStorage kaydını günceller —
   paylaşılan bir context/state kütüphanesi gerekmez, mevcut kod tabanının
   sade client-bileşen deseniyle tutarlı kalır.
5. Kapalıyken içerik tamamen DOM'dan kaldırılır (conditional render, sadece
   `display:none` değil) — asıl hedef sayfanın DOM/scroll uzunluğunu
   azaltmak olduğu için bu önemli.
6. Erişilebilirlik: başlık `<button>` olur, `aria-expanded` ve
   `aria-controls` eklenir.

Bu değişiklik sadece `ayarlar/varyant-ozellikleri` sayfasını ve yeni
bileşeni etkiler; veritabanı şeması, server action'ların mantığı ya da
başka hiçbir ekran değişmez — düşük riskli, saf UI/UX iyileştirmesi.

## Claude Code promptu

```
"Varyant Özellikleri" sayfasında (src/app/(admin)/admin/ayarlar/varyant-ozellikleri/page.tsx)
her özellik (Beden, Renk, Kalıp vb.) bir Card içinde tüm değerleriyle basılıyor;
değer sayısı arttıkça sayfa aşırı uzuyor. Bunu açılır/kapanır (akordeon) yap:

1. Yeni bir client bileşen oluştur: src/components/admin/variant-attribute-card.tsx
   - Props: attributeId (string), title (ReactNode), valueCount (number),
     action (ReactNode — mevcut yukarı/aşağı/sil butonları), children (ReactNode
     — değer listesi + "yeni değer ekle" formu), className (opsiyonel).
   - "use client" ile işaretle.
   - Açık/kapalı state'i useState ile tut, ilk değeri useEffect içinde
     localStorage'dan oku (key: `varyant-ozellik-acik:${attributeId}`).
     Kayıt yoksa varsayılan: valueCount > 6 ise kapalı, değilse açık.
     (SSR/hydration uyuşmazlığını önlemek için: sunucu tarafı ilk render'da
     "açık" varsay, useEffect'te gerçek değeri okuyup gerekirse false'a çek —
     ya da mounted flag'i ile ilk client render'a kadar içerik render etme;
     hangisi bu koddaki mevcut hydration desenine daha uygunsa onu kullan,
     örnek için diğer client bileşenlere (örn. use-dirty-signal.ts) bak.)
   - Başlık satırını tıklanabilir <button> yap: sol tarafta ChevronRight/
     ChevronDown (lucide-react, açık/kapalıya göre), özellik adı, ardından
     value count rozeti (örn. "24 değer" - text-xs text-admin-text-muted).
     Sağ tarafta `action` prop'u (mevcut yukarı/aşağı/sil butonları) —
     bu butonların tıklaması `stopPropagation` ile akordeon toggle'ını
     TETİKLEMEMELİ (butonlar zaten <form> içinde olduğu için event'i
     doğru yerde durdur, örn. action'ı saran bir <div onClick={(e) =>
     e.stopPropagation()}>).
   - `aria-expanded={open}` ve `aria-controls` ekle, içerik div'ine karşılık
     gelen id ver.
   - İçerik (children), sadece open true iken render edilsin (kapalıyken
     DOM'dan tamamen kalksın, sadece CSS ile gizleme değil).
   - Toggle olduğunda localStorage'a yaz.
   - Ayrıca `window`'da "varyant-ozellikleri:hepsi" custom event'ini dinle
     (useEffect + addEventListener), event.detail.open değerine göre kendi
     state'ini ve localStorage kaydını güncelle.

2. Yeni küçük bir client bileşen: src/components/admin/variant-attributes-toggle-all.tsx
   - "Tümünü Aç" ve "Tümünü Kapat" şeklinde iki küçük buton/link render et
     (text-xs, text-admin-accent gibi mevcut stil diline uygun).
   - Tıklanınca `window.dispatchEvent(new CustomEvent("varyant-ozellikleri:hepsi",
     { detail: { open: true|false } }))` çalıştır.

3. page.tsx içinde:
   - Mevcut `Card` kullanımını (özellik seviyesindeki, satır 185-299 civarı)
     `VariantAttributeCard` ile değiştir: title, action (mevcut yukarı/aşağı/
     sil form'ları) ve valueCount={attribute.values.length} prop olarak geç,
     children olarak mevcut değer listesi + "değer ekle" formunu aynen içine al.
   - Sayfa başlığının hemen altına (Card "Özellik Ekle"den önce ya da sonra,
     en uygun yere) `<VariantAttributesToggleAll />` ekle.
   - Değer seviyesindeki `Card` KULLANILMIYOR zaten (düz div'ler) — orada
     değişiklik gerekmiyor, sadece özellik seviyesi akordeon oluyor.

4. Mevcut `Card` bileşenine (src/components/admin/card.tsx) DOKUNMA — proje
   genelinde başka yerlerde de kullanılıyor, bu değişiklik sadece varyant
   özellikleri sayfasına özel yeni bileşenle yapılmalı.

5. Test:
   - `npx tsc --noEmit` ve `npm run build` hatasız tamamlanmalı.
   - Yerel dev sunucuda /admin/ayarlar/varyant-ozellikleri sayfasını aç:
     birden fazla özellik ve en az birinde 7+ değer olacak şekilde test
     verisi ile (yoksa birkaç tane "değer ekle" ile üret), ilk yüklemede
     6'dan fazla değeri olan özelliğin kapalı, azının açık başladığını
     doğrula.
   - Bir kartın başlığına tıklayıp aç/kapa çalıştığını, yukarı/aşağı/sil
     butonlarına tıklamanın akordeonu YANLIŞLIKLA tetiklemediğini doğrula.
   - Açık bir kartta yeni bir değer ekleyip (sayfa server action ile
     yeniden render olacak) o kartın hâlâ açık kaldığını doğrula.
   - Sayfayı yenile (F5): açık/kapalı durumların localStorage'dan
     korunduğunu doğrula.
   - "Tümünü Aç" / "Tümünü Kapat" butonlarının tüm kartları tek seferde
     doğru şekilde değiştirdiğini doğrula.
   - Mobilde (375px) düzenin bozulmadığını kontrol et.

Commit'i mesajıyla birlikte öner ama benim onayım olmadan push etme.
```
