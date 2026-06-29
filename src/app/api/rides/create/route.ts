import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { getVerificationStatus } from '@/lib/verification'
import { notify, pushToUser } from '@/lib/notify'
import { pushToUsers } from '@/lib/realtime-push'

const schema = z.object({
  vehicleId: z.string().min(1),
  pickupAddress: z.string().min(2),
  pickupLat: z.coerce.number(),
  pickupLng: z.coerce.number(),
  destAddress: z.string().min(2),
  destLat: z.coerce.number(),
  destLng: z.coerce.number(),
  departureTime: z.string(),
  totalSeats: z.coerce.number().int().min(1).max(8),
  pricePerSeat: z.coerce.number().min(0),
  routeDistance: z.coerce.number().optional(),
  routeDuration: z.coerce.number().optional(),
  notes: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const vs = await getVerificationStatus(user.id)
  if (!vs.canOfferRide) {
    return NextResponse.json(
      { error: 'Driver and vehicle verification required before offering rides' },
      { status: 403 }
    )
  }

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
  }
  const d = parsed.data

  // Validate vehicle ownership
  const vehicle = await db.vehicle.findFirst({ where: { id: d.vehicleId, driverId: user.id } })
  if (!vehicle) return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })

  const departure = new Date(d.departureTime)
  if (departure.getTime() < Date.now() - 60 * 1000) {
    return NextResponse.json({ error: 'Departure time must be in the future' }, { status: 400 })
  }
  if (d.totalSeats > vehicle.totalSeats) {
    return NextResponse.json({ error: `Vehicle only has ${vehicle.totalSeats} seats` }, { status: 400 })
  }

  const ride = await db.ride.create({
    data: {
      driverId: user.id,
      vehicleId: vehicle.id,
      pickupAddress: d.pickupAddress,
      pickupLat: d.pickupLat,
      pickupLng: d.pickupLng,
      destAddress: d.destAddress,
      destLat: d.destLat,
      destLng: d.destLng,
      routeDistance: d.routeDistance || null,
      routeDuration: d.routeDuration || null,
      departureTime: departure,
      totalSeats: d.totalSeats,
      availableSeats: d.totalSeats,
      pricePerSeat: d.pricePerSeat,
      notes: d.notes || null,
      status: 'SCHEDULED',
    },
    include: {
      driver: { select: { id: true, name: true, driverRating: true, avatarUrl: true, phone: true } },
      vehicle: true,
    },
  })

  return NextResponse.json({ ride })
}
