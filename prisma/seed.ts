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

  // Get roles for user creation
  const allRoles = await prisma.userRole.findMany();
  const roleMap = Object.fromEntries(allRoles.map((r) => [r.name, r.id]));

  // 3. Seed Users
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
