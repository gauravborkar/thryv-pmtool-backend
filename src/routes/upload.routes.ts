import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { getPresignedUrl } from '../controllers/upload.controller';

const router = Router();

/**
 * @route  POST /storage/presign
 * @desc   Generate a presigned upload URL for direct client-to-cloud file upload
 * @access Private (all authenticated roles)
 * @body   { fileName: string, fileType: string, folder?: string }
 */
router.post('/presign', authenticate, getPresignedUrl);

export default router;
