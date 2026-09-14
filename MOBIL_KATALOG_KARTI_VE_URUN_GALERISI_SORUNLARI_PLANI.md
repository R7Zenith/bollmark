# Mobil Görünüm — Katalog Kartı ve Ürün Galerisi Sorunları (Araştırma + Plan)

## ÖNEMLİ DÜZELTME (ilk analizden sonra)

İlk analiz bu bilgisayardaki (`hp4-bilgisayar`) yerel `Bollmark` klasöründeki kod okunarak yapılmıştı.
Kullanıcı canlı siteden (`https://www.bollmark.com/urunler?cinsiyet=Kad%C4%B1n`) bir ekran görüntüsü
paylaştı ve orada **gerçekten kırmızı bir "%34 İNDİRİM" rozeti VE "SON 1 ADET" / "SON 2 ADET" rozetleri
görünüyor** — ikisi de kart sol üstünde. Bu, yerel kodda (`src/components/product-card.tsx`) okuduğum
haliyle **birebir örtüşmüyor**: yerel dosyada indirim rozeti `clay` renginde (rebrand sonrası siyah) ve
"Son N Adet" rozeti diye bir şey hiç yok.

**Sonuç: bu bilgisayarın yerel `main` dalı ile canlıda (Vercel/production) yayında olan kod aynı değil.**
`.git/config` incelendiğinde repo `https://github.com/R7Zenith/bollmark.git`, tek `main` dalı üzerinden
çalışıyor, `README.md`'de de "dükkandaki ve evdeki bilgisayardan senkron çalışma" (git pull/push) akışı
tarif ediliyor — yani muhtemelen:

- Canlıda olan "Son N Adet" + kırmızı indirim rozeti özelliği, bu bilgisayara **hiç `git pull`
  edilmemiş** bir commit'te (başka bir bilgisayardan/oturumdan push edilmiş) VEYA
- Bu bilgisayardaki yerel "Release temasına birebir uyum" çalışması (`RELEASE_TEMA_BIREBIR_UYUM_PLANI.md`,
  13 Eylül) sırasında `product-card.tsx` kasıtlı ya da kazayla bu özelliği içermeyen/değiştiren bir hale
  gelmiş ve bu **henüz push edilmemiş yerel bir değişiklik** (`URUN_GORSELLERI_GENISLIK_ANALIZI.md` ve
  benzeri planların hepsinin sonunda "commit öner, onayım olmadan push etme" notu var — yani push
  edilmemiş epey iş birikmiş olabilir).

Ben bu bilgisayarda git komutu çalıştıramıyorum (bu oturumda `device_bash`/terminal aracı yok, sadece
dosya okuma/yazma var), o yüzden hangisi olduğunu **kesin olarak** söyleyemem — tahmin yürütmeden bunu
Claude Code'un (senin bilgisayarında gerçek terminal erişimiyle) ilk iş olarak doğrulaması gerekiyor.
Aşağıdaki plan buna göre güncellendi: **önce senkron durumu netleştirilecek, ondan sonra mobil
düzeltmeler CANLIDA GERÇEKTEN ÇALIŞAN koda göre yapılacak** (benim yerel dosyalardan çıkardığım analiz
değil).

---

## Ekran görüntüsünden doğrulanan gerçek durum (canlı site, mobil, /urunler?cinsiyet=Kadın)

- Sol üstte iki türden rozet var, aynı konumda (`SON 1 ADET` / `SON 2 ADET` beyaz-siyah metinli pill,
  `%34 İNDİRİM` kırmızı dolgulu pill) — ikisi aynı anda bir üründe görünmüyor gibi duruyor (indirimli
  üründe "son adet" yok, "son adet" olan üründe indirim yok) ama ikisi de görselin üst kısmının önemli bir
  bölümünü kaplıyor, özellikle rozet metni 2 satıra düşünce ("SON 1 ADET" gibi) veya ürün adı kısa olup da
  görsel dar olunca daha da belirginleşiyor.
- Sağ üstte kalp (favori) butonu.
- Sağ altta siyah dairesel "+" butonu — ekran görüntüsünde gerçekten de görseldeki modele göre iri
  duruyor, özellikle dar kartlarda (2 sütun) modelin bacak/vücut hizasına denk geliyor.
- Fiyat hizası: sol üstteki "1.590 TL" (indirimsiz, tek fiyat, tek satır) ile sağdaki "990 TL 1.490 TL"
  (indirimli, iki fiyat yan yana) karşılaştırıldığında, başlık 2 satıra taştığı için fiyat satırı biraz
  daha aşağıda kalıyor gibi duruyor — tam ölçüm gerekiyor ama görünen o ki kod incelemesindeki teorik sorun
  (başlık satır sayısına göre kayan fiyat) ekran görüntüsünde de gözle seçiliyor.

---

