/**
 * Firebase Storage provider (backed by Google Cloud Storage).
 *
 * Upload flow:
 *   1. Frontend sends file as FormData to POST /tasks/:id/media (same as before).
 *   2. Backend receives it via multer, uploads buffer to Firebase via Admin SDK.
 *   3. Backend stores the returned Firebase public URL in the database.
 *
 * Required .env vars:
 *   FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY, FIREBASE_STORAGE_BUCKET
 *
 * Firebase Storage Rules (Firebase console → Storage → Rules):
 *   rules_version = '2';
 *   service firebase.storage {
 *     match /b/{bucket}/o {
 *       match /{allPaths=**} {
 *         allow read: if true;
 *         allow write: if false;
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
  async uploadFile({ fileName, fileType, buffer, folder = 'uploads' }) {
    ensureInitialized();
    const bucket = getStorage().bucket();

    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const cleanName = fileName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = `${folder}/${uniqueSuffix}-${cleanName}`;

    const file = bucket.file(filePath);

    // Upload buffer with public: true so it's readable via storage.googleapis.com
    await file.save(buffer, {
      metadata: { contentType: fileType },
      public: true,
    });

    const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? bucket.name;
    const fileUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;

    return { fileUrl };
  },

  async deleteFile(fileUrl: string) {
    try {
      const bucketName = process.env.FIREBASE_STORAGE_BUCKET ?? '';
      const prefix = `https://storage.googleapis.com/${bucketName}/`;

      if (!fileUrl.startsWith(prefix)) return; // not a Firebase URL — skip

      ensureInitialized();
      const bucket = getStorage().bucket();
      const filePath = decodeURIComponent(fileUrl.slice(prefix.length));

      await (bucket.file(filePath).delete({ ignoreNotFound: true }) as Promise<unknown>);
    } catch (err) {
      console.error('[Firebase] Failed to delete file:', err);
    }
  },
};