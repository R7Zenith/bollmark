import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { requestIp } from "@/lib/meta/capi";
import { DEVICE_COOKIE, DEVICE_COOKIE_OPTIONS, recordDevice, resolveDeviceId } from "@/lib/kalp-topla/devices";

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

        // Kalp Topla (Y2): giriste cihaz gorulmesi - davet edenin cihazi da
        // eslesebilsin diye. authorize NextAuth route handler'inda calistigi
        // icin cerez burada yazilabilir.
        const cookieStore = await cookies();
        const { deviceId, isNew } = resolveDeviceId(cookieStore.get(DEVICE_COOKIE)?.value);
        if (isNew) cookieStore.set(DEVICE_COOKIE, deviceId, DEVICE_COOKIE_OPTIONS);
        await recordDevice({ customerId: customer.id, deviceId, ip: requestIp(await headers()), event: "LOGIN" });

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
