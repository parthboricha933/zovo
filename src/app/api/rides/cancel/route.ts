import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToUsers } from '@/lib/realtime-push'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rideId } = await req.json()
  if (!rideId) return NextResponse.json({ error: 'rideId required' }, { status: 400 })

  const ride = await db.ride.findUnique({
    where: { id: rideId },
    include: { bookings: true },
  })
  if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  if (ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['SCHEDULED', 'ACTIVE'].includes(ride.status)) {
    return NextResponse.json({ error: 'Cannot cancel this ride' }, { status: 400 })
  }

  await db.ride.update({ where: { id: rideId }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

  // Cancel all confirmed/requested bookings
  await db.booking.updateMany({
    where: { rideId, status: { in: ['REQUESTED', 'CONFIRMED'] } },
    data: { status: 'CANCELLED', cancelledAt: new Date() },
  })

  // Notify passengers
  const affected = ride.bookings.filter((b) => ['REQUESTED', 'CONFIRMED'].includes(b.status))
  for (const b of affected) {
    await notify({
      userId: b.passengerId,
      type: 'BOOKING_REJECTED',
      title: 'Ride Cancelled',
      body: `Your ride from ${ride.pickupAddress} to ${ride.destAddress} was cancelled by the driver.`,
      data: { rideId, bookingId: b.id },
    })
    await pushToUsers([b.passengerId], 'booking:cancelled', { rideId, bookingId: b.id })
  }

  return NextResponse.json({ ok: true })
}
