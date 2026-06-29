import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

const schema = z.object({
  bookingId: z.string().min(1),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
})

/**
 * Submit a review after ride completion.
 * - One review per (bookingId, reviewerId)
 * - Updates aggregate rating on the reviewee (driver or passenger)
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { bookingId, rating, comment } = parsed.data

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.status !== 'COMPLETED') {
    return NextResponse.json({ error: 'Can only rate completed rides' }, { status: 400 })
  }

  const isPassenger = booking.passengerId === user.id
  const isDriver = booking.ride.driverId === user.id
  if (!isPassenger && !isDriver) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const revieweeId = isPassenger ? booking.ride.driverId : booking.passengerId
  if (revieweeId === user.id) return NextResponse.json({ error: 'Cannot review yourself' }, { status: 400 })

  // Idempotent: upsert
  const review = await db.review.upsert({
    where: { bookingId_reviewerId: { bookingId, reviewerId: user.id } },
    update: { rating, comment },
    create: {
      bookingId,
      rideId: booking.rideId,
      reviewerId: user.id,
      revieweeId,
      rating,
      comment,
    },
  })

  // Update aggregate rating (simple running average)
  const allReviews = await db.review.findMany({ where: { revieweeId } })
  const avg = allReviews.reduce((s, r) => s + r.rating, 0) / allReviews.length
  if (isPassenger) {
    // passenger rated driver
    await db.user.update({ where: { id: revieweeId }, data: { driverRating: Math.round(avg * 100) / 100 } })
    await db.driverProfile.updateMany({ where: { userId: revieweeId }, data: { rating: Math.round(avg * 100) / 100 } })
  } else {
    // driver rated passenger
    await db.user.update({ where: { id: revieweeId }, data: { passengerRating: Math.round(avg * 100) / 100 } })
    await db.passengerProfile.updateMany({ where: { userId: revieweeId }, data: { rating: Math.round(avg * 100) / 100 } })
  }

  return NextResponse.json({ ok: true, review })
}
