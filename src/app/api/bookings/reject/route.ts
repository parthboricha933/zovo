import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToUser } from '@/lib/realtime-push'
import { sendBookingRejectedEmail } from '@/lib/mailer'

/**
 * Driver rejects a booking request.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, reason } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true, passenger: { select: { id: true, name: true, email: true } } },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (booking.status !== 'REQUESTED') {
    return NextResponse.json({ error: `Booking already ${booking.status}` }, { status: 400 })
  }

  await db.booking.update({
    where: { id: bookingId },
    data: { status: 'REJECTED', rejectedAt: new Date() },
  })

  await notify({
    userId: booking.passengerId,
    type: 'BOOKING_REJECTED',
    title: 'Booking Declined',
    body: `Your booking request for ${booking.ride.destAddress} was declined by the driver.`,
    data: { rideId: booking.rideId, bookingId: booking.id, reason },
  })
  await pushToUser(booking.passengerId, 'booking:rejected', {
    bookingId,
    rideId: booking.rideId,
    reason: reason || 'Driver declined the request',
  })

  // Send rejection email to passenger
  await sendBookingRejectedEmail({
    to: booking.passenger.email,
    passengerName: booking.passenger.name,
    driverName: user.name,
    pickupAddress: booking.ride.pickupAddress,
    destAddress: booking.ride.destAddress,
    departureTime: booking.ride.departureTime,
    totalPrice: booking.totalPrice,
    seatsBooked: booking.seatsBooked,
    reason,
  })

  return NextResponse.json({ ok: true })
}
