/**
 * Storage factory — picks the active provider from STORAGE_PROVIDER env var.
 *
 * To switch providers:
 *   - Firebase:  STORAGE_PROVIDER=firebase  (current)
 *   - AWS S3:    STORAGE_PROVIDER=s3        (stub — implement s3.provider.ts)
 */
import { StorageProvider } from './storage.interface';
import { firebaseProvider } from './firebase.provider';
import { s3Provider } from './s3.provider';
import { cloudinaryProvider } from './cloudinary.provider';
import { localProvider } from './local.provider';

function createStorageProvider(): StorageProvider {
  const provider = (process.env.STORAGE_PROVIDER ?? 'local').toLowerCase();
  switch (provider) {
    case 'firebase':
      return firebaseProvider;
    case 'cloudinary':
      return cloudinaryProvider;
    case 's3':
    case 'r2':
      return s3Provider;
    case 'local':
      return localProvider;
    default:
      throw new Error(
        `Unknown STORAGE_PROVIDER: "${provider}". Valid options: firebase, cloudinary, s3, local`
      );
  }
}

export const storage = createStorageProvider();
