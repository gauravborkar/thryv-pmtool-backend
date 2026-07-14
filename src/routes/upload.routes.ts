import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPresignedUrl } from '../controllers/upload.controller';
import { upload } from '../middleware/upload.middleware';
import { storage } from '../lib/storage';

const router = Router();

/**
 * @route  POST /storage/presign
 * @desc   Generate a presigned upload URL for direct client-to-cloud file upload
 * @access Private (all authenticated roles)
 * @body   { fileName: string, fileType: string, folder?: string }
 */
router.post('/presign', authenticate, getPresignedUrl);

/**
 * @route  POST /storage/upload
 * @desc   Directly upload a file to the active storage provider (used for local fallback)
 * @access Private
 */
router.post('/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file provided' });
    }

    const { folder } = req.body;
    const result = await storage.uploadFile({
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      buffer: req.file.buffer,
      folder: folder || 'general'
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ success: false, message: 'File upload failed' });
  }
});

export default router;
