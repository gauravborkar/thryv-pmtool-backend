import prisma from '../lib/prisma';

async function test() {
  try {
    await prisma.$connect();
    console.log('✅ Prisma connected successfully');
    // simple query
    const result = await prisma.$queryRaw`SELECT 1`;
    console.log('Query result:', result);
  } catch (err) {
    console.error('❌ Prisma connection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

test();
