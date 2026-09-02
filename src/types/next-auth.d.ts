import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import type { AdminRole } from "@/lib/roles";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: AdminRole;
  }

  interface Session {
    // role: sadece admin oturumunda (auth.ts) dolu olur. id: sadece musteri
    // oturumunda (customer-auth.ts) dolu olur - iki ayri NextAuth ornegi
    // ayni global Session tipini paylastigi icin ikisi de opsiyonel.
    user?: DefaultSession["user"] & { role?: AdminRole; id?: string };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: AdminRole;
  }
}
