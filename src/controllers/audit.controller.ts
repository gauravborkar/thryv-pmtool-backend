import { Request, Response, NextFunction } from 'express';
import * as auditService from '../services/audit.service';

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.query.userId ? parseInt(req.query.userId as string, 10) : undefined;
    const action = req.query.action as string | undefined;
    const entity = req.query.entity as string | undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;

    const result = await auditService.getAuditLogs({
      userId,
      action,
      entity,
      page,
      limit,
    });

    res.status(200).json({
      message: 'Audit logs retrieved successfully',
      data: result.logs,
      pagination: result.pagination,
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};
