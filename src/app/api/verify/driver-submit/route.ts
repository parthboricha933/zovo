import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { shouldAutoApproveVerifications } from '@/lib/dev-mode'

/**
 * Driver verification submission.
 * Body: { licenseNumber, licenseExpiry (ISO), licenseImage?, aadhaarNumber?, aadhaarImage? }
 *
 * In dev, auto-approve; in production an admin reviews via /api/admin/verify/review.
 */
const schema = z.object({
  licenseNumber: z.string().min(3),
  licenseExpiry: z.string(),
  licenseImage: z.string().optional(),
  aadhaarNumber: z.string().optional(),
  aadhaarImage: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
  }
  const { licenseNumber, licenseExpiry, licenseImage, aadhaarNumber, aadhaarImage } = parsed.data

  const profile = await db.driverProfile.upsert({
    where: { userId: user.id },
    update: {
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      licenseImage: licenseImage || null,
      aadhaarNumber: aadhaarNumber || null,
      aadhaarImage: aadhaarImage || null,
    },
    create: {
      userId: user.id,
      licenseNumber,
      licenseExpiry: new Date(licenseExpiry),
      licenseImage: licenseImage || null,
      aadhaarNumber: aadhaarNumber || null,
      aadhaarImage: aadhaarImage || null,
    },
  })

  await db.verification.upsert({
    where: { userId_type: { userId: user.id, type: 'DRIVER' } },
    update: { status: 'PENDING', documentUrl: licenseImage || null },
    create: {
      userId: user.id,
      type: 'DRIVER',
      status: 'PENDING',
      documentUrl: licenseImage || null,
    },
  })

  // Auto-approve if enabled (default ON in dev, OFF in production unless AUTO_APPROVE_VERIFICATIONS=1)
  if (shouldAutoApproveVerifications()) {
    await db.driverProfile.update({
      where: { userId: user.id },
      data: { status: 'APPROVED', verifiedAt: new Date() },
    })
    await db.user.update({ where: { id: user.id }, data: { driverStatus: 'APPROVED' } })
    await db.verification.update({
      where: { userId_type: { userId: user.id, type: 'DRIVER' } },
      data: { status: 'APPROVED', reviewedAt: new Date(), reviewedBy: user.id },
    })
    await notify({
      userId: user.id,
      type: 'VERIFICATION_APPROVED',
      title: 'Driver Verified',
      body: 'Your driver verification has been approved. Add a vehicle to start offering rides.',
    })
  } else {
    await db.user.update({ where: { id: user.id }, data: { driverStatus: 'PENDING' } })
  }

  // Re-fetch the profile so the response reflects the post-approve state
  const updatedProfile = await db.driverProfile.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ ok: true, profile: updatedProfile })
}
