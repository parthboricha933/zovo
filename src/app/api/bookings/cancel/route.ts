import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToRide } from '@/lib/realtime-push'

/**
 * Either passenger or driver cancels a confirmed booking.
 * - If passenger cancels: refund seats, notify driver
 * - If driver cancels individual booking: refund seats, notify passenger
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, reason } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  const isPassenger = booking.passengerId === user.id
  const isDriver = booking.ride.driverId === user.id
  if (!isPassenger && !isDriver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['REQUESTED', 'CONFIRMED'].includes(booking.status)) {
    return NextResponse.json({ error: 'Cannot cancel this booking' }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CANCELLED', cancelledAt: new Date() },
    })
    if (booking.status === 'CONFIRMED') {
      await tx.ride.update({
        where: { id: booking.rideId },
        data: { availableSeats: { increment: booking.seatsBooked } },
      })
    }
  })

  const otherUserId = isPassenger ? booking.ride.driverId : booking.passengerId
  await notify({
    userId: otherUserId,
    type: 'BOOKING_REJECTED',
    title: 'Booking Cancelled',
    body: isPassenger
      ? `Passenger cancelled their booking for ${booking.ride.destAddress}.`
      : `Driver cancelled your booking for ${booking.ride.destAddress}.`,
    data: { rideId: booking.rideId, bookingId, reason },
  })
  await pushToRide(booking.rideId, 'ride:seats', {
    rideId: booking.rideId,
    availableSeats: booking.ride.availableSeats + booking.seatsBooked,
  })

  return NextResponse.json({ ok: true })
}
