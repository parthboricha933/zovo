import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { OAuth2Client } from 'google-auth-library'
import { db } from '@/lib/db'
import { signToken, setAuthCookie, hashPassword } from '@/lib/auth'
import { autoApproveDevVerifications } from '@/lib/verification'
import { notify } from '@/lib/notify'

const CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || ''
const CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ''

const schema = z.object({
  // Google Identity Services credential (ID token JWT)
  credential: z.string().optional(),
  // Fallback for older clients: post-Google-verify payload
  googleId: z.string().optional(),
  email: z.string().email().optional(),
  name: z.string().optional(),
  picture: z.string().optional(),
})

export async function POST(req: NextRequest) {
  try {
    const json = await req.json()
    const parsed = schema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid Google payload' }, { status: 400 })
    }

    let payload: {
      sub: string
      email: string
      name?: string
      picture?: string
      email_verified?: boolean
    }

    if (parsed.data.credential) {
      // Verify the Google ID token server-side
      const client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET)
      const ticket = await client.verifyIdToken({
        idToken: parsed.data.credential,
        audience: CLIENT_ID,
      })
      const p = ticket.getPayload()
      if (!p || !p.sub || !p.email) {
        return NextResponse.json({ error: 'Invalid Google token' }, { status: 401 })
      }
      payload = { sub: p.sub, email: p.email, name: p.name, picture: p.picture, email_verified: p.email_verified }
    } else if (parsed.data.googleId && parsed.data.email) {
      // Fallback path (legacy client)
      payload = {
        sub: parsed.data.googleId,
        email: parsed.data.email,
        name: parsed.data.name,
        picture: parsed.data.picture,
        email_verified: true,
      }
    } else {
      return NextResponse.json({ error: 'Missing Google credential' }, { status: 400 })
    }

    const { sub: googleId, email, name, picture } = payload

    // Find existing user by googleId or email
    let user = await db.user.findFirst({
      where: { OR: [{ googleId }, { email }] },
    })

    if (!user) {
      user = await db.user.create({
        data: {
          email,
          name: name || email.split('@')[0],
          googleId,
          avatarUrl: picture || null,
          // random unusable password hash — Google users can't password-login
          passwordHash: hashPassword(googleId + Math.random().toString()),
          emailVerified: true,
        },
      })
      await db.passengerProfile.create({ data: { userId: user.id } })
      await autoApproveDevVerifications(user.id)
      await notify({
        userId: user.id,
        type: 'SYSTEM',
        title: 'Welcome to ZOVO!',
        body: 'Please complete your verification to start booking rides.',
      })
    } else if (!user.googleId) {
      // link existing email account
      user = await db.user.update({
        where: { id: user.id },
        data: { googleId, avatarUrl: picture || user.avatarUrl, emailVerified: true },
      })
    }

    const token = signToken({
      sub: user.id,
      email: user.email,
      role: user.activeRole,
      isAdmin: user.isAdmin,
    })
    await setAuthCookie(token)

    // Whether the user has selected a primary role yet
    const hasSelectedRole =
      user.driverStatus !== 'NONE' ||
      user.passengerProfile !== null ||
      user.activeRole !== 'PASSENGER'

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.activeRole,
        isAdmin: user.isAdmin,
      },
      requiresRoleSelection: !hasSelectedRole,
    })
  } catch (e) {
    console.error('google login error', e)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
