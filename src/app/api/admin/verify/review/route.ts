import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { verificationId, status, notes } = await req.json().catch(() => ({}))
  if (!verificationId || !['APPROVED', 'REJECTED'].includes(status)) {
    return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
  }

  const v = await db.verification.update({
    where: { id: verificationId },
    data: { status, notes, reviewedAt: new Date(), reviewedBy: user.id },
  })

  // Apply side effects based on type
  if (v.type === 'KYC') {
    await db.user.update({ where: { id: v.userId }, data: { kycStatus: status } })
  } else if (v.type === 'DRIVER') {
    await db.user.update({ where: { id: v.userId }, data: { driverStatus: status } })
    if (status === 'APPROVED') {
      await db.driverProfile.updateMany({
        where: { userId: v.userId },
        data: { status: 'APPROVED', verifiedAt: new Date() },
      })
    }
  } else if (v.type === 'VEHICLE') {
    // For vehicle verifications, documentUrl stores nothing; we look up by user
    if (status === 'APPROVED') {
      await db.vehicle.updateMany({
        where: { driverId: v.userId, status: 'PENDING' },
        data: { status: 'APPROVED', verifiedAt: new Date(), reviewedBy: user.id },
      })
    }
  } else if (v.type === 'PHONE') {
    await db.user.update({ where: { id: v.userId }, data: { phoneVerified: status === 'APPROVED' } })
  } else if (v.type === 'EMAIL') {
    await db.user.update({ where: { id: v.userId }, data: { emailVerified: status === 'APPROVED' } })
  }

  return NextResponse.json({ ok: true, verification: v })
}
