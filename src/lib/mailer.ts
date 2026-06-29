import nodemailer from 'nodemailer'

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com'
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '465')
const SMTP_USER = process.env.SMTP_USER || ''
const SMTP_PASS = process.env.SMTP_PASS || ''
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER

let transporter: nodemailer.Transporter | null = null

function getTransporter() {
  if (transporter) return transporter
  if (!SMTP_USER || !SMTP_PASS) {
    console.warn('[mailer] SMTP credentials not configured')
    return null
  }
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  })
  return transporter
}

export interface SendMailInput {
  to: string
  subject: string
  text?: string
  html?: string
}

export async function sendMail({ to, subject, text, html }: SendMailInput) {
  const t = getTransporter()
  if (!t) {
    console.warn(`[mailer] Skipping email to ${to} (no SMTP configured). Subject: ${subject}`)
    return null
  }
  try {
    const info = await t.sendMail({
      from: SMTP_FROM,
      to,
      subject,
      text,
      html,
    })
    console.log(`[mailer] Sent to ${to}: ${info.messageId}`)
    return info
  } catch (e: any) {
    console.error('[mailer] send error', e)
    return null
  }
}

export async function sendVerificationEmail(to: string, token: string, name: string) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const verifyUrl = `${appUrl}/?verifyEmail=${token}`
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="font-size: 24px; font-weight: 700; color: #0f766e; margin-bottom: 24px;">ZOVO</div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">Verify your email address</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi ${name},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Welcome to ZOVO! Please verify your email address to start booking and offering rides.
          Click the button below to confirm:
        </p>
        <a href="${verifyUrl}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Verify Email</a>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 24px 0 0;">
          Or copy and paste this link into your browser:<br>
          <span style="color: #0f766e; word-break: break-all;">${verifyUrl}</span>
        </p>
        <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
          If you didn't sign up for ZOVO, you can safely ignore this email.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
        © ${new Date().getFullYear()} ZOVO. All rights reserved.
      </p>
    </div>
  `
  return sendMail({
    to,
    subject: 'Verify your ZOVO email address',
    html,
    text: `Hi ${name},\n\nWelcome to ZOVO! Verify your email by visiting:\n${verifyUrl}\n\nIf you didn't sign up, you can ignore this email.`,
  })
}
