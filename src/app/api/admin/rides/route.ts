import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const status = searchParams.get('status')

  const rides = await db.ride.findMany({
    where: status ? { status } : {},
    include: {
      driver: { select: { id: true, name: true, email: true, phone: true, driverRating: true } },
      vehicle: true,
      bookings: {
        include: {
          passenger: { select: { id: true, name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    items: rides.map((r) => ({
      id: r.id,
      status: r.status,
      pickupAddress: r.pickupAddress,
      destAddress: r.destAddress,
      departureTime: r.departureTime,
      pricePerSeat: r.pricePerSeat,
      totalSeats: r.totalSeats,
      availableSeats: r.availableSeats,
      createdAt: r.createdAt,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      cancelledAt: r.cancelledAt,
      driver: r.driver,
      vehicle: r.vehicle,
      bookingCount: r.bookings.length,
      confirmedBookings: r.bookings.filter((b) => ['CONFIRMED', 'STARTED', 'COMPLETED'].includes(b.status)).length,
      totalRevenue: r.bookings
        .filter((b) => b.status === 'COMPLETED')
        .reduce((s, b) => s + b.totalPrice, 0),
    })),
  })
}
