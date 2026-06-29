import { NextResponse } from 'next/server'
import { getSession, signToken } from '@/lib/auth'

/**
 * Mint a fresh JWT for the WebSocket client.
 * (The auth cookie is httpOnly so the browser can't read it directly; we proxy it.)
 */
export async function GET() {
  const session = await getSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const token = signToken({
    sub: session.sub,
    email: session.email,
    role: session.role,
    isAdmin: session.isAdmin,
  })
  return NextResponse.json({ token })
}
