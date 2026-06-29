import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { pushToRide } from '@/lib/realtime-push'

/**
 * Update the current user's live location (used for ride tracking).
 * Body: { rideId?, lat, lng, heading?, speed? }
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { rideId, lat, lng, heading, speed } = await req.json()
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    return NextResponse.json({ error: 'invalid coords' }, { status: 400 })
  }

  await db.liveLocation.upsert({
    where: { userId: user.id },
    update: { lat, lng, heading, speed, rideId: rideId || null },
    create: { userId: user.id, rideId: rideId || null, lat, lng, heading, speed },
  })

  if (rideId) {
    await pushToRide(rideId, 'ride:location', {
      rideId,
      lat,
      lng,
      heading,
      speed,
      userId: user.id,
      ts: Date.now(),
    })
  }

  return NextResponse.json({ ok: true })
}
