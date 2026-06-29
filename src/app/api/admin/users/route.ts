import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q') || ''
  const role = searchParams.get('role') // PASSENGER | DRIVER | ADMIN

  const where: any = {}
  if (q) {
    where.OR = [
      { name: { contains: q } },
      { email: { contains: q } },
      { phone: { contains: q } },
    ]
  }
  if (role === 'DRIVER') where.driverStatus = { not: 'NONE' }
  if (role === 'PASSENGER') where.passengerProfile = { isNot: null }
  if (role === 'ADMIN') where.isAdmin = true

  const users = await db.user.findMany({
    where,
    include: {
      driverProfile: true,
      passengerProfile: true,
      vehicles: { select: { id: true, make: true, model: true, plateNumber: true, status: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    items: users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      avatarUrl: u.avatarUrl,
      activeRole: u.activeRole,
      isAdmin: u.isAdmin,
      isBanned: u.isBanned,
      emailVerified: u.emailVerified,
      phoneVerified: u.phoneVerified,
      kycStatus: u.kycStatus,
      driverStatus: u.driverStatus,
      passengerRating: u.passengerRating,
      driverRating: u.driverRating,
      passengerRides: u.passengerRides,
      driverRides: u.driverRides,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      hasDriverProfile: !!u.driverProfile,
      hasPassengerProfile: !!u.passengerProfile,
      vehicles: u.vehicles,
    })),
  })
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, action } = await req.json()
  // action: 'ban' | 'unban' | 'makeAdmin' | 'removeAdmin'
  const update: any = {}
  if (action === 'ban') update.isBanned = true
  if (action === 'unban') update.isBanned = false
  if (action === 'makeAdmin') update.isAdmin = true
  if (action === 'removeAdmin') update.isAdmin = false

  await db.user.update({ where: { id: userId }, data: update })
  await db.auditLog.create({
    data: { userId: user.id, action: `admin.user.${action}`, details: `target=${userId}`, ip: req.headers.get('x-forwarded-for') || '' },
  })

  return NextResponse.json({ ok: true })
}
