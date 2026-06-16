import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getDashboardMetrics = async (req: Request, res: Response) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalClients,
      activeManagers,
      activeDesigners,
      dueTodayTasks,
      totalTasks,
      completedTasks,
      deliverablesAggregation,
      totalPackages,
      attachmentsAggregation
    ] = await Promise.all([
      // 1. Total active clients
      prisma.client.count({ where: { is_active: true } }),

      // 2. Active managers
      prisma.user.count({ 
        where: { 
          is_active: true, 
          role: { name: { equals: 'Manager', mode: 'insensitive' } } 
        } 
      }),

      // 3. Active designers
      prisma.user.count({ 
        where: { 
          is_active: true, 
          role: { name: { equals: 'Designer', mode: 'insensitive' } } 
        } 
      }),

      // 4. Due today
      prisma.task.count({ 
        where: { 
          designer_due_date: {
            gte: today,
            lt: new Date(today.getTime() + 24 * 60 * 60 * 1000)
          }
        } 
      }),

      // 5. Total tasks for completion percentage
      prisma.task.count(),

      // 6. Completed tasks for completion percentage
      prisma.task.count({
        where: {
          status: { name: { equals: 'Completed', mode: 'insensitive' } }
        }
      }),

      // 7. Deliverables (sum of line items quantity)
      prisma.contentPackageLineItem.aggregate({
        _sum: { quantity: true }
      }),

      // 8. Total packages
      prisma.contentPackage.count(),

      // 9. Total storage used
      prisma.attachment.aggregate({
        _sum: { file_size: true }
      })
    ]);

    const completionPercentage = totalTasks > 0 
      ? Number(((completedTasks / totalTasks) * 100).toFixed(1)) 
      : 0;
      
    const deliverables = deliverablesAggregation._sum.quantity || 0;

    const usedBytes = attachmentsAggregation._sum.file_size || 0;
    const usedGB = Number((usedBytes / (1024 * 1024 * 1024)).toFixed(3));
    const capacityGB = 25;
    const rawPercentage = (usedBytes / (capacityGB * 1024 * 1024 * 1024)) * 100;
    const storagePercentage = rawPercentage > 0 && rawPercentage < 0.01 
      ? 0.01 
      : Number(rawPercentage.toFixed(2));

    res.json({
      success: true,
      data: {
        totalClients,
        activeManagers,
        activeDesigners,
        dueToday: dueTodayTasks,
        deliverables,
        completionPercentage,
        totalPackages,
        storageProvider: process.env.STORAGE_PROVIDER || 'firebase',
        storageUsedGB: usedGB,
        storagePercentage
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
  }
};
