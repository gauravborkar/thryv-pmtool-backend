import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as taskService from '../services/task.service';

function getErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('Forbidden')) return 403;
  return 400;
}

export const getTasks = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const user = req.user!;
    const tasks = await taskService.listTasks({
      role: user.role,
      userId: user.id,
      sortBy: req.query.sortBy as 'dueDate' | 'status' | 'client' | 'designer' | 'designerDue' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      status: req.query.status as string | undefined,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
      designerId: req.query.designerId ? Number(req.query.designerId) : undefined,
      search: req.query.search as string | undefined,
    });

    res.status(200).json({
      message: 'Tasks retrieved successfully',
      data: tasks,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to retrieve tasks',
    });
  }
};

export const getTaskById = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const user = req.user!;
    const task = await taskService.getTaskById(taskId, user.role, user.id);

    res.status(200).json({
      message: 'Task retrieved successfully',
      data: task,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to retrieve task',
    });
  }
};

export const createTask = async (req: AuthRequest, res: Response) => {
  try {
    const { title, publishDate } = req.body;
    if (!title || !publishDate) {
      return res.status(400).json({ message: 'title and publishDate are required' });
    }

    const task = await taskService.createTask(req.body, req.user!.id);
    res.status(201).json({
      message: 'Task created successfully',
      data: task,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to create task',
    });
  }
};

export const updateTask = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const task = await taskService.updateTask(taskId, req.body, req.user!.id);
    res.status(200).json({
      message: 'Task updated successfully',
      data: task,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to update task',
    });
  }
};

export const updateTaskStatus = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const status = String(req.body.status || '').toUpperCase() as
      | 'NOT_STARTED'
      | 'IN_PROGRESS'
      | 'UPLOADED'
      | 'APPROVED'
      | 'SCHEDULED';

    if (
      !status ||
      !['NOT_STARTED', 'IN_PROGRESS', 'UPLOADED', 'APPROVED', 'SCHEDULED'].includes(status)
    ) {
      return res.status(400).json({ message: 'status is required' });
    }

    const task = await taskService.updateTaskStatus(taskId, status, req.user!.role, req.user!.id);
    res.status(200).json({
      message: 'Task status updated successfully',
      data: task,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to update task status',
    });
  }
};

export const assignTask = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const designerId = Number(req.body.designerId);

    if (Number.isNaN(taskId) || Number.isNaN(designerId)) {
      return res.status(400).json({ message: 'Valid taskId and designerId are required' });
    }

    const task = await taskService.assignTask(taskId, designerId);
    res.status(200).json({
      message: 'Task assigned successfully',
      data: task,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to assign task',
    });
  }
};

export const addTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await taskService.addComment(taskId, req.user!.id, { content });
    res.status(201).json({
      message: 'Comment added successfully',
      data: comment,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to add comment',
    });
  }
};

export const updateTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (Number.isNaN(taskId) || Number.isNaN(commentId)) {
      return res.status(400).json({ message: 'Invalid task/comment ID' });
    }

    const content = String(req.body.content || '').trim();
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await taskService.updateComment(taskId, commentId, req.user!.id, req.user!.role, {
      content,
    });
    res.status(200).json({
      message: 'Comment updated successfully',
      data: comment,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to update comment',
    });
  }
};

export const deleteTaskComment = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (Number.isNaN(taskId) || Number.isNaN(commentId)) {
      return res.status(400).json({ message: 'Invalid task/comment ID' });
    }

    const deleted = await taskService.deleteComment(taskId, commentId, req.user!.id, req.user!.role);
    res.status(200).json({
      message: 'Comment deleted successfully',
      data: deleted,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to delete comment',
    });
  }
};

export const deleteTask = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    const deleted = await taskService.deleteTask(taskId);
    res.status(200).json({
      message: 'Task deleted successfully',
      data: deleted,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to delete task',
    });
  }
};

export const addTaskAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    if (Number.isNaN(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    const attachment = await taskService.addTaskAttachment(taskId, req.user!.id, {
      fileName: req.file.originalname,
      fileUrl,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
    });

    res.status(201).json({
      message: 'Attachment uploaded successfully',
      data: attachment,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to upload attachment',
    });
  }
};

export const deleteTaskAttachment = async (req: AuthRequest, res: Response) => {
  try {
    const taskId = Number(req.params.id);
    const attachmentId = Number(req.params.attachmentId);
    if (Number.isNaN(taskId) || Number.isNaN(attachmentId)) {
      return res.status(400).json({ message: 'Invalid task or attachment ID' });
    }

    const result = await taskService.deleteTaskAttachment(
      taskId,
      attachmentId,
      req.user!.id,
      req.user!.role
    );

    res.status(200).json({
      message: 'Attachment deleted successfully',
      data: result,
    });
  } catch (error) {
    res.status(getErrorStatus(error)).json({
      message: error instanceof Error ? error.message : 'Failed to delete attachment',
    });
  }
};

