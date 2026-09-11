import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1c1917",
        cream: "#f3ede3",
        clay: "#a9765a",
        stone: "#8a8478",
        line: "#e2dcd0",
        "admin-bg": "#f6f6f7",
        "admin-surface": "#ffffff",
        "admin-border": "#e3e3e5",
        "admin-text": "#1a1a1a",
        "admin-text-muted": "#6b6b6f",
        "admin-accent": "#4f46e5"
      },
      fontFamily: {
        display: ["var(--font-display)", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"]
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
