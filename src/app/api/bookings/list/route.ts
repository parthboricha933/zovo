import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * List bookings for the current user.
 * Query: ?role=PASSENGER|DRIVER  &status=REQUESTED|CONFIRMED|STARTED|COMPLETED|CANCELLED|REJECTED
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'PASSENGER'
  const status = searchParams.get('status')

  const where: any = {}
  if (role === 'PASSENGER') where.passengerId = user.id
  else if (role === 'DRIVER') where.ride = { driverId: user.id }
  if (status) where.status = status

  const bookings = await db.booking.findMany({
    where,
    include: {
      ride: {
        include: {
          driver: { select: { id: true, name: true, phone: true, avatarUrl: true, driverRating: true } },
          vehicle: true,
        },
      },
      passenger: { select: { id: true, name: true, phone: true, avatarUrl: true, passengerRating: true } },
    },
    orderBy: { requestedAt: 'desc' },
    take: 100,
  })

  return NextResponse.json({
    items: bookings.map((b) => ({
      id: b.id,
      status: b.status,
      seatsBooked: b.seatsBooked,
      totalPrice: b.totalPrice,
      paymentMethod: b.paymentMethod,
      paymentStatus: b.paymentStatus,
      otpCode: b.passengerId === user.id || b.ride.driverId === user.id ? b.otpCode : null,
      requestedAt: b.requestedAt,
      confirmedAt: b.confirmedAt,
      startedAt: b.startedAt,
      completedAt: b.completedAt,
      ride: b.ride,
      passenger: b.passenger,
    })),
  })
}
