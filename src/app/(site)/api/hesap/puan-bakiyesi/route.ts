import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { customerAuthOptions } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(customerAuthOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ loyaltyPoints: 0 }, { status: 200 });
  }
  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
    select: { loyaltyPoints: true }
  });
  return NextResponse.json({ loyaltyPoints: customer?.loyaltyPoints ?? 0 });
}
