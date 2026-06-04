import { Prisma, Task } from '@prisma/client';
import { addDays } from 'date-fns';
import prisma from '../lib/prisma';
import path from 'path';
import fs from 'fs';

const STATUS_FLOW = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'UPLOADED',
  'APPROVED',
  'SCHEDULED',
] as const;

type WorkflowStatus = (typeof STATUS_FLOW)[number];

export type TaskFilters = {
  role: string;
  userId: number;
  sortBy?: 'dueDate' | 'status' | 'client' | 'designer';
  sortOrder?: 'asc' | 'desc';
  status?: string;
  clientId?: number;
  designerId?: number;
  search?: string;
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
  status?: WorkflowStatus;
};

export type UpdateTaskPayload = {
  title?: string;
  brief?: string;
  postSpecs?: string;
  publishDate?: string;
  priority?: number;
};

export type CommentPayload = {
  content: string;
};

async function getOrCreateStatus(name: WorkflowStatus) {
  return prisma.taskStatus.upsert({
    where: { name },
    update: {},
    create: { name },
  });
}

function getStatusRank(name: string): number {
  const index = STATUS_FLOW.findIndex((s) => s === name);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function includeTaskRelations() {
  return {
    status: true,
    calendar_entry: { include: { client: true } },
    assigned_designer: { select: { id: true, name: true, email: true } },
    created_by_manager: { select: { id: true, name: true, email: true } },
    comments: {
      include: { author: { select: { id: true, name: true, email: true } } },
      orderBy: { created_at: 'asc' as const },
    },
    uploads: true,
  };
}

function mapTask(task: Prisma.TaskGetPayload<{ include: ReturnType<typeof includeTaskRelations> }>) {
  return {
    id: task.id,
    title: task.title,
    brief: task.calendar_entry?.description || '',
    postSpecs: '',
    status: task.status.name,
    statusId: task.status_id,
    priority: task.priority,
    publishDate: task.publish_date,
    designerDueDate: task.designer_due_date,
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
    })),
    createdAt: task.created_at,
    updatedAt: task.updated_at,
  };
}

function canViewTask(role: string, userId: number, task: Task): boolean {
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  if (role === 'DESIGNER') return task.assigned_designer_id === userId;
  return false;
}

export async function listTasks(filters: TaskFilters) {
  const where: Prisma.TaskWhereInput = {};

  if (filters.role === 'DESIGNER') {
    where.assigned_designer_id = filters.userId;
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

  const tasks = await prisma.task.findMany({
    where,
    include: includeTaskRelations(),
  });

  const sortBy = filters.sortBy ?? 'dueDate';
  const sortOrder = filters.sortOrder ?? 'asc';
  const direction = sortOrder === 'asc' ? 1 : -1;

  const sorted = [...tasks].sort((a, b) => {
    if (sortBy === 'status') {
      return (getStatusRank(a.status.name) - getStatusRank(b.status.name)) * direction;
    }
    if (sortBy === 'client') {
      const aClient = a.calendar_entry?.client?.name ?? '';
      const bClient = b.calendar_entry?.client?.name ?? '';
      return aClient.localeCompare(bClient) * direction;
    }
    if (sortBy === 'designer') {
      const aDesigner = a.assigned_designer?.name ?? '';
      const bDesigner = b.assigned_designer?.name ?? '';
      return aDesigner.localeCompare(bDesigner) * direction;
    }
    return (a.designer_due_date.getTime() - b.designer_due_date.getTime()) * direction;
  });

  return sorted.map(mapTask);
}

export async function getTaskById(taskId: number, role: string, userId: number) {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: includeTaskRelations(),
  });

  if (!task) {
    throw new Error('Task not found');
  }

  if (!canViewTask(role, userId, task)) {
    throw new Error('Forbidden: You do not have permission to access this task');
  }

  return mapTask(task);
}

export async function createTask(payload: CreateTaskPayload, managerId: number) {
  const statusName = (payload.status ?? 'NOT_STARTED') as WorkflowStatus;
  const status = await getOrCreateStatus(statusName);
  const publishDate = new Date(payload.publishDate);
  const designerDueDate = addDays(publishDate, -2);

  const task = await prisma.task.create({
    data: {
      calendar_entry_id: payload.calendarEntryId,
      title: payload.title,
      status_id: status.id,
      priority: payload.priority ?? 2,
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
          description: [payload.brief, payload.postSpecs].filter(Boolean).join('\n\n'),
        },
      });
    }
  }

  return mapTask(task);
}

