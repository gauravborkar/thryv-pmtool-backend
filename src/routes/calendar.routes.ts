import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';
import { getBlackoutDates, addBlackoutDate, removeBlackoutDate } from '../controllers/calendar.controller';
import { addDays, endOfMonth, parseISO, startOfMonth } from 'date-fns';

const router = Router();

// --- Blackout Dates Routes ---
router.get('/blackouts', authenticate, getBlackoutDates);
router.post('/blackouts', authenticate, authorize(['ADMIN', 'MANAGER']), addBlackoutDate);
router.delete('/blackouts/:date', authenticate, authorize(['ADMIN', 'MANAGER']), removeBlackoutDate);

/**
 * @route GET /calendar
 * @desc Get calendar entries
 * @access Private (All authenticated users)
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { client_id, month } = req.query;
    const monthDate =
      typeof month === 'string' && month
        ? parseISO(month.length === 7 ? `${month}-01` : month)
        : null;

    const entries = await prisma.calendarEntry.findMany({
      where: {
        client_id: client_id ? Number(client_id) : undefined,
        date: monthDate
          ? {
              gte: startOfMonth(monthDate),
              lte: endOfMonth(monthDate),
            }
          : undefined,
      },
      include: { client: true, task: { include: { status: true } } },
      orderBy: { date: 'asc' },
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
  try {
    const {
      clientId,
      date,
      title,
      description,
      status = 'NOT_STARTED',
      priority = 2,
      assignedDesignerId,
    } = req.body;

    if (!clientId || !date || !title) {
      return res.status(400).json({ message: 'clientId, date, and title are required' });
    }

    const publishDate = parseISO(String(date));
    const designerDueDate = addDays(publishDate, -2);

    const statusRow = await prisma.taskStatus.upsert({
      where: { name: String(status).toUpperCase() },
      update: {},
      create: { name: String(status).toUpperCase() },
    });

    const entry = await prisma.calendarEntry.create({
      data: {
        client_id: Number(clientId),
        date: publishDate,
        title: String(title),
        description: description ? String(description) : null,
      },
    });

    const task = await prisma.task.create({
      data: {
        calendar_entry_id: entry.id,
        title: String(title),
        status_id: statusRow.id,
        priority: Number(priority) || 2,
        publish_date: publishDate,
        designer_due_date: designerDueDate,
        assigned_designer_id: assignedDesignerId ? Number(assignedDesignerId) : null,
        created_by_manager_id: (req as any).user.id,
      },
      include: {
        status: true,
        assigned_designer: { select: { id: true, name: true, email: true } },
      },
    });

    res.status(201).json({
      message: 'Calendar entry and task created successfully',
      data: {
        ...entry,
        task,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Failed to create calendar entry' });
  }
});

export default router;
