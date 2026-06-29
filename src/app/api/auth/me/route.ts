import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVerificationStatus } from '@/lib/verification'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null }, { status: 200 })
  const vs = await getVerificationStatus(user.id)
  return NextResponse.json({
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatarUrl: user.avatarUrl,
      activeRole: user.activeRole,
      isAdmin: user.isAdmin,
      emailVerified: user.emailVerified,
      phoneVerified: user.phoneVerified,
      kycStatus: user.kycStatus,
      driverStatus: user.driverStatus,
      passengerRating: user.passengerRating,
      driverRating: user.driverRating,
      passengerRides: user.passengerRides,
      driverRides: user.driverRides,
      hasDriverProfile: !!user.driverProfile,
      hasPassengerProfile: !!user.passengerProfile,
      driverProfile: user.driverProfile
        ? {
            id: user.driverProfile.id,
            licenseNumber: user.driverProfile.licenseNumber,
            licenseExpiry: user.driverProfile.licenseExpiry,
            status: user.driverProfile.status,
            rating: user.driverProfile.rating,
            totalRides: user.driverProfile.totalRides,
            totalEarnings: user.driverProfile.totalEarnings,
          }
        : null,
      vehicles: user.vehicles ?? [],
    },
    verification: vs,
  })
}
