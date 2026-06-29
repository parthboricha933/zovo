import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * List rides for the current user.
 * Query: ?role=DRIVER (rides I offered) | PASSENGER (rides I booked onto) | all
 *        &status=SCHEDULED|ACTIVE|ONGOING|COMPLETED|CANCELLED
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const role = searchParams.get('role') || 'all'
  const status = searchParams.get('status')
  const type = searchParams.get('type') // upcoming | active | history

  const now = new Date()
  let rides: any[] = []

  if (role === 'DRIVER' || role === 'all') {
    const driverRides = await db.ride.findMany({
      where: {
        driverId: user.id,
        ...(status ? { status } : {}),
        ...(type === 'upcoming'
          ? { status: 'SCHEDULED', departureTime: { gte: now } }
          : type === 'active'
          ? { status: { in: ['ACTIVE', 'ONGOING'] } }
          : type === 'history'
          ? { status: { in: ['COMPLETED', 'CANCELLED'] } }
          : {}),
      },
      include: {
        vehicle: true,
        bookings: {
          include: { passenger: { select: { id: true, name: true, avatarUrl: true, phone: true, passengerRating: true } } },
        },
      },
      orderBy: { departureTime: 'desc' },
      take: 50,
    })
    rides = rides.concat(driverRides.map((r) => ({ ...r, role: 'DRIVER' })))
  }

  if (role === 'PASSENGER' || role === 'all') {
    const bookings = await db.booking.findMany({
      where: {
        passengerId: user.id,
        ...(status ? { status } : {}),
        ...(type === 'upcoming'
          ? { status: { in: ['REQUESTED', 'CONFIRMED'] } }
          : type === 'active'
          ? { status: { in: ['CONFIRMED', 'STARTED'] } }
          : type === 'history'
          ? { status: { in: ['COMPLETED', 'CANCELLED', 'REJECTED'] } }
          : {}),
      },
      include: {
        ride: {
          include: {
            driver: { select: { id: true, name: true, avatarUrl: true, phone: true, driverRating: true } },
            vehicle: true,
          },
        },
      },
      orderBy: { requestedAt: 'desc' },
      take: 50,
    })
    rides = rides.concat(
      bookings.map((b) => ({ ...b.ride, role: 'PASSENGER', booking: b }))
    )
  }

  return NextResponse.json({ items: rides })
}
