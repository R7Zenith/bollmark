import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1917",
        cream: "#fdfcfb",
        clay: "#a9765a",
        stone: "#8a8478",
        line: "#e2dcd0",
        // Indirimli fiyat/rozetler icin ayri bir kirmizi ton - marka rengi
        // clay ile karismasin diye (Shopify "Release" temasindaki gibi).
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
