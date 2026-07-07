import prisma from '../lib/prisma';

export async function createNotification(data: {
  userId: number;
  title: string;
  message: string;
  type: string;
  referenceId?: number;
  referenceType?: string;
}) {
  return prisma.notification.create({
    data: {
      user_id: data.userId,
      title: data.title,
      message: data.message,
      type: data.type,
      reference_id: data.referenceId,
      reference_type: data.referenceType,
    },
  });
}

export async function getUserNotifications(userId: number) {
  return prisma.notification.findMany({
    where: { user_id: userId },
    orderBy: { created_at: 'desc' },
  });
}

export async function markAsRead(notificationId: number, userId: number) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification || notification.user_id !== userId) {
    throw new Error('Notification not found or unauthorized');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { is_read: true },
  });
}

export async function markAllAsRead(userId: number) {
  return prisma.notification.updateMany({
    where: { user_id: userId, is_read: false },
    data: { is_read: true },
  });
}
