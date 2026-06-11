import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { storage } from '../lib/storage';

export const getPresignedUrl = async (req: AuthRequest, res: Response) => {
  try {
    if (!storage.getSignedUploadUrl) {
      return res.status(400).json({
        message: `The active storage provider ("${process.env.STORAGE_PROVIDER || 'firebase'}") does not support direct browser-to-cloud uploads.`,
      });
    }

    const { fileName, fileType, folder } = req.body;
    if (!fileName || !fileType) {
      return res.status(400).json({
        message: 'fileName and fileType are required in the request body.',
      });
    }

    const result = await storage.getSignedUploadUrl({
      fileName,
      fileType,
      folder: folder || 'task-media',
    });

    res.status(200).json({
      message: 'Upload signature generated successfully',
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate upload signature',
    });
  }
};
