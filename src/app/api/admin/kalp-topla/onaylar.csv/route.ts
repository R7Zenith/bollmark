import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit-log";
import { formatDateTime, istanbulDayEnd, istanbulDayStart } from "@/lib/format";

// Pazarlama onay kayitlari CSV (KALP_TOPLA_PLANI.md 6.11, T3): yalniz ADMIN,
// tarih araligi (Istanbul gunu, bas/bit = YYYY-MM-DD), UTF-8 BOM. Indirme
// denetim kaydina yazilir.
const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz istek." }, { status: 401 });
  }

  const bas = req.nextUrl.searchParams.get("bas") ?? "";
  const bit = req.nextUrl.searchParams.get("bit") ?? "";
  const createdAt = {
    ...(DATE_KEY.test(bas) ? { gte: istanbulDayStart(bas) } : {}),
    ...(DATE_KEY.test(bit) ? { lte: istanbulDayEnd(bit) } : {})
  };

  const rows = await prisma.marketingConsentLog.findMany({ where: { createdAt }, orderBy: { createdAt: "asc" } });

  const header = ["Müşteri ID", "E-posta", "Kanal", "İşlem", "Tarih-saat (İstanbul)", "Kaynak", "IP", "Metin sürümü"];
  const lines = rows.map((r) =>
    [
      r.customerId,
      r.email,
      r.channel,
      r.granted ? "Verildi" : "Geri çekildi",
      formatDateTime(r.createdAt),
      r.source,
      r.ipPurgedAt ? "silindi (3 yıl)" : (r.ip ?? ""),
      r.textVersion
    ]
      .map(csvCell)
      .join(",")
  );
  const csv = "﻿" + [header.map(csvCell).join(","), ...lines].join("\r\n");

  await logAudit({
    actorEmail: session.user.email ?? "",
    actorRole: session.user.role ?? "ADMIN",
    action: "KALP_TOPLA_ONAY_CSV_INDIRILDI",
    targetType: "MarketingConsentLog",
    targetId: "-",
    detail: `Aralık: ${bas || "başlangıç"} – ${bit || "bugün"}, ${rows.length} satır`
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kalp-topla-onaylar-${bas || "tumu"}-${bit || "bugun"}.csv"`,
      "Cache-Control": "no-store"
    }
  });
}
