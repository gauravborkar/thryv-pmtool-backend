import prisma from '../lib/prisma';
import { localCache } from '../utils/cache';
import { createNotification } from './notification.service';

export interface CreateClientInput {
  name: string;
  active_month: string | Date;
  manager_id?: number;
  brand_details?: any;
  timezone?: string;
}

export interface UpdateClientInput {
  name?: string;
  active_month?: string | Date;
  manager_id?: number;
  brand_details?: any;
  timezone?: string;
  is_active?: boolean;
}

/**
 * Helper to enforce that a manager can only access their own client.
 * Throws an error if the user is a manager and does not own the client.
 */
function enforceOwnership(client: { manager_id: number }, user: { id: number; roles: string[] }) {
  if (user.roles.includes('MANAGER') && !user.roles.includes('ADMIN') && client.manager_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to access this client profile');
  }
}

/**
 * Lists clients based on user role.
 * - ADMIN: Can see all clients.
 * - MANAGER: Can only see clients they manage.
 */
export const getClients = async (user: { id: number; roles: string[] }, activeOnly = true) => {
  const cacheKey = `clients_user_${user.id}_active_${activeOnly}`;
  const cached = localCache.get<any[]>(cacheKey);
  if (cached) return cached;

  const whereClause: any = {};

  if (user.roles.includes('MANAGER') && !user.roles.includes('ADMIN')) {
    whereClause.manager_id = user.id;
  }

  if (activeOnly) {
    whereClause.is_active = true;
  }

  const result = await prisma.client.findMany({
    where: whereClause,
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      created_at: 'desc',
    },
  });

  localCache.set(cacheKey, result, 120 * 1000); // 2 minutes
  return result;
};

/**
 * Gets a single client by ID, checking ownership.
 */
export const getClientById = async (id: number, user: { id: number; roles: string[] }) => {
  const client = await prisma.client.findUnique({
    where: { id },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Use helper for ownership enforcement
  enforceOwnership(client, user);

  return client;
};

/**
 * Creates a client.
 * - MANAGER: manager_id is forced to their own ID.
 * - ADMIN: can assign any valid manager_id (defaults to their own ID if not specified).
 */
export const createClient = async (data: CreateClientInput, user: { id: number; roles: string[] }) => {
  let managerId = user.id;

  if (user.roles.includes('ADMIN')) {
    if (data.manager_id) {
      // Validate that the assigned manager exists
      const targetManager = await prisma.user.findUnique({
        where: { id: data.manager_id },
        include: { roles: true },
      });

      if (!targetManager) {
        throw new Error('Assigned manager user not found');
      }

      const hasManagerPrivileges = targetManager.roles.some(
        (r) => r.name === 'MANAGER' || r.name === 'ADMIN'
      );

      if (!hasManagerPrivileges) {
        throw new Error('Clients can only be assigned to Admin or Manager accounts');
      }

      managerId = data.manager_id;
    }
  } else if (user.roles.includes('MANAGER')) {
    // Managers can only create clients for themselves
    managerId = user.id;
  }

  const client = await prisma.client.create({
    data: {
      name: data.name,
      active_month: new Date(data.active_month),
      manager_id: managerId,
      brand_details: data.brand_details || undefined,
      timezone: data.timezone || 'UTC',
      is_active: true,
    },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (user.id !== managerId) {
    await createNotification({
      userId: managerId,
      title: 'Client Assigned',
      message: `You have been assigned to client "${client.name}"`,
      type: 'CLIENT_ASSIGNED',
      referenceId: client.id,
      referenceType: 'Client'
    });
  }

  localCache.deletePattern('clients_user_');
  return client;
};

/**
 * Updates a client, checking ownership first.
 */
export const updateClient = async (id: number, data: UpdateClientInput, user: { id: number; roles: string[] }) => {
  const client = await prisma.client.findUnique({
    where: { id },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Use helper for ownership enforcement
  enforceOwnership(client, user);

  const updateData: any = { ...data };
  delete updateData.id;

  // Handle active_month parsing if updated
  if (data.active_month) {
    updateData.active_month = new Date(data.active_month);
  }

  // Manager update restrictions:
  if (user.roles.includes('MANAGER') && !user.roles.includes('ADMIN')) {
    // Managers cannot reassign the client's manager_id
    delete updateData.manager_id;
  } else if (user.roles.includes('ADMIN') && data.manager_id) {
    // Admin is reassigning the manager. Verify the target manager exists.
    const targetManager = await prisma.user.findUnique({
      where: { id: data.manager_id },
      include: { roles: true },
    });

    if (!targetManager) {
      throw new Error('Assigned manager user not found');
    }

    const hasManagerPrivileges = targetManager.roles.some(
      (r) => r.name === 'MANAGER' || r.name === 'ADMIN'
    );

    if (!hasManagerPrivileges) {
      throw new Error('Clients can only be assigned to Admin or Manager accounts');
    }
  }

  const updated = await prisma.client.update({
    where: { id },
    data: updateData,
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  localCache.deletePattern('clients_user_');

  if (data.manager_id && data.manager_id !== client.manager_id && user.id !== data.manager_id) {
    await createNotification({
      userId: data.manager_id,
      title: 'Client Assigned',
      message: `You have been assigned to client "${updated.name}"`,
      type: 'CLIENT_ASSIGNED',
      referenceId: updated.id,
      referenceType: 'Client'
    });
  }

  return updated;
};

/**
 * Archives a client (soft-delete).
 */
export const archiveClient = async (id: number, user: { id: number; roles: string[] }) => {
  const client = await prisma.client.findUnique({
    where: { id },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Use helper for ownership enforcement
  enforceOwnership(client, user);

  const archived = await prisma.client.update({
    where: { id },
    data: { is_active: false },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  localCache.deletePattern('clients_user_');
  return archived;
};