# Footer "Bültenimize katılın" Bölümünü Kaldırma Planı

## Bulgu
Bülten bölümü sitede **tek yerde** var (footer). Formun arkasında gerçek bir endpoint/veritabanı yok
(`footer-newsletter-form.tsx` içinde "TODO: endpoint'e bağla" yazıyor, submit hiçbir şey yapmıyor).
Yani kaldırınca kaybedilen veri/işlev yok.

Etkilenen dosyalar:
- `src/components/site-footer.tsx` — satır ~38-46: "Bültenimize katılın" başlığı, açıklama metni, `<FooterNewsletterForm />` ve import (satır 3)
- `src/components/footer-newsletter-form.tsx` — başka yerde kullanılmıyor, silinecek

## Claude Code Prompt

```
Footer'daki "Bültenimize katılın" bölümünü kaldır; sitenin başka yerinde bülten/abonelik bölümü varsa onu da kaldır.

Bilinen durum:
- src/components/site-footer.tsx içinde "Üst blok" grid'inin sol sütunu (başlık "Bültenimize katılın", "Yeni koleksiyonlardan ve fırsatlardan..." paragrafı, <FooterNewsletterForm />) ve dosyanın başındaki import var.
- src/components/footer-newsletter-form.tsx submit'te hiçbir şey yapmıyor (bağlı endpoint yok).

Yapılacaklar:
1. Önce tüm src/ ve prisma/ içinde grep yap: "bülten", "bulten", "newsletter", "abone", "subscribe", "FooterNewsletterForm". Sitenin başka bir sayfasında/bileşeninde (ana sayfa, ürün detay, hesap, "yapım aşamasında" gate sayfası, e-posta şablonları, admin) bülten formu veya metni varsa listele ve onları da kaldır. Admin tarafında bülten yönetimi vs. varsa dokunmadan bana bildir.
2. site-footer.tsx: bülten sütununu ve import'u sil. Kalan "Kurumsal / Müşteri hizmetleri / ..." link sütunları kaybolan sütun yüzünden yana kaymasın ya da boş kalmasın: grid'i yeniden düzenle (link sütunları tam genişliği kullansın; masaüstünde ve mobilde düzgün hizalı, mevcut Release tarzı görünümü bozma). Üst boşluk/padding dengeli kalsın.
3. footer-newsletter-form.tsx dosyasını sil (başka yerde import edilmiyorsa).
4. Sadece istenen değişikliği yap, başka refactor yapma (karpathy-guidelines).
5. `npx tsc --noEmit` ve `npm run lint` çalıştır; 390px ve 1600px genişlikte footer'ı görsel kontrol et.
6. Yüklü skill'leri kullan.
7. İş bitince DEPLOY_STATUS.md'ye kısa not düş (ne kaldırıldı, hangi dosyalar, test sonucu).
```

## Kabul kriterleri
- Sitede "Bültenimize katılın", "Abone Ol", e-posta input'u kalmadı.
- Footer link sütunları masaüstü + mobilde düzgün görünüyor.
- tsc/lint temiz.
