import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const statuses = await prisma.taskStatus.findMany();
  console.log('Statuses in database:', statuses.map(s => s.name));
}
main().catch(console.error).finally(() => prisma.$disconnect());
