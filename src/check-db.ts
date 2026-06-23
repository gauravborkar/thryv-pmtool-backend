import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // 1. Search for PHOTOGRAPHER role (case-insensitive)
  const photographerRole = await prisma.userRole.findFirst({
    where: {
      name: {
        equals: 'PHOTOGRAPHER',
        mode: 'insensitive',
      },
    },
    include: {
      users: true,
      invitations: true,
      permissions: true,
      tasks_assigned: true,
    },
  });

  if (!photographerRole) {
    console.log('No role named "PHOTOGRAPHER" was found in the database.');
    return;
  }

  console.log('Found PHOTOGRAPHER role:', photographerRole);

  // 2. Dissociate and clean up references
  const roleId = photographerRole.id;

  // A. Delete any invitations using this role first (since role_id is not nullable in Invitation)
  if (photographerRole.invitations.length > 0) {
    console.log(`Deleting ${photographerRole.invitations.length} invitations associated with role ID ${roleId}...`);
    await prisma.invitation.deleteMany({
      where: { role_id: roleId },
    });
  }

  // B. Dissociate users, tasks, and permissions (Prisma handles disconnect for many-to-many automatically when we delete, 
  // but let's disconnect explicitly to be safe)
  console.log(`Disconnecting users, tasks, and permissions from role...`);
  await prisma.userRole.update({
    where: { id: roleId },
    data: {
      users: { set: [] },
      permissions: { set: [] },
      tasks_assigned: { set: [] },
    },
  });

  // C. Delete the role
  console.log(`Deleting UserRole with ID ${roleId} and name "${photographerRole.name}"...`);
  await prisma.userRole.delete({
    where: { id: roleId },
  });

  console.log('Role deletion complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
