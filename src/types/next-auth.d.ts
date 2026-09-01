import { DefaultSession, DefaultUser } from "next-auth";
import { DefaultJWT } from "next-auth/jwt";
import type { AdminRole } from "@/lib/roles";

declare module "next-auth" {
  interface User extends DefaultUser {
    role?: AdminRole;
  }

  interface Session {
    user?: DefaultSession["user"] & { role?: AdminRole };
  }
}

declare module "next-auth/jwt" {
  interface JWT extends DefaultJWT {
    role?: AdminRole;
  }
}
