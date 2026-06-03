// src/services/distribution.service.ts
import { ContentPackage, DistributionRule, ScheduledPost } from '@prisma/client';
import prisma from '../lib/prisma';



/**
 * Schedule posts according to distribution rules.
 * - Avoid more than `maxConsecutiveSameFormat` consecutive posts with the same format.
 * - Prefer placing posts on `peakDays` (ISO 1=Mon .. 7=Sun).
 * - The order of formats follows `formatSequence`.
 */
export async function schedulePosts(packageId: string, ruleId: number): Promise<ScheduledPost[]> {
  const rule = await prisma.distributionRule.findUnique({
    where: { id: ruleId },
    include: { scheduledPosts: true },
  });
  if (!rule) throw new Error('Distribution rule not found');

  const pkg = await prisma.contentPackage.findUnique({
    where: { id: packageId },
    include: { line_items: true },
  });
  if (!pkg) throw new Error('Package not found');

  const formats: string[] = JSON.parse(rule.formatSequence as any) || [];
  const peakDays: number[] = JSON.parse(rule.peakDays as any) || []; // 1-7
  const maxConsecutive = rule.maxConsecutiveSameFormat ?? 1;

  // Calculate total posts needed based on package line items
  const totalPosts = pkg.line_items.reduce((sum, item) => sum + item.quantity, 0) || (formats.length > 0 ? formats.length * 2 : 10);

  if (totalPosts === 0) return [];

  // Define the timeframe for the package (assume 30 days)
  const timeframeDays = 30;
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeframeDays);

  const availablePeakDates: Date[] = [];
  const blackoutDates = await prisma.blackoutDate.findMany({
    where: {
      date: { gte: startDate, lte: endDate },
    },
  });
  const blackoutTimes = blackoutDates.map(b => b.date.getTime());

  let curr = new Date(startDate);
  while (curr <= endDate) {
    const isoDay = curr.getDay() === 0 ? 7 : curr.getDay();
    // Normalize time to start of day for comparison
    const currNormalized = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate()).getTime();

    if (peakDays.length === 0 || peakDays.includes(isoDay)) {
      if (!blackoutTimes.includes(currNormalized)) {
        availablePeakDates.push(new Date(curr));
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  const scheduled: ScheduledPost[] = [];
  let lastFormat = '';
  let consecutive = 0;

  for (let i = 0; i < totalPosts; i++) {
    // Choose next format respecting consecutive constraint
    let candidate = formats[i % (formats.length || 1)] || 'STATIC';
    if (formats.length > 1 && candidate === lastFormat && consecutive >= maxConsecutive) {
      const alt = formats.find(f => f !== lastFormat) || candidate;
      candidate = alt;
    }

    // Evenly spread across the available peak dates
    const step = availablePeakDates.length / totalPosts;
    const index = Math.min(Math.floor(i * step), availablePeakDates.length - 1);
    const scheduledDate = availablePeakDates[index];

    const created = await prisma.scheduledPost.create({
      data: {
        package_id: packageId,
        scheduled_at: scheduledDate,
        format: candidate,
        ruleId: ruleId,
      },
    });
    scheduled.push(created);

    // Update helpers for next iteration
    if (candidate === lastFormat) {
      consecutive++;
    } else {
      lastFormat = candidate;
      consecutive = 1;
    }
  }

  return scheduled;
}
