import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import * as taskController from '../controllers/task.controller';
import { upload } from '../middleware/upload.middleware';

const router = Router();

/**
 * @route GET /tasks
 * @desc Get all tasks (Filtered by role in logic)
 * @access Private (All roles)
 */
router.get('/', authenticate, taskController.getTasks);
router.get('/types', authenticate, taskController.getTaskTypes);
router.get('/:id', authenticate, taskController.getTaskById);

/**
 * @route POST /tasks
 * @desc Create/Assign a task (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), taskController.createTask);

/**
 * @route PATCH /tasks/:id/status
 * @desc Update task status (All roles)
 * @access Private
 */
router.patch('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), taskController.updateTask);
router.patch('/:id/status', authenticate, taskController.updateTaskStatus);

/**
 * @route PATCH /tasks/:id/assign
 * @desc Assign task to designer (Manager/Admin only)
 * @access Private (Admin, Manager)
 */
router.patch('/:id/assign', authenticate, authorize(['ADMIN', 'MANAGER']), taskController.assignTask);
router.post('/:id/comments', authenticate, taskController.addTaskComment);
router.patch('/:id/comments/:commentId', authenticate, taskController.updateTaskComment);
router.delete('/:id/comments/:commentId', authenticate, taskController.deleteTaskComment);

// Media / Attachments
router.post('/:id/media', authenticate, upload.single('file'), taskController.addTaskAttachment);
router.delete('/:id/media/:attachmentId', authenticate, taskController.deleteTaskAttachment);

router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), taskController.deleteTask);

export default router;

