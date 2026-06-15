import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as notificationService from '../services/notification.service';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const notifications = await notificationService.getUserNotifications(req.user!.id);
    res.json({ data: notifications });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to fetch notifications',
    });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const notificationId = parseInt(req.params.id, 10);
    if (isNaN(notificationId)) {
      return res.status(400).json({ message: 'Invalid notification ID' });
    }

    const notification = await notificationService.markAsRead(notificationId, req.user!.id);
    res.json({ message: 'Notification marked as read', data: notification });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to mark notification as read',
    });
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    await notificationService.markAllAsRead(req.user!.id);
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to mark all notifications as read',
    });
  }
};
