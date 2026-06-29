import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getVerificationStatus } from '@/lib/verification'
import { notify } from '@/lib/notify'
import { pushToUser } from '@/lib/realtime-push'
import { generateOtpCode } from '@/lib/auth'

const schema = z.object({
  rideId: z.string().min(1),
  seatsBooked: z.coerce.number().int().min(1).max(8),
  paymentMethod: z.enum(['CASH', 'UPI', 'RAZORPAY', 'STRIPE']).default('CASH'),
})

/**
 * Passenger requests a booking on a ride.
 * - Validates verification status
 * - Validates ride is bookable
 * - Validates seat availability
 * - Auto-accepts if driver pre-approved instant bookings (we treat all as REQUESTED first)
 * - Sends realtime booking:request event to driver + persists notification
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vs = await getVerificationStatus(user.id)
  if (!vs.canBookRide) {
    return NextResponse.json(
      { error: 'Please complete verification before booking a ride' },
      { status: 403 }
    )
  }

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const { rideId, seatsBooked, paymentMethod } = parsed.data

  const ride = await db.ride.findUnique({ where: { id: rideId }, include: { driver: true } })
  if (!ride) return NextResponse.json({ error: 'Ride not found' }, { status: 404 })
  if (ride.driverId === user.id) return NextResponse.json({ error: 'Cannot book your own ride' }, { status: 400 })
  if (!['SCHEDULED', 'ACTIVE'].includes(ride.status)) {
    return NextResponse.json({ error: 'Ride is not available for booking' }, { status: 400 })
  }
  if (ride.availableSeats < seatsBooked) {
    return NextResponse.json({ error: `Only ${ride.availableSeats} seat(s) available` }, { status: 400 })
  }
  // Check existing pending/confirmed booking for same ride by same passenger
  const existing = await db.booking.findFirst({
    where: {
      rideId,
      passengerId: user.id,
      status: { in: ['REQUESTED', 'CONFIRMED', 'STARTED'] },
    },
  })
  if (existing) {
    return NextResponse.json({ error: 'You already have an active booking on this ride', bookingId: existing.id }, { status: 400 })
  }

  const totalPrice = ride.pricePerSeat * seatsBooked

  const booking = await db.booking.create({
    data: {
      rideId,
      passengerId: user.id,
      seatsBooked,
      totalPrice,
      status: 'REQUESTED',
      paymentMethod,
      paymentStatus: paymentMethod === 'CASH' ? 'PENDING' : 'PENDING',
    },
    include: { ride: true, passenger: { select: { id: true, name: true, phone: true, avatarUrl: true, passengerRating: true } } },
  })

  // Notify driver
  await notify({
    userId: ride.driverId,
    type: 'BOOKING_REQUEST',
    title: 'New Booking Request',
    body: `${user.name} requested ${seatsBooked} seat(s) on your ride to ${ride.destAddress}.`,
    data: {
      rideId,
      bookingId: booking.id,
      pickup: ride.pickupAddress,
      destination: ride.destAddress,
      seatsBooked,
      totalPrice,
    },
  })
  await pushToUser(ride.driverId, 'booking:request', {
    booking,
    ride: { id: ride.id, pickupAddress: ride.pickupAddress, destAddress: ride.destAddress, departureTime: ride.departureTime, pricePerSeat: ride.pricePerSeat },
    passenger: booking.passenger,
  })

  return NextResponse.json({ booking })
}
