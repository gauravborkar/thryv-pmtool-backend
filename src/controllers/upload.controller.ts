import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { storage } from '../lib/storage';

/**
 * POST /storage/presign
 * Generate a short-lived signed upload URL for direct client-to-cloud upload.
 *
 * Body: { fileName: string, fileType: string, folder?: string }
 * Response: { uploadUrl: string, fileUrl: string }
 *   - uploadUrl: PUT file bytes here directly (expires in 15 min)
 *   - fileUrl:   permanent public URL — save this to the database
 */
export const getPresignedUrl = async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, fileType, folder } = req.body as {
      fileName?: string;
      fileType?: string;
      folder?: string;
    };

    if (!fileName || !fileType) {
      return res.status(400).json({ message: 'fileName and fileType are required' });
    }

    const result = await storage.getSignedUploadUrl({
      fileName,
      fileType,
      folder: folder ?? 'uploads',
    });

    res.status(200).json({
      message: 'Presigned URL generated successfully',
      data: result,
    });
  } catch (error) {
    console.error('[Upload] presign error:', error);
    res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to generate presigned URL',
    });
  }
};