## Adım 0 (ZORUNLU, her şeyden önce) — Yerel/canlı senkronu netleştir

Claude Code'un bilgisayarında gerçek `git` erişimi var, benim bu oturumda yok — bu adımı SADECE o
yapabilir, ben burada tahmin ediyorum.

1. `git status` — yerel değişiklik var mı (özellikle `src/components/product-card.tsx`,
   `src/components/product-viewer.tsx`, `tailwind.config.ts`, `src/app/globals.css` gibi bu konuşmada adı
   geçen dosyalarda), commit'lenmemiş mi bak.
2. `git fetch origin` sonrası `git log --oneline HEAD..origin/main` — origin/main'de yerelde olmayan
   commit var mı (yani uzak/canlı, yerelin ÖNÜNDE mi) — varsa bunlar muhtemelen "Son N Adet" + kırmızı
   rozet özelliğini içeriyor olabilir.
3. `git log --oneline origin/main..HEAD` — yerelde olup origin/main'de olmayan commit var mı (yerel,
   uzağın ÖNÜNDE mi, örn. "Release temasına uyum" işi push edilmemiş mi).
4. Vercel tarafında hangi commit'in production'a deploy edildiğini (Vercel dashboard'dan ya da varsa
   `vercel` CLI ile) teyit et — GitHub'daki `origin/main` ile production deploy'un aynı commit olduğundan
   emin ol (bazen production farklı bir branch'ten veya manuel deploy'dan besleniyor olabilir).
5. Bu üçü (yerel HEAD, origin/main, production deploy) arasında fark varsa, bana (kullanıcıya) DURUMU
   ÖZETLE ve nasıl ilerlemek istediğimi sor: örn. önce `git pull` ile "Son N Adet" özelliğini yerel'e
   çekip yerel Release-redesign işiyle uyumlu hale getirmek mi, yoksa iki tarafı manuel karşılaştırıp elle
   birleştirmek mi gerekiyor — bu bir git merge/conflict riski taşıyabilir, kod kaybı olmaması için ONAY
   ALINMADAN hiçbir pull/merge/commit/push YAPMA.
6. Netleşince, aşağıdaki maddelerdeki dosya/satır referanslarını GÜNCEL (senkronlanmış) koda göre tekrar
   doğrula — benim aşağıda verdiğim satır numaraları/kod parçaları 14 Eylül'de bu bilgisayardaki yerel
   dosyalardan alındı, canlıdaki gerçek kod muhtemelen farklı (en azından "Son N Adet" rozeti ve rozet
   rengi konusunda kesinlikle farklı).

---

## 1. Katalog kartında sol üstteki rozetler görseli kapatıyor

### Ekran görüntüsünden doğrulanan

Hem kırmızı "%İNDİRİM" rozeti hem "SON N ADET" rozeti gerçekten var ve sol üst köşede, görsel üzerinde
duruyor — dar mobil kartlarda (2 sütun) görselin üst şeridinin göze çarpan bir kısmını kaplıyor.

### Not (Adım 0'a bağlı)

Bu bölümdeki kesin dosya/satır referansı Adım 0 tamamlanmadan güvenilir değil — "Son N Adet" rozetinin
kodu bu bilgisayarda bulunamadı, muhtemelen henüz pull edilmemiş bir commit'te ya da farklı bir
component'te. Claude Code, Adım 0 sonrası GÜNCEL `product-card.tsx`'i (veya rozetlerin gerçekten
render edildiği hangi dosyaysa onu) bulup buradan devam etmeli.

### Önerilen çözüm (dosya netleşince uygulanacak)

- Rozet(ler) için dar ekranda (`< 400px` gibi) boyut/padding küçültme: `text-[10px] px-2 py-0.5` gibi,
  masaüstünde mevcut boyut korunsun.
- Aynı kartta hem indirim hem stok rozeti aynı anda render edilebiliyorsa (şu an ekran görüntüsünde ikisi
  farklı üründe görünüyor ama kodun ikisini aynı anda göstermesi teorik olarak mümkünse), ikisi üst üste
  binmesin diye dikey olarak alt alta dizilsin (`flex flex-col gap-1`, `absolute left-2 top-2` sarmalayıcı
  içinde), yan yana değil.
- Rozet metni uzunsa (`"SON 1 ADET"` gibi) tek satıra sığdırmak için `whitespace-nowrap` + gerekiyorsa
  font boyutunu biraz daha küçültmek düşünülebilir, ama metni kesme (`truncate`) YAPMA — kullanıcı stok
  bilgisini net okuyabilmeli.
- Kalp butonuyla (sağ üst) çakışma olmadığını (rozet sola, kalp sağa yeteri kadar boşluk bırakarak) dar
  ekranda doğrula.

---

## 2. "+" hızlı sepete ekle butonu mobilde çok büyük

