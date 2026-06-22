import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    roles: string[];        // e.g. ['ADMIN', 'DESIGNER']
    permissions: string[];  // e.g. ['task:create', 'task:upload']
  };
}

/** Helper: check if user has any of the given roles */
export const hasRole = (user: AuthRequest['user'], ...roles: string[]): boolean => {
  if (!user) return false;
  return roles.some((r) => user.roles.includes(r));
};

/** Helper: check if user has a specific permission */
export const hasPermission = (user: AuthRequest['user'], permission: string): boolean => {
  if (!user) return false;
  return user.permissions.includes(permission);
};

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authorization token missing or malformed' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, JWT_SECRET) as any;
    // Support both old JWTs (single role string) and new JWTs (roles array)
    req.user = {
      id: payload.id,
      email: payload.email,
      roles: Array.isArray(payload.roles)
        ? payload.roles
        : (payload.role ? [payload.role] : []),
      permissions: Array.isArray(payload.permissions) ? payload.permissions : [],
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};

/** Middleware: allow only users with at least one of the specified roles */
export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.roles.some((r) => roles.includes(r))) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
    }
    next();
  };
};

/** Middleware: allow only users with a specific permission */
export const requirePermission = (permission: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !req.user.permissions.includes(permission)) {
      return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
    }
    next();
  };
};

const DEFAULT_ACCESS: Record<string, string[]> = {
  'Dashboard': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Tasks': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Clients': ['ADMIN'],
  'Calendar': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'AI Calendar': ['ADMIN', 'MANAGER', 'DESIGNER', 'CLIENT'],
  'Packages': ['ADMIN', 'MANAGER'],
  'Team Members': ['ADMIN'],
  'Section Access': ['ADMIN']
};

/** Middleware: check if the user's role is authorized for a specific section dynamically */
export const authorizeSection = (sectionName: string) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authorization token missing or malformed' });
    }

    // Always allow ADMIN
    if (req.user.roles.includes('ADMIN')) {
      return next();
    }

    try {
      const rule = await prisma.accessControlRule.findUnique({
        where: { section: sectionName },
      });

      let allowedRoles: (string | number)[] = [];
      if (rule) {
        allowedRoles = rule.roles as (string | number)[];
      } else {
        // Find default role IDs dynamically from the database using DEFAULT_ACCESS
        const defaultNames = DEFAULT_ACCESS[sectionName] || [];
        const dbRoles = await prisma.userRole.findMany({
          where: { name: { in: defaultNames } },
          select: { id: true }
        });
        allowedRoles = dbRoles.map(r => r.id);
      }

      // Check if user has access. If user token has roleIds, use them.
      // Otherwise, query database to map user's role names to their corresponding database IDs.
      const dbUserRoles = await prisma.userRole.findMany({
        where: { name: { in: req.user.roles } },
        select: { id: true }
      });
      const userRoleIds = dbUserRoles.map(r => r.id);

      const hasAccess = userRoleIds.some((id) => allowedRoles.includes(id)) || 
                        req.user.roles.some((name) => allowedRoles.includes(name));

      if (!hasAccess) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
      }

      next();
    } catch (error) {
      console.error(`Error checking access control rule for ${sectionName}:`, error);
      // Fallback if db query fails
      const defaultRoles = DEFAULT_ACCESS[sectionName] || [];
      const hasAccess = req.user.roles.some((role) => defaultRoles.includes(role));

      if (!hasAccess) {
        return res.status(403).json({ message: 'Forbidden: You do not have permission to access this resource' });
      }
      next();
    }
  };
};

