"use client";

import { SessionProvider } from "next-auth/react";

// Admin oturumundan (session-provider.tsx) ayri - musteri oturum
// endpoint'ine (/api/musteri-auth) isaret eder.
export function CustomerSessionProvider({ children }: { children: React.ReactNode }) {
  return <SessionProvider basePath="/api/musteri-auth">{children}</SessionProvider>;
}
