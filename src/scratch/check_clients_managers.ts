import prisma from '../lib/prisma';

async function main() {
  // Show all users with their roles
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      roles: { select: { id: true, name: true } }
    }
  });
  console.log('\n=== ALL USERS ===');
  users.forEach(u => {
    const roleNames = u.roles.map(r => `${r.name}(id:${r.id})`).join(', ');
    console.log(`  ID:${u.id} | ${u.name} | ${u.email} | Roles: ${roleNames}`);
  });

  // Show ALL clients with their manager_id
  const clients = await prisma.client.findMany({
    select: {
      id: true,
      name: true,
      manager_id: true,
      is_active: true,
      is_onboard: true,
      manager: { select: { id: true, name: true, email: true } }
    },
    orderBy: { created_at: 'desc' },
    take: 20
  });
  console.log('\n=== RECENT 20 CLIENTS (manager_id → who sees them) ===');
  clients.forEach(c => {
    console.log(`  Client "${c.name}" (id:${c.id}) → manager_id:${c.manager_id} (${c.manager.name}) | active:${c.is_active} onboard:${c.is_onboard}`);
  });

  // Summary: group clients by manager_id
  const grouped = await prisma.client.groupBy({
    by: ['manager_id'],
    _count: { id: true },
    where: { is_active: true, is_onboard: true }
  });
  console.log('\n=== CLIENT COUNT PER MANAGER (active+onboarded) ===');
  for (const g of grouped) {
    const mgr = users.find(u => u.id === g.manager_id);
    console.log(`  manager_id:${g.manager_id} (${mgr?.name ?? 'UNKNOWN'}) → ${g._count.id} clients`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
