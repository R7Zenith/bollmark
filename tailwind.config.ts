import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      // release-main.myshopify.com'un canli `:root` CSS degiskenlerinden
      // birebir alindi (color-scheme-1, 13 Eylul 2026 olculdu):
      // --color-background: 255,255,255, --color-foreground/--color-link:
      // 17,17,17, --color-secondary-text: 101,112,110, --color-border:
      // 235,235,235. Eskiden sicak krem/kahve tonlu (fdfcfb/1c1917/a9765a)
      // ayri bir marka paleti kullaniyorduk - kullanicinin acik istegiyle
      // Release'in gercek monokrom paletine gecildi. "clay" (vurgu/hover
      // rengi) de ink ile ayni deger: Release'de link/vurgu rengi metinle
      // AYNI siyah (--color-link: 17,17,17), ayri bir "marka rengi" yok -
      // hover geri bildirimi renk degil, alt cizgi buyume animasyonuyla
      // (.nav-underline) veya dolu/dolgusuz "invert" geciisiyle (bkz.
      // product-viewer.tsx .button--filled hover) veriliyor. clay'i tamamen
      // silmek yerine ink'e esitlemek, adini kullanan onlarca dosyayi tek
      // tek degistirmeden ayni sonucu veriyor.
      colors: {
        ink: "#111111",
        cream: "#ffffff",
        clay: "#111111",
        stone: "#65706e",
        line: "#ebebeb",
        // Indirimli fiyat/rozetler icin ayri bir kirmizi ton - Release'in
        // kendi --color-error'una (#C25151) yakin, marka semantik kirmizisi
        // olarak korundu.
        sale: "#c0392b",
        "admin-bg": "#f6f6f7",
        "admin-surface": "#ffffff",
        "admin-border": "#e3e3e5",
        "admin-text": "#1a1a1a",
        "admin-text-muted": "#6b6b6f",
        "admin-accent": "#4f46e5"
      },
      fontFamily: {
        // Shopify "Release" temasi referansi: tek govde/baslik fontu Poppins.
        // display, sans ile ayni - tum basliklar da Poppins kullaniyor.
        display: ["var(--font-sans)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        // Sadece cumle icinde tek tek vurgulanan kelimelerde (<em> gibi)
        // kullanilan ikinci, italik serif font - bkz. page.tsx'teki
        // "font-accent italic" kullanimlari.
        accent: ["var(--font-accent)", "serif"]
      },
      letterSpacing: {
        widest2: "0.25em"
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(17,17,17,0.08)"
      },
      spacing: {
        section: "6rem"
      }
    }
  },
  plugins: []
};

export default config;
