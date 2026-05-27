import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @route GET /calendar
 * @desc Get calendar entries
 * @access Private (All authenticated users)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { client_id, month } = req.query;
    
    const entries = await prisma.calendarEntry.findMany({
      where: {
        client_id: client_id ? Number(client_id) : undefined,
        // Month filtering logic will be more complex in Sprint 3
      },
      include: { client: true, task: true },
    });

    res.json({ data: entries });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /calendar
 * @desc Create calendar entry (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  res.status(501).json({ message: 'Calendar creation logic coming in Sprint 3' });
});

export default router;
