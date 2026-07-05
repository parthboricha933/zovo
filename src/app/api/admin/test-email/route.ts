import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { sendMail } from '@/lib/mailer'

/**
 * Admin-only endpoint to test SMTP email sending.
 * Usage: POST /api/admin/test-email  { to: "test@example.com" }
 */
export async function POST(req: Request) {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { to } = await req.json().catch(() => ({}))
  const recipient = to || user.email

  const result = await sendMail({
    to: recipient,
    subject: 'ZOVO SMTP Test',
    text: 'This is a test email from ZOVO to verify SMTP is working.',
    html: `
      <div style="font-family: sans-serif; padding: 24px;">
        <h2>ZOVO SMTP Test</h2>
        <p>This is a test email from ZOVO to verify email sending is working.</p>
        <p>If you received this, email sending is configured correctly!</p>
        <p>Sent at: ${new Date().toISOString()}</p>
      </div>
    `,
  })

  if (result) {
    return NextResponse.json({
      ok: true,
      messageId: (result as any).messageId || (result as any).id,
      sentTo: recipient,
      method: process.env.RESEND_API_KEY ? 'resend' : 'smtp',
    })
  } else {
    return NextResponse.json({
      ok: false,
      error: 'Email sending failed — check server logs',
      smtpUser: process.env.SMTP_USER || '(not set)',
      smtpHost: process.env.SMTP_HOST || '(not set)',
      smtpPort: process.env.SMTP_PORT || '(not set)',
      resendConfigured: !!process.env.RESEND_API_KEY,
    }, { status: 500 })
  }
}
