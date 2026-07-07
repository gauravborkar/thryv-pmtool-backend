import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

// GET /users (Admin only)
router.get('/', authenticate, authorize([1]), async (req: any, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const search = req.query.search as string;
    const role = req.query.role as string;

    const skip = (page - 1) * limit;

    const where: any = { is_active: true };
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (role && role !== 'ALL') {
      where.roles = { some: { name: role } };
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { roles: { include: { permissions: true } } },
      }),
      prisma.user.count({ where }),
    ]);

    const usersWithoutPassword = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
    
    res.json({
      data: usersWithoutPassword,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

import bcrypt from 'bcryptjs';

// POST /users (Admin only)
router.post('/', authenticate, authorize([1]), async (req: any, res) => {
  try {
    const { email, password, name, role_ids, custom_permissions } = req.body;
    // Support legacy role_id (single) or new role_ids (array)
    const roleIds: number[] = role_ids
      ? (Array.isArray(role_ids) ? role_ids : [role_ids]).map(Number)
      : (req.body.role_id ? [Number(req.body.role_id)] : []);
    
    if (!email || !password || !name || roleIds.length === 0) {
      return res.status(400).json({ message: 'Email, password, name, and at least one role are required' });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        roles: { connect: roleIds.map((id) => ({ id })) },
        custom_permissions: custom_permissions !== undefined ? (custom_permissions === null ? Prisma.DbNull : custom_permissions) : undefined,
      },
      include: { roles: { include: { permissions: true } } },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /users/me
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { roles: { include: { permissions: true } } },
    });

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const { password, ...userWithoutPassword } = user;
    res.json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /users/designers (All authenticated users)
router.get('/designers', authenticate, async (_req: any, res) => {
  try {
    const designers = await prisma.user.findMany({
      where: {
        roles: { none: { name: 'ADMIN' } },
        is_active: true,
      },
      select: { id: true, name: true, email: true, roles: { select: { id: true, name: true } } },
      orderBy: { name: 'asc' },
    });
    res.json({ data: designers });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /users/taggable (All authenticated users)
router.get('/taggable', authenticate, async (_req: any, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { is_active: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.json({ data: users });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// DELETE /users/:id (Admin only)
router.delete('/:id', authenticate, authorize([1]), async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Soft-delete the user by setting is_active: false
    await prisma.user.update({
      where: { id: userId },
      data: { is_active: false },
    });

    res.json({ message: 'User soft-deleted successfully' });
  } catch (error: any) {
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(500).json({ message: error.message });
  }
});
// PUT /users/:id (Admin only)
router.put('/:id', authenticate, authorize([1]), async (req: any, res) => {
  try {
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const { email, password, name, role_ids, custom_permissions } = req.body;
    // Support legacy role_id (single) or new role_ids (array)
    const roleIds: number[] | undefined = role_ids
      ? (Array.isArray(role_ids) ? role_ids : [role_ids]).map(Number)
      : (req.body.role_id !== undefined ? [Number(req.body.role_id)] : undefined);
    
    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!existingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if email is being changed and is already in use
    if (email && email !== existingUser.email) {
      const emailInUse = await prisma.user.findUnique({ where: { email } });
      if (emailInUse) {
        return res.status(400).json({ message: 'Email already in use' });
      }
    }

    const dataToUpdate: any = {
      ...(email && { email }),
      ...(name && { name }),
      ...(roleIds && { roles: { set: roleIds.map((id) => ({ id })) } }),
      ...(custom_permissions !== undefined && { custom_permissions: custom_permissions === null ? Prisma.DbNull : custom_permissions }),
    };

    if (password) {
      dataToUpdate.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: dataToUpdate,
      include: { roles: { include: { permissions: true } } },
    });

    const { password: _, ...userWithoutPassword } = updatedUser;
    res.json({ data: userWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
