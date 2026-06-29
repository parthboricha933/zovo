import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !user.isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const pending = await db.verification.findMany({
    where: { status: 'PENDING' },
    include: { user: { select: { id: true, name: true, email: true, phone: true } } },
    orderBy: { submittedAt: 'desc' },
    take: 200,
  })

  return NextResponse.json({
    items: pending.map((v) => ({
      id: v.id,
      type: v.type,
      status: v.status,
      notes: v.notes,
      documentUrl: v.documentUrl,
      submittedAt: v.submittedAt,
      user: v.user,
    })),
  })
}
