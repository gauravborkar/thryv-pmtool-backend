/**
 * Firebase Storage provider (backed by Google Cloud Storage).
 *
 * Upload flow:
 *   1. Backend generates a signed WRITE URL (15-min expiry) + a permanent public read URL.
 *   2. Frontend PUTs the file directly to the signed URL (file never touches our server).
 *   3. Frontend calls POST /tasks/:id/media with { fileName, fileUrl, fileType, fileSize }
 *      to persist the record in the database.
 *
 * Required .env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET
 *
 * Firebase Storage Rules (set in Firebase console → Storage → Rules):
 *   rules_version = '2';
 *   service firebase.storage {
 *     match /b/{bucket}/o {
 *       match /uploads/{allPaths=**} {
 *         allow read: if true;   // public CDN reads
 *         allow write: if false; // only server via signed URLs
 *       }
 *     }
 *   }
 */
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getStorage } from 'firebase-admin/storage';
import { StorageProvider } from './storage.interface';

function ensureInitialized() {
  if (getApps().length > 0) return;

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !privateKey) {
    throw new Error(
      'Missing Firebase env vars. Ensure FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, ' +
        'and FIREBASE_PRIVATE_KEY are set.'
    );
  }

  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey,
    }),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  });
}

export const firebaseProvider: StorageProvider = {
  async getSignedUploadUrl({ fileName, fileType, folder = 'uploads' }) {
    ensureInitialized();
    const bucket = getStorage().bucket();

    // Build a unique, URL-safe file path
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const cleanName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `${folder}/${uniqueSuffix}-${cleanName}`;

    const file = bucket.file(filePath);

    // Signed URL the frontend can PUT to (expires in 15 minutes)
    const [uploadUrl] = await file.getSignedUrl({
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType: fileType,
    });

    // Permanent public read URL (requires public read Storage Rules — see file comment above)
    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? bucket.name;
    const fileUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;

    return { uploadUrl, fileUrl };
  },

  async deleteFile(fileUrl: string) {
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? '';
      const prefix = `https://storage.googleapis.com/${bucketName}/`;

      if (!fileUrl.startsWith(prefix)) return; // not a Firebase Storage URL — skip

      ensureInitialized();
      const bucket = getStorage().bucket();
      const filePath = decodeURIComponent(fileUrl.slice(prefix.length));

      await (bucket.file(filePath).delete({ ignoreNotFound: true }) as Promise<unknown>);
    } catch (err) {
      console.error('[Firebase] Failed to delete file:', err);
    }
  },
};