Ekran görüntüsünde de doğrulandı — buton gerçekten iri duruyor. Bu kısım, kodun `product-card.tsx`
dosyasında bulunan `h-9 w-9` butonla (satır ~117-127) tutarlı görünüyor — bu dosyanın canlıdaki hali,
rozetlerin aksine, muhtemelen aynı/benzer (buton konumu/davranışı ekran görüntüsüyle örtüşüyor). Yine de
Adım 0 sonrası kesinleştir.

- `md:opacity-0 md:group-hover:opacity-100` sadece masaüstü hover'ı için; mobilde taban `opacity-100`
  değeri yüzünden buton her zaman görünür ve orantısız büyük kalıyor.
- Mobilde `h-8 w-8` (32px), masaüstünde `md:h-9 md:w-9` (36px) öner.
- İkonu da `size` prop'u yerine Tailwind sınıfıyla responsive yap (`h-3.5 w-3.5 md:h-4 md:w-4`).

---

## 3. Ürün fiyatları kart satırında hizasız

Kod incelemesi (`product-card.tsx` satır ~129-145): başlık (`h3`) için `line-clamp`/sabit yükseklik yok,
`colorLabel` (renk etiketi) koşullu render ediliyor (varsa ekstra satır, yoksa yok) — bu yüzden komşu
kartlarda başlık 1/2 satır olma durumuna göre fiyat satırı farklı yükseklikte kalıyor. Ekran görüntüsünde
de (2 satırlık başlığı olan sağ üstteki kart ile 2 satırlık soldaki kart karşılaştırıldığında) fiyatların
tam hizalı olmadığı seçilebiliyor. Bu kısmın kodu muhtemelen değişmemiştir (rozetler kadar riskli değil)
ama Adım 0 sonrası yine de teyit et.

- `h3`'e `line-clamp-2` + gerçek 2 satırlık yüksekliğe denk gelen `min-h-[...]` ekle (tahmini değer değil,
  tarayıcıda gerçek satır yüksekliğini ölçüp ona göre yaz).
- `colorLabel` alanını boş olsa bile aynı yüksekliği kaplayacak şekilde her zaman render et (yoksa
  `invisible` yap, koşullu render yerine koşullu görünürlük).
- Biri kısa biri uzun isimli iki ürün yan yana geldiğinde fiyat satırlarının aynı hizada durduğunu
  Playwright'la `getBoundingClientRect()` ile ölçüp doğrula.

---

## 4. Ürün detay sayfası — 5'ten fazla fotoğrafta mobil galeri taşıyor, kaydırma/swipe çalışmıyor

Bu madde katalog kartıyla ilgili değil, ürün DETAY sayfasıyla ilgili (ekran görüntüsü bunu göstermiyor,
ayrıca test edilmesi lazım). Yerel `product-viewer.tsx`'te mobil galeri zaten ayrı bir `md:hidden` bloğuna
(tek büyük görsel + altında `overflow-x-auto` kaydırılabilir küçük resim şeridi) ayrılmış, kod yorumunda
"12 Eylül 2026'da release-main.myshopify.com/products/top-8 referans alınarak yazıldı" deniyor — ama
Adım 0 aynı burada da geçerli: bu değişiklik gerçekten canlıya gitmiş mi, yoksa sadece yerel mi belli
değil. Katalog kartındaki "Son N Adet" rozeti sürprizinden sonra, bu konuda da varsayımda bulunmuyorum —
Claude Code önce production'da gerçekten 5+ fotoğraflı bir ürün açıp (senin verdiğin site üzerinden,
telefon boyutunda) davranışı bizzat görsün, sonra yerel koddaki mobil galeri bloğunun bunu çözüp
çözmediğine bakılsın.

- Production'da 5+ fotoğraflı gerçek bir ürün sayfası aç (375-390px), şunları gözlemle:
  - Sayfa yatayda taşıyor mu (`scrollWidth` vs `clientWidth`).
  - Küçük resim şeridi dokunuşla kayıyor mu.
  - Ana büyük görsel parmakla kaydırılınca (swipe) değişiyor mu.
- Eğer yerel `product-viewer.tsx`'teki mobil blok zaten production'da varsa ve hâlâ bozuksa: `md:hidden`
  sarmalayıcıya ve `overflow-x-auto` elemente güvenlik payı olarak `min-w-0` ekle (grid/flex blowout
  riskine karşı), ve ana görsele native `touchstart`/`touchend` ile basit bir swipe handler ekle (şu an
  sadece küçük resme dokununca değişiyor, ana görselde swipe yok).
- Eğer yerel blok production'da yoksa: Adım 0'da zaten netleşmiş olacak (pull/deploy gerekiyor demektir).

### 4a. Kullanıcının ekran görüntüsüyle DOĞRULANAN ek bulgu — aktif küçük resmin çerçevesi tek taraflı kesiliyor

