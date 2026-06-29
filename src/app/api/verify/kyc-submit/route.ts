import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { shouldAutoApproveVerifications } from '@/lib/dev-mode'

/**
 * KYC submission — auto-approved in dev (or when AUTO_APPROVE_VERIFICATIONS=1).
 * Body: { aadhaarNumber?, aadhaarImage?, address?, documentUrl? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))

  const autoApprove = shouldAutoApproveVerifications()
  const newStatus = autoApprove ? 'APPROVED' : 'PENDING'

  await db.user.update({ where: { id: user.id }, data: { kycStatus: newStatus } })
  await db.verification.upsert({
    where: { userId_type: { userId: user.id, type: 'KYC' } },
    update: { status: newStatus, documentUrl: body.documentUrl || null, reviewedAt: autoApprove ? new Date() : null },
    create: {
      userId: user.id,
      type: 'KYC',
      status: newStatus,
      documentUrl: body.documentUrl || null,
      reviewedAt: autoApprove ? new Date() : null,
    },
  })

  if (autoApprove) {
    await notify({
      userId: user.id,
      type: 'VERIFICATION_APPROVED',
      title: 'KYC Approved',
      body: 'Your KYC verification has been approved.',
    })
  }

  return NextResponse.json({ ok: true, kycStatus: newStatus })
}
