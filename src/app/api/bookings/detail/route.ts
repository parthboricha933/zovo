import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id },
    include: {
      ride: {
        include: {
          driver: { select: { id: true, name: true, phone: true, avatarUrl: true, driverRating: true } },
          vehicle: true,
          liveLocation: true,
        },
      },
      passenger: { select: { id: true, name: true, phone: true, avatarUrl: true, passengerRating: true } },
      messages: {
        orderBy: { createdAt: 'asc' },
        take: 500,
      },
      reviews: true,
    },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isPassenger = booking.passengerId === user.id
  const isDriver = booking.ride.driverId === user.id
  if (!isPassenger && !isDriver && !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({
    booking: {
      id: booking.id,
      status: booking.status,
      seatsBooked: booking.seatsBooked,
      totalPrice: booking.totalPrice,
      paymentMethod: booking.paymentMethod,
      paymentStatus: booking.paymentStatus,
      // Only show OTP to the passenger (and driver after accept for verify)
      otpCode: isPassenger || isDriver ? booking.otpCode : null,
      requestedAt: booking.requestedAt,
      confirmedAt: booking.confirmedAt,
      startedAt: booking.startedAt,
      completedAt: booking.completedAt,
      chatArchived: booking.chatArchived,
      ride: booking.ride,
      passenger: booking.passenger,
      messages: booking.messages,
      reviews: booking.reviews,
    },
  })
}
