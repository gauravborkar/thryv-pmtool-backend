import { v2 as cloudinary } from 'cloudinary';
import { StorageProvider, UploadResult } from './storage.interface';

let initialized = false;

function ensureInitialized() {
  if (initialized) return;

  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error(
      'Missing Cloudinary env vars. Ensure CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, ' +
        'and CLOUDINARY_API_SECRET are set.'
    );
  }

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  initialized = true;
}

export const cloudinaryProvider: StorageProvider = {
  async uploadFile({ fileName, buffer, folder = 'uploads' }) {
    ensureInitialized();

    // Remove extension from filename to use as public ID
    const dotIndex = fileName.lastIndexOf('.');
    const cleanName = fileName
      .substring(0, dotIndex !== -1 ? dotIndex : fileName.length)
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '');

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const publicId = `${cleanName}-${uniqueSuffix}`;

    return new Promise<UploadResult>((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: publicId,
          resource_type: 'auto', // Automatically detect image, video, raw (docs, zips)
        },
        (error, result) => {
          if (error || !result) {
            reject(error || new Error('Upload to Cloudinary failed'));
          } else {
            resolve({
              fileUrl: result.secure_url,
            });
          }
        }
      );

      uploadStream.end(buffer);
    });
  },

  async deleteFile(fileUrl: string) {
    try {
      if (!fileUrl.includes('res.cloudinary.com')) return; // Not a Cloudinary URL

      ensureInitialized();

      // Extract resource_type and public_id from Cloudinary URL
      // E.g. https://res.cloudinary.com/cloudname/image/upload/v1234/folder/name.jpg
      const parts = fileUrl.split('/upload/');
      if (parts.length < 2) return;

      const beforeUpload = parts[0].split('/');
      const resourceType = beforeUpload[beforeUpload.length - 1]; // e.g. "image", "video", "raw"

      const afterUpload = parts[1].split('/');
      // If there's a version number (v1234567), skip it
      if (afterUpload[0].startsWith('v') && /^\d+$/.test(afterUpload[0].substring(1))) {
        afterUpload.shift();
      }

      const pathAndName = afterUpload.join('/');
      const dotIndex = pathAndName.lastIndexOf('.');
      const publicId = dotIndex !== -1 ? pathAndName.substring(0, dotIndex) : pathAndName;

      await cloudinary.uploader.destroy(publicId, {
        resource_type: resourceType,
      });
      console.log(`[Cloudinary] Deleted file: ${publicId} (${resourceType})`);
    } catch (err) {
      console.error('[Cloudinary] Failed to delete file:', err);
    }
  },
};
