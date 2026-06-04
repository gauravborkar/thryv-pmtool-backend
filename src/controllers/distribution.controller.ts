// src/controllers/distribution.controller.ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

/** GET /distribution/:projectId */
export const getDistributionRule = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const rule = await prisma.distributionRule.findUnique({ where: { package_id: packageId } });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json(rule);
};

/** POST /distribution/:projectId */
export const upsertDistributionRule = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const { formatSequence, peakDays, maxConsecutiveSameFormat, regenerationMode } = req.body;
  const data = {
    package_id: packageId,
    formatSequence: JSON.stringify(formatSequence),
    peakDays: JSON.stringify(peakDays),
    maxConsecutiveSameFormat: maxConsecutiveSameFormat ?? 1,
    regenerationMode: regenerationMode ?? 'ALL',
  };
  const rule = await prisma.distributionRule.upsert({
    where: { package_id: packageId },
    update: data,
    create: data,
  });
  res.json(rule);
};

/** POST /distribution/:projectId/schedule */
export const scheduleDistribution = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const rule = await prisma.distributionRule.findUnique({ where: { package_id: packageId } });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  const { schedulePosts } = await import('../services/distribution.service');
  const scheduled = await schedulePosts(packageId, rule.id);
  res.json(scheduled);
};

/** GET /distribution/:projectId/posts — list all scheduled posts for a package */
export const getScheduledPosts = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const posts = await prisma.scheduledPost.findMany({
    where: { package_id: packageId },
    orderBy: { scheduled_at: 'asc' },
  });
  res.json(posts);
};

/** PATCH /distribution/posts/:postId/lock — mark a post as locked (assigned to a task) */
export const lockPost = async (req: Request, res: Response) => {
  const postId = Number(req.params.postId);
  if (Number.isNaN(postId)) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Scheduled post not found' });

  const updated = await prisma.scheduledPost.update({
    where: { id: postId },
    data: { is_locked: true },
  });
  res.json(updated);
};

/** PATCH /distribution/posts/:postId/unlock — remove the lock from a post */
export const unlockPost = async (req: Request, res: Response) => {
  const postId = Number(req.params.postId);
  if (Number.isNaN(postId)) return res.status(400).json({ error: 'Invalid post id' });

  const post = await prisma.scheduledPost.findUnique({ where: { id: postId } });
  if (!post) return res.status(404).json({ error: 'Scheduled post not found' });

  const updated = await prisma.scheduledPost.update({
    where: { id: postId },
    data: { is_locked: false },
  });
  res.json(updated);
};
