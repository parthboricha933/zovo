import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'

/**
 * KYC submission — in dev we auto-approve.
 * Body: { aadhaarNumber?, aadhaarImage?, address?, documentUrl? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  await db.user.update({ where: { id: user.id }, data: { kycStatus: 'APPROVED' } })
  await db.verification.upsert({
    where: { userId_type: { userId: user.id, type: 'KYC' } },
    update: { status: 'APPROVED', documentUrl: body.documentUrl || null, reviewedAt: new Date() },
    create: {
      userId: user.id,
      type: 'KYC',
      status: 'APPROVED',
      documentUrl: body.documentUrl || null,
      reviewedAt: new Date(),
    },
  })
  await notify({
    userId: user.id,
    type: 'VERIFICATION_APPROVED',
    title: 'KYC Approved',
    body: 'Your KYC verification has been approved.',
  })

  return NextResponse.json({ ok: true, kycStatus: 'APPROVED' })
}
