import { Prisma, Task } from '@prisma/client';
import { addDays } from 'date-fns';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs';
import { createNotification } from './notification.service';
import { storage } from '../lib/storage';

const STATUS_FLOW = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'UPLOADED',
  'APPROVED',
  'SCHEDULED',
] as const;

type WorkflowStatus = (typeof STATUS_FLOW)[number];

export type TaskFilters = {
  roles: string[];
  userId: number;
  sortBy?: 'dueDate' | 'status' | 'client' | 'designer' | 'designerDue';
  sortOrder?: 'asc' | 'desc';
  status?: string;
  clientId?: number;
  designerId?: number;
  search?: string;
  page?: number;
  limit?: number;
};

export type CreateTaskPayload = {
  title: string;
  brief?: string;
  postSpecs?: string;
  publishDate: string;
  priority?: number;
  calendarEntryId?: number;
  clientId?: number;
  assignedDesignerId?: number;
  assignedRoleIds?: number[];
  status?: WorkflowStatus;
  taskTypeId?: number;
  taskTypeIds?: number[];
  startDate?: string;
};

export type UpdateTaskPayload = {
  title?: string;
  brief?: string;
  postSpecs?: string;
  publishDate?: string;
  priority?: number;
  taskTypeId?: number;
  taskTypeIds?: number[];
  assignedRoleIds?: number[];
  startDate?: string;
};

export type CommentPayload = {
  content: string;
};

const statusCache = new Map<string, number>();

async function getOrCreateStatus(name: WorkflowStatus) {
  const cachedId = statusCache.get(name);
  if (cachedId) {
    return { id: cachedId, name };
  }
  const status = await prisma.taskStatus.upsert({
    where: { name },
    update: {},
    create: { name },
  });
  statusCache.set(name, status.id);
  return status;
}

