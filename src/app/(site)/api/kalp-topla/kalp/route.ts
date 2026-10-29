import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { KalpError, giveHeart, withdrawHeart, type KalpErrorCode } from "@/lib/kalp-topla/bar";

// Kalp ver (POST) / geri cek (DELETE), govde { productId } (plan 5.1, 5.3).
const STATUS: Record<KalpErrorCode, number> = {
  NOT_FOUND: 404,
  FROZEN: 409,
  QUOTA: 409,
  RATE: 429,
  ROUND_CLOSED: 409,
  NO_HEART: 409
};
const headers = { "Cache-Control": "no-store" };

async function handle(req: NextRequest, run: (customerId: string, productId: string) => Promise<unknown>) {
  const session = await getServerSession(customerAuthOptions);
  const customerId = session?.user?.id;
  if (!customerId) return NextResponse.json({ error: "Giriş yapmalısın." }, { status: 401, headers });
  const body = (await req.json().catch(() => null)) as { productId?: unknown } | null;
  const productId = typeof body?.productId === "string" ? body.productId : "";
  if (!productId) return NextResponse.json({ error: "Ürün eksik." }, { status: 400, headers });
  try {
    return NextResponse.json((await run(customerId, productId)) ?? { ok: true }, { headers });
  } catch (error) {
    if (error instanceof KalpError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: STATUS[error.code], headers });
    }
    throw error;
  }
}

export function POST(req: NextRequest) {
  return handle(req, giveHeart);
}

export function DELETE(req: NextRequest) {
  return handle(req, withdrawHeart);
}
