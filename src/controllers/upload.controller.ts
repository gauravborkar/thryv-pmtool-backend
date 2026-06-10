/**
 * Upload controller — reserved for future direct-upload features.
 * Currently the main upload path goes through POST /tasks/:id/media
 * which handles Firebase upload internally via the storage provider.
 */
import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';

export const getPresignedUrl = async (_req: AuthRequest, res: Response) => {
  res.status(410).json({
    message: 'Presigned URL upload is not active. Use POST /tasks/:id/media to upload files.',
  });
};