function getStatusRank(name: string): number {
  const index = STATUS_FLOW.findIndex((s) => s === name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function includeTaskRelations() {
  return {
    status: true,
    task_type: true,
    task_types: true,
    calendar_entry: { include: { client: true } },
    assigned_designer: { select: { id: true, name: true, email: true } },
    created_by_manager: { select: { id: true, name: true, email: true } },
    assigned_roles: true,
    comments: {
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { created_at: 'asc' as const },
    },
    uploads: {
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    },
  };
}

function mapTask(task: Prisma.TaskGetPayload<{ include: ReturnType<typeof includeTaskRelations> }>) {
  const desc = task.calendar_entry?.description || '';
  const parts = desc.split('\n\n');
  const brief = parts[0] || '';
  const postSpecs = parts.slice(1).join('\n\n') || '';

  return {
    id: task.id,
    title: task.title,
    brief,
    postSpecs,
    status: task.status.name,
    statusId: task.status_id,
    priority: task.priority,
    publishDate: task.publish_date,
    designerDueDate: task.designer_due_date,
    startDate: task.start_date,
    taskTypeId: task.task_type_id,
    taskType: task.task_type
      ? {
          id: task.task_type.id,
          name: task.task_type.name,
        }
      : null,
    taskTypeIds: task.task_types ? task.task_types.map(t => t.id) : [],
    taskTypes: task.task_types ? task.task_types.map(t => ({ id: t.id, name: t.name })) : [],
    assignedRoleIds: task.assigned_roles ? task.assigned_roles.map(r => r.id) : [],
    assignedRoles: task.assigned_roles ? task.assigned_roles.map(r => ({ id: r.id, name: r.name })) : [],
    calendarEntryId: task.calendar_entry_id,
    client: task.calendar_entry?.client
      ? {
          id: task.calendar_entry.client.id,
          name: task.calendar_entry.client.name,
        }
      : null,
    assignedDesigner: task.assigned_designer,
    createdByManager: task.created_by_manager,
    comments: task.comments.map((c) => ({
      id: c.id,
      content: c.content,
      createdAt: c.created_at,
      author: c.author,
    })),
    media: task.uploads.map((u) => ({
      id: u.id,
      fileName: u.file_name,
      fileUrl: u.file_url,
      fileType: u.file_type,
      fileSize: u.file_size,
      createdAt: u.created_at,
      uploadedBy: u.user,
    })),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

/** Worker roles that can be assigned to tasks */
const WORKER_ROLES = ['DESIGNER', 'VIDEOGRAPHER', 'EDITOR'];

function canViewTask(roles: string[], userId: number, task: Task): boolean {
  if (roles.includes('ADMIN')) return true;
  if (roles.includes('MANAGER')) return task.created_by_manager_id === userId;
  if (roles.some((r) => WORKER_ROLES.includes(r))) return task.assigned_designer_id === userId;
  return false;
}

export async function listTasks(filters: TaskFilters) {
  const where: Prisma.TaskWhereInput = {};

  const isWorker = filters.roles.some((r) => WORKER_ROLES.includes(r));
  const isManager = filters.roles.includes('MANAGER');
  const isAdmin = filters.roles.includes('ADMIN');

  if (isWorker && !isManager && !isAdmin) {
    where.assigned_designer_id = filters.userId;
  } else if (isManager && !isAdmin) {
    where.created_by_manager_id = filters.userId;
  }

  if (filters.status) {
    where.status = { name: filters.status.toUpperCase() };
  }

  if (filters.clientId) {
    where.calendar_entry = { client_id: filters.clientId };
  }

  if (filters.designerId) {
    where.assigned_designer_id = filters.designerId;
  }

  if (filters.search?.trim()) {
    const query = filters.search.trim();
    where.OR = [
      { title: { contains: query, mode: 'insensitive' } },
      { calendar_entry: { client: { name: { contains: query, mode: 'insensitive' } } } },
      { assigned_designer: { name: { contains: query, mode: 'insensitive' } } },
    ];
  }

  const sortBy = filters.sortBy ?? 'dueDate';
  const sortOrder = (filters.sortOrder ?? 'asc') as Prisma.SortOrder;

  let orderBy: Prisma.TaskOrderByWithRelationInput = { publish_date: sortOrder };

  if (sortBy === 'status') {
    orderBy = { status_id: sortOrder };
  } else if (sortBy === 'client') {
    orderBy = { calendar_entry: { client: { name: sortOrder } } };
  } else if (sortBy === 'designer') {
    orderBy = { assigned_designer: { name: sortOrder } };
  } else if (sortBy === 'dueDate') {
    orderBy = { publish_date: sortOrder };
  } else if (sortBy === 'designerDue') {
    orderBy = { designer_due_date: sortOrder };
  }

  const isPaginated = filters.page !== undefined || filters.limit !== undefined;
  const page = Math.max(1, filters.page || 1);
  const limit = Math.max(1, Math.min(100, filters.limit || 10));
  const skip = (page - 1) * limit;

  if (isPaginated) {
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        include: includeTaskRelations(),
        orderBy,
        skip,
        take: limit,
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks: tasks.map(mapTask),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  } else {
    const tasks = await prisma.task.findMany({
      where,
      include: includeTaskRelations(),
      orderBy,
    });
    return tasks.map(mapTask);
  }
}

export async function getTaskById(taskId: number, roles: string[], userId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: includeTaskRelations(),
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (!canViewTask(roles, userId, task)) {
    throw new Error('Forbidden: You do not have permission to access this task');
  }

  return mapTask(task);
}

export async function createTask(payload: CreateTaskPayload, managerId: number) {
  const statusName = (payload.status ?? 'NOT_STARTED') as WorkflowStatus;
  const status = await getOrCreateStatus(statusName);
  const publishDate = new Date(payload.publishDate);
  const designerDueDate = addDays(publishDate, -2);
  const startDate = payload.startDate ? new Date(payload.startDate) : null;

  const hasTaskTypeIds = payload.taskTypeIds && payload.taskTypeIds.length > 0;
  const primaryTaskTypeId = hasTaskTypeIds ? Number(payload.taskTypeIds![0]) : (payload.taskTypeId ? Number(payload.taskTypeId) : null);

  const task = await prisma.task.create({
    data: {
      calendar_entry_id: payload.calendarEntryId,
      title: payload.title,
      status_id: status.id,
      task_type_id: primaryTaskTypeId,
      task_types: hasTaskTypeIds 
        ? { connect: payload.taskTypeIds!.map(id => ({ id: Number(id) })) }
        : (payload.taskTypeId ? { connect: [{ id: Number(payload.taskTypeId) }] } : undefined),
      assigned_roles: payload.assignedRoleIds && payload.assignedRoleIds.length > 0
        ? { connect: payload.assignedRoleIds.map(id => ({ id: Number(id) })) }
        : undefined,
      priority: payload.priority ?? 2,
      start_date: startDate,
      publish_date: publishDate,
      designer_due_date: designerDueDate,
      assigned_designer_id: payload.assignedDesignerId,
      created_by_manager_id: managerId,
    },
    include: includeTaskRelations(),
  });

  if (payload.brief || payload.postSpecs) {
    if (payload.calendarEntryId) {
      await prisma.calendarEntry.update({
        where: { id: payload.calendarEntryId },
        data: {
          description: `${payload.brief || ''}\n\n${payload.postSpecs || ''}`,
        },
      });
    }
  }

  if (payload.assignedDesignerId && payload.assignedDesignerId !== managerId) {
    await createNotification({
      userId: payload.assignedDesignerId,
      title: 'Task Assigned',
      message: `You have been assigned to task "${task.title}"`,
      type: 'TASK_ASSIGNED',
      referenceId: task.id,
      referenceType: 'Task'
    });
  }

  return mapTask(task);
}

export async function updateTask(taskId: number, payload: UpdateTaskPayload, roles: string[], userId: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');
  const isWorker = roles.some((r) => WORKER_ROLES.includes(r));

  if (isManager && !isAdmin && existing.created_by_manager_id !== userId) {
    throw new Error('Forbidden: You do not have permission to update this task');
  }
  if (isWorker && !isManager && !isAdmin && existing.assigned_designer_id !== userId) {
    throw new Error('Forbidden: You do not have permission to update this task');
  }

  const publishDate = payload.publishDate
    ? new Date(payload.publishDate)
    : existing.publish_date;
  const designerDueDate = addDays(publishDate, -2);
  const startDate = payload.startDate !== undefined
    ? (payload.startDate ? new Date(payload.startDate) : null)
    : existing.start_date;

  const hasNewTaskTypeIds = payload.taskTypeIds !== undefined;
  const newPrimaryTaskTypeId = hasNewTaskTypeIds 
    ? (payload.taskTypeIds!.length > 0 ? Number(payload.taskTypeIds![0]) : null)
    : (payload.taskTypeId !== undefined 
        ? (payload.taskTypeId ? Number(payload.taskTypeId) : null) 
        : existing.task_type_id);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: payload.title ?? existing.title,
      task_type_id: newPrimaryTaskTypeId,
      task_types: hasNewTaskTypeIds
        ? { set: payload.taskTypeIds!.map(id => ({ id: Number(id) })) }
        : (payload.taskTypeId !== undefined 
            ? (payload.taskTypeId ? { set: [{ id: Number(payload.taskTypeId) }] } : { set: [] }) 
            : undefined),
      assigned_roles: payload.assignedRoleIds !== undefined
        ? { set: payload.assignedRoleIds.map(id => ({ id: Number(id) })) }
        : undefined,
      priority: payload.priority ?? existing.priority,
      start_date: startDate,
      publish_date: publishDate,
      designer_due_date: designerDueDate,
    },
    include: includeTaskRelations(),
  });

  if (existing.calendar_entry_id && (payload.brief !== undefined || payload.postSpecs !== undefined || payload.title)) {
    const calendarEntry = await prisma.calendarEntry.findUnique({
      where: { id: existing.calendar_entry_id },
    });
    const existingDesc = calendarEntry?.description || '';
    const parts = existingDesc.split('\n\n');
    const existingBrief = parts[0] || '';
    const existingSpecs = parts.slice(1).join('\n\n') || '';

    const newBrief = payload.brief !== undefined ? payload.brief : existingBrief;
    const newSpecs = payload.postSpecs !== undefined ? payload.postSpecs : existingSpecs;

    await prisma.calendarEntry.update({
      where: { id: existing.calendar_entry_id },
      data: {
        title: payload.title ?? undefined,
        description: `${newBrief}\n\n${newSpecs}`,
        date: payload.publishDate ? new Date(payload.publishDate) : undefined,
      },
    });
  }

  return mapTask(task);
}

export async function updateTaskStatus(
  taskId: number,
  statusName: WorkflowStatus,
  roles: string[],
  userId: number
) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const isWorker = roles.some((r) => WORKER_ROLES.includes(r));
  const isManager = roles.includes('MANAGER');
  const isAdmin = roles.includes('ADMIN');

  if (isWorker && !isManager && !isAdmin && existing.assigned_designer_id !== userId) {
    throw new Error('Forbidden: You can only update your assigned tasks');
  }

  const status = await getOrCreateStatus(statusName);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status_id: status.id },
    include: includeTaskRelations(),
  });

  if (['UPLOADED', 'APPROVED', 'SCHEDULED', 'COMPLETE', 'DONE'].includes(statusName)) {
    if (task.created_by_manager_id !== userId) {
      await createNotification({
        userId: task.created_by_manager_id,
        title: 'Task Status Updated',
        message: `Task "${task.title}" status changed to ${statusName}`,
        type: 'TASK_STATUS_CHANGED',
        referenceId: task.id,
        referenceType: 'Task'
      });
    }
  } else if (['REVISION', 'IN_PROGRESS'].includes(statusName) && task.assigned_designer_id) {
    if (task.assigned_designer_id !== userId) {
      await createNotification({
        userId: task.assigned_designer_id,
        title: 'Task Status Updated',
        message: `Task "${task.title}" status changed to ${statusName}`,
        type: 'TASK_STATUS_CHANGED',
        referenceId: task.id,
        referenceType: 'Task'
      });
    }
  }

  return mapTask(task);
}

