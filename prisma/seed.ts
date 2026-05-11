import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // 1. Create User Roles
  const adminRole = await prisma.userRole.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: { name: 'ADMIN' },
  })

  const managerRole = await prisma.userRole.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: { name: 'MANAGER' },
  })

  const designerRole = await prisma.userRole.upsert({
    where: { name: 'DESIGNER' },
    update: {},
    create: { name: 'DESIGNER' },
  })

  console.log('✅ Created roles')

  // 2. Create Task Statuses
  const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'UPLOADED', 'APPROVED', 'SCHEDULED']
  for (const status of statuses) {
    await prisma.taskStatus.upsert({
      where: { name: status },
      update: {},
      create: { name: status },
    })
  }
  console.log('✅ Created task statuses')

  // 3. Create Post Types
  const postTypes = ['REEL', 'CAROUSEL', 'STATIC', 'STORY']
  for (const type of postTypes) {
    await prisma.postType.upsert({
      where: { name: type },
      update: {},
      create: { name: type },
    })
  }
  console.log('✅ Created post types')

  // 4. Create Platforms
  const platforms = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN']
  for (const platform of platforms) {
    await prisma.platform.upsert({
      where: { name: platform },
      update: {},
      create: { name: platform },
    })
  }
  console.log('✅ Created platforms')

  // 5. Create Users
  const hashedPassword = await bcrypt.hash('Admin123!', 10)

  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: {
      email: 'admin@example.com',
      password: hashedPassword,
      name: 'Admin User',
      role_id: adminRole.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'manager@example.com' },
    update: {},
    create: {
      email: 'manager@example.com',
      password: hashedPassword,
      name: 'Test Manager',
      role_id: managerRole.id,
    },
  })

  await prisma.user.upsert({
    where: { email: 'designer@example.com' },
    update: {},
    create: {
      email: 'designer@example.com',
      password: hashedPassword,
      name: 'Test Designer',
      role_id: designerRole.id,
    },
  })

  console.log('✅ Seeded 3 users')
  console.log('📝 Password for all: Admin123!')
  console.log('✅ Seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })