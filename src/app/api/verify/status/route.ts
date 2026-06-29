import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { getVerificationStatus } from '@/lib/verification'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const vs = await getVerificationStatus(user.id)
  return NextResponse.json({
    ...vs,
    driverProfile: user.driverProfile
      ? {
          licenseNumber: user.driverProfile.licenseNumber,
          status: user.driverProfile.status,
        }
      : null,
    vehicles: user.vehicles.map((v) => ({
      id: v.id,
      make: v.make,
      model: v.model,
      plateNumber: v.plateNumber,
      status: v.status,
      totalSeats: v.totalSeats,
      vehicleType: v.vehicleType,
    })),
  })
}
