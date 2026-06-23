import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider, UploadResult } from './storage.interface';

const UPLOADS_DIR = path.join(process.cwd(), 'uploads');

async function ensureDirectoryExists(dir: string) {
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Ignore error if directory already exists
  }
}

export const localProvider: StorageProvider = {
  async uploadFile({ fileName, buffer, folder = '' }): Promise<UploadResult> {
    const safeFileName = `${crypto.randomUUID()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    const targetDir = path.join(UPLOADS_DIR, folder);
    
    await ensureDirectoryExists(targetDir);
    
    const filePath = path.join(targetDir, safeFileName);
    await fs.writeFile(filePath, buffer);

    const fileUrl = `${process.env.APP_BASE_URL || 'http://localhost:3002'}/uploads/${folder ? folder + '/' : ''}${safeFileName}`;

    return { fileUrl };
  },

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const urlObj = new URL(fileUrl);
      const relativePath = urlObj.pathname.replace('/uploads/', '');
      const filePath = path.join(UPLOADS_DIR, relativePath);
      await fs.unlink(filePath);
    } catch (err) {
      console.error(`Failed to delete local file ${fileUrl}:`, err);
    }
  }
};
