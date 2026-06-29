import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToUser } from '@/lib/realtime-push'
import { generateOtpCode } from '@/lib/auth'
import { sendBookingAcceptedEmail } from '@/lib/mailer'

/**
 * Driver accepts a booking request.
 * - Sets booking.status = CONFIRMED
 * - Generates OTP
 * - Decrements ride.availableSeats
 * - Notifies passenger + pushes realtime event
 * - Sends email to passenger with ride details + OTP
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true, passenger: { select: { id: true, name: true, phone: true, email: true } } },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.ride.driverId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  if (booking.status !== 'REQUESTED') {
    return NextResponse.json({ error: `Booking already ${booking.status}` }, { status: 400 })
  }
  if (booking.ride.availableSeats < booking.seatsBooked) {
    return NextResponse.json({ error: 'Not enough seats available' }, { status: 400 })
  }

  const otp = generateOtpCode()

  await db.$transaction(async (tx) => {
    await tx.booking.update({
      where: { id: bookingId },
      data: { status: 'CONFIRMED', confirmedAt: new Date(), otpCode: otp },
    })
    await tx.ride.update({
      where: { id: booking.rideId },
      data: { availableSeats: { decrement: booking.seatsBooked } },
    })
  })

  // Notify passenger
  await notify({
    userId: booking.passengerId,
    type: 'BOOKING_ACCEPTED',
    title: 'Booking Confirmed',
    body: `Your booking to ${booking.ride.destAddress} is confirmed. OTP: ${otp}`,
    data: { rideId: booking.rideId, bookingId: booking.id, otp },
  })
  await pushToUser(booking.passengerId, 'booking:accepted', {
    booking: { id: booking.id, rideId: booking.rideId, status: 'CONFIRMED' },
    ride: { id: booking.ride.id, pickupAddress: booking.ride.pickupAddress, destAddress: booking.ride.destAddress, departureTime: booking.ride.departureTime, driverId: booking.ride.driverId },
  })
  // Send OTP to passenger only (driver gets it via the verify-otp route)
  await pushToUser(booking.passengerId, 'otp:generated', { bookingId: booking.id, otp })

  // Send email to passenger with booking details + OTP
  await sendBookingAcceptedEmail({
    to: booking.passenger.email,
    passengerName: booking.passenger.name,
    driverName: user.name,
    pickupAddress: booking.ride.pickupAddress,
    destAddress: booking.ride.destAddress,
    departureTime: booking.ride.departureTime,
    totalPrice: booking.totalPrice,
    seatsBooked: booking.seatsBooked,
    otp,
  })

  // Also post the OTP as a system message in the in-app chat so the passenger
  // can see it in the chat drawer too (not just email)
  await db.message.create({
    data: {
      bookingId: booking.id,
      senderId: user.id, // driver
      content: `✅ Booking confirmed! Your OTP for pickup is: ${otp}. Share this 6-digit code with me when we meet at the pickup location.`,
    },
  }).catch(() => {})

  return NextResponse.json({ ok: true, bookingId, status: 'CONFIRMED' })
}
