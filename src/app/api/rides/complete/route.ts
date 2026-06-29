import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToRide } from '@/lib/realtime-push'
import { sendRideCompletedEmail } from '@/lib/mailer'

/**
 * Driver completes the ride.
 * - Sets ride.status = COMPLETED
 * - Marks all STARTED bookings as COMPLETED
 * - Archives chats
 * - Aggregates driver earnings + ride counts
 * - Updates passenger ride counts
 * - Updates LiveLocation cleanup
 * - Sends "ride completed" email to passengers
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rideId } = await req.json()
  if (!rideId) return NextResponse.json({ error: 'rideId required' }, { status: 400 })

  const ride = await db.ride.findUnique({
    where: { id: rideId },
    include: { bookings: { include: { passenger: { select: { id: true, name: true, email: true } } } }, vehicle: true },
  })
  if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  if (ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (!['ACTIVE', 'ONGOING'].includes(ride.status)) {
    return NextResponse.json({ error: 'Ride is not active' }, { status: 400 })
  }

  const completedBookings = ride.bookings.filter((b) => b.status === 'STARTED')

  await db.$transaction(async (tx) => {
    await tx.ride.update({
      where: { id: rideId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    })

    for (const b of completedBookings) {
      await tx.booking.update({
        where: { id: b.id },
        data: { status: 'COMPLETED', completedAt: new Date(), chatArchived: true },
      })

      // Payment (CASH = paid at completion)
      const platformFee = Math.round(b.totalPrice * 0.1 * 100) / 100
      const driverPayout = b.totalPrice - platformFee
      await tx.payment.create({
        data: {
          bookingId: b.id,
          userId: ride.driverId,
          amount: b.totalPrice,
          method: b.paymentMethod,
          status: b.paymentMethod === 'CASH' ? 'PAID' : b.paymentStatus,
          platformFee,
          driverPayout,
          paidAt: b.paymentMethod === 'CASH' ? new Date() : null,
        },
      })

      // Update driver earnings
      await tx.driverProfile.update({
        where: { userId: ride.driverId },
        data: {
          totalEarnings: { increment: driverPayout },
          totalRides: { increment: 1 },
        },
      })
      await tx.user.update({
        where: { id: ride.driverId },
        data: { driverRides: { increment: 1 } },
      })
      // Update passenger ride count
      await tx.user.update({
        where: { id: b.passengerId },
        data: { passengerRides: { increment: 1 } },
      })
      await tx.passengerProfile.update({
        where: { userId: b.passengerId },
        data: { totalRides: { increment: 1 } },
      })
    }

    // Clean up live location
    await tx.liveLocation.deleteMany({ where: { rideId } })
  })

  // Notify passengers + send emails
  for (const b of completedBookings) {
    await notify({
      userId: b.passengerId,
      type: 'RIDE_COMPLETED',
      title: 'Ride Completed',
      body: 'Your ride has been completed. Please rate your experience.',
      data: { rideId, bookingId: b.id },
    })

    // Send ride-completed email to passenger
    await sendRideCompletedEmail({
      to: b.passenger.email,
      passengerName: b.passenger.name,
      driverName: user.name,
      pickupAddress: ride.pickupAddress,
      destAddress: ride.destAddress,
      departureTime: ride.departureTime,
      totalPrice: b.totalPrice,
      seatsBooked: b.seatsBooked,
    })
  }
  await pushToRide(rideId, 'ride:completed', { rideId })

  return NextResponse.json({ ok: true })
}
