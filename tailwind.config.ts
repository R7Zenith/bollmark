import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#111111",
        paper: "#faf9f7",
        accent: "#c9a24b",
        line: "#e6e2da",
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
      }
    }
  },
  plugins: []
};

export default config;
