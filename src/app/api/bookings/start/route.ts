import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Convenience endpoint to start a booking directly without OTP (used in cases where
 * driver wants to start the ride). Kept for completeness; main flow uses verify-otp.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({ where: { id: bookingId } })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })

  await db.booking.update({
    where: { id: bookingId },
    data: { status: 'STARTED', startedAt: new Date(), otpVerifiedAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
