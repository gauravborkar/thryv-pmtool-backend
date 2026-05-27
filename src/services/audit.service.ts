import prisma from '../lib/prisma';

export interface LogActionData {
  userId?: number;
  action: string;
  entity?: string;
  entityId?: number;
  details?: Record<string, any>;
  ipAddress?: string;
}

export interface GetAuditLogsFilter {
  userId?: number;
  action?: string;
  entity?: string;
  page?: number;
  limit?: number;
}

/**
 * Creates an audit log record in the database.
 */
export const logAction = async (data: LogActionData) => {
  try {
    const log = await prisma.auditLog.create({
      data: {
        user_id: data.userId || undefined,
        action: data.action,
        entity: data.entity || undefined,
        entity_id: data.entityId || undefined,
        details: data.details || undefined,
        ip_address: data.ipAddress || undefined,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    return log;
  } catch (error) {
    console.error('[AuditService] Failed to create audit log:', error);
    // Silent return to avoid throwing errors on business operations if logging fails
    return null;
  }
};

/**
 * Retrieves audit logs from the database with pagination, sorting, and optional filtering.
 */
export const getAuditLogs = async (filters: GetAuditLogsFilter = {}) => {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 50));
  const skip = (page - 1) * limit;

  const whereClause: any = {};

  if (filters.userId) {
    whereClause.user_id = filters.userId;
  }

  if (filters.action) {
    whereClause.action = filters.action;
  }

  if (filters.entity) {
    whereClause.entity = filters.entity;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        created_at: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where: whereClause }),
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
};
