import { NextRequest, NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

/**
 * Simple file upload endpoint.
 * Accepts multipart/form-data with a 'file' field.
 * Saves to /home/z/my-project/public/uploads/<uuid>.<ext>
 * Returns the relative URL.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    // 5 MB max
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400 })
    }

    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf']
    if (!allowed.includes(file.type)) {
      return NextResponse.json({ error: 'Unsupported file type' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'bin'
    const name = `${randomUUID()}.${ext}`
    const uploadDir = join(process.cwd(), 'public', 'uploads')
    await mkdir(uploadDir, { recursive: true })
    const path = join(uploadDir, name)
    const buf = Buffer.from(await file.arrayBuffer())
    await writeFile(path, buf)

    return NextResponse.json({ url: `/uploads/${name}`, size: file.size, type: file.type })
  } catch (e: any) {
    console.error('upload error', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
