/**
 * One-time admin bootstrap.
 * Usage: bun run /home/z/my-project/scripts/bootstrap-admin.ts
 *
 * Creates an admin user if none exists:
 *   email: admin@zovo.app
 *   password: admin123
 */
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const existing = await db.user.findFirst({ where: { isAdmin: true } })
  if (existing) {
    console.log('Admin already exists:', existing.email)
    process.exit(0)
  }
  const admin = await db.user.create({
    data: {
      name: 'ZOVO Admin',
      email: 'admin@zovo.app',
      passwordHash: bcrypt.hashSync('admin123', 12),
      isAdmin: true,
      activeRole: 'ADMIN',
      emailVerified: true,
      phoneVerified: true,
      kycStatus: 'APPROVED',
    },
  })
  console.log('Admin created:')
  console.log('  email: admin@zovo.app')
  console.log('  password: admin123')
  console.log('  id:', admin.id)
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
