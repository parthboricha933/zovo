import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [
    totalUsers,
    totalDrivers,
    totalPassengers,
    pendingVerifications,
    activeRides,
    completedRides,
    totalRides,
    payments,
    completedPayments,
  ] = await Promise.all([
    db.user.count(),
    db.driverProfile.count(),
    db.passengerProfile.count(),
    db.verification.count({ where: { status: 'PENDING' } }),
    db.ride.count({ where: { status: { in: ['ACTIVE', 'ONGOING'] } } }),
    db.ride.count({ where: { status: 'COMPLETED' } }),
    db.ride.count(),
    db.payment.findMany({ where: { status: 'PAID' } }),
    db.payment.count({ where: { status: 'PAID' } }),
  ])

  const platformEarnings = payments.reduce((s, p) => s + p.platformFee, 0)
  const totalRevenue = payments.reduce((s, p) => s + p.amount, 0)
  const driverPayouts = payments.reduce((s, p) => s + p.driverPayout, 0)

  // Recent rides
  const recentRides = await db.ride.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: {
      driver: { select: { id: true, name: true } },
      bookings: { select: { id: true, status: true, totalPrice: true, passengerId: true } },
    },
  })

  // Revenue by day (last 7 days)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const recentPayments = await db.payment.findMany({
    where: { status: 'PAID', paidAt: { gte: sevenDaysAgo } },
    select: { amount: true, platformFee: true, paidAt: true },
  })
  const revenueByDay: Record<string, { revenue: number; platformFee: number; rides: number }> = {}
  for (const p of recentPayments) {
    const day = new Date(p.paidAt!).toISOString().slice(0, 10)
    if (!revenueByDay[day]) revenueByDay[day] = { revenue: 0, platformFee: 0, rides: 0 }
    revenueByDay[day].revenue += p.amount
    revenueByDay[day].platformFee += p.platformFee
    revenueByDay[day].rides += 1
  }

  return NextResponse.json({
    totalUsers,
    totalDrivers,
    totalPassengers,
    pendingVerifications,
    activeRides,
    completedRides,
    totalRides,
    completedPayments,
    platformEarnings: Math.round(platformEarnings * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    driverPayouts: Math.round(driverPayouts * 100) / 100,
    revenueByDay: Object.entries(revenueByDay).map(([day, v]) => ({ day, ...v })),
    recentRides: recentRides.map((r) => ({
      id: r.id,
      status: r.status,
      pickupAddress: r.pickupAddress,
      destAddress: r.destAddress,
      departureTime: r.departureTime,
      pricePerSeat: r.pricePerSeat,
      seatsBooked: r.totalSeats - r.availableSeats,
      driver: r.driver,
      bookingCount: r.bookings.length,
      totalBookingValue: r.bookings.reduce((s, b) => s + b.totalPrice, 0),
    })),
  })
}
