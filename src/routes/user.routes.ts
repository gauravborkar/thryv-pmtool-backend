import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

// GET /users (Admin only)
router.get('/', authenticate, authorize(['ADMIN']), async (req: any, res) => {
  try {
    const users = await prisma.user.findMany({
      include: { role: true },
    });
    const usersWithoutPassword = users.map(({ password, ...userWithoutPassword }) => userWithoutPassword);
    res.json({ data: usersWithoutPassword });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

// GET /users/me
router.get('/me', authenticate, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: { role: true },
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

export default router;
