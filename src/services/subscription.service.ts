import prisma from '../lib/prisma';

export interface CreateSubscriptionInput {
  client_id?: number | null;
  title: string;
  description?: string;
  price: number;
  payment_method: string;
  due_date: string | Date;
}

export interface UpdateSubscriptionInput {
  client_id?: number | null;
  title?: string;
  description?: string;
  price?: number;
  payment_method?: string;
  due_date?: string | Date;
}

export const getSubscriptions = async (filters: { client_id?: number } = {}) => {
  const whereClause: any = { is_deleted: false };
  if (filters.client_id) {
    whereClause.client_id = Number(filters.client_id);
  }

  return prisma.subscription.findMany({
    where: whereClause,
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      created_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      due_date: 'asc',
    },
  });
};

export const getSubscriptionById = async (id: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      created_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  if (!subscription || subscription.is_deleted) {
    throw new Error('Subscription not found');
  }

  return subscription;
};

export const createSubscription = async (data: CreateSubscriptionInput, userId: number) => {
  // Validate client exists if provided
  if (data.client_id) {
    const clientExists = await prisma.client.findUnique({
      where: { id: data.client_id },
    });
    if (!clientExists) {
      throw new Error('Client not found');
    }
  }

  return prisma.subscription.create({
    data: {
      client_id: data.client_id || null,
      title: data.title,
      description: data.description || null,
      price: data.price,
      payment_method: data.payment_method,
      due_date: new Date(data.due_date),
      created_by_id: userId,
    },
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      created_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const updateSubscription = async (id: number, data: UpdateSubscriptionInput) => {
  // Validate subscription exists
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  });
  if (!subscription || subscription.is_deleted) {
    throw new Error('Subscription not found');
  }

  // Validate client if changed and provided
  if (data.client_id && data.client_id !== subscription.client_id) {
    const clientExists = await prisma.client.findUnique({
      where: { id: data.client_id },
    });
    if (!clientExists) {
      throw new Error('Client not found');
    }
  }

  const updateData: any = { ...data };
  if (data.due_date) {
    updateData.due_date = new Date(data.due_date);
  }
  // Allow clearing client association explicitly if passed null
  if (data.client_id === null) {
    updateData.client_id = null;
  }

  return prisma.subscription.update({
    where: { id },
    data: updateData,
    include: {
      client: {
        select: {
          id: true,
          name: true,
        },
      },
      created_by: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
};

export const deleteSubscription = async (id: number) => {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
  });
  if (!subscription || subscription.is_deleted) {
    throw new Error('Subscription not found');
  }

  return prisma.subscription.update({
    where: { id },
    data: { is_deleted: true },
  });
};
