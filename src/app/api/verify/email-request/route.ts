import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'
import { sendVerificationEmail } from '@/lib/mailer'

/**
 * Generate a fresh email verification token, store it on the user's Verification
 * row, and email the user a verification link.
 *
 * In production this sends a real email via Gmail SMTP. The user clicks the link,
 * which hits /api/verify/email-confirm?token=... to mark the email as verified.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (user.emailVerified) return NextResponse.json({ ok: true, alreadyVerified: true })

  // Generate a random token
  const token = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2) + Date.now().toString(36)

  // Store it on the verification row
  await db.verification.upsert({
    where: { userId_type: { userId: user.id, type: 'EMAIL' } },
    update: { status: 'PENDING', notes: token, submittedAt: new Date() },
    create: { userId: user.id, type: 'EMAIL', status: 'PENDING', notes: token, submittedAt: new Date() },
  })

  // Send the email
  await sendVerificationEmail(user.email, token, user.name)

  return NextResponse.json({
    ok: true,
    message: 'Verification email sent. Check your inbox (and spam folder).',
    // In dev, also return the token so you can verify without email access
    devToken: process.env.NODE_ENV !== 'production' ? token : undefined,
  })
}
