import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'

/**
 * Phone verification request — in production this would SMS a 6-digit code.
 * In dev, we auto-approve.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { phone } = await req.json().catch(() => ({}))
  if (phone) {
    await db.user.update({ where: { id: user.id }, data: { phone } })
  }

  // Dev: auto-approve
  await db.user.update({ where: { id: user.id }, data: { phoneVerified: true } })
  await db.verification.upsert({
    where: { userId_type: { userId: user.id, type: 'PHONE' } },
    update: { status: 'APPROVED', reviewedAt: new Date() },
    create: { userId: user.id, type: 'PHONE', status: 'APPROVED', reviewedAt: new Date() },
  })
  await notify({
    userId: user.id,
    type: 'VERIFICATION_APPROVED',
    title: 'Phone Verified',
    body: 'Your phone number has been verified.',
  })

  return NextResponse.json({ ok: true, phoneVerified: true })
}
