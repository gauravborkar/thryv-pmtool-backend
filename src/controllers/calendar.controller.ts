import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { parseISO, startOfDay } from 'date-fns';

export const getBlackoutDates = async (req: Request, res: Response) => {
  try {
    const { start, end } = req.query;
    
    let where: any = {};
    if (start && end) {
      where.date = {
        gte: parseISO(start as string),
        lte: parseISO(end as string),
      };
    }
    
    const dates = await prisma.blackoutDate.findMany({ where, orderBy: { date: 'asc' } });
    res.json(dates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blackout dates' });
  }
};

export const addBlackoutDate = async (req: Request, res: Response) => {
  try {
    const { date, reason } = req.body;
    const parsedDate = startOfDay(parseISO(date));
    
    const blackout = await prisma.blackoutDate.upsert({
      where: { date: parsedDate },
      update: { reason },
      create: { date: parsedDate, reason },
    });
    
    res.json(blackout);
  } catch (err) {
    res.status(500).json({ error: 'Failed to add blackout date' });
  }
};

export const removeBlackoutDate = async (req: Request, res: Response) => {
  try {
    const { date } = req.params;
    const parsedDate = startOfDay(parseISO(date));
    
    await prisma.blackoutDate.delete({
      where: { date: parsedDate },
    });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove blackout date' });
  }
};
