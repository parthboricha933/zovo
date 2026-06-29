import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, signToken, setAuthCookie } from '@/lib/auth'

/**
 * Set the active role for the current user.
 * Body: { role: 'PASSENGER' | 'DRIVER' }
 * Re-issues a JWT with the new role.
 *
 * Optionally also creates the corresponding profile (passenger/driver) on first switch.
 */
const schema = z.object({
  role: z.enum(['PASSENGER', 'DRIVER']),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const json = await req.json()
  const parsed = schema.safeParse(json)
  if (!parsed.success) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  const { role } = parsed.data

  // Ensure passenger profile exists
  if (role === 'PASSENGER' && !user.passengerProfile) {
    await db.passengerProfile.create({ data: { userId: user.id } })
  }
  // For DRIVER, profile is created during driver verification — but make sure we
  // at least mark driverStatus = PENDING so the user can proceed to verification.
  if (role === 'DRIVER' && user.driverStatus === 'NONE') {
    await db.user.update({ where: { id: user.id }, data: { driverStatus: 'PENDING' } })
  }

  await db.user.update({ where: { id: user.id }, data: { activeRole: role } })

  const token = signToken({
    sub: user.id,
    email: user.email,
    role,
    isAdmin: user.isAdmin,
  })
  await setAuthCookie(token)

  return NextResponse.json({ ok: true, role })
}
