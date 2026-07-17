import prisma from '../lib/prisma';
import { getClients } from '../services/client.service';
import redis from '../lib/redis';

async function main() {
  console.log('--- STARTING CLIENT ASSIGNMENT AND VISIBILITY TEST ---');

  // Find Admin user
  const adminUser = await prisma.user.findFirst({
    where: { roles: { some: { name: 'ADMIN' } } },
    include: { roles: true }
  });
  if (!adminUser) {
    console.error('Admin user not found!');
    return;
  }

  // Find Manager user
  const managerUser = await prisma.user.findFirst({
    where: { roles: { some: { name: 'MANAGER' } } },
    include: { roles: true }
  });
  if (!managerUser) {
    console.error('Manager user not found!');
    return;
  }

  console.log(`Admin User: ID=${adminUser.id}, Name=${adminUser.name}`);
  console.log(`Manager User: ID=${managerUser.id}, Name=${managerUser.name}`);

  // Construct fake AuthRequest user contexts
  const adminContext = {
    id: adminUser.id,
    roles: adminUser.roles.map(r => r.name),
    roleIds: adminUser.roles.map(r => r.id)
  };

  const managerContext = {
    id: managerUser.id,
    roles: managerUser.roles.map(r => r.name),
    roleIds: managerUser.roles.map(r => r.id)
  };

  // 1. Fetch clients using getClients service for Admin
  const adminClients = await getClients(adminContext, true, true);
  console.log(`Admin sees ${adminClients.length} active onboarded clients.`);

  // 2. Fetch clients using getClients service for Manager
  const managerClients = await getClients(managerContext, true, true);
  console.log(`Manager sees ${managerClients.length} active onboarded clients.`);

  // Verify that manager sees clients assigned to them
  const clientsAssignedToManagerInDb = await prisma.client.findMany({
    where: { manager_id: managerUser.id, is_active: true, is_onboard: true }
  });
  console.log(`Clients in DB directly assigned to Manager: ${clientsAssignedToManagerInDb.length}`);

  if (managerClients.length === clientsAssignedToManagerInDb.length) {
    console.log('SUCCESS: Service layer filtering matches DB assignments.');
  } else {
    console.error('FAILURE: Service layer client count does not match database assignments!');
  }

  // Check Redis status
  console.log(`Redis Status: ${redis.status}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
