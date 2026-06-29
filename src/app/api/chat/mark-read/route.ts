import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { bookingId } = await req.json()
  if (!bookingId) return NextResponse.json({ error: 'bookingId required' }, { status: 400 })

  // Mark all messages in this booking NOT sent by me as read
  await db.message.updateMany({
    where: { bookingId, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
