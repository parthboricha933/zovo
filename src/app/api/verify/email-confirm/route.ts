import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { notify } from '@/lib/notify'

/**
 * Confirm an email verification token.
 *
 * Called via:
 *   GET /api/verify/email-confirm?token=...
 *
 * The token is looked up in the Verification table (stored in `notes` column).
 * On match, marks the user's email as verified and returns a small HTML page
 * with a "back to app" link.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) {
    return new NextResponse(renderHTML('Missing token', false), {
      headers: { 'content-type': 'text/html' },
    })
  }

  const v = await db.verification.findFirst({
    where: { type: 'EMAIL', notes: token, status: 'PENDING' },
  })
  if (!v) {
    return new NextResponse(renderHTML('Invalid or expired token', false), {
      headers: { 'content-type': 'text/html' },
    })
  }

  await db.$transaction(async (tx) => {
    await tx.user.update({
      where: { id: v.userId },
      data: { emailVerified: true },
    })
    await tx.verification.update({
      where: { id: v.id },
      data: { status: 'APPROVED', reviewedAt: new Date() },
    })
  })

  await notify({
    userId: v.userId,
    type: 'VERIFICATION_APPROVED',
    title: 'Email Verified',
    body: 'Your email address has been verified successfully.',
  }).catch(() => {})

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  return new NextResponse(renderHTML('Email verified successfully!', true, appUrl), {
    headers: { 'content-type': 'text/html' },
  })
}

function renderHTML(message: string, success: boolean, appUrl?: string) {
  const color = success ? '#0f766e' : '#dc2626'
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>ZOVO Email Verification</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f9fafb;margin:0;padding:24px;}.card{max-width:480px;margin:0 auto;background:white;border-radius:12px;padding:32px;border:1px solid #e5e7eb;text-align:center;}.logo{font-size:24px;font-weight:700;color:#0f766e;margin-bottom:16px;}.msg{font-size:18px;font-weight:600;color:${color};margin-bottom:16px;}.btn{display:inline-block;background:#0f766e;color:white;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600;}</style>
</head><body>
<div class="card">
<div class="logo">ZOVO</div>
<div class="msg">${message}</div>
${appUrl ? `<a href="${appUrl}" class="btn">Continue to ZOVO</a>` : ''}
</div>
</body></html>`
}
