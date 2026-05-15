import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import prisma from '../lib/prisma';

const router = Router();

/**
 * @route GET /tasks
 * @desc Get all tasks (Filtered by role in logic)
 * @access Private (All roles)
 */
router.get('/', authenticate, async (req: any, res) => {
  try {
    const { role, id } = req.user;
    let tasks;

    if (role === 'DESIGNER') {
      // Designers only see tasks assigned to them
      tasks = await prisma.task.findMany({
        where: { assigned_designer_id: id },
        include: { status: true, calendar_entry: true },
      });
    } else {
      // Admins and Managers see everything
      tasks = await prisma.task.findMany({
        include: { status: true, assigned_designer: true, calendar_entry: true },
      });
    }

    res.json({ data: tasks });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
});

/**
 * @route POST /tasks
 * @desc Create/Assign a task (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  // Logic for task creation will go here in Sprint 3
  res.status(501).json({ message: 'Task creation logic coming in Sprint 3' });
});

/**
 * @route PATCH /tasks/:id/status
 * @desc Update task status (All roles)
 * @access Private
 */
router.patch('/:id/status', authenticate, async (req, res) => {
  // All roles can update status, but logic will check if designer is assigned
  res.status(501).json({ message: 'Task status update logic coming in Sprint 3' });
});

/**
 * @route PATCH /tasks/:id/assign
 * @desc Assign task to designer (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.patch('/:id/assign', authenticate, authorize(['ADMIN', 'MANAGER']), async (req, res) => {
  res.status(501).json({ message: 'Task assignment logic coming in Sprint 3' });
});

export default router;
