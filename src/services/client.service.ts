import prisma from '../lib/prisma';
import { localCache } from '../utils/cache';
import { createNotification } from './notification.service';

export interface CreateClientInput {
  name: string;
  active_month: string | Date;
  manager_id?: number;
  brand_details?: any;
  timezone?: string;
  package_ids?: string[];
  google_drive_link?: string;
}

export interface UpdateClientInput {
  name?: string;
  active_month?: string | Date;
  manager_id?: number;
  brand_details?: any;
  timezone?: string;
  is_active?: boolean;
  package_ids?: string[];
  google_drive_link?: string;
}

function isManagerUser(user: { roles: string[]; roleIds?: number[] }) {
  const isManager = user.roleIds?.includes(2) || user.roles.includes('MANAGER');
  const isAdmin = user.roleIds?.includes(1) || user.roles.includes('ADMIN');
  return isManager && !isAdmin;
}

/**
 * Helper to enforce that a manager can only access their own client.
 * Throws an error if the user is a manager and does not own the client.
 */
function enforceOwnership(client: { manager_id: number }, user: { id: number; roles: string[]; roleIds?: number[] }) {
  if (isManagerUser(user) && client.manager_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to access this client profile');
  }
}

/**
 * Lists clients based on user role.
 * - ADMIN: Can see all clients.
 * - MANAGER: Can only see clients they manage.
 */
export const getClients = async (user: { id: number; roles: string[]; roleIds?: number[] }, activeOnly = true) => {
  const cacheKey = `clients_user_${user.id}_active_${activeOnly}`;
  const cached = localCache.get<any[]>(cacheKey);
  if (cached) return cached;

  const whereClause: any = {};

  if (isManagerUser(user)) {
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
      content_packages: {
        select: {
          id: true,
          name: true,
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
export const getClientById = async (id: number, user: { id: number; roles: string[]; roleIds?: number[] }) => {
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
      content_packages: {
        select: {
          id: true,
          name: true,
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
export const createClient = async (data: CreateClientInput, user: { id: number; roles: string[]; roleIds?: number[] }) => {
  let managerId = user.id;

  const isAdmin = user.roleIds?.includes(1) || user.roles.includes('ADMIN');
  const isManager = user.roleIds?.includes(2) || user.roles.includes('MANAGER');

  if (isAdmin) {
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
        (r) => r.id === 1 || r.id === 2 || r.name === 'MANAGER' || r.name === 'ADMIN'
      );

      if (!hasManagerPrivileges) {
        throw new Error('Clients can only be assigned to Admin or Manager accounts');
      }

      managerId = data.manager_id;
    }
  } else if (isManager) {
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
      google_drive_link: data.google_drive_link || null,
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

  if (data.package_ids && data.package_ids.length > 0) {
    await prisma.contentPackage.updateMany({
      where: {
        id: { in: data.package_ids },
      },
      data: { client_id: client.id },
    });
  }

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

  // Return the client with packages included
  const clientWithPackages = await prisma.client.findUnique({
    where: { id: client.id },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      content_packages: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  return clientWithPackages || client;
};

/**
 * Updates a client, checking ownership first.
 */
export const updateClient = async (id: number, data: UpdateClientInput, user: { id: number; roles: string[]; roleIds?: number[] }) => {
  const client = await prisma.client.findUnique({
    where: { id },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Use helper for ownership enforcement
  enforceOwnership(client, user);

  // Build updateData using only fields that are valid Prisma Client model columns.
  // DO NOT spread req.body directly – extra fields like package_ids would reach Prisma.
  const updateData: any = {};
  if (data.name !== undefined)          updateData.name = data.name;
  if (data.is_active !== undefined)     updateData.is_active = data.is_active;
  if (data.brand_details !== undefined) updateData.brand_details = data.brand_details;
  if (data.timezone !== undefined)      updateData.timezone = data.timezone;
  if (data.google_drive_link !== undefined) updateData.google_drive_link = data.google_drive_link;
  if (data.active_month !== undefined)  updateData.active_month = new Date(data.active_month);

  const isAdmin = user.roleIds?.includes(1) || user.roles.includes('ADMIN');
  const isManager = user.roleIds?.includes(2) || user.roles.includes('MANAGER');

  // Manager update restrictions:
  if (isManager && !isAdmin) {
    // Managers cannot reassign the client's manager_id
    // (manager_id is simply not added to updateData for manager users)
  } else if (isAdmin && data.manager_id) {
    // Admin is reassigning the manager. Verify the target manager exists.
    const targetManager = await prisma.user.findUnique({
      where: { id: data.manager_id },
      include: { roles: true },
    });

    if (!targetManager) {
      throw new Error('Assigned manager user not found');
    }

    const hasManagerPrivileges = targetManager.roles.some(
      (r) => r.id === 1 || r.id === 2 || r.name === 'MANAGER' || r.name === 'ADMIN'
    );

    if (!hasManagerPrivileges) {
      throw new Error('Clients can only be assigned to Admin or Manager accounts');
    }

    updateData.manager_id = data.manager_id;
  }

  // If package_ids is provided, update client_id on packages
  if (data.package_ids !== undefined) {
    // 1. Dissociate packages that are no longer associated
    await prisma.contentPackage.updateMany({
      where: {
        client_id: client.id,
        id: { notIn: data.package_ids },
      },
      data: { client_id: null },
    });

    // 2. Associate new packages
    if (data.package_ids.length > 0) {
      await prisma.contentPackage.updateMany({
        where: {
          id: { in: data.package_ids },
        },
        data: { client_id: client.id },
      });
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
      content_packages: {
        select: {
          id: true,
          name: true,
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
export const archiveClient = async (id: number, user: { id: number; roles: string[]; roleIds?: number[] }) => {
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