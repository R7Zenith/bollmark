# Ürün Detay Sayfası – İade/Değişim, Ürün Bakım Talimatı, Beden Tablosu Planı (v2)

> v1'den farkı: Kullanıcı bakım talimatının Koton'dan BİREBİR alınmasını istedi (v1'de "kopyalamayalım, kendi metnimizi yazalım" önerilmişti — bu karardan vazgeçildi). Ayrıca İade ve Değişim + Ürün Bakım Talimatı butonlarının ürün açıklamasının hemen altına taşınması istendi. Beden Tablosu için Koton canlı sitesinden (tarayıcıyla) gerçek içerik çekildi.

## Kullanıcıyla netleşen kararlar (bu turda)

1. **Ürün Bakım Talimatı metni:** Koton'dan birebir alınacak (aşağıda tam metin var, canlı siteden tarayıcı ile çekildi — sadece küçük temizlik/düzeltme yapıldı, örn. fazla boşluklar). Marka adı geçen bir ifade yok, metin zaten markadan bağımsız genel bir "bakım rehberi" — olduğu gibi kullanılabilir.
2. **Buton konumu:** "İade ve Değişim" ve "Ürün Bakım Talimatı" satırları artık Beden Tablosu/Ürün Detayları accordion'larının yanına değil, **ürün açıklamasının (descriptionHtml + "Devamını Oku") hemen altına** taşınıyor.
3. **Beden Tablosu — önemli bulgu:** Koton'da "Beden Tablosu" satırına tıklayınca açılan şey, BU ürüne özel bir tablo değil — Koton'un TÜM kategorileri (Kadın/Genç/Erkek/Kız Çocuk/Erkek Çocuk/Bebek/Büyük Beden) ve her kategöri altında 9 alt tip (Üst Giyim/Elbise/Mayo/İç Giyim Alt/Alt Giyim/Denim Alt/Denim Üst/İç Giyim Üst/Kemer) için ayrı ayrı vücut ölçü tablosu içeren DEV bir genel beden rehberi modalı (~60 farklı tablo, ölçüm nasıl yapılır görselleriyle birlikte). Bu, tek bir ürünle ilgili değil, Koton'un tüm kataloğu için ortak bir referans aracı.
   - Bunu birebir kopyalamak (60 tabloyu tek tek girmek) bu oturumun kapsamını fazlasıyla aşıyor ve Bollmark'ın kendi ürün kategorileriyle (ayakkabı, valiz, aksesuar, çeşitli marka giyim) bire bir örtüşmüyor — Koton'da "Ayakkabı" kategorisi bile yok.
   - Bunun yerine, sayfada zaten AYRICA duran ve bu ürüne özel olan basit tablo kopyalandı: **"Ürün Ölçü Tablosu (cm)"** — Beden (34/36/38/40) sütunları, Boy/Bel/Basen satırları. Bu, Bollmark'ta zaten var olan `sizeGuide` serbest metin alanına admin tarafından pipe (`|`) ile girilip tabloya çevrilecek olan yapının BİREBİR KOTON BİÇİMİ. Aşağıda örnek veri var.
   - Koton'un dev çok-kategorili genel beden rehberini de birebir istiyorsanız (60 tablo + ölçüm görselleri), bu ayrı ve daha büyük bir iş — istersen bir sonraki turda sadece o konuya odaklanan ayrı bir plan çıkarabilirim.

---

## İÇERİK 1 — İade & Değişim (drawer)

Koton canlı sitesinden birebir (sadece "Koton" marka adı geçen kısımlar olduğu gibi bırakıldı, sen Claude Code promptunda Bollmark'a uyarlatacaksın — bkz. aşağıdaki prompt'taki not):

```
İnternet mağazamızdan yapılan alışverişleri, gönderi tarihinden itibaren 30 gün içinde iade edebilirsiniz.

İadesi Mümkün Olmayan Ürünler:
İç giyim alt parçaları, mayo ve bikini altları iadesi mümkün olmayan ürünlerdir. Bu ürünler sağlık ve hijyen açısından uygun olmamasından dolayı iade ve değişim kapsamına girmemektedir. Makyaj malzemeleri, küpe, takı, tek kullanımlık ürünler, çabuk bozulma tehlikesi olan veya son kullanma tarihi geçme ihtimali olan ürünler ve parfüm gibi ürünler ambalajının açılmış olması halinde iadesi mümkün olmayan ürünlerdir.

İade Seçenekleri

Mağazadan İade
Franchise mağazalarımız hariç tüm Türkiye mağazalarımızdan ürünlerinizi kolayca iade edebilirsiniz.

Kargo ile İade
Hesabım alanından Siparişlerim sayfasına girerek iade etmek istediğiniz ürün için iade talebi oluşturun.
İade talebi oluşturduktan sonra size özel bir Kolay İade Kodu oluşturulacaktır.
Dilediğiniz kargo şubesine Kolay İade Kodu numaranızı bildirerek ÜCRETSİZ olarak ürünü teslim etmeniz yeterlidir. Ayrıca iade adresi belirtmeniz gerekmez.
Ürünü teslim ettikten sonra kargo takip numaranızı kargo görevlisinden almayı unutmayınız.

Üyeliksiz Verilen Siparişler
Siparişinizi üyelik oluşturmadan verdiyseniz, iade işleminizi gerçekleştirebilmek için siparişinizle aynı e-posta adresini kullanarak kolayca üyelik oluşturabilirsiniz. Üyeliğinizi oluşturduktan sonra Hesabım alanındaki Siparişlerim sayfasından iade talebinizi oluşturabilir ve size özel Kolay İade Kodu ile ürününüzü dilediğiniz kargo şubelerine ÜCRETSİZ olarak teslim edebilirsiniz.

Değişim İşlemleri
Ürün değişimlerinizi tüm Türkiye mağazalarımızdan gerçekleştirebilirsiniz.

Daha fazla bilgi için Sıkça Sorulan Sorular bölümünü inceleyebilirsiniz.
```

> NOT: "Franchise mağazalarımız hariç tüm Türkiye mağazalarımızdan" ve "tüm Türkiye mağazalarımızdan" ifadeleri Koton'un yüzlerce mağazası olduğu için anlamlı — Bollmark'ın tek mağazası (Karacabey) var. Claude Code promptunda bu iki cümlenin Bollmark'ın gerçek durumuna göre (tek mağaza adı geçecek şekilde veya kaldırılacak şekilde) hafifçe uyarlanması istendi, geri kalan metin birebir.

---

## İÇERİK 2 — Ürün Bakım Talimatı (drawer)

Koton canlı sitesinden birebir (marka/ürün adı geçmiyor, tamamen genel bir metin — hiç değiştirmeden kullanılabilir):

```
Genel Bakım Uyarıları: Ürünlerin Doğru Bakımı

Çevreyi ve doğal kaynaklarımızı korumanın ilk adımlarından biri, ürün ve giysi bakımında önerilen talimatları doğru bir şekilde uygulamaktır. Ürünlere uygun bakım ve yıkama talimatlarını uygulayarak çevremizi ve kaynaklarımızı korumanın yanı sıra giysilerin kullanım ömrünü uzatma şansı da yakalayabiliriz. Satın aldığınız ürünün her yıkama sonrası ilk günkü gibi canlı bir görünüme sahip olması için yapmanız gerekenlere bakacak olursak;

1. Ürün Etiketlerine Önem Verin: Giysi veya ürünlerinizin bakım etiketlerini hem satın alma aşamasında hem de bakım ve yıkama işlemi öncesinde dikkatlice incelemek doğru bakım sürecinin ilk adımı olacaktır. Bu etiketler, ürünlerin kumaş yapısına uygun bakım ve yıkama talimatları içerir. Ürünlere uygulayabileceğiniz işlemler, yıkama ve bakım önerilerinin yanı sıra kumaş içeriklerini de görebileceğiniz bu etiketler ürünlerin doğru bakımı konusunda bilgi sahibi olmanıza olanak sağlayacaktır.

2. Önerilen Bakım Talimatlarına Uyun: Dolabınıza ekleyeceğiniz her giysi, ayakkabı ve aksesuar ürünü için farklı bir bakım yöntemi oluşturmanız gerekir. Ürünün kumaş içeriğine, tasarımına ve yapısına göre değişebilen bu yöntemleri doğru uygulamak oldukça önemlidir. Ürün için önerilen talimatlara uygun şekilde bakım yapmak ürününüzün kullanım süresi uzarken, rengini ve dokusunu uzun süre muhafaza etmenizi de kolaylaştıracaktır.

3. Yüksek Dereceli Yıkama İşlemlerinden Kaçının: Ürün bakımı ve yıkama işlemlerinde çevre dostu ve tasarruf sağlayan yöntemleri tercih etmek uzun vadede oldukça faydalıdır. Yüksek dereceli yıkama işlemlerinden kaçınarak siz de ürününüzün kullanım süresini uzatırken kalitesini uzun süre korumasına yardımcı olabilirsiniz. Özellikle iç çamaşırı ve beyaz renkli ürünlerde sık sık tercih edilen yüksek dereceli yıkama işlemleri ürünlerinizin dokusunda hasar oluşturmanın yanı sıra tasarım detaylarına ve kalıplarına da zarar verebilir. Ürünün etiketinde yer alan yıkama derecesine sadık kalmak ürününüz için doğru olan bakım adımlarından birini daha tamamlamanızı sağlayacaktır.

4. Fazla Deterjan Kullanımından Kaçının: Ürün yıkama işlemi sırasında deterjan kullanımını minimum düzeyde tutmak çevresel ve bireysel sağlık açısından oldukça önemlidir. Yıkama esnasında önerilen deterjan miktarını aşmak ürünlerinizin daha hijyenik olmasına değil; aksine daha fazla kimyasal maddeye maruz kalarak hasar görmesine sebep olabilir. Bu nedenle yıkama işlemi başlamadan önce deterjan miktarını ölçek yardımı ile belirleyerek fazla deterjan kullanımından kaçınmalısınız. Bir diğer yandan, yıkama işlemi esnasında deterjan çeşitlerinin yanı sıra yumuşatıcı ve leke çıkarıcı gibi kimyasal maddelerin kullanımını en aza indirgemek de çevreyi ve ürünlerinizi korumak adına atacağınız etkili bir adım olacaktır.

5. Yıkama İşlemlerinde Renk Ayrımını Gözetin: Giysilerinizi yıkamadan önce renk ve dokularına göre ayırmak ürünlerinizin yapısını korumanın öncelikleri arasında yer alır. Yüksek sıcaklık ve basınçlı suya maruz kalan ürünler kimi zaman beraber yıkandıkları diğer ürünlere renk verebilir. Özellikle içerisinde indigo boya bulunan bazı kumaşlar yıkama esnasından yüksek oranda renk bırakabilir. Bu nedenle yıkama işlemi öncesinde ürünlerinizi benzer renkler bir arada yıkanacak şekilde ayırmanız ürün bakım sürecinize yarar sağlayacak bir yöntem olacaktır. Beyazlar, koyu renkler ve açık renkler gibi renk tonlarına göre ayırarak yıkama işlemini gerçekleştirdiğiniz ürünler renklerini ve dokularını uzun süre muhafaza edecektir.

6. Yıkama İşlemlerinde Ağartıcı Kullanmayın: Ürün bakım sürecinde kimyasal madde kullanımını en az seviyede tutmak önceliğiniz olmalı. Bu kimyasallar arasında oldukça güçlü bir etkiye sahip olan ağartıcı maddeleri ürün yıkama işleminin öncesinde ve yıkama işlemi esnasında kullanmaktan kaçınmanızı öneririz. Çevreye olan zararının yanı sıra cildinizi irrite edecek bir etkiye de sahip olan ağartıcı maddelere alternatif olacak leke çıkarıcı ve doğal içerikli ürünleri tercih edebilirsiniz. Bu şekilde hem ürünlerinizin renk, doku ve tasarımını koruyabilir hem de ağartıcı maddelerin çevresel ve bireysel zararlarına karşı önlem alabilirsiniz.

7. Baskılı/Nakışlı Ürünleri Ütülemeden ve Yıkamadan Önce Ters Çevirin: Ürün bakımı süresince dikkat etmenizi önerdiğimiz bir diğer aşama ise baskılı, pullu ve nakışlı tasarımlara sahip ürünleri her işlem öncesi ters çevirmeniz olacak. Özellikle nakışlı ve işlemeli tasarımlar, genellikle el işçiliği kullanılarak hazırlanmaları sebebiyle ekstra hassaslık gerektirir. Ters çevirme yöntemi ile ürünlerinizin rengini ve desenini korurken işlemler esnasında oluşabilecek fiziksel hasarlara karşı da önlem almış olursunuz. Ters çevirme adımı ile ürünleriniz tasarımları ve dokuları değişmeden, ilk günkü gibi kullanabileceğiniz şekilde dolabınızda yer almaya devam edecektir.

ÜRÜN BAKIMINDA 3 ANA İŞLEM

1. Yıkama İşlemi: Ürünlerin ve giysilerin etiketinde yer alan yıkama talimatlarını doğru uygulamak, çevreyi ve doğal kaynakları koruma yolculuğunda atacağınız önemli adımlardan biri. Üç ana adıma ayıracağımız bakım sürecinde dikkate almanız gereken ilk önerimiz giysi ve ürünlerinizi yalnızca ihtiyaç duyduğunuz zamanlarda yıkamak olacak. Gereğinden fazla yapılan bakım, ütü ve yıkama işlemlerinin uzun vadede ürünlerinizin dokusuna ve kalıbına zarar verme olasılığı oldukça yüksektir. Sonrasında ise ürünlerinizin kumaş ve tasarım özelliklerine uygun olacak yıkama şeklini belirlemeniz gerekecek. Ürünlerin etiketlerinde yer alan yıkama talimatları bu adımda size büyük bir yarar sağlayacaktır. Etiket bilgilerinde yer alan sıcaklık, yıkama yöntemi ve program gibi detayları inceleyerek ürününüz için uygun olacak yıkama işlemini belirleyebilirsiniz.

Gelin en sık tercih edilen yıkama biçimlerine birlikte göz atalım,

Elde Yıkama: Hassas kumaş türleri kullanılarak tasarlanan ya da nakışlı ve desenli tasarımlara sahip ürünler makinede yıkama işlemiyle zarar görebilir. Ürününüzün hem dokusunu hem de tasarımını koruma altına alacak yıkama işlemlerinden biri olan elde yıkama yöntemi, doğru su sıcaklığı ve deterjan kullanımıyla ürününüzün ihtiyaç duyduğu hassasiyeti sağlayacaktır.

Makinede Yıkama: Yıkama yöntemleri arasında hem tasarruflu hem de pratik bir yöntem olarak kabul edilen makinede yıkama işlemini genel olarak iki şekilde sınıflandırabiliriz:

Normal Programda Yıkama: Makinede yıkama programları arasında en sık tercih edilenler arasında normal yıkama programlarının olduğunu söyleyebiliriz. Günlük kıyafetleriniz için tercih edebileceğiniz normal yıkama programları ürünlerinizi ideal şekilde temizlemenin en tasarruflu yollarından biri. Normal yıkama programlarında dikkat etmeniz gereken tek şey ürünün benzer renklerle yıkanması ve etiketinde yer alan su sıcaklık derecesine uygun bir program tercih etmek olacak.

Hassas Programda Yıkama: Hassas, dokulu veya el işçiliğiyle hazırlanan ürünleri makinede yıkamak için en uygun seçeneğin hassas programlar olduğunu söyleyebiliriz. Hassas yıkama programlarını aynı zamanda yüksek ısı, yoğun sıkma ve durulama işlemleriyle kumaş dokusu zedelenebilecek ürünler için de tercih edebilirsiniz. Ürün bakım talimatlarında görebileceğiniz bu programlar ürününüze zarar vermeden yıkamak için en doğru seçenek olacaktır.

2. Kurutma İşlemi: Ürünlerinizin dokusunu ve rengini uzun süre koruyacak bir diğer işlem ise elbette kurutma işlemi. Giysilerinizin önerilen kurutma talimatlarına uygun şekilde kurutmak bakım ve yıkama işlemi kadar önem arz ediyor. Genellikle etiket ve ürün bilgi alanlarında yer alan bu talimatlar ürünlerinizi kumaş ve tasarım modellerine uygun olacak şekilde hazırlanıyor. Doğrudan güneş ışığından kaçınmanın yanı sıra kalorifer ve ısıtıcı gibi araçlarla giysilerinizi temas ettirmeden kurutma işlemini gerçekleştirmelisiniz. Hassas kumaş yapılı ürünlerde ise oda sıcaklığında askı yöntemi ile kurutma işlemini tamamlayabilirsiniz.

3. Ütüleme İşlemi: Ütüleme işlemi, ürününüze uygulayacağınız doğru bakım sürecinin son adımı olarak kabul edilebilir. Yıkama, bakım ve kurutma işleminin ardından ürünün yapısına uyacak ütü ısı derecesi ile ütü işlemine başlayabilirsiniz. Ürünleri ters çevirerek ütülemek, bakım talimatlarında yer alan ısı derecesini geçmemeniz, fermuarlı ürünlerde bu bölgelere es geçerek ve ürünlerinizi hafif nemliyken ütülemeye başlamak bu adımda size önereceğimiz birkaç küçük ipucu olacak. Yıkama ve kurutma işleminde olduğu gibi ütü işleminde de yüksek ısılı programlardan kaçınmak ürünün yapısında oluşabilecek zararlara karşı koruyucu bir önlem olacaktır.

Kuru Temizleme İşlemi: Kuru temizleme işlemi, makinede veya elde yıkamaya uygun olmayan ürünler için tercih edebileceğiniz bakım yöntemlerinden biridir. Bu yöntem, hassas kumaş yapısına sahip olan veya tasarımında el işçiliği bulunan ürünler için uygun olacak özel bir bakım işlemidir. Genellikle abiye elbise, takım elbise ve dış giyim ürünleri gibi elde ve makinede temizlenmesi sakıncalı olacak ürünler için tavsiye edilen kuru temizleme işlemi simgesi, ürününüzün etiketinde yer alan bakım talimatları bölümünde yer almaktadır.
```

> NOT: Koton'da bu metnin ÜSTÜNDE ayrıca ürüne özel küçük bir "Giysi Bakım Kılavuzu" ikon listesi var (örn. "Maksimum 30°C sıcaklıkta yıkayınız", "Ağartıcı kullanmayınız", "Orta sıcaklıkta ütüleyiniz", "Tamburlu kurutma yapmayınız", "Kuru temizleme yapılamaz") — bu kısım ürüne göre değişiyor ve Bollmark'ta zaten var olan ürün bazlı `careInstructions` alanına karşılık geliyor. Drawer'da bu yüzden üstte (varsa) ürünün kendi `careInstructions` metni, altında yukarıdaki genel metin gösterilecek — v1 planındaki yapı bu yönüyle korunuyor.

---

## İÇERİK 3 — Beden Tablosu (accordion, mevcut sizeGuide alanı)

Koton'un BU ürüne özel "Ürün Ölçü Tablosu (cm)" bölümünden birebir örnek (canlı siteden okundu):

```
Ürün düz zeminde ölçülmüştür. En (genişlik) ölçüleri 1/2 (yarım) ölçüdür.

Beden | Boy | Bel | Basen
34 | 32 | 37 | 51
36 | 32 | 39 | 53
38 | 33 | 41 | 55
40 | 34 | 43 | 57
```

Bu, admin panelinde bir ürünün `sizeGuide` alanına girilecek örnek biçim (üstteki açıklama cümlesi + pipe'lı satırlar). Önceki planda kararlaştırıldığı gibi bu satırlar site tarafında gerçek bir `<table>`'a çevrilecek, açıklama cümlesi ise tablonun üstünde düz metin olarak kalacak.

---

## Claude Code için GÜNCELLENMİŞ prompt

```
Bollmark ürün detay sayfasında (src/components/product-viewer.tsx) önceki turda konuşulan İade ve Değişim + Ürün Bakım Talimatı + Beden Tablosu işini şu şekilde güncelle/tamamla:

1) KONUM DEĞİŞİKLİĞİ: "İade ve Değişim" ve "Ürün Bakım Talimatı" satırları (ok işaretli, tıklanınca InfoDrawer açan butonlar — bkz. önceki prompt'taki InfoDrawer component'i, cart-drawer.tsx'teki animasyon deseniyle) artık "Ürün Detayları"/"Beden Tablosu" accordion'larının yanında DEĞİL, ürün açıklaması bloğunun (descriptionHtml + "Devamını Oku/Daha Az Göster" butonu içeren `{descriptionHtml && (...)}` bloğu) HEMEN ALTINDA, trust-ticker (`.trust-ticker` güven şeridi) bloğundan ÖNCE yer alacak. Eğer InfoDrawer component'ini ve state'leri (iadeDrawerOpen, bakimDrawerOpen) önceki promptta zaten oluşturduysan onlara dokunma, sadece JSX'te bu iki butonun konumunu taşı.

2) İADE & DEĞİŞİM İÇERİĞİ (Bollmark'ın gerçek politikasına uyarlanmış, Koton'dan büyük ölçüde birebir alınan metin):

[Bu dosyanın "İÇERİK 1 — İade & Değişim" bölümündeki metni birebir kullan. SADECE şu iki değişikliği yap: (a) "Mağazadan İade" alt başlığındaki "Franchise mağazalarımız hariç tüm Türkiye mağazalarımızdan ürünlerinizi kolayca iade edebilirsiniz." cümlesini Bollmark'ın tek mağazası olduğu gerçeğine uyarlayarak "Karacabey/Bursa'daki mağazamızdan da ürününüzü iade edebilirsiniz." gibi kısalt. (b) "Değişim İşlemleri" altındaki "Ürün değişimlerinizi tüm Türkiye mağazalarımızdan gerçekleştirebilirsiniz." cümlesini aynı şekilde tek mağazaya uyarlayarak kısalt. Geri kalan HER ŞEYİ (İadesi Mümkün Olmayan Ürünler paragrafı, Kargo ile İade adımları, Üyeliksiz Verilen Siparişler paragrafı) birebir kopyala.]

3) ÜRÜN BAKIM TALİMATI İÇERİĞİ: Bu dosyanın "İÇERİK 2 — Ürün Bakım Talimatı" bölümündeki metni HİÇBİR DEĞİŞİKLİK YAPMADAN, birebir kullan (marka adı geçmiyor, olduğu gibi kullanılabilir). Madde numaraları (1-7), "ÜRÜN BAKIMINDA 3 ANA İŞLEM" alt başlığı ve içindeki Yıkama/Kurutma/Ütüleme/Kuru Temizleme alt bölümleri dahil TAMAMINI kullan — kısaltma. Drawer'ın EN ÜSTÜNDE, eğer bu ürünün `careInstructions` prop'u doluysa "Bu ürün için" alt başlığıyla onu göster, ALTINDA yukarıdaki tam metni göster. Uzun bir metin olduğu için InfoDrawer'ın içerik alanının `overflow-y-auto` scroll edebildiğinden emin ol (zaten öyle olmalıydı), başlıklar arasında yeterli boşluk (space-y-4 veya benzeri) ve madde numaralarının kalın/belirgin görünmesi için basit bir stil uygula (örn. her maddeyi ayrı `<p>` yap, madde başındaki "1.", "2." gibi kısmı `<strong>` yap).

4) BEDEN TABLOSU: Önceki planda kararlaştırıldığı gibi accordion olarak kalıyor (drawer'a çevrilmiyor), sizeGuide metninde "|" varsa tabloya çeviren parse fonksiyonu aynen uygulanacak (önceki prompt madde 5). Şimdilik gerçek ürün verisi girilmediği için görünmüyordu — örnek/test amaçlı, herhangi bir ürünün admin panelindeki Beden Tablosu alanına şunu gir ve sitede gerçekten tablo olarak render edildiğini doğrula:

Ürün düz zeminde ölçülmüştür. En (genişlik) ölçüleri 1/2 (yarım) ölçüdür.

Beden | Boy | Bel | Basen
34 | 32 | 37 | 51
36 | 32 | 39 | 53
38 | 33 | 41 | 55
40 | 34 | 43 | 57

(İlk satır "|" içermiyor, o yüzden parse fonksiyonu onu normal açıklama metni olarak, sonraki 5 satırı ise tablo olarak render etmeli — fonksiyonun bunu doğru ayırt ettiğinden emin ol: örn. "|" içeren ardışık satırları tablo satırı say, içermeyenleri tablonun üstünde/altında düz paragraf olarak bas.)

NOT (bilgi amaçlı, iş değil): Koton'un "Beden Tablosu" satırına tıklayınca AYRICA çok kategorili (Kadın/Erkek/Çocuk vb. + Üst Giyim/Alt Giyim/Denim/Mayo/vb.) dev bir genel vücut ölçü rehberi modalı da açılıyor (~60 farklı tablo). Bu iş kapsamına DAHİL DEĞİL, şimdilik yapma — yukarıdaki ürün bazlı basit tablo yeterli.

5) Değişiklikleri yaptıktan sonra npm run build ile derlemenin geçtiğini doğrula, DEPLOY_STATUS.md'ye her zamanki formatta bir not düş (bu turda ne değişti: buton konumu taşındı, iade/bakım metinleri gerçek içerikle dolduruldu, beden tablosu test verisiyle doğrulandı).
```
