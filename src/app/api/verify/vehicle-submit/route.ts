import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'
import { shouldAutoApproveVerifications } from '@/lib/dev-mode'

const schema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z.coerce.number().int().min(1990).max(new Date().getFullYear() + 1),
  plateNumber: z.string().min(3),
  color: z.string().min(1),
  vehicleType: z.enum(['SEDAN', 'SUV', 'HATCHBACK', 'AUTO', 'BIKE']).default('SEDAN'),
  totalSeats: z.coerce.number().int().min(1).max(8),
  rcImage: z.string().optional(),
  insuranceImage: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!user.driverProfile || user.driverProfile.status !== 'APPROVED') {
    return NextResponse.json({ error: 'Driver verification required first' }, { status: 403 })
  }

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid' }, { status: 400 })
  }
  const data = parsed.data

  const existingPlate = await db.vehicle.findUnique({ where: { plateNumber: data.plateNumber } })
  if (existingPlate) {
    return NextResponse.json({ error: 'Plate number already registered' }, { status: 400 })
  }

  const autoApprove = shouldAutoApproveVerifications()
  const vehicle = await db.vehicle.create({
    data: {
      driverId: user.id,
      make: data.make,
      model: data.model,
      year: data.year,
      plateNumber: data.plateNumber,
      color: data.color,
      vehicleType: data.vehicleType,
      totalSeats: data.totalSeats,
      rcImage: data.rcImage || null,
      insuranceImage: data.insuranceImage || null,
      status: autoApprove ? 'APPROVED' : 'PENDING',
      verifiedAt: autoApprove ? new Date() : null,
      reviewedBy: autoApprove ? user.id : null,
    },
  })

  await db.verification.create({
    data: {
      userId: user.id,
      type: 'VEHICLE',
      status: vehicle.status,
      documentUrl: data.rcImage || null,
      reviewedAt: vehicle.verifiedAt,
    },
  })

  if (vehicle.status === 'APPROVED') {
    await notify({
      userId: user.id,
      type: 'VERIFICATION_APPROVED',
      title: 'Vehicle Approved',
      body: `Your ${vehicle.make} ${vehicle.model} (${vehicle.plateNumber}) is approved. You can now offer rides!`,
    })
  }

  return NextResponse.json({ ok: true, vehicle })
}
