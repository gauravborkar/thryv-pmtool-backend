const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  const tasks = await prisma.task.findMany({
    include: {
      task_types: true,
      task_type: true,
      calendar_entry: true,
    }
  });
  console.log(JSON.stringify(tasks, null, 2));
  await prisma.$disconnect();
}

run();
