// src/services/distribution.service.ts
import { ScheduledPost } from '@prisma/client';
import prisma from '../lib/prisma';

/**
 * Schedule posts according to distribution rules.
 *
 * regenerationMode behaviour
 * ──────────────────────────
 * ALL          (default) – delete ALL existing ScheduledPost rows for the
 *              package, then create a full fresh set.
 *
 * UNSCHEDULED  – keep rows that are locked (is_locked = true, meaning a
 *              manager has already assigned / converted them to a task /
 *              calendar entry) and only create enough new rows to reach the
 *              total required by the package line-items.
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

  const formats: string[] = JSON.parse(rule.formatSequence as string) || [];
  const peakDays: number[] = JSON.parse(rule.peakDays as string) || []; // 1-7
  const maxConsecutive = rule.maxConsecutiveSameFormat ?? 1;
  const regenerationMode = rule.regenerationMode ?? 'ALL';

  // Total posts the package requires
  const totalRequired =
    pkg.line_items.reduce((sum, item) => sum + item.quantity, 0) ||
    (formats.length > 0 ? formats.length * 2 : 10);

  if (totalRequired === 0) return [];

  // ─── Step 1: Delete unwanted existing posts ────────────────────────────────
  if (regenerationMode === 'UNSCHEDULED') {
    // Only delete posts that are NOT locked (i.e. not yet assigned to a task)
    await prisma.scheduledPost.deleteMany({
      where: { package_id: packageId, is_locked: false },
    });
  } else {
    // ALL mode: wipe everything and start fresh
    await prisma.scheduledPost.deleteMany({ where: { package_id: packageId } });
  }

  // ─── Step 2: Count how many we still need to create ───────────────────────
  const lockedCount = await prisma.scheduledPost.count({
    where: { package_id: packageId, is_locked: true },
  });
  const postsToCreate = Math.max(0, totalRequired - lockedCount);

  if (postsToCreate === 0) {
    // All slots are already covered by locked posts; return them as-is
    return prisma.scheduledPost.findMany({ where: { package_id: packageId } });
  }

  // ─── Step 3: Build the pool of available dates ────────────────────────────
  const timeframeDays = 30;
  const startDate = new Date();
  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + timeframeDays);

  const blackoutDates = await prisma.blackoutDate.findMany({
    where: { date: { gte: startDate, lte: endDate } },
  });
  const blackoutTimes = new Set(
    blackoutDates.map((b) =>
      new Date(b.date.getFullYear(), b.date.getMonth(), b.date.getDate()).getTime()
    )
  );

  // Gather dates already occupied by locked posts to avoid double-booking the same day
  const lockedDates = new Set(
    rule.scheduledPosts
      .filter((p) => p.is_locked)
      .map((p) =>
        new Date(p.scheduled_at.getFullYear(), p.scheduled_at.getMonth(), p.scheduled_at.getDate()).getTime()
      )
  );

  const availablePeakDates: Date[] = [];
  let curr = new Date(startDate);
  while (curr <= endDate) {
    const isoDay = curr.getDay() === 0 ? 7 : curr.getDay();
    const currNorm = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate()).getTime();

    if (peakDays.length === 0 || peakDays.includes(isoDay)) {
      if (!blackoutTimes.has(currNorm) && !lockedDates.has(currNorm)) {
        availablePeakDates.push(new Date(curr));
      }
    }
    curr.setDate(curr.getDate() + 1);
  }

  // ─── Step 4: Create the new posts ─────────────────────────────────────────
  let lastFormat = '';
  let consecutive = 0;

  for (let i = 0; i < postsToCreate; i++) {
    // Pick the next format respecting the consecutive limit
    let candidate = formats[i % (formats.length || 1)] || 'STATIC';
    if (formats.length > 1 && candidate === lastFormat && consecutive >= maxConsecutive) {
      candidate = formats.find((f) => f !== lastFormat) ?? candidate;
    }

    if (availablePeakDates.length === 0) break; // no dates left to schedule

    // Evenly spread new posts across the remaining available peak dates
    const step = availablePeakDates.length / postsToCreate;
    const index = Math.min(Math.floor(i * step), availablePeakDates.length - 1);
    const scheduledDate = availablePeakDates[index];

    await prisma.scheduledPost.create({
      data: {
        package_id: packageId,
        scheduled_at: scheduledDate,
        format: candidate,
        ruleId: ruleId,
        is_locked: false,
      },
    });

    if (candidate === lastFormat) {
      consecutive++;
    } else {
      lastFormat = candidate;
      consecutive = 1;
    }
  }

  // Return ALL posts for this package (locked + newly created)
  return prisma.scheduledPost.findMany({ where: { package_id: packageId } });
}