Kullanıcının paylaştığı ekran görüntüsünde (ürün detay sayfası, mobil, 5 fotoğraflı bir ürün) aktif küçük
resmin etrafındaki siyah çerçeve (`ring-1 ring-ink ring-offset-1`, satır ~332) SADECE sağda ve solda
görünüyor, üstte/altta görünmüyor — gözle "sanki fotoğrafın üstü/altı kesiliyormuş" izlenimi veriyor ama
kesilen aslında fotoğraf değil, göstergenin (ring) kendisi.

**Kök neden (kodda doğrulandı, tahmin değil):** Küçük resim şeridinin sarmalayıcısı
(`mt-3 flex gap-2 overflow-x-auto`, satır ~325) sadece yatay eksende `overflow-x-auto` tanımlıyor, DİKEY
boşluk (padding) yok. CSS'in bir kuralı gereği, bir eksen `overflow: visible` DEĞİLSE diğer eksen de
otomatik olarak taşmayı kırpan bir moda geçer — yani bu konteyner dikeyde de fiilen "kırpan" davranıyor.
Aktif küçük resmin `ring-offset-1` + `ring-1` çerçevesi kutunun dışına ince bir gölge olarak taşıyor:
yatayda öğeler arası `gap-2` (8px) sayesinde bu taşan gölgeye yer var (görünüyor), dikeyde ise konteynerin
yüksekliği tam thumbnail yüksekliğine (`aspect-square`, 64px) eşit olduğu için taşan kısım kırpılıyor
(görünmüyor) — asimetrik çerçeve buradan geliyor.

**Çözüm:** `overflow-x-auto` olan konteynere dikey boşluk ekle (`py-1` veya `py-1.5`), ring'in üstte/altta
da taşacak yeri olsun. Tek satırlık, düşük riskli bir düzeltme.

**GÜNCELLEME (2. ekran görüntüsüyle doğrulandı):** py-1 eklenince dikey kesilme muhtemelen düzeldi ama
şimdi EN SOLDAKİ (ilk) küçük resimde ring'in SOL kenarı görünmüyor — aynı mantık yatay eksende de geçerli:
konteynerin scroll alanı ilk öğenin sol kenarına tam yapışık başlıyor, taşan ring solda absorbe edilecek
boşluk bulamıyor (öğeler arası `gap-2` sadece komşu öğeler ARASINDA boşluk sağlıyor, ilk öğenin SOLUNDA ve
son öğenin SAĞINDA değil). **Çözüm:** aynı konteynere yatayda da biraz iç boşluk ekle — `overflow-x-auto`
yanına `px-1` de ekle (`py-1 px-1`, yani kısaca `p-1` de yazılabilir) — böylece ilk/son öğenin ring'i de
kırpılmadan görünür.

### 4c. Küçük resimlerde fotoğrafın kafası/üst kısmı kırpılıyor (kullanıcı ekran görüntüsüyle bildirdi)

Küçük resim kutuları `aspect-square` (satır ~331: `relative aspect-square w-16 shrink-0 overflow-hidden`)
+ `<Image ... className="object-cover" />` kullanıyor. Ürün fotoğrafları dikey/portre oranlı (3:4) olduğu
için kareye `object-cover` ile sığdırılırken üst (kafa) ve alt (ayaklar) kısmı otomatik kırpılıyor — bu
TÜM küçük resimlerde geçerli, tek bir öğeye özel bir hata değil, `aspect-square` + `object-cover`
kombinasyonunun doğal sonucu. Kullanıcı fotoğrafın TAMAMININ görünmesini istiyor.

**Çözüm (iki seçenek, kullanıcıya sorulmalı ya da varsayılan olarak 1. seçenek uygulanmalı):**
1. **Önerilen:** Küçük resim kutusunu ana görselle aynı orana çevir (`aspect-[3/4]`), `object-cover` kalsın
   — kutu artık fotoğrafın gerçek oranıyla eşleştiği için kırpma pratikte ortadan kalkar (kutu biraz daha
   dar/uzun görünür, `w-16` yerine `w-14` gibi biraz daraltılması gerekebilir ki şerit fazla yer kaplamasın).
2. **Alternatif:** Kutuyu kare bırak ama `object-cover` yerine `object-contain` + hafif bir arka plan
   (`bg-line`, zaten var) kullan — fotoğraf küçültülüp kutunun içine TAMAMEN sığar (üstte/altta boşluk
   kalır, "letterbox" görünümü), hiçbir şey kırpılmaz ama kare kutunun içi tam dolmaz.

Release referans sitesinin (release-main.myshopify.com) kendi küçük resimlerinin hangi yaklaşımı
kullandığına bakıp (kare mi, dikey mi) ona göre karar vermek en tutarlı sonucu verir — Claude Code bunu
kontrol edip hangisinin görsel olarak daha iyi durduğuna (ekran görüntüsüyle) karar versin.

