import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const addOnInclude = {
  created_by: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
  assigned_to: {
    select: {
      id: true,
      email: true,
      name: true,
    },
  },
};

export const getClientAddOns = async (clientId: number) => {
  return await prisma.addOn.findMany({
    where: { client_id: clientId, is_deleted: false },
    include: addOnInclude,
    orderBy: { created_at: 'desc' },
  });
};

export const getClientAddOnById = async (id: number) => {
  const addOn = await prisma.addOn.findUnique({
    where: { id },
    include: addOnInclude,
  });
  if (!addOn || addOn.is_deleted) {
    throw new Error('Add-On not found');
  }
  return addOn;
};

export const createClientAddOn = async (
  clientId: number,
  data: {
    title: string;
    description?: string;
    date: string | Date;
    price: number;
    assigned_to_id?: number;
  },
  userId: number
) => {
  // Validate client exists
  const clientExists = await prisma.client.findUnique({
    where: { id: clientId },
  });
  if (!clientExists) {
    throw new Error('Client not found');
  }

  // Validate assignee exists if provided
  if (data.assigned_to_id) {
    const assigneeExists = await prisma.user.findUnique({
      where: { id: data.assigned_to_id },
    });
    if (!assigneeExists) {
      throw new Error('Assigned user not found');
    }
  }

  return await prisma.addOn.create({
    data: {
      client_id: clientId,
      title: data.title,
      description: data.description || null,
      date: new Date(data.date),
      price: data.price,
      assigned_to_id: data.assigned_to_id || null,
      created_by_id: userId,
    },
    include: addOnInclude,
  });
};

export const updateClientAddOn = async (
  id: number,
  data: {
    title?: string;
    description?: string;
    date?: string | Date;
    price?: number;
    assigned_to_id?: number | null;
  },
  userId: number
) => {
  const existing = await prisma.addOn.findUnique({
    where: { id },
  });
  if (!existing || existing.is_deleted) {
    throw new Error('Add-On not found');
  }

  // Validate assignee exists if provided
  if (data.assigned_to_id) {
    const assigneeExists = await prisma.user.findUnique({
      where: { id: data.assigned_to_id },
    });
    if (!assigneeExists) {
      throw new Error('Assigned user not found');
    }
  }

  const updateData: any = {};
  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.date !== undefined) updateData.date = new Date(data.date);
  if (data.price !== undefined) updateData.price = data.price;
  if (data.assigned_to_id !== undefined) updateData.assigned_to_id = data.assigned_to_id;

  return await prisma.addOn.update({
    where: { id },
    data: updateData,
    include: addOnInclude,
  });
};

export const deleteClientAddOn = async (id: number) => {
  const existing = await prisma.addOn.findUnique({
    where: { id },
  });
  if (!existing || existing.is_deleted) {
    throw new Error('Add-On not found');
  }
  return await prisma.addOn.update({
    where: { id },
    data: { is_deleted: true },
  });
};
