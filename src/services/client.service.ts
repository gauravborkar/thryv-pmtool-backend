import prisma from '../lib/prisma';

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
 * Lists clients based on user role.
 * - ADMIN: Can see all clients.
 * - MANAGER: Can only see clients they manage.
 */
export const getClients = async (user: { id: number; role: string }, activeOnly = true) => {
  const whereClause: any = {};

  if (user.role === 'MANAGER') {
    whereClause.manager_id = user.id;
  }

  if (activeOnly) {
    whereClause.is_active = true;
  }

  return prisma.client.findMany({
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
};

/**
 * Gets a single client by ID, checking ownership.
 */
export const getClientById = async (id: number, user: { id: number; role: string }) => {
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

  // Ownership check: Managers can only read their own clients
  if (user.role === 'MANAGER' && client.manager_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to access this client profile');
  }

  return client;
};

/**
 * Creates a client.
 * - MANAGER: manager_id is forced to their own ID.
 * - ADMIN: can assign any valid manager_id (defaults to their own ID if not specified).
 */
export const createClient = async (data: CreateClientInput, user: { id: number; role: string }) => {
  let managerId = user.id;

  if (user.role === 'ADMIN') {
    if (data.manager_id) {
      // Validate that the assigned manager exists
      const targetManager = await prisma.user.findUnique({
        where: { id: data.manager_id },
        include: { role: true },
      });

      if (!targetManager) {
        throw new Error('Assigned manager user not found');
      }

      if (targetManager.role.name !== 'MANAGER' && targetManager.role.name !== 'ADMIN') {
        throw new Error('Clients can only be assigned to Admin or Manager accounts');
      }

      managerId = data.manager_id;
    }
  } else if (user.role === 'MANAGER') {
    // Managers can only create clients for themselves
    managerId = user.id;
  }

  return prisma.client.create({
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
};

/**
 * Updates a client, checking ownership first.
 */
export const updateClient = async (id: number, data: UpdateClientInput, user: { id: number; role: string }) => {
  const client = await prisma.client.findUnique({
    where: { id },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Ownership check
  if (user.role === 'MANAGER' && client.manager_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to update this client profile');
  }

  const updateData: any = { ...data };
  delete updateData.id;

  // Handle active_month parsing if updated
  if (data.active_month) {
    updateData.active_month = new Date(data.active_month);
  }

  // Manager update restrictions:
  if (user.role === 'MANAGER') {
    // Managers cannot reassign the client's manager_id
    delete updateData.manager_id;
  } else if (user.role === 'ADMIN' && data.manager_id) {
    // Admin is reassigning the manager. Verify the target manager exists.
    const targetManager = await prisma.user.findUnique({
      where: { id: data.manager_id },
      include: { role: true },
    });

    if (!targetManager) {
      throw new Error('Assigned manager user not found');
    }

    if (targetManager.role.name !== 'MANAGER' && targetManager.role.name !== 'ADMIN') {
      throw new Error('Clients can only be assigned to Admin or Manager accounts');
    }
  }

  return prisma.client.update({
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
};

/**
 * Archives a client (soft-delete).
 */
export const archiveClient = async (id: number, user: { id: number; role: string }) => {
  const client = await prisma.client.findUnique({
    where: { id },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  // Ownership check
  if (user.role === 'MANAGER' && client.manager_id !== user.id) {
    throw new Error('Forbidden: You do not have permission to archive this client profile');
  }

  return prisma.client.update({
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
};