### 4b. Kullanıcının istediği ek özellik — iPhone tarzı parmağı takip eden swipe animasyonu

Şu an ana görselde swipe/touch event'i hiç yok (madde 4'te zaten belirtilmişti), sadece küçük resme
dokununca anında (`setActiveImage`) değişiyor. Kullanıcı özellikle **parmağı gerçek zamanlı takip eden**
bir sürükleme deneyimi istiyor (iPhone Fotoğraflar/Instagram tarzı: parmak hareket ettikçe görsel de
canlı kayıyor, bırakınca yumuşak `transition` ile bir sonraki/önceki görsele tam oturuyor ya da yetmezse
geri tepiyor) — bu, basit bir `touchstart`/`touchend` ile index değiştirmekten daha kapsamlı bir iş:
`touchmove` sırasında elle bir `translateX` state'i güncellenmeli (CSS transition KAPALI, anlık takip
için), `touchend`'de eşik (örn. genişliğin %20'si) aşıldıysa komşu görsele `transition` AÇIK şekilde
snap olunmalı, aşılmadıysa mevcut görsele geri dönülmeli.

---

## Claude Code'a verilecek prompt

```
Bollmark storefront'unda mobil görünümde birkaç sorun bildirildi (ekran görüntüsü:
https://www.bollmark.com/urunler?cinsiyet=Kad%C4%B1n — kırmızı "%İndirim" rozeti, "SON N ADET" rozeti,
büyük "+" butonu, hizasız fiyatlar; ayrıca ürün detay sayfasında 5+ fotoğraflı ürünlerde mobil galeri
sorunu iddia ediliyor). ÖNEMLİ: Bu makinede daha önce yapılan bir kod incelemesinde, yerel
`src/components/product-card.tsx` dosyasında "Son N Adet" rozetinin HİÇ bulunmadığı ve indirim rozetinin
rengi için kullanılan `clay` token'ının (tailwind.config.ts) 13 Eylül'deki bir rebrand'de siyaha
eşitlendiği görüldü — yani bu ekranda gördüğümüz canlı site ile bu bilgisayardaki yerel kod BİREBİR AYNI
DEĞİL. Bu yüzden hiçbir CSS değişikliği yapmadan ÖNCE:

### Adım 0 — Senkron durumu netleştir (ZORUNLU, atlanamaz)

1. `git status` çalıştır, commit'lenmemiş yerel değişiklikleri listele (özellikle product-card.tsx,
   product-viewer.tsx, tailwind.config.ts, globals.css).
2. `git fetch origin`, sonra `git log --oneline HEAD..origin/main` (uzakta olup yerelde olmayan commit'ler)
   ve `git log --oneline origin/main..HEAD` (yerelde olup uzakta olmayan commit'ler) çalıştır.
3. Mümkünse (Vercel CLI kuruluysa veya dashboard erişimi varsa) production'a deploy edilen commit hash'ini
   GitHub'daki origin/main ile karşılaştır.
4. Bulguları (yerel HEAD neyin önünde/gerisinde, kaç commit fark var, hangi dosyalarda çakışma riski var)
   bana ÖZETLE ve nasıl ilerlemek istediğimi sor — ÖZELLİKLE eğer hem yerelde push edilmemiş değişiklik
   HEM DE uzakta yerelde olmayan commit varsa (iki taraf da ilerlemiş olabilir, bu bir merge/conflict
   riski demektir). Onayım olmadan git pull/merge/rebase/push YAPMA, bu adımda sadece durum tespiti yap.
5. Ben onay verdikten sonra (pull/merge gerekiyorsa dikkatli birleştir, mevcut yerel "Release temasına
   uyum" çalışmasını kaybetmeden), aşağıdaki maddelere GÜNCEL/senkronlanmış koda göre devam et — aşağıdaki
   satır numaraları ve kod parçaları 14 Eylül'de bu bilgisayarın YEREL diskinden alındı, senkron
   sonrasında değişmiş olabilir, körü körüne uygulama, önce dosyanın güncel halini oku.

### 1. Katalog kartı — sol üstteki rozetler (indirim + "Son N Adet")

Rozetlerin gerçekte hangi dosyada/component'te render edildiğini (senkron sonrası) bul — muhtemelen
`src/components/product-card.tsx` ama "Son N Adet" kısmı pull sonrası gelecek yeni/farklı bir koddan
kaynaklanıyor olabilir. Bulunca:
- Rozet(ler)i mobilde (`< 400px` gibi) biraz küçült (metin/padding), masaüstü boyutu koru.
- İndirim rozetinin rengi `sale` (`#c0392b`, tailwind.config.ts'te tanımlı, ürün detay sayfasındaki aynı
  rozet zaten bunu kullanıyor) ile tutarlı olsun — eğer hâlâ `clay` kullanıyorsa (ki `clay` artık siyaha
  eşit) `sale`'e çevir.
