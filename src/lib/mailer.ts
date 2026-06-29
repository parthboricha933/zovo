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

interface BookingEmailData {
  to: string
  passengerName: string
  driverName: string
  pickupAddress: string
  destAddress: string
  departureTime: string
  totalPrice: number
  seatsBooked: number
}

export async function sendBookingAcceptedEmail(data: BookingEmailData & { otp: string }) {
  const dep = new Date(data.departureTime)
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="font-size: 24px; font-weight: 700; color: #0f766e; margin-bottom: 24px;">ZOVO</div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">✅ Booking Confirmed!</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi ${data.passengerName},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your driver <strong>${data.driverName}</strong> has accepted your booking request. Here are your ride details:
        </p>
        <div style="background: #f0fdfa; border: 1px solid #0f766e; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">PICKUP</div>
          <div style="font-weight: 600; color: #111827; margin-bottom: 12px;">${data.pickupAddress}</div>
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">DROP</div>
          <div style="font-weight: 600; color: #111827; margin-bottom: 12px;">${data.destAddress}</div>
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">DEPARTURE</div>
          <div style="font-weight: 600; color: #111827;">${dep.toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div>
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb; display: flex; justify-content: space-between;">
            <span style="font-size: 13px; color: #6b7280;">${data.seatsBooked} seat(s) • Total</span>
            <span style="font-weight: 700; color: #0f766e;">₹${data.totalPrice}</span>
          </div>
        </div>
        <div style="background: #fef3c7; border: 2px dashed #f59e0b; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
          <div style="font-size: 12px; color: #92400e; margin-bottom: 8px; font-weight: 600;">🔑 SHARE THIS OTP WITH YOUR DRIVER AT PICKUP</div>
          <div style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #92400e; font-family: 'Courier New', monospace;">${data.otp}</div>
        </div>
        <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
          When you meet your driver at the pickup location, share this 6-digit OTP with them.
          The driver will enter it in the app to start the ride. Track your driver live in the ZOVO app.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
        © ${new Date().getFullYear()} ZOVO. All rights reserved.
      </p>
    </div>
  `
  return sendMail({
    to: data.to,
    subject: `✅ Booking Confirmed — ${data.pickupAddress.split(',')[0]} → ${data.destAddress.split(',')[0]}`,
    html,
    text: `Hi ${data.passengerName},\n\nYour booking is confirmed!\n\nDriver: ${data.driverName}\nFrom: ${data.pickupAddress}\nTo: ${data.destAddress}\nDeparture: ${dep.toLocaleString()}\nSeats: ${data.seatsBooked}\nTotal: ₹${data.totalPrice}\n\nYour OTP for pickup: ${data.otp}\n\nShare this OTP with your driver at pickup to start the ride.`,
  })
}

export async function sendBookingRejectedEmail(data: BookingEmailData & { reason?: string }) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="font-size: 24px; font-weight: 700; color: #0f766e; margin-bottom: 24px;">ZOVO</div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">Booking Declined</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi ${data.passengerName},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Unfortunately, the driver <strong>${data.driverName}</strong> was unable to accept your booking request for the ride
          from <strong>${data.pickupAddress}</strong> to <strong>${data.destAddress}</strong>.
        </p>
        ${data.reason ? `<p style="color: #6b7280; font-size: 14px; padding: 12px; background: #f3f4f6; border-radius: 6px;">Reason: ${data.reason}</p>` : ''}
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 24px 0 0;">
          Don't worry — there are plenty of other rides on ZOVO. Open the app to search for more rides on your route.
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
        © ${new Date().getFullYear()} ZOVO. All rights reserved.
      </p>
    </div>
  `
  return sendMail({
    to: data.to,
    subject: `Booking Declined — ${data.pickupAddress.split(',')[0]} → ${data.destAddress.split(',')[0]}`,
    html,
    text: `Hi ${data.passengerName},\n\nYour booking request was declined by the driver.\n\nRoute: ${data.pickupAddress} → ${data.destAddress}\nDriver: ${data.driverName}\n${data.reason ? `Reason: ${data.reason}` : ''}\n\nSearch for more rides on ZOVO.`,
  })
}

export async function sendRideStartedEmail(data: BookingEmailData) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="font-size: 24px; font-weight: 700; color: #0f766e; margin-bottom: 24px;">ZOVO</div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">🚗 Ride Started!</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi ${data.passengerName},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your ride with <strong>${data.driverName}</strong> has started. Track your driver live in the ZOVO app.
        </p>
        <div style="background: #eff6ff; border: 1px solid #3b82f6; border-radius: 8px; padding: 16px;">
          <div style="font-size: 13px; color: #6b7280;">ROUTE</div>
          <div style="font-weight: 600; color: #111827;">${data.pickupAddress} → ${data.destAddress}</div>
        </div>
        <p style="color: #6b7280; font-size: 13px; margin: 24px 0 0;">
          Have a safe and pleasant journey!
        </p>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
        © ${new Date().getFullYear()} ZOVO. All rights reserved.
      </p>
    </div>
  `
  return sendMail({
    to: data.to,
    subject: `🚗 Ride Started — ${data.pickupAddress.split(',')[0]} → ${data.destAddress.split(',')[0]}`,
    html,
    text: `Hi ${data.passengerName},\n\nYour ride has started!\n\nDriver: ${data.driverName}\nRoute: ${data.pickupAddress} → ${data.destAddress}\n\nHave a safe journey!`,
  })
}

export async function sendRideCompletedEmail(data: BookingEmailData & { ratingUrl?: string }) {
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px; background: #f9fafb;">
      <div style="background: white; border-radius: 12px; padding: 32px; border: 1px solid #e5e7eb;">
        <div style="font-size: 24px; font-weight: 700; color: #0f766e; margin-bottom: 24px;">ZOVO</div>
        <h1 style="font-size: 20px; font-weight: 600; color: #111827; margin: 0 0 16px;">🎉 Ride Completed!</h1>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">Hi ${data.passengerName},</p>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your ride with <strong>${data.driverName}</strong> is now complete. We hope you had a great trip!
        </p>
        <div style="background: #f0fdfa; border: 1px solid #0f766e; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
          <div style="font-size: 13px; color: #6b7280; margin-bottom: 4px;">ROUTE</div>
          <div style="font-weight: 600; color: #111827; margin-bottom: 12px;">${data.pickupAddress} → ${data.destAddress}</div>
          <div style="display: flex; justify-content: space-between; padding-top: 12px; border-top: 1px solid #e5e7eb;">
            <span style="font-size: 13px; color: #6b7280;">${data.seatsBooked} seat(s) • Total paid</span>
            <span style="font-weight: 700; color: #0f766e;">₹${data.totalPrice}</span>
          </div>
        </div>
        <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 16px;">
          Please take a moment to rate your driver — it helps other passengers and recognizes great drivers.
        </p>
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://zovo-five.vercel.app'}" style="display: inline-block; background: #0f766e; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px;">Rate your driver</a>
      </div>
      <p style="color: #9ca3af; font-size: 12px; text-align: center; margin: 24px 0 0;">
        © ${new Date().getFullYear()} ZOVO. All rights reserved.
      </p>
    </div>
  `
  return sendMail({
    to: data.to,
    subject: `🎉 Ride Completed — Please rate your driver`,
    html,
    text: `Hi ${data.passengerName},\n\nYour ride is complete!\n\nDriver: ${data.driverName}\nRoute: ${data.pickupAddress} → ${data.destAddress}\nTotal: ₹${data.totalPrice}\n\nPlease rate your driver in the ZOVO app.`,
  })
}
