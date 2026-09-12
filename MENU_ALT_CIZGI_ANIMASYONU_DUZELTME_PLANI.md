# Üst Menü Alt Çizgi Animasyonu — Eksik Uygulama ve Düzeltme Promptu

## Tespit edilen sorun

`RELEASE_TEMA_BIREBIR_UYUM_PLANI.md` (Adım 1.3 / 1.1 tekrarı) release
temasından ölçülen hover alt-çizgi tekniğini şöyle tanımlıyor:

```css
.nav-underline {
  background-image: linear-gradient(currentColor, currentColor);
  background-repeat: no-repeat;
  background-position: 0 100%;
  background-size: 0% 1px;
  transition: background-size 0.4s ease;
}
.nav-underline:hover { background-size: 100% 1px; }
```

Bu class `src/app/globals.css` içine eklenmiş (satır 61-71) — bu kısım
yapılmış. Ama `src/components/site-header.tsx` içinde `nav-underline`
class'ı sadece **mega-menu panelinin içindeki alt kategori linklerine**
uygulanmış (`GROUP_LINK_CLASS` / `GROUP_LINK_ACTIVE_CLASS`, satır 27-28).

Asıl istenen yer — üst menüdeki **"Tüm Ürünler", "Kadın", "Erkek",
"Aksesuar"** sekmeleri (`DesktopNav` bileşeni, satır 245-284) —
`linkClassName` şu an:

```
"flex items-center gap-1 text-[10px] font-normal uppercase tracking-[1.4px] hover:text-clay"
```

Yani bu dört ana linkte `nav-underline` hiç yok; sadece renk değişiyor
(`hover:text-clay`), alt çizgi animasyonu yok. Plan dosyasına yazılmış
olması ("uygulandı") aslında sadece panel-içi linkler için doğruymuş,
ana menü sekmeleri unutulmuş.

## Dikkat edilmesi gereken teknik detay

`nav-underline` bir `background-image`/`background-size` tekniği olduğu
için elementin **sadece metni** sarması gerekiyor — `inline-block` ile
kullanılmalı (panel linklerinde de öyle yapılmış). `DesktopNav`'daki
linkler ise `flex items-center gap-1` ile hem metni hem chevron ikonunu
sarıyor; `nav-underline` doğrudan bu `<Link>`'e eklenirse çizgi ikonun
altına kadar uzar, bu da istenmeyen bir görünüm olur. Bu yüzden
class'ı `<Link>`'in kendisine değil, içindeki metni saran ayrı bir
`<span className="nav-underline inline-block">` öğesine eklemek gerekiyor;
"Tüm Ürünler" linkinde (chevron'suz) direkt `<Link>` üzerine de
uygulanabilir ama tutarlılık için orada da span kullanmak daha temiz.

## Claude Code'a verilecek prompt

```
RELEASE_TEMA_BIREBIR_UYUM_PLANI.md'de tanımlanan .nav-underline hover
animasyonu (globals.css'e eklenmişti, satır ~61-71) sadece mega-menu
panelinin içindeki alt kategori linklerine (GROUP_LINK_CLASS /
GROUP_LINK_ACTIVE_CLASS) uygulanmış — asıl istenen üst menü sekmelerinde
("Tüm Ürünler", "Kadın", "Erkek", "Aksesuar") eksik kalmış. Bunu
src/components/site-header.tsx içindeki DesktopNav bileşeninde tamamla:

1. DesktopNav'daki linkClassName'i ("flex items-center gap-1 text-[10px]
   font-normal uppercase tracking-[1.4px] hover:text-clay") değiştirme —
   bu class flex container'da kalsın (chevron hizalaması için gerekli).
2. Her linkin görünen metnini ("Tüm Ürünler", tab.label) bir
   <span className="nav-underline inline-block"> içine al, nav-underline
   class'ını Link'in kendisine DEĞİL bu span'a ekle — çünkü nav-underline
   background-size tekniği kullanıyor ve chevron ikonunu da sarmasını
   istemiyoruz, sadece metnin altına çizgi çizilsin.
3. Aktif/açık durumdaki sekme (openMenu === tab.key veya aktif
   kategori/cinsiyet seçiliyken, mevcut text-clay mantığına benzer) için
   panel linklerindeki GROUP_LINK_ACTIVE_CLASS deseninde olduğu gibi
   ayrı bir stil gerekip gerekmediğini kontrol et — şu an DesktopNav'da
   "aktif" durumu için ayrı bir class yoksa bunu ekleme, sadece hover
   animasyonunu tamamla.
4. Test: npx tsc --noEmit ve npm run build hatasız tamamlanmalı. Yerel
   scratchpad'de Playwright ile 1280/1600px genişlikte "Tüm Ürünler",
   "Kadın", "Erkek", "Aksesuar" üzerine hover yapılınca alt çizginin
   soldan sağa açıldığını (background-size 0% → 100% transition)
   doğrula, chevron ikonunun altına çizgi uzamadığını ekran görüntüsüyle
   kontrol et.
5. Bulguları ve öncesi/sonrası ekran görüntülerini özetle paylaş.
6. DEPLOY_STATUS.md'ye bu işin özetini not düş (proje talimatı gereği).

Commit'i öner ama benim onayım olmadan push etme.
```