- Aynı kartta iki rozet birden render edilebiliyorsa dikey olarak alt alta dizilsin (yan yana değil, üst
  üste binmesin).
- Rozetle sağ üstteki kalp (favori) butonu arasında dar ekranda da yeterli boşluk olduğunu, görselin
  önemli bir kısmının kapanmadığını Playwright ekran görüntüsüyle (375-390px) doğrula.

### 2. "+" hızlı sepete ekle butonu

`h-9 w-9` olan buton (muhtemelen `product-card.tsx`), `md:opacity-0 md:group-hover:opacity-100` sadece
masaüstü hover'ı için tasarlanmış, mobilde taban opacity-100 yüzünden her zaman görünür ve büyük kalıyor.
Mobilde `h-8 w-8`, masaüstünde `md:h-9 md:w-9` yap; ikonu da Tailwind boyut sınıfıyla responsive yap
(`h-3.5 w-3.5 md:h-4 md:w-4`, `size` prop'u yerine).

### 3. Fiyat hizası

Kart başlığına (`h3`) `line-clamp-2` + gerçek 2 satırlık yüksekliğe denk gelen sabit `min-h` ekle (gerçek
ölçüm yap, tahmini rem değeri kullanma). Renk etiketi (`colorLabel`) satırını, boş olsa bile aynı
yüksekliği kaplayacak şekilde her zaman render et (invisible ile). Biri kısa biri uzun isimli iki ürün
yan yana geldiğinde fiyatların birebir aynı yükseklikte hizalandığını `getBoundingClientRect()` ile ölçüp
doğrula (mobil 2 sütun VE masaüstü çoklu sütun görünümünde).

### 4. Ürün detay sayfası — 5+ fotoğraflı üründe mobil galeri

Production'da (bollmark.com) 5'ten fazla fotoğrafı olan gerçek bir ürün bul, 375-390px'te aç: sayfa yatay
taşıyor mu, küçük resim şeridi kaydırılabiliyor mu, ana görsel swipe ile değişiyor mu — gerçekten gözlemle
(varsayma). Yerel `product-viewer.tsx`'teki `md:hidden` mobil galeri bloğu (tek büyük görsel + üstteki
overflow-x-auto thumbnail şeridi) senkron sonrası hâlâ mevcutsa ve production'da bu sorun gözlemleniyorsa:
- `md:hidden` sarmalayıcıya ve thumbnail şeridine güvenlik payı olarak `min-w-0` ekle.

### 4a. Aktif küçük resmin çerçevesi (ring) kırpılıyor (dikey + yatay)

Kullanıcının iki ekran görüntüsüyle doğrulandı. Sebep: küçük resim şeridinin sarmalayıcısı
(`mt-3 flex gap-2 overflow-x-auto`, satır ~325) hiç iç boşluk (padding) tanımlamıyor — `overflow-x-auto`
CSS kuralı gereği dikey ekseni de otomatik kırpan moda sokuyor (aktif küçük resmin `ring-1 ring-ink
ring-offset-1` çerçevesi kutunun dışına taşan ince bir gölge, üstte/altta bu yüzden kırpılıyor), AYRICA
ilk öğenin SOLUNDA ve son öğenin SAĞINDA da taşan ring'i absorbe edecek boşluk yok (`gap-2` sadece
öğeler ARASI boşluk sağlıyor). Düzeltme: konteynere hem dikey hem yatay iç boşluk ekle —
`overflow-x-auto` yanına `p-1` koy (kısaca `py-1 px-1` yerine). Düzeltme sonrası TÜM küçük resimlerin
(ilk ve son dahil) çerçevesinin 4 kenarda da eşit göründüğünü ekran görüntüsüyle doğrula.

### 4b. Küçük resimlerde fotoğrafın kafası/üst kısmı kırpılıyor

