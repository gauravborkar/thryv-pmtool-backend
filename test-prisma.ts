import prisma from './src/lib/prisma';

async function main() {
  const tasks = await prisma.task.findMany({
    where: { is_deleted: false },
    include: {
      platform_specs: true
    },
    take: 1
  });
  console.log('Success!', tasks);
}

main().catch(console.error).finally(() => prisma.$disconnect());
