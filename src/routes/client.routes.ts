import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @route GET /clients
 * @desc List all clients
 * @access Private (Admin, Manager)
 */
router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const clients = await prisma.client.findMany({
      include: { manager: true },
    });
    res.json({ data: clients });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /clients
 * @desc Create a new client
 * @access Private (Admin, Manager)
 */
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  try {
    const { name, manager_id, active_month } = req.body;
    
    const client = await prisma.client.create({
      data: {
        name,
        manager_id,
        active_month: new Date(active_month),
      },
    });

    res.status(201).json({ data: client });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