Küçük resim kutuları `aspect-square` (satır ~331) + `object-cover` kullanıyor; ürün fotoğrafları dikey
(3:4) olduğu için kareye sığdırılırken üst (kafa) ve alt (ayak) kısmı otomatik kırpılıyor — TÜM küçük
resimlerde geçerli, tek bir hataya özel değil. Kullanıcı fotoğrafın tamamının görünmesini istiyor.
Önerilen çözüm: kutuyu `aspect-square` yerine `aspect-[3/4]` yap (ana görselle aynı oran, `object-cover`
kalsın — kutu artık fotoğrafın gerçek oranıyla eşleştiği için kırpma büyük ölçüde ortadan kalkar,
gerektiğinde `w-16`'yı biraz daraltmak (`w-14`) şeridin toplam genişliğini dengeler). Uygulamadan önce
release-main.myshopify.com'un kendi küçük resimlerinin hangi oranı kullandığına bakıp ona göre karar ver,
ekran görüntüsüyle bana göster.

### 4c. Ana galeri kaydırması — hazır kütüphaneye geçiş (ÖNEMLİ, önce onay iste)

İlk denemede native `touchstart`/`touchmove`/`touchend` ile yazılan swipe, kullanıcıda "bazen bug
oluşuyor, bir anda geri atıyor, akışkan değil, kasıyormuş gibi" izlenimi bıraktı — elle yazılmış
momentum/snap fiziği ince ayar gerektiren zor bir problem. Bunun yerine, tam bu iş için yazılmış, aktif
geliştirilen bir kütüphaneye geç:

**[Embla Carousel](https://www.embla-carousel.com/) (`embla-carousel-react`, npm'de güncel sürüm 8.6.0)**
— React/Next.js için headless (kendi CSS'ini dayatmıyor, mevcut Tailwind tasarımını koruyabilirsin),
~6kb, akıcı momentum/sürükleme + kesin snap noktaları. Resmi "Thumbnail Sync" örneği ("main image + alt
thumbnail şeridi senkron kayar") tam bu senaryo için hazır referans.
Kaynaklar: [embla-carousel.com](https://www.embla-carousel.com/), [embla-carousel-react npm](https://www.npmjs.com/package/embla-carousel-react), [GitHub](https://github.com/davidjerleke/embla-carousel), [React kurulumu](https://www.embla-carousel.com/docs/get-started/react)

`npm install embla-carousel-react` kur, mevcut native touch handler kodunu SİL, ana görsel için bir Embla
instance + küçük resim şeridi için "thumbnail sync" deseniyle ikinci bir Embla instance bağla (resmi
örnekten uyarla). `md:hidden` mobil bloğun GÖRSEL tasarımını (boyutlar, ring, boşluklar, 4a/4b'deki
düzeltmeler) KORU, sadece kaydırma/senkron mantığını Embla'ya devret. tsc/build hatasız geçmeli.

### 4d. Zoom (lightbox) — büyümüyor, kaydırma yok, ok butonları tıklanamıyor

Kod incelemesi (`product-viewer.tsx` satır ~692-775):

- **Ok butonları neden tıklanmıyor (kök neden bulundu):** Sol/sağ ok butonları (satır ~714-737) ile
  görsel kutusu (satır ~741-767) kardeş elemanlar, hiçbirinde `z-index` yok; görsel kutusu DOM'da
  butonlardan SONRA geldiği için üstte render ediliyor ve mobilde neredeyse ekranın tamamını kapladığı
  için buton alanlarının üzerine biniyor, tıklamaları yutuyor. Düzeltme: ok butonlarına (ve kapat
  butonuna) `z-10` ekle.
- **Yeterince büyümüyor:** Görsel kutusu `h-full max-h-[85vh] w-full max-w-3xl` ile genişlik/yükseklik
  BAĞIMSIZ sınırlanıyor, dış sarmalayıcıda da `p-4` boşluk var; dikey 3:4 fotoğraf mobilde genişlik
  tarafından sınırlanıyor, yükseklikte fazla boş yer kalıyor. Mobilde dış `p-4`'ü azalt (`p-2 sm:p-4`),
  `max-w-3xl`'i mobilde gevşet (`max-w-full`, sadece `md:max-w-3xl`) — `object-contain` zaten kırpmayı
  engelliyor, bu sadece kullanılabilir alanı büyütür.
- **Zoomlu halde kaydırma/pan yok (kullanıcı özellikle bunu istiyor):** Şu an sabit `scale(2)` + tıklanan
  noktaya `transform-origin`, zoomluyken İKİ ayrı davranış da eksik: (1) parmakla zoomlu görüntünün
  içinde gezinme (pan/sürükleme) hiç yok — sadece nereye dokunduğuna göre sabit bir 2x büyütme yapıyor,
  parmağı hareket ettirince görüntü kaymıyor; (2) zoomluyken sağa/sola kaydırınca bir sonraki/önceki
  fotoğrafa geçiş de yok, sadece küçük ok butonları var (ki onlar da z-index hatasından tıklanamıyordu).
  İkisi birden bir "premium" galeri deneyiminin parçası — iPhone Fotoğraflar/Instagram'da da böyle çalışır:
  zoomluyken parmakla gezinebiliyorsun, pan sınırına gelince (görüntünün kenarına dayanınca) devam eden
  bir yatay swipe bir sonraki fotoğrafa geçiriyor.

**GÜNCELLEME — kullanıcı "Embla'yı zaten kurmuşken zoomlu halde de onu kullanamaz mıyız" diye sordu,
araştırıldı:** Embla Carousel'in kendisinde **pinch-zoom/pan desteği YOK** — bu, kütüphanenin kendi GitHub
deposunda açık bir özellik isteği olarak duruyor, henüz eklenmemiş
([Discussion #828 "Add robust pinch zoom support"](https://github.com/davidjerleke/embla-carousel/discussions/828),
ayrıca [Discussion #269 "Embla lightbox"](https://github.com/davidjerleke/embla-carousel/discussions/269)
de aynı şekilde "henüz yok, resmi bir lightbox çözümü de yok" diyor). Yani Embla'yı SADECE zoom için
kullanmak mümkün değil — ama zoomlu ekranda "sonraki/önceki fotoğrafa geçiş" (swipe) kısmı için Embla
zaten birebir uygun (bu, ana galeride yaptığı işin aynısı) — o yüzden tam kütüphane değişimi yerine daha
hafif bir hibrit öneriliyor:

**Önerilen (daha hafif, Embla'yı tekrar kullanan) yaklaşım:**
1. Lightbox'taki görsel geçişini (sonraki/önceki) AYRI bir Embla instance'ı ile yap — ana galeride
   kurulan aynı deseni burada da kullan (istersen aktif index'i ana galeri ile senkron tut).
2. SADECE pinch-zoom + pan (görüntünün içinde parmakla gezinme) için küçük, bu işe özel bir kütüphane
   ekle: **[react-zoom-pan-pinch](https://github.com/BetterTyped/react-zoom-pan-pinch)**
   (`npm install react-zoom-pan-pinch`, aktif geliştiriliyor, `<TransformWrapper>`/`<TransformComponent>`
   ile herhangi bir görseli pinch/pan/wheel-zoom yapılabilir hale getiriyor, React'e özel, hafif).
   Kaynaklar: [npm](https://www.npmjs.com/package/react-zoom-pan-pinch), [GitHub](https://github.com/BetterTyped/react-zoom-pan-pinch)
3. Davranış: görsel zoom seviyesi 1x (varsayılan) iken Embla'nın kendi swipe'ı aktif olsun (sonraki/önceki
   fotoğrafa geçer); kullanıcı 1x'ten büyük zoom yaptığı an (`react-zoom-pan-pinch`'in `onZoomChange` gibi
   bir callback'i) Embla'nın swipe'ını GEÇİCİ olarak devre dışı bırak (Embla'nın `reInit`/`plugins`
   API'siyle ya da basitçe zoom>1 iken dokunma olaylarını `react-zoom-pan-pinch`'e bırak) — kullanıcı pan
   sınırına dayanıp zoom'u 1x'e geri döndürünce (double-tap veya pinch-out ile) Embla swipe'ı tekrar aktif
   olsun. Bu, "zoomluyken pan, zoom'dan çıkınca yine fotoğraflar arası swipe" davranışını, tam otomatik
   swipe-to-next-while-zoomed kadar "sihirli" olmasa da, çok daha az entegrasyon riskiyle verir.

**Alternatif (daha az entegrasyon işi ama Embla'yı YİNE DE kullanmayan, ayrı bir hazır lightbox):**
**[Yet Another React Lightbox](https://yet-another-react-lightbox.com/)** — [Zoom eklentisi](https://yet-another-react-lightbox.com/plugins/zoom)
zoomluyken hem pan hem sonraki/önceki görsele swipe geçişini TEK PAKET içinde, hazır/test edilmiş olarak
veriyor (kullanıcının orijinal "swipe zoomluyken de çalışsın" isteğine en pürüzsüz cevap budur), ama
Embla'dan ayrı bir ikinci carousel motoru eklemiş olursun. Kaynaklar: [ana sayfa](https://yet-another-react-lightbox.com/), [npm](https://www.npmjs.com/package/yet-another-react-lightbox), [GitHub](https://github.com/igordanchenko/yet-another-react-lightbox)

**Benim önerim:** Kullanıcı hafiflik/tek kütüphane istiyorsa 1. seçenek (Embla + react-zoom-pan-pinch
hibrit); "zoomluyken swipe-to-next" davranışının kusursuz/native-app-gibi çalışması en önemliyse 2.
seçenek (Yet Another React Lightbox). Claude Code'a hangisini istediğimi netleştirip ona göre kurmasını
söylemek en doğrusu.

### Not — yeni bağımlılık eklemeden önce onay al

4c ve 4d yeni npm paketleri (`embla-carousel-react`, `yet-another-react-lightbox`) eklemeyi öneriyor —
Claude Code kuruluma geçmeden önce bunu bana bir kez daha teyit ettirsin (ikisini de mi istiyorum, yoksa
sadece biri mi), sonra kurup uygulasın.

### Genel

- Her madde için `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
- Masaüstü görünümler bu değişikliklerden etkilenmemeli, 1280px/1600px'te de kontrol et.
- Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş (sorun, kök neden — özellikle Adım 0'da
  bulunan senkron durumu — çözüm, doğrulama). Commit'i öner ama onayım olmadan push etme.
```
