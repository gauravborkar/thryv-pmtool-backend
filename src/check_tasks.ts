import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const tasks = await prisma.task.findMany({
    where: { is_deleted: false },
    include: { status: true },
  });

  console.log(`Found ${tasks.length} active tasks:`);
  tasks.forEach((t) => {
    console.log(`- Title: ${t.title}`);
    console.log(`  Status: ${t.status?.name}`);
    console.log(`  Publish Date: ${t.publish_date}`);
    console.log(`  Designer Due Date: ${t.designer_due_date}`);
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
