import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seeding...');

  // 1. Seed Roles
  console.log('Seeding roles...');
  const roles = [
    { name: 'ADMIN' },
    { name: 'MANAGER' },
    { name: 'DESIGNER' },
    { name: 'CLIENT' },
  ];

  for (const role of roles) {
    await prisma.userRole.upsert({
      where: { name: role.name },
      update: {},
      create: role,
    });
  }

  // 2. Seed Task Statuses
  console.log('Seeding task statuses...');
  const statuses = [
    { name: 'BACKLOG' },
    { name: 'TODO' },
    { name: 'IN_PROGRESS' },
    { name: 'REVIEW' },
    { name: 'DONE' },
  ];

  for (const status of statuses) {
    await prisma.taskStatus.upsert({
      where: { name: status.name },
      update: {},
      create: status,
    });
  }

  // 3. Seed Package Builder lookups
  console.log('Seeding package builder lookups...');
  const contentTypes = [
    { name: 'REEL' },
    { name: 'CAROUSEL' },
    { name: 'STATIC' },
    { name: 'STORY' },
  ];
  const billingCycles = [
    { name: 'WEEKLY' },
    { name: 'MONTHLY' },
    { name: 'QUARTERLY' },
  ];
  const socialPlatforms = [
    { name: 'Instagram' },
    { name: 'Facebook' },
    { name: 'TikTok' },
    { name: 'LinkedIn' },
    { name: 'YouTube' },
    { name: 'Twitter/X' },
  ];

  for (const type of contentTypes) {
    await prisma.contentType.upsert({
      where: { name: type.name },
      update: {},
      create: type,
    });
  }

  for (const cycle of billingCycles) {
    await prisma.billingCycle.upsert({
      where: { name: cycle.name },
      update: {},
      create: cycle,
    });
  }

  for (const platform of socialPlatforms) {
    await prisma.socialPlatform.upsert({
      where: { name: platform.name },
      update: {},
      create: platform,
    });
  }

  // Get roles for user creation
  const allRoles = await prisma.userRole.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  // 4. Seed Users
  console.log('Seeding users...');
  const hashedPassword = await bcrypt.hash('password123', 10);

  const users = [
    {
      email: 'admin@thryv.com',
      name: 'Thryv Admin',
      password: hashedPassword,
      role_id: roleMap['ADMIN'],
    },
    {
      email: 'manager@thryv.com',
      name: 'Project Manager',
      password: hashedPassword,
      role_id: roleMap['MANAGER'],
    },
    {
      email: 'designer@thryv.com',
      name: 'Creative Designer',
      password: hashedPassword,
      role_id: roleMap['DESIGNER'],
    },
    {
      email: 'client@thryv.com',
      name: 'Test Client User',
      password: hashedPassword,
      role_id: roleMap['CLIENT'],
    },
  ];

  for (const user of users) {
    await prisma.user.upsert({
      where: { email: user.email },
      update: {
        role_id: user.role_id,
        password: user.password,
      },
      create: user,
    });
  }

  // 5. Seed Audit Logs
  console.log('Seeding mock audit logs...');
  const seededAdmin = await prisma.user.findUnique({ where: { email: 'admin@thryv.com' } });
  const seededManager = await prisma.user.findUnique({ where: { email: 'manager@thryv.com' } });
  
  if (seededAdmin && seededManager) {
    const mockLogs = [
      {
        user_id: seededAdmin.id,
        action: 'USER_LOGIN_SUCCESS',
        entity: 'User',
        entity_id: seededAdmin.id,
        details: { email: 'admin@thryv.com' },
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - 3600000 * 2), // 2 hours ago
      },
      {
        user_id: seededAdmin.id,
        action: 'USER_INVITATION_SUCCESS',
        entity: 'Invitation',
        entity_id: 1,
        details: { email: 'designer-invite@thryv.com', role_id: roleMap['DESIGNER'] },
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - 3600000 * 1.5), // 1.5 hours ago
      },
      {
        user_id: seededManager.id,
        action: 'USER_LOGIN_SUCCESS',
        entity: 'User',
        entity_id: seededManager.id,
        details: { email: 'manager@thryv.com' },
        ip_address: '127.0.0.1',
        created_at: new Date(Date.now() - 3600000 * 1), // 1 hour ago
      },
    ];

    // Clear any old audit logs first to prevent duplicate build seed bloat
    await prisma.auditLog.deleteMany({});
    
    for (const log of mockLogs) {
      await prisma.auditLog.create({
        data: log,
      });
    }
  }

  // 6. Seed Retention Policy Settings
  console.log('Seeding retention policy settings...');
  await prisma.retentionPolicy.upsert({
    where: { id: 1 },
    update: {},
    create: {
      id: 1,
      isEnabled: false,
      keepDays: 30,
    },
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