export async function updateTask(taskId: number, payload: UpdateTaskPayload, managerId: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const publishDate = payload.publishDate
    ? new Date(payload.publishDate)
    : existing.publish_date;
  const designerDueDate = addDays(publishDate, -2);

  const task = await prisma.task.update({
    where: { id: taskId },
    data: {
      title: payload.title ?? existing.title,
      priority: payload.priority ?? existing.priority,
      publish_date: publishDate,
      designer_due_date: designerDueDate,
      created_by_manager_id: managerId,
    },
    include: includeTaskRelations(),
  });

  if (existing.calendar_entry_id) {
    await prisma.calendarEntry.update({
      where: { id: existing.calendar_entry_id },
      data: {
        title: payload.title ?? undefined,
        description: [payload.brief, payload.postSpecs].filter(Boolean).join('\n\n') || undefined,
        date: payload.publishDate ? new Date(payload.publishDate) : undefined,
      },
    });
  }

  return mapTask(task);
}

export async function updateTaskStatus(
  taskId: number,
  statusName: WorkflowStatus,
  role: string,
  userId: number
) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  if (role === 'DESIGNER' && existing.assigned_designer_id !== userId) {
    throw new Error('Forbidden: You can only update your assigned tasks');
  }

  const status = await getOrCreateStatus(statusName);
  const task = await prisma.task.update({
    where: { id: taskId },
    data: { status_id: status.id },
    include: includeTaskRelations(),
  });

  return mapTask(task);
}

export async function assignTask(taskId: number, designerId: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  const designer = await prisma.user.findUnique({
    where: { id: designerId },
    include: { role: true },
  });

  if (!designer || designer.role.name !== 'DESIGNER') {
    throw new Error('Assigned user must be a designer');
  }

  const task = await prisma.task.update({
    where: { id: taskId },
    data: { assigned_designer_id: designerId },
    include: includeTaskRelations(),
  });

  return mapTask(task);
}

export async function addComment(taskId: number, userId: number, payload: CommentPayload) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

  const comment = await prisma.comment.create({
    data: {
      task_id: taskId,
      author_id: userId,
      content: payload.content,
    },
    include: { author: { select: { id: true, name: true, email: true } } },
  });

  return {
    id: comment.id,
    content: comment.content,
    createdAt: comment.created_at,
    author: comment.author,
  };
}

function canManageComment(role: string, commentAuthorId: number, userId: number): boolean {
  if (role === 'ADMIN' || role === 'MANAGER') return true;
  return commentAuthorId === userId;
}

export async function updateComment(
  taskId: number,
  commentId: number,
  userId: number,
  role: string,
  payload: CommentPayload
) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.task_id !== taskId) throw new Error('Comment not found');
  if (!canManageComment(role, comment.author_id, userId)) {
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
  role: string
) {
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.task_id !== taskId) throw new Error('Comment not found');
  if (!canManageComment(role, comment.author_id, userId)) {
    throw new Error('Forbidden: You do not have permission to delete this comment');
  }

  await prisma.comment.delete({ where: { id: commentId } });
  return { id: commentId };
}

export async function deleteTask(taskId: number) {
  const existing = await prisma.task.findUnique({ where: { id: taskId } });
  if (!existing) throw new Error('Task not found');

  await prisma.task.delete({ where: { id: taskId } });
  return { id: taskId };
}

export async function addTaskAttachment(
  taskId: number,
  userId: number,
  payload: {
    fileName: string;
    fileUrl: string;
    fileType: string;
    fileSize: number;
  }
) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error('Task not found');

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
  role: string
) {
  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
  });
  if (!attachment || attachment.task_id !== taskId) {
    throw new Error('Attachment not found');
  }

  // Auth check: Admin/Manager or the owner who uploaded it
  const isOwner = attachment.uploaded_by === userId;
  const isAdminOrManager = ['ADMIN', 'MANAGER'].includes(role);
  if (!isOwner && !isAdminOrManager) {
    throw new Error('Forbidden: You do not have permission to delete this attachment');
  }

  // Delete physical file
  const filePath = path.join(process.cwd(), 'uploads', path.basename(attachment.file_url));
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.error('Failed to delete physical file:', err);
  }

  await prisma.attachment.delete({ where: { id: attachmentId } });
  return { id: attachmentId };
}

