import prisma from '../lib/prisma';

async function main() {
  console.log('Creating table _TaskAssignedRoles manually...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_TaskAssignedRoles" (
          "A" INTEGER NOT NULL,
          "B" INTEGER NOT NULL,
          CONSTRAINT "_TaskAssignedRoles_AB_pkey" PRIMARY KEY ("A", "B"),
          CONSTRAINT "_TaskAssignedRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE,
          CONSTRAINT "_TaskAssignedRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "user_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
    
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "_TaskAssignedRoles_B_index" ON "_TaskAssignedRoles"("B");
    `);

    console.log('Table _TaskAssignedRoles created successfully!');
  } catch (error: any) {
    console.error('Failed to create _TaskAssignedRoles:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
