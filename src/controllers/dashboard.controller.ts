import { Request, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
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

    const user = (req as AuthRequest).user;
    let designerMetrics = undefined;

    if (user && user.role.toUpperCase() === 'DESIGNER') {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 7);

      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      const [
        designerTotalTasks,
        designerOpenTasks,
        designerInProgressTasks,
        designerDueTodayTasks,
        designerDueThisWeekTasks,
        designerAwaitingReviewTasks,
        designerApprovedThisMonthTasks,
        designerComments,
        designerOverdueTasks,
        designerCompletedTasks,
        unreadCommentNotifications
      ] = await Promise.all([
        prisma.task.count({ where: { assigned_designer_id: user.id } }),
        prisma.task.count({ where: { assigned_designer_id: user.id, status: { name: { in: ['TODO', 'BACKLOG', 'NOT_STARTED'] } } } }),
        prisma.task.count({ where: { assigned_designer_id: user.id, status: { name: 'IN_PROGRESS' } } }),
        prisma.task.count({ 
          where: { 
            assigned_designer_id: user.id, 
            designer_due_date: { gte: today, lt: new Date(today.getTime() + 24 * 60 * 60 * 1000) } 
          } 
        }),
        prisma.task.count({ 
          where: { 
            assigned_designer_id: user.id, 
            designer_due_date: { gte: startOfWeek, lt: endOfWeek } 
          } 
        }),
        prisma.task.count({ where: { assigned_designer_id: user.id, status: { name: { in: ['REVIEW', 'UPLOADED'] } } } }),
        prisma.task.count({ where: { assigned_designer_id: user.id, status: { name: 'APPROVED' }, updated_at: { gte: startOfMonth } } }),
        prisma.comment.count({ where: { task: { assigned_designer_id: user.id }, author_id: { not: user.id } } }),
        prisma.task.count({ 
          where: { 
            assigned_designer_id: user.id, 
            designer_due_date: { lt: today }, 
            status: { name: { notIn: ['DONE', 'APPROVED'] } } 
          } 
        }),
        prisma.task.count({ where: { assigned_designer_id: user.id, status: { name: { in: ['DONE', 'APPROVED'] } } } }),
        prisma.notification.findMany({
          where: {
            user_id: user.id,
            type: 'COMMENT_ADDED',
            is_read: false
          },
          orderBy: { created_at: 'desc' },
          take: 10,
          select: {
            id: true,
            message: true,
            reference_id: true,
            created_at: true
          }
        })
      ]);

      designerMetrics = {
        totalTasks: designerTotalTasks,
        openTasks: designerOpenTasks,
        inProgressTasks: designerInProgressTasks,
        dueToday: designerDueTodayTasks,
        dueThisWeek: designerDueThisWeekTasks,
        awaitingReview: designerAwaitingReviewTasks,
        approvedThisMonth: designerApprovedThisMonthTasks,
        comments: designerComments,
        overdue: designerOverdueTasks,
        completedTasks: designerCompletedTasks,
        unreadCommentNotifications: unreadCommentNotifications.map(n => ({
          id: n.id,
          message: n.message,
          referenceId: n.reference_id,
          createdAt: n.created_at
        }))
      };
    }

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
        storagePercentage,
        designerMetrics
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard metrics:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard metrics' });
  }
};
