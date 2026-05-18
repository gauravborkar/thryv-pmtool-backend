import prisma from './lib/prisma';

async function check() {
  const invitations = await prisma.invitation.findMany({
    include: { role: true }
  });
  console.log('ALL INVITATIONS:', JSON.stringify(invitations, null, 2));
}

check().catch(console.error);
