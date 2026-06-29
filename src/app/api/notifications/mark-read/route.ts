import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const count = await db.notification.count({ where: { userId: user.id, readAt: null } })
  return NextResponse.json({ count })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await req.json()
  if (id) {
    await db.notification.update({ where: { id, userId: user.id }, data: { readAt: new Date() } })
  } else {
    await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } })
  }
  return NextResponse.json({ ok: true })
}
