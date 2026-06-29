import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToRide } from '@/lib/realtime-push'
import { sendRideStartedEmail } from '@/lib/mailer'

/**
 * Driver verifies the OTP the passenger shared at pickup.
 * Sets booking.status = STARTED, ride.status = ONGOING.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId, otp } = await req.json()
  if (!bookingId || !otp) return NextResponse.json({ error: 'bookingId and otp required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true, passenger: { select: { id: true, name: true, email: true } } },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (booking.status !== 'CONFIRMED') {
    return NextResponse.json({ error: `Booking is ${booking.status}, cannot start` }, { status: 400 })
  }
  if (booking.otpCode !== otp) {
    return NextResponse.json({ error: 'Incorrect OTP. Ride cannot be started.' }, { status: 400 })
  }

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'STARTED', startedAt: new Date(), otpVerifiedAt: new Date() },
    })
    await tx.ride.update({
      where: { id: booking.rideId },
      data: { status: 'ONGOING' },
    })
  })

  await notify({
    userId: booking.passengerId,
    type: 'RIDE_STARTED',
    title: 'Ride Started',
    body: 'Your ride has started. Enjoy the trip!',
    data: { rideId: booking.rideId, bookingId },
  })
  await pushToRide(booking.rideId, 'ride:started', { rideId: booking.rideId, bookingId })
  await pushToRide(booking.rideId, 'otp:verified', { bookingId })

  // Send ride-started email to passenger
  await sendRideStartedEmail({
    to: booking.passenger.email,
    passengerName: booking.passenger.name,
    driverName: user.name,
    pickupAddress: booking.ride.pickupAddress,
    destAddress: booking.ride.destAddress,
    departureTime: booking.ride.departureTime,
    totalPrice: booking.totalPrice,
    seatsBooked: booking.seatsBooked,
  })

  return NextResponse.json({ ok: true, status: 'STARTED' })
}
