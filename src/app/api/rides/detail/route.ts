import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const ride = await db.ride.findUnique({
    where: { id },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          phone: true,
          avatarUrl: true,
          driverRating: true,
          driverProfile: { select: { rating: true, totalRides: true, totalEarnings: true } },
        },
      },
      vehicle: true,
      bookings: {
        include: {
          passenger: { select: { id: true, name: true, phone: true, avatarUrl: true, passengerRating: true } },
        },
      },
      liveLocation: true,
    },
  })
  if (!ride) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Allow driver of this ride OR passengers with a confirmed booking
  const isDriver = ride.driverId === user.id
  const isPassenger = ride.bookings.some(
    (b) => b.passengerId === user.id && ['CONFIRMED', 'STARTED', 'COMPLETED'].includes(b.status)
  )
  const isAdmin = user.isAdmin
  if (!isDriver && !isPassenger && !isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ride })
}
