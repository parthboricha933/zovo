import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, signToken, setAuthCookie } from '@/lib/auth'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid input' }, { status: 400 })
    }
    const { email, password } = parsed.data

    const user = await db.user.findUnique({ where: { email } })
    if (!user || !user.passwordHash) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }
    if (user.isBanned) {
      return NextResponse.json({ error: 'Account suspended' }, { status: 403 })
    }

    await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), isOnline: true } })

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.activeRole,
      isAdmin: user.isAdmin,
    })
    await setAuthCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.activeRole,
        isAdmin: user.isAdmin,
      },
    })
  } catch (e) {
    console.error('login error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
