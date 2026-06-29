import { db } from './db'

/**
 * Verification gate helper.
 *
 * Per spec:
 *  - Passengers cannot book until verified (email must be verified; phone & KYC are
 *    auto-approved in dev but the full workflow exists in /api/verify/* routes).
 *  - Drivers cannot offer rides until driver AND vehicle verification are approved.
 */

export interface VerificationStatus {
  emailVerified: boolean
  phoneVerified: boolean
  kycStatus: string
  driverStatus: string
  hasApprovedVehicle: boolean
  canBookRide: boolean
  canOfferRide: boolean
}

export async function getVerificationStatus(userId: string): Promise<VerificationStatus> {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      driverProfile: true,
      vehicles: true,
    },
  })
  if (!user) {
    return {
      emailVerified: false,
      phoneVerified: false,
      kycStatus: 'PENDING',
      driverStatus: 'NONE',
      hasApprovedVehicle: false,
      canBookRide: false,
      canOfferRide: false,
    }
  }
  const hasApprovedVehicle = user.vehicles.some(v => v.status === 'APPROVED')
  const driverApproved = user.driverStatus === 'APPROVED' && user.driverProfile?.status === 'APPROVED'
  return {
    emailVerified: user.emailVerified,
    phoneVerified: user.phoneVerified,
    kycStatus: user.kycStatus,
    driverStatus: user.driverStatus,
    hasApprovedVehicle,
    canBookRide: user.emailVerified && user.phoneVerified && user.kycStatus === 'APPROVED',
    canOfferRide: driverApproved && hasApprovedVehicle,
  }
}

/**
 * In dev mode, auto-approve phone + KYC for a freshly registered user.
 * Email verification is a real flow (token-based) but in dev we can also pre-approve
 * for convenience — we expose both via the /api/verify/email-confirm dev shortcut.
 */
export async function autoApproveDevVerifications(userId: string) {
  if (process.env.NODE_ENV !== 'production') {
    await db.user.update({
      where: { id: userId },
      data: {
        phoneVerified: true,
        kycStatus: 'APPROVED',
      },
    })
    await db.verification.upsert({
      where: { userId_type: { userId, type: 'PHONE' } },
      update: { status: 'APPROVED', reviewedAt: new Date() },
      create: { userId, type: 'PHONE', status: 'APPROVED', reviewedAt: new Date() },
    }).catch(() => {})
    await db.verification.upsert({
      where: { userId_type: { userId, type: 'KYC' } },
      update: { status: 'APPROVED', reviewedAt: new Date() },
      create: { userId, type: 'KYC', status: 'APPROVED', reviewedAt: new Date() },
    }).catch(() => {})
  }
}
