import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Fetch messages for a booking (most recent first or chronological).
 * Query: ?bookingId=...&before=<iso>&limit=50
 */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const bookingId = searchParams.get('bookingId')
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true },
  })
  if (!booking) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (booking.passengerId !== user.id && booking.ride.driverId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const before = searchParams.get('before')
  const limit = parseInt(searchParams.get('limit') || '100')

  const messages = await db.message.findMany({
    where: {
      bookingId,
      ...(before ? { createdAt: { lt: new Date(before) } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return NextResponse.json({ items: messages.reverse() })
}
