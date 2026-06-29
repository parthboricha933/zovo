import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const payments = await db.payment.findMany({
    include: {
      booking: {
        include: {
          ride: { select: { pickupAddress: true, destAddress: true, driverId: true } },
          passenger: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    items: payments.map((p) => ({
      id: p.id,
      amount: p.amount,
      method: p.method,
      status: p.status,
      platformFee: p.platformFee,
      driverPayout: p.driverPayout,
      transactionId: p.transactionId,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
      booking: p.booking,
    })),
  })
}
