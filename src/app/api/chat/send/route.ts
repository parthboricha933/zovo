import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { pushToUser } from '@/lib/realtime-push'

const schema = z.object({
  bookingId: z.string().min(1),
  content: z.string().min(1).max(2000),
})

/**
 * Persist + broadcast a chat message.
 * Real-time delivery is done via socket.io 'chat:send' client event; this endpoint
 * also stores it in the DB for history and pushes a notification to the other party.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  const { bookingId, content } = parsed.data

  const booking = await db.booking.findUnique({
    where: { id: bookingId },
    include: { ride: true },
  })
  if (!booking) return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  if (booking.passengerId !== user.id && booking.ride.driverId !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (booking.chatArchived) {
    return NextResponse.json({ error: 'Chat is archived' }, { status: 400 })
  }

  const message = await db.message.create({
    data: { bookingId, senderId: user.id, content },
  })

  // Notify the other party
  const recipientId = booking.passengerId === user.id ? booking.ride.driverId : booking.passengerId
  await notify({
    userId: recipientId,
    type: 'CHAT_MESSAGE',
    title: 'New Message',
    body: content.slice(0, 80),
    data: { bookingId, messageId: message.id, senderId: user.id },
  })
  await pushToUser(recipientId, 'chat:message', {
    id: message.id,
    bookingId,
    senderId: user.id,
    content,
    createdAt: message.createdAt,
  })

  return NextResponse.json({ message })
}