export async function assignTask(taskId: number, designerId: number, roles: string[], actionUserId?: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');

  if (isManager && !isAdmin && existing.created_by_manager_id !== actionUserId) {
    throw new Error('Forbidden: You do not have permission to assign this task');
  }

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    include: { roles: true },
  });

  if (!designer || !designer.roles.some((r) => WORKER_ROLES.includes(r.name))) {
    throw new Error('Assigned user must be a designer, videographer, or editor');
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      assigned_designer_id: designerId,
      // Recalculate designer due date based on existing publish date
      designer_due_date: addDays(existing.publish_date, -2),
    },
    include: includeTaskRelations(),
  });

  if (existing.assigned_designer_id !== designerId && designerId !== actionUserId) {
    await createNotification({
      userId: designerId,
      title: 'Task Assigned',
      message: `You have been assigned to task "${existing.title}"`,
      type: 'TASK_ASSIGNED',
      referenceId: taskId,
      referenceType: 'Task'
    });
  }

  return mapTask(task);
}

export async function addComment(taskId: number, userId: number, roles: string[], payload: CommentPayload) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  if (!canViewTask(roles, userId, task)) {
    throw new Error('Forbidden: You do not have permission to access this task');
  }

  const comment = await prisma.comment.create({
    data: {
      task_id: taskId,
      author_id: userId,
      content: payload.content,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  if (task.assigned_designer_id && userId === task.assigned_designer_id) {
    await createNotification({
      userId: task.created_by_manager_id,
      title: 'New Comment on Task',
      message: `A new comment was added to task "${task.title}"`,
      type: 'COMMENT_ADDED',
      referenceId: taskId,
      referenceType: 'Task'
    });
  } else if (task.assigned_designer_id && userId === task.created_by_manager_id) {
    await createNotification({
      userId: task.assigned_designer_id,
      title: 'New Comment on Task',
      message: `A new comment was added to task "${task.title}"`,
      type: 'COMMENT_ADDED',
      referenceId: taskId,
      referenceType: 'Task'
    });
  }

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.created_at,
    author: comment.author,
  };
}

function canManageComment(roles: string[], commentAuthorId: number, userId: number): boolean {
  if (roles.includes('ADMIN') || roles.includes('MANAGER')) return true;
  return commentAuthorId === userId;
}

export async function updateComment(
  taskId: number,
  commentId: number,
  userId: number,
  roles: string[],
  payload: CommentPayload
) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.task_id !== taskId) throw new Error('Comment not found');
  if (!canManageComment(roles, comment.author_id, userId)) {
    throw new Error('Forbidden: You do not have permission to edit this comment');
  }

  const updated = await prisma.comment.update({
    where: { id: commentId },
    data: { content: payload.content },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return {
    id: updated.id,
    content: updated.content,
    createdAt: updated.created_at,
    author: updated.author,
  };
}

export async function deleteComment(
  taskId: number,
  commentId: number,
  userId: number,
  roles: string[]
) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.task_id !== taskId) throw new Error('Comment not found');
  if (!canManageComment(roles, comment.author_id, userId)) {
    throw new Error('Forbidden: You do not have permission to delete this comment');
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return { id: commentId };
}

