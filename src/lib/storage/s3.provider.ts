/**
 * AWS S3 / Cloudflare R2 storage provider (stub).
 *
 * To implement:
 *   1. npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
 *   2. Add env vars: AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET
 *      (For Cloudflare R2 also set: CLOUDFLARE_ACCOUNT_ID and use R2 endpoint)
 *   3. Replace the stub methods below with real S3 presign logic
 *   4. Change STORAGE_PROVIDER=s3 in .env
 */
import { StorageProvider } from './storage.interface';

export const s3Provider: StorageProvider = {
  async getSignedUploadUrl(_options) {
    throw new Error(
      'S3 provider is not yet configured. ' +
        'Set STORAGE_PROVIDER=s3 and add AWS credentials to .env.'
    );
  },

  async deleteFile(_fileUrl) {
    throw new Error('S3 provider is not yet configured.');
  },
};
