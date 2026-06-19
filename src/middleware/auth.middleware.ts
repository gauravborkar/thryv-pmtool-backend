import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

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
