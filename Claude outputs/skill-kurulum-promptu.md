# Claude Code Skill Kurulumları — Tek Seferde Uygula

Bu dosyayı evdeki bilgisayarında Claude Code'a (VSCode eklentisi) aç, bu dosyanın
içeriğinin tamamını kopyala, Claude Code'un **chat paneline** yapıştırıp Enter'a
bas. Claude hem terminal komutlarını kendi çalıştıracak hem de slash komutlarını
sırayla uygulayacak. (İstersen adım adım da elle girebilirsin, aşağıda hepsi ayrı
ayrı da yazıyor.)

---

## Claude'a verilecek tam prompt (aynen kopyala-yapıştır)

Aşağıdaki adımları sırayla, her birini bitirdikten sonra bir sonrakine geçerek
uygula. Her terminal komutundan sonra çıktıyı kontrol et, hata olursa dur ve
bana bildir.

1. Terminalde şu komutu çalıştır:
   `npx skills add zanwei/design-dna -a claude-code -g -y`

2. Terminalde şu komutu çalıştır:
   `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend" -a claude-code -g -y`

3. Terminalde şu komutu çalıştır:
   `npx skills add https://github.com/Leonxlnx/taste-skill --skill "redesign-existing-projects" -a claude-code -g -y`

4. `/plugins` komutunu çalıştır, açılan ekrandan Marketplaces sekmesine git ve
   `anthropics/skills` marketplace'ini ekle. Sonra listeden `frontend-design`
   skill'ini içeren paketi (örn. `example-skills`) bul ve kur.

5. `/plugins` komutunu tekrar çalıştır, Marketplaces sekmesinden
   `nateherkai/scroll-craft` marketplace'ini ekle. Sonra listeden
   `nateherk-design` plugin'ini kur.

6. Kurulum özetinde "Run /reload-plugins to activate" gibi bir uyarı çıkarsa
   `/reload-plugins` komutunu çalıştır.

7. Terminalde (VSCode terminali, chat paneli değil) şu komutu çalıştır — bu,
   scroll-craft plugin'inin ön kontrol scriptidir:
   `node scripts/doctor.mjs`
   (Bu komutu plugin'in kurulduğu klasörde çalıştırman gerekebilir; hata
   verirse plugin'in kurulum klasörünü bul ve oradan çalıştır.)

8. Hepsi bittiğinde bana kısa bir özet ver: hangi skill/plugin'ler başarıyla
   kuruldu, hangisinde hata oldu.

---

## Referans — kurduğumuz skill/plugin listesi

| Adı | Tür | Kaynak |
|---|---|---|
| design-dna | npx skill (global) | https://github.com/zanwei/design-dna |
| frontend-design | plugin (anthropics/skills marketplace) | https://github.com/anthropics/skills |
| scroll-craft (nateherk-design) | plugin (marketplace) | https://github.com/nateherkai/scroll-craft |
| design-taste-frontend | npx skill (global) | https://github.com/Leonxlnx/taste-skill |
| redesign-existing-projects | npx skill (global) | https://github.com/Leonxlnx/taste-skill |

Not: Bunların hepsi **bilgisayara özel** kuruluyor (`-g` / kullanıcı seviyesi
plugin). Yani bu dosyayı her yeni bilgisayarda bir kez çalıştırman yeterli,
proje (Bollmark) değişse bile tekrar kurman gerekmez.
