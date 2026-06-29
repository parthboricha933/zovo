import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, signToken, setAuthCookie, generateEmailToken } from '@/lib/auth'
import { autoApproveDevVerifications } from '@/lib/verification'
import { notify } from '@/lib/notify'

const schema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  phone: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 })
    }
    const { name, email, password, phone } = parsed.data

    const existing = await db.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 400 })
    }

    const user = await db.user.create({
      data: {
        name,
        email,
        passwordHash: hashPassword(password),
        phone: phone || null,
      },
    })
    await db.passengerProfile.create({ data: { userId: user.id } })

    // create verification rows
    const emailToken = generateEmailToken()
    await db.verification.create({
      data: { userId: user.id, type: 'EMAIL', status: 'PENDING', notes: emailToken },
    })

    // Dev: auto-approve phone + KYC
    await autoApproveDevVerifications(user.id)

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: 'PASSENGER',
      isAdmin: false,
    })
    await setAuthCookie(token)

    // notify
    await notify({
      userId: user.id,
      type: 'SYSTEM',
      title: 'Welcome to ZOVO!',
      body: 'Please complete your verification to start booking rides.',
    })

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: 'PASSENGER',
      },
      requiresRoleSelection: true,
    })
  } catch (e: any) {
    console.error('signup error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
