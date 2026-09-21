import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { cartLinesSchema, resolveCartLines } from "@/lib/cart-lines";

const schema = z.object({ lines: cartLinesSchema });

// Sepetteki satirlarin GUNCEL fiyat/stok/yayin durumunu doner (misafir de
// kullanir, giris gerekmez). Istemci bu yaniti sepetteki fiyatlari tazelemek
// icin kullanir; nihai tutar yine siparis olusturulurken hesaplanir.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
  }

  const lines = await resolveCartLines(parsed.data.lines);
  return NextResponse.json({ lines }, { headers: { "Cache-Control": "no-store" } });
}
