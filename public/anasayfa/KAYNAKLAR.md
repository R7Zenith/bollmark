# Ana sayfa görselleri — kaynaklar

Bu klasörde artık görsel yok. 22 Ekim 2026'da ana sayfanın alt bölümleri yenilendi
(bkz. `docs/planlar/ANASAYFA_ALT_BOLUM_YENILEME_PLANI.md`) ve buradaki 8 Unsplash stok fotoğrafı silindi:
`editoryal-sol.jpg`, `editoryal-sag.jpg`, `lookbook-genis.jpg`, `koleksiyon-kadin/erkek/cocuk/ayakkabi/aksesuar.jpg`.

**İlke:** Ana sayfadaki her görsel ya sitede satılan gerçek bir ürünün fotoğrafı ya da mağazanın gerçek fotoğrafıdır.

- Kategori şeridi ve Kadın/Erkek/Çocuk/Ayakkabı/Aksesuar kutuları: kategorinin admin'deki `imageUrl`'i, yoksa
  o kategori/gruptaki en yeni yayındaki ürünün ilk fotoğrafı. Hiçbiri yoksa kart gri zeminde yalnız yazı olarak görünür.
- Mağaza fotoğrafları: `public/magaza/` (`magaza-1.jpg` geniş, `magaza-2.jpg`–`magaza-4.jpg` küçük).
- Instagram kareleri: `public/instagram/` (bkz. oradaki `README.md`).

Hero görseli (`public/hero-model.jpg`) bu yenilemenin kapsamı dışındadır.
