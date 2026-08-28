import { defineConfig } from "prisma/config";

try {
  // Yerelde .env dosyasindan DATABASE_URL'i yukler. Vercel gibi ortamlarda
  // .env dosyasi olmayabilir (degiskenler dogrudan process.env'e enjekte edilir),
  // bu yuzden hata sessizce yutuluyor.
  process.loadEnvFile();
} catch {}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL
  }
});