export async function deleteTask(taskId: number, roles: string[], userId: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const isAdmin = roles.includes('ADMIN');
  const isManager = roles.includes('MANAGER');

  if (isManager && !isAdmin && existing.created_by_manager_id !== userId) {
    throw new Error('Forbidden: You do not have permission to delete this task');
  }

  await prisma.task.delete({ where: { id: taskId } });
  return { id: taskId };
}

export async function addTaskAttachment(
  taskId: number,
  userId: number,
  roles: string[],
  payload: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  if (!canViewTask(roles, userId, task)) {
    throw new Error('Forbidden: You do not have permission to access this task');
  }

  const attachment = await prisma.attachment.create({
    data: {
      file_name: payload.fileName,
      file_url: payload.fileUrl,
      file_type: payload.fileType,
      file_size: payload.fileSize,
      task_id: taskId,
      uploaded_by: userId,
    },
    include: {
      user: { select: { id: true, name: true, email: true } },
    },
  });

  if (userId !== task.created_by_manager_id) {
    await createNotification({
      userId: task.created_by_manager_id,
      title: 'Attachment Uploaded',
      message: `An attachment was uploaded to task "${task.title}"`,
      type: 'ATTACHMENT_UPLOADED',
      referenceId: taskId,
      referenceType: 'Task'
    });
  }

  return {
    id: attachment.id,
    fileName: attachment.file_name,
    fileUrl: attachment.file_url,
    fileType: attachment.file_type,
    fileSize: attachment.file_size,
    createdAt: attachment.created_at,
    uploadedBy: attachment.user,
  };
}

