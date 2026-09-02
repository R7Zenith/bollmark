import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// Admin girisinden (auth.ts) tamamen ayri bir NextAuth ornegi - musteri
// oturum cerezi farkli isimde tutulur (musteri-oturum-token), aksi halde
// ayni tarayicida admin ve musteri oturumlari birbirini gecersiz kilabilirdi.
export const customerAuthOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  pages: {
    signIn: "/hesap/giris"
  },
  cookies: {
    sessionToken: {
      name: "musteri-oturum-token",
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production"
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: "Müşteri Girişi",
      credentials: {
        email: { label: "E-posta", type: "email" },
        password: { label: "Şifre", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const customer = await prisma.customer.findUnique({
          where: { email: credentials.email.trim().toLowerCase() }
        });
        if (!customer) return null;

        const valid = await bcrypt.compare(credentials.password, customer.passwordHash);
        if (!valid) return null;

        return { id: customer.id, name: customer.name, email: customer.email };
      }
    })
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.sub = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    }
  }
};
