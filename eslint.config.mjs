import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  {
    rules: {
      // Projede efekt icinde state yazmak bilincli kullaniliyor: SSR uyumlu
      // localStorage okuma, "mounted" bayraklari, cekmecelerin giris/cikis
      // animasyon durumlari ve fetch sonucunu state'e yazma. Kural bunlari
      // topluca isaretliyordu; yeniden yazmak animasyonlari/hydration'i riske atar.
      "react-hooks/set-state-in-effect": "off"
    }
  },
  // src/generated: Prisma'nin urettigi kod (git'te ignore'lu), lint'lenmemeli.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"])
]);

export default eslintConfig;
