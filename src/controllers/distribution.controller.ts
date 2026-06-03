// src/controllers/distribution.controller.ts
import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getDistributionRule = async (req: Request, res: Response) => {
  const packageId = req.params.projectId; // The route uses :projectId, but it represents packageId here
  const rule = await prisma.distributionRule.findUnique({ where: { package_id: packageId } });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  res.json(rule);
};

export const upsertDistributionRule = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const { formatSequence, peakDays, maxConsecutiveSameFormat } = req.body;
  const data = {
    package_id: packageId,
    formatSequence: JSON.stringify(formatSequence),
    peakDays: JSON.stringify(peakDays),
    maxConsecutiveSameFormat: maxConsecutiveSameFormat ?? 1,
  };
  const rule = await prisma.distributionRule.upsert({
    where: { package_id: packageId },
    update: data,
    create: data,
  });
  res.json(rule);
};

export const scheduleDistribution = async (req: Request, res: Response) => {
  const packageId = req.params.projectId;
  const rule = await prisma.distributionRule.findUnique({ where: { package_id: packageId } });
  if (!rule) return res.status(404).json({ error: 'Rule not found' });
  // Re‑use the service we created earlier
  const { schedulePosts } = await import('../services/distribution.service');
  const scheduled = await schedulePosts(packageId, rule.id);
  res.json(scheduled);
};
