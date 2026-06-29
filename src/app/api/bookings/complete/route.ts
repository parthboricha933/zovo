import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Passenger can mark their booking as completed (after driver does). Useful as a
 * fallback. Driver's /api/rides/complete is the main trigger.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({ where: { id: bookingId } })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.passengerId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  await db.booking.update({
    where: { id: bookingId },
    data: { status: 'COMPLETED', completedAt: new Date(), chatArchived: true },
  })

  return NextResponse.json({ ok: true })
}
