# Reklam videosu şablonu: durum notu (YARIM İŞ)

Son güncelleme: 27 Kasım 2026. Bu iş başka bir bilgisayardan devam etsin diye yazıldı.
**Claude: bu dosyayı baştan sona oku, sonra "Kalan adımlar"dan devam et.** Kullanıcıya Türkçe yaz.

## Nerede kaldık

- Yazılan tek kod: `lib/akis.mjs`. Meta ürün akışını okuyor (önce `localhost:3000/feed/meta.xml`, sonra `bollmark.com/feed/meta.xml`) ve varyantları "ürün kodu + renk" birimine topluyor. Fiyat `sale_price` varsa o, yoksa `price`. Bedenler arası fiyat farkı `fiyatTekDegil` ile işaretleniyor (27 Kasım'da hiçbir üründe yoktu).
- Denendi: 721 ürün+renk birimi var. Kurallara (stokta, en az 3 beden stokta, sezon "Yaz" değil, en az 3 foto) uyan 294 birim var.
- Henüz yazılmayanlar: şablon HTML, görsel analizi, `oner` / `uret` komutları, müzik, kalite kontrolü, kayıt, SKILL.md, RAPOR.md. Video üretilmedi.
- Bu iş `video-sablon` dalında. `main`'e alınmadı. Kullanıcı söylemeden `main`'e merge ve push yok.

## Alınan kararlar ve bulgular

| Konu | Karar | Gerekçe |
|---|---|---|
| Motor | HyperFrames 0.9.100 (`npx hyperframes`), GSAP 3.15 | Apache-2.0, ticari kullanıma açık. Kullanıcı istedi. |
| onetake | **Kullanılmıyor** | Lisansı PolyForm Noncommercial 1.0.0. Mağaza reklamı ticari kullanımdır. Kullanıcı "ticari kullanmayacağız" dedi, ancak satış reklamı tanım gereği ticari olduğu için reddedildi ve gerekçesi açıklandı. "hizli-tanitim" türü onetake olmadan, HyperFrames ile kurulacak. |
| Müzik | Kodla sentezlenen özgün müzik (numpy/scipy, önceki örnek: `../acilis-50-reels/scripts/ses-uret.py`), ayarla müziksiz üretim, ve kaynak+lisans alanı zorunlu bir `muzik/lisanslar.json` (lisansı olmayan dosya reddedilir) | HeyGen müzik kataloğu girişe bağlı ve Meta reklam lisansı belgesiz. MusicGen ağırlıkları CC BY-NC. media-use'un hazır SFX'leri Pixabay lisanslı (ticari serbest, `~/.claude/skills/media-use/audio/assets/sfx/CREDITS.md`). Alternatif: Meta Reklam Yöneticisi'nin kendi müzik kütüphanesi. |
| Registry | Tarifleri kendi şablona uyarla: `soft-blur-in` ve `shared-axis-y` (başlık girişleri), `directional-wipe`'ın clip-path maske mantığı (RGB ayrışma ve parlama olmadan), `line-swap` (maskeli satır değişimi), `logo-brand-close` fikri (PNG logo ile) | Sıfırdan efekt yazmadan önce registry'ye bakıldı. Ucuz parlama efektleri yasak. |
| Palet | krem `#F2EDE5`, mürekkep `#151413` / `#111111`, vurgu kahve `#7A5A45`, stone `#65706E`, site görsel zemini `#F2F1EF` | Instagram görsellerinden (`docs/instagram-duyuru/`) ve `tailwind.config.ts`'ten ölçüldü. Kicker yazıları geniş aralıklı büyük harf, kahve renk. |
| Font | Poppins 700–800 (site fontu, HyperFrames'te paketli) | Kullanıcı kuralı. |
| Logo | `public/logo.png` (siyah) ve `public/logo-white.png`, 1400×273 RGBA | |
| Yeni gelenler | Akış sırası (`merchant-feed.ts`: `orderBy createdAt desc`), küçük `sira` = yeni | Akışta tarih alanı yok, DB okunmuyor. |
| Öneri dışı | İç Giyim, Boxer, Mayo & Bikini | Meta reklam politikası riski. Rapora yazılacak. |
| Fotoğraflar | 2:3 ve ~3:4 oranlı. Çoğu açık gri ya da beyaz düz zemin; bir kısmı stüdyo dışı arka planlı. Manken üstünde, ürün tek başına ve detay yakın çekim karışık. Görseller Node `fetch` ile iniyor (Python urllib 403 alıyor). | Kırpma için sharp ile ürün sınır kutusu bulunmalı, ürün kesilmeden sığdırılmalı, boşluk kenar rengiyle doldurulmalı. |
| sharp | Kök `node_modules/sharp` (repo içindeki script'ten bare `import "sharp"` ile çözülür) | |
| Kalıcı talimat | `.claude/skills/bollmark-video/SKILL.md`. `.claude/skills/` artık Git'te (.gitignore'da `.claude/*` + `!.claude/skills/`) | İki bilgisayardan çalışılabilsin diye. |

## Kalan adımlar

1. `package.json` (bu klasör): `hyperframes@0.9.100` sabit. Köke `video:oner` ve `video` script'leri.
2. Görsel analizi (`lib/gorsel.mjs`): indir ve önbelleğe al (`.onbellek/`), boyut, kenar rengi ve tekdüzelik, ürün sınır kutusu, en güçlü / model / arka / detay fotoğrafını seçme.
3. Şablon (`sablon/`): tek-urun, kategori, yeni-gelenler, fiyat-araligi, hizli-tanitim. Her biri 1080×1920 ve 1080×1350, 30 fps.
4. `scripts/oner.mjs` ve `scripts/uret.mjs`. Render: `npx hyperframes render --quality delivery`. 30 MB altı, H.264.
5. Kalite kontrolü: en kalabalık 4 kare, güvenli alan, fiyat-akış karşılaştırması, ffprobe, -14 LUFS, `kontrol.jpg`.
6. `docs/reklam/video-kaydi.md`, SKILL.md, `RAPOR.md`, localhost önizlemesi, ilk teslim (3 tek-urun + 1 kategori).
7. Kökteki `.gitignore`'a `Claude outputs/videolar/` zaten eklendi.

## Yeni bilgisayarda bir kerelik kurulum

- Node 22 veya üstü, FFmpeg/ffprobe (PATH'te), Python 3 + `pip install numpy scipy pillow`.
- `git fetch && git checkout video-sablon && npm install` (kök).
- HyperFrames skill'leri global (`~/.claude/skills/`), bu yüzden repoda yok: `npx hyperframes skills update` (ya da `npx skills add heygen-com/hyperframes`). Gerekenler: hyperframes, hyperframes-cli, hyperframes-registry, media-use.
- `.env` gerekmez. Ürün verisi bollmark.com akışından gelir.

## Kullanıcının asıl brifi (27 Kasım 2026, aynen)

> Bollmark için sürekli kullanılacak bir reklam videosu ŞABLONU kurmanı istiyorum. Amaç: Instagram/Facebook reklamları için her hafta 5–10 yeni video üretmek; videolar profesyonel, hatasız, dikkat çekici olmalı, asla amatör görünmemeli. Ben bundan sonra yalnız "yeni video" diyeceğim, sen gerisini bileceksin.
>
> KULLANILACAK ARAÇLAR
> - Ana motor: hyperframes ve hyperframes-cli skill'leri (HTML + GSAP). Geçişler ve hareketli yazılar için hyperframes-registry bloklarını kullan; sıfırdan efekt yazmadan önce registry'de uygun blok ara.
> - Müzik ve ses efekti: media-use. Yalnız reklamda ticari kullanımı açıkça serbest lisanslı müzik kullan; her parçanın kaynağını ve lisansını rapora yaz. Lisansı net olmayan hiçbir şeyi kullanma. Uygun müzik bulunamazsa videoyu müziksiz de üretilebilir yap (ayar ile).
> - İkinci stil olarak onetake skill'ini incele; uygun görürsen "hızlı tanıtım" türünü onunla kur, gerekçeni rapora yaz.
> - HyperFrames bir yerde yetersiz kalırsa remotion-video'ya geçmeden önce bana sor.
>
> GENEL KURALLAR
> - Önce DEPLOY_STATUS.md, docs/reklam/ klasörü, tailwind.config.ts, public/logo.png ve public/logo-white.png dosyalarını incele. Sitenin renklerini, yazı tiplerini ve logosunu kullan; videolar Instagram'daki kurumsal görünümle ve siteyle aynı kimlikte olmalı.
> - Şablonun kaynak dosyaları: docs/reklam/video-sablon/. Üretilen videolar: "Claude outputs/videolar/YYYY-AA-GG/" (Git'e girmez; .gitignore'a ekle). node_modules ve ara dosyalar da Git'e girmesin.
> - Veritabanına hiçbir şey yazma. Ürün verisini yalnız okumak için Meta ürün akışını kullan: önce http://localhost:3000/feed/meta.xml, çalışmıyorsa https://bollmark.com/feed/meta.xml. Fiyat, eski fiyat, stok, beden, görseller, cinsiyet, kategori ve sezon (custom_label_1) buradan gelir. Hiçbir fiyatı elle yazma. Veritabanı şeması değişecek bir şey gerekirse dur ve bana sor (Neon'da canlı ve yerel aynı veritabanı).
> - Önce localhost'ta önizlemesini aç ve bana göster. Ben "yerel commit at" demeden commit yok. Ben söylemeden push yok. Commit'ten önce DEPLOY_STATUS.md'yi güncelle.
>
> VİDEO TÜRLERİ (her biri 9:16 1080×1920 ve 4:5 1080×1350, 30 fps, H.264, her dosya 30 MB altı)
> 1. tek-urun (8–12 sn): tek ürün. Kanca ilk 1,5 saniyede: ürünün en güçlü fotoğrafı tam ekran, hızlı yaklaşma ve büyük başlık. Sonra 3–4 fotoğraf (model üstünde, arka, kumaş yakın çekimi), her biri hareketli (yavaş yaklaşma, maske geçişi, detaya yakınlaşma). Ardından fiyat kartı, en sonda logo ve bollmark.com.
> 2. kategori (12–15 sn): bir kategoriden 4–6 ürün (ör. kışlık montlar). Her ürün kendi fiyatıyla, kategori başlığı açılışta.
> 3. yeni-gelenler (10–15 sn): son eklenen ürünlerden 4–6 tanesi, "Yeni gelenler" başlığı.
> 4. fiyat-araligi (12–15 sn): belirli bir fiyatın altındaki 4–6 ürün (ör. "1.000 TL altı"). Eşik ayar olsun.
> 5. (onetake uygun bulunursa) hizli-tanitim: kinetik yazılı 10–15 sn ürün tanıtımı.
>
> TASARIM KURALLARI (kesin)
> - Kurumsal, sade, premium moda markası görünümü. Kalabalık, renk cümbüşü, clipart, ucuz parlama efekti yok.
> - Tüm yazılar kalın sans-serif (sitenin başlık fontu; yoksa Poppins 700–800). İnce ve italik font yok. Vurgu renkle yapılır.
> - Yazılar okunacak kadar uzun ekranda kalır: kısa başlık en az 1,2 sn, fiyat kartı en az 1,5 sn.
> - Instagram güvenli alanları (9:16): önemli yazı ve logo yanlardan en az 80 px, üstten en az 230 px, alttan en az 380 px içeride. 4:5'te kenarlardan en az 60 px.
> - Ürün fotoğrafları kırpılırken ürün asla kesilmez; gerekirse fotoğrafın kenar rengiyle doldurulur.
> - Fiyat yalnız akıştaki güncel satış fiyatıdır, sonuna " TL" eklenir. Üstü çizili eski fiyat ve "% indirim" yazısı YOK (indirim mevzuatı riski). Kampanya yazısı yalnız ben istersem eklenir.
> - Kargo satırı: "1.500 TL ve üzeri siparişte kargo ücretsiz". Başka vaat yok (ücretsiz iade, kapıda ödeme, en ucuz vb. yazma).
> - Başka markaların logoları videonun ana öğesi olmaz; ürün adı videoda marka adı olmadan yazılabilir.
> - Türkçe karakterler (ç ğ ı İ ö ş ü) her yerde doğru görünmeli.
>
> ÜRÜN SEÇİMİ YARDIMCISI
> - "npm run video:oner" gibi bir komut kur. Akıştan şu koşullara uyan ürünleri listelesin: stokta, en az 3 bedeni stokta, sezonu "Yaz" olmayan, en az 3 fotoğrafı olan. Her ürünün kodu, adı, markası, fiyatı, stoktaki beden sayısı, fotoğraf sayısı ve son video tarihi görünsün.
> - Son 14 günde videosu yapılmış ürünleri öneride en alta koy.
> - Önerilerde tek markaya ya da tek kategoriye yığılma olmasın.
>
> ÜRETİM KOMUTU
> - Tek komutla üretim: ör. "npm run video -- --tur tek-urun --urun KOD1,KOD2,KOD3" ve "npm run video -- --tur kategori --kategori Mont --adet 5". Her ürün ya da set için 9:16 ve 4:5 dosyaları üretsin.
> - Dosya adı: tur_urunkodu_9x16.mp4 / tur_urunkodu_4x5.mp4 (setlerde tur_kategori-adi_...).
>
> KALİTE KONTROLÜ (her üretimde otomatik, geçmeyen video teslim edilmez)
> - Her video için en kalabalık 4 karenin tam boy görüntüsünü al ve kendin incele: taşan ya da kesilen yazı, güvenli alan dışında yazı, kesilen ürün, bozuk Türkçe karakter, logo hatası, boş kare, siyah kare.
> - Videodaki fiyatı akıştaki fiyatla karşılaştır.
> - ffprobe ile ölçü, süre, fps, dosya boyutu kontrolü. Ses varsa loudness -14 LUFS civarına normalize.
> - Tüm kontrol karelerini tek bir temas sayfasında (kontrol.jpg) birleştir ve video klasörüne koy.
>
> KAYIT
> - Her üretimi docs/reklam/video-kaydi.md dosyasına ekle: tarih, tür, ürün kodları, dosya adları, müzik ve lisansı.
>
> KALICI TALİMAT DOSYASI (çok önemli)
> - .claude/skills/bollmark-video/SKILL.md dosyasını yaz. Ben ileride yalnız "yeni video" ya da "yeni video: 3 tek ürün + 1 kategori" dediğimde bu dosya yüklenmeli ve şunları bilmeli: şablonun yeri, komutlar, ürün seçim kuralları (ürün belirtmezsem öneri komutunu çalıştırıp çeşitli 3 tek ürün + 1 set seç ve bana listeyi göster), tasarım kuralları, kalite kontrolü, kayıt, git kuralları. "Ne yapayım?" diye sormadan, seçimi gösterip üretime geçsin; yalnız bir kural belirsizse sorsun.
> - Skill açıklamasında "yeni video", "video üret", "reklam videosu" ifadeleri geçsin ki otomatik yüklensin.
>
> İLK TESLİM
> - Şablonu kur, öneri komutunu çalıştır, kendi seçtiğin 3 tek-urun videosu (biri kadın dış giyim, biri erkek ürün, biri ayakkabı ya da aksesuar) ve 1 kategori videosu üret. Hepsini localhost önizlemesinde ve dosya olarak göster.
> - Rapor: docs/reklam/video-sablon/RAPOR.md (kullanılan araçlar ve gerekçe, müzik lisansları, üretim komutları, kontrol sonuçları, bilinen sınırlar).

## Kullanıcı tercihleri (bu bilgisayarın Claude hafızasından)

- Kullanıcıya her zaman Türkçe yaz.
- Arayüz animasyonları "reduced motion" ayarında da oynar.
- Oturum özetleri `docs/gunluk/YYYY-AA.md` dosyasına eklenir. `DEPLOY_STATUS.md` yalnız kısa güncel durum sayfasıdır. Gerçek gizli değerler `DEPLOY_STATUS.md`'ye yazılmaz.
