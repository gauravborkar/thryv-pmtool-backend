import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

/**
 * @desc Get the active storage retention policy
 * @route GET /settings/retention
 * @access Private (Admin, Manager)
 */
export const getRetentionPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let policy = await prisma.retentionPolicy.findUnique({
      where: { id: 1 },
    });

    // Fallback in case seeding was skipped or row deleted
    if (!policy) {
      policy = await prisma.retentionPolicy.create({
        data: {
          id: 1,
          isEnabled: false,
          keepDays: 30,
        },
      });
    }

    res.status(200).json({
      message: 'Retention policy retrieved successfully',
      data: {
        isEnabled: policy.isEnabled,
        keepDays: policy.keepDays,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};

/**
 * @desc Update the storage retention policy
 * @route PUT /settings/retention
 * @access Private (Admin only)
 */
export const updateRetentionPolicy = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { isEnabled, keepDays } = req.body;

    if (isEnabled === undefined || keepDays === undefined) {
      return res.status(400).json({ message: 'isEnabled and keepDays are required fields' });
    }

    const keepDaysNum = parseInt(keepDays, 10);
    if (Number.isNaN(keepDaysNum) || keepDaysNum <= 0) {
      return res.status(400).json({ message: 'keepDays must be a positive integer' });
    }

    const updatedPolicy = await prisma.retentionPolicy.upsert({
      where: { id: 1 },
      update: {
        isEnabled: Boolean(isEnabled),
        keepDays: keepDaysNum,
      },
      create: {
        id: 1,
        isEnabled: Boolean(isEnabled),
        keepDays: keepDaysNum,
      },
    });

    res.status(200).json({
      message: 'Retention policy updated successfully',
      data: {
        isEnabled: updatedPolicy.isEnabled,
        keepDays: updatedPolicy.keepDays,
      },
    });
  } catch (error: any) {
    res.status(500).json({ message: error.message || 'Internal server error' });
  }
};
