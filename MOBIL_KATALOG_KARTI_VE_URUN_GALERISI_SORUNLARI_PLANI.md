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
- Ana görsele native `touchstart`/`touchend` tabanlı basit bir swipe handler ekle (harici kütüphane
  ekleme, ~20-30 satırlık bir handler yeterli; sınırları aşmasın, swipe sonrası thumbnail'daki aktif
  vurgu senkron kalsın).

### Genel

- Her madde için `npx tsc --noEmit` ve `npm run build` hatasız geçmeli.
- Masaüstü görünümler bu değişikliklerden etkilenmemeli, 1280px/1600px'te de kontrol et.
- Bitince DEPLOY_STATUS.md'ye her zamanki formatta not düş (sorun, kök neden — özellikle Adım 0'da
  bulunan senkron durumu — çözüm, doğrulama). Commit'i öner ama onayım olmadan push etme.
```
