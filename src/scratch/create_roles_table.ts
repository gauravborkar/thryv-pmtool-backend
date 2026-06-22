import prisma from '../lib/prisma';

async function run() {
  console.log('Running manual SQL to create missing _TaskAssignedRoles table...');
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "_TaskAssignedRoles" (
          "A" INTEGER NOT NULL,
          "B" INTEGER NOT NULL
      );
    `);
    console.log('Table _TaskAssignedRoles created successfully.');

    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "_TaskAssignedRoles_AB_unique" ON "_TaskAssignedRoles"("A", "B");
    `);
    console.log('Unique index created.');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "_TaskAssignedRoles_B_index" ON "_TaskAssignedRoles"("B");
    `);
    console.log('Index B created.');

    // We use try-catch block for constraints in case they are already present
    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "_TaskAssignedRoles" 
        ADD CONSTRAINT "_TaskAssignedRoles_A_fkey" 
        FOREIGN KEY ("A") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('Constraint A added.');
    } catch (e: any) {
      console.log('Constraint A already exists or could not be added:', e.message);
    }

    try {
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "_TaskAssignedRoles" 
        ADD CONSTRAINT "_TaskAssignedRoles_B_fkey" 
        FOREIGN KEY ("B") REFERENCES "user_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
      `);
      console.log('Constraint B added.');
    } catch (e: any) {
      console.log('Constraint B already exists or could not be added:', e.message);
    }

    console.log('All migrations executed successfully!');
  } catch (error: any) {
    console.error('Failed to execute raw SQL:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

run();
  