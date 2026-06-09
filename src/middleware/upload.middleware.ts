import multer from 'multer';

// Use memory storage — files are kept as buffers and uploaded to cloud storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100 MB
  },
});
