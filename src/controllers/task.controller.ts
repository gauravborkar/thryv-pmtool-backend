import { NextFunction, Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import * as taskService from '../services/task.service';
import { validateFileSecurity, sanitizeInput } from '../lib/security';

function getErrorStatus(error: unknown): number {
  const message = error instanceof Error ? error.message : '';
  if (message.includes('not found')) return 404;
  if (message.includes('Forbidden')) return 403;
  return 400;
}

export const getTasks = async (req: AuthRequest, res: Response, _next: NextFunction) => {
  try {
    const user = req.user!;
    const page = req.query.page ? Number(req.query.page) : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    const result = await taskService.listTasks({
      roles: user.roles,
      roleIds: user.roleIds,
      userId: user.id,
      sortBy: req.query.sortBy as 'dueDate' | 'status' | 'client' | 'designer' | 'designerDue' | undefined,
      sortOrder: req.query.sortOrder as 'asc' | 'desc' | undefined,
      status: req.query.status as string | undefined,
      clientId: req.query.clientId ? Number(req.query.clientId) : undefined,
      designerId: req.query.designerId ? Number(req.query.designerId) : undefined,
      search: req.query.search as string | undefined,
      page: page && !Number.isNaN(page) ? page : undefined,
      limit: limit && !Number.isNaN(limit) ? limit : undefined,
    });

    if (result && typeof result === 'object' && 'tasks' in result) {
      return res.status(200).json({
        message: 'Tasks retrieved successfully',
        data: result.tasks,
        pagination: result.pagination,
      });
    }

    res.status(200).json({
      message: 'Tasks retrieved successfully',
      data: result,
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
    const task = await taskService.getTaskById(taskId, user.roles, user.id, user.roleIds);

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

    req.body.title = sanitizeInput(title);
    if (req.body.brief) req.body.brief = sanitizeInput(req.body.brief);
    if (req.body.postSpecs) req.body.postSpecs = sanitizeInput(req.body.postSpecs);

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

    if (req.body.title) req.body.title = sanitizeInput(req.body.title);
    if (req.body.brief) req.body.brief = sanitizeInput(req.body.brief);
    if (req.body.postSpecs) req.body.postSpecs = sanitizeInput(req.body.postSpecs);

    const task = await taskService.updateTask(taskId, req.body, req.user!.roles, req.user!.id, req.user!.roleIds);
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

    const task = await taskService.updateTaskStatus(taskId, status, req.user!.roles, req.user!.id, req.user!.roleIds);
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

    const task = await taskService.assignTask(taskId, designerId, req.user!.roles, req.user!.id, req.user!.roleIds);
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

    const content = sanitizeInput(String(req.body.content || '').trim());
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await taskService.addComment(taskId, req.user!.id, req.user!.roles, { content }, req.user!.roleIds);
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

    const content = sanitizeInput(String(req.body.content || '').trim());
    if (!content) {
      return res.status(400).json({ message: 'Comment content is required' });
    }

    const comment = await taskService.updateComment(taskId, commentId, req.user!.id, req.user!.roles, {
      content,
    }, req.user!.roleIds);
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

    const deleted = await taskService.deleteComment(taskId, commentId, req.user!.id, req.user!.roles, req.user!.roleIds);
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

    const deleted = await taskService.deleteTask(taskId, req.user!.roles, req.user!.id, req.user!.roleIds);
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

    let fileName = '';
    let fileUrl = '';
    let fileType = '';
    let fileSize = 0;

    // Check if the file is already uploaded directly to the CDN by the client
    if (req.body.fileUrl) {
      fileName = req.body.fileName;
      fileUrl = req.body.fileUrl;
      fileType = req.body.fileType;
      fileSize = Number(req.body.fileSize || 0);

      if (!fileName || !fileType) {
        return res.status(400).json({
          message: 'fileName and fileType are required for direct-to-CDN uploads.',
        });
      }
    } else {
      // Server-proxied upload fallback
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded or fileUrl provided' });
      }

      // SECURITY HARDENING: Early validation before actual upload
      validateFileSecurity(req.file.originalname, req.file.size);

      const { storage } = await import('../lib/storage');
      const uploadResult = await storage.uploadFile({
        fileName: req.file.originalname,
        fileType: req.file.mimetype,
        buffer: req.file.buffer,
        folder: 'task-media',
      });

      fileName = req.file.originalname;
      fileUrl = uploadResult.fileUrl;
      fileType = req.file.mimetype;
      fileSize = req.file.size;
    }

    // SECURITY HARDENING: Validate file size and type whitelists
    validateFileSecurity(fileName, fileSize);

    const attachment = await taskService.addTaskAttachment(taskId, req.user!.id, req.user!.roles, {
      fileName,
      fileUrl,
      fileType,
      fileSize,
    }, req.user!.roleIds);

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
      req.user!.roles,
      req.user!.roleIds
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

export const getTaskTypes = async (req: AuthRequest, res: Response) => {
  try {
    const types = await taskService.getTaskTypes();
    res.status(200).json({
      message: 'Task types retrieved successfully',
      data: types,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to retrieve task types',
    });
  }
};

