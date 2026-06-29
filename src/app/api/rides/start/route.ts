import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'

/**
 * Driver marks the ride as ACTIVE (waiting for passengers at pickup / about to start).
 * This is a soft pre-start state. The actual ride starts when OTP is verified on at
 * least one booking, via /api/bookings/verify-otp + /api/bookings/start.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rideId } = await req.json()
  if (!rideId) return NextResponse.json({ error: 'rideId required' }, { status: 400 })

  const ride = await db.ride.findUnique({ where: { id: rideId }, include: { bookings: true } })
  if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  if (ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['SCHEDULED'].includes(ride.status)) {
    return NextResponse.json({ error: 'Ride cannot be activated' }, { status: 400 })
  }

  await db.ride.update({ where: { id: rideId }, data: { status: 'ACTIVE', startedAt: new Date() } })

  // Notify confirmed passengers that driver is on the way
  const confirmed = ride.bookings.filter((b) => b.status === 'CONFIRMED')
  for (const b of confirmed) {
    await notify({
      userId: b.passengerId,
      type: 'DRIVER_ARRIVED',
      title: 'Driver On The Way',
      body: `Your driver has started the ride. Track live on the map.`,
      data: { rideId, bookingId: b.id },
    })
  }

  return NextResponse.json({ ok: true })
}
