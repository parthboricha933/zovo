import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

/**
 * Search published rides.
 * Query params:
 *   pickupLat, pickupLng, destLat, destLng, date (YYYY-MM-DD), seats (min), maxPrice, sortBy
 *
 * Match logic:
 *  - Pickup within 5km of requested pickup
 *  - Destination within 5km of requested destination
 *  - Available seats >= requested seats
 *  - Departure on/after requested date (if provided)
 *  - Status SCHEDULED or ACTIVE
 *  - Departure in the future
 */
const RADIUS_KM = 5

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const pickupLat = searchParams.get('pickupLat') ? parseFloat(searchParams.get('pickupLat')!) : null
  const pickupLng = searchParams.get('pickupLng') ? parseFloat(searchParams.get('pickupLng')!) : null
  const destLat = searchParams.get('destLat') ? parseFloat(searchParams.get('destLat')!) : null
  const destLng = searchParams.get('destLng') ? parseFloat(searchParams.get('destLng')!) : null
  const date = searchParams.get('date')
  const seats = searchParams.get('seats') ? parseInt(searchParams.get('seats')!) : 1
  const maxPrice = searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')!) : null
  const sortBy = searchParams.get('sortBy') || 'relevance' // relevance | price | departure | distance

  // Candidate rides
  const rides = await db.ride.findMany({
    where: {
      status: { in: ['SCHEDULED', 'ACTIVE'] },
      availableSeats: { gte: seats },
      departureTime: { gte: new Date() },
      driverId: { not: user.id }, // can't book own ride
      ...(maxPrice ? { pricePerSeat: { lte: maxPrice } } : {}),
      ...(date
        ? {
            departureTime: {
              gte: new Date(`${date}T00:00:00`),
              lte: new Date(`${date}T23:59:59`),
            },
          }
        : {}),
    },
    include: {
      driver: {
        select: {
          id: true,
          name: true,
          driverRating: true,
          avatarUrl: true,
          phone: true,
          driverProfile: { select: { rating: true, totalRides: true } },
        },
      },
      vehicle: { select: { make: true, model: true, color: true, plateNumber: true, vehicleType: true } },
      bookings: { where: { status: { in: ['CONFIRMED', 'STARTED'] } }, select: { id: true, seatsBooked: true, passengerId: true } },
    },
    orderBy: { departureTime: 'asc' },
    take: 100,
  })

  let filtered = rides
  if (pickupLat != null && pickupLng != null && destLat != null && destLng != null) {
    filtered = rides.filter((r) => {
      const pickupDist = haversineKm(pickupLat, pickupLng, r.pickupLat, r.pickupLng)
      const destDist = haversineKm(destLat, destLng, r.destLat, r.destLng)
      return pickupDist <= RADIUS_KM + 50 && destDist <= RADIUS_KM + 50
    })
  }

  // Sort
  const sortFns: Record<string, (a: any, b: any) => number> = {
    price: (a, b) => a.pricePerSeat - b.pricePerSeat,
    departure: (a, b) => new Date(a.departureTime).getTime() - new Date(b.departureTime).getTime(),
    distance: (a, b) => (a._pickupDist ?? 0) - (b._pickupDist ?? 0),
    relevance: (a, b) => {
      const aScore = (a._pickupDist ?? 999) + (a._destDist ?? 999)
      const bScore = (b._pickupDist ?? 999) + (b._destDist ?? 999)
      return aScore - bScore
    },
  }
  // Compute distances for sorting
  const withDist = filtered.map((r) => {
    const _pickupDist =
      pickupLat != null && pickupLng != null ? haversineKm(pickupLat, pickupLng, r.pickupLat, r.pickupLng) : null
    const _destDist =
      destLat != null && destLng != null ? haversineKm(destLat, destLng, r.destLat, r.destLng) : null
    return { ...r, _pickupDist, _destDist }
  })
  withDist.sort(sortFns[sortBy] || sortFns.relevance)

  return NextResponse.json({
    items: withDist.map((r) => ({
      id: r.id,
      pickupAddress: r.pickupAddress,
      destAddress: r.destAddress,
      pickupLat: r.pickupLat,
      pickupLng: r.pickupLng,
      destLat: r.destLat,
      destLng: r.destLng,
      departureTime: r.departureTime,
      pricePerSeat: r.pricePerSeat,
      availableSeats: r.availableSeats,
      totalSeats: r.totalSeats,
      status: r.status,
      routeDistance: r.routeDistance,
      routeDuration: r.routeDuration,
      notes: r.notes,
      pickupDistKm: r._pickupDist,
      destDistKm: r._destDist,
      driver: r.driver,
      vehicle: r.vehicle,
    })),
  })
}