export async function deleteTaskAttachment(
  taskId: number,
  attachmentId: number,
  userId: number,
  roles: string[]
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  if (!canViewTask(roles, userId, task)) {
    throw new Error('Forbidden: You do not have permission to access this task');
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment || attachment.task_id !== taskId) {
    throw new Error('Attachment not found');
  }

  // Auth check: Admin/Manager or the owner who uploaded it
  const isOwner = attachment.uploaded_by === userId;
  const isAdminOrManager = roles.some((r) => ['ADMIN', 'MANAGER'].includes(r));
  if (!isOwner && !isAdminOrManager) {
    throw new Error('Forbidden: You do not have permission to delete this attachment');
  }

  // Delete from cloud storage (Firebase / S3) — no-op if URL doesn't match provider
  await storage.deleteFile(attachment.file_url);

  // Legacy fallback: also try to remove a local disk file (for old uploads)
  const localFilePath = path.join(process.cwd(), 'uploads', path.basename(attachment.file_url));
  try {
    if (fs.existsSync(localFilePath)) {
      fs.unlinkSync(localFilePath);
    }
  } catch (err) {
    console.error('Failed to delete local file:', err);
  }

  await prisma.attachment.delete({ where: { id: attachmentId } });
  return { id: attachmentId };
}

export async function getTaskTypes() {
  return prisma.taskType.findMany({
    orderBy: { name: 'asc' },
  });
}

