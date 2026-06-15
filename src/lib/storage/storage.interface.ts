/**
 * Generic storage provider interface.
 * Any storage backend (Firebase, S3, R2, etc.) must implement this contract.
 * Swap providers by changing STORAGE_PROVIDER in .env — no other code changes needed.
 */

export interface UploadResult {
  /** Permanent public URL to store in the database */
  fileUrl: string;
}

export interface StorageProvider {
  /**
   * Upload a file buffer to cloud storage.
   * Returns the permanent public URL.
   */
  uploadFile(options: {
    fileName: string;
    fileType: string;
    buffer: Buffer;
    folder?: string;
  }): Promise<UploadResult>;

  /**
   * Generate a presigned URL or upload parameters for direct client-to-cloud file upload.
   */
  getSignedUploadUrl?(options: {
    fileName: string;
    fileType: string;
    folder?: string;
  }): Promise<{
    uploadUrl: string;
    fileUrl: string;
    additionalFields?: Record<string, any>;
  }>;

  /**
   * Delete a file by its public URL.
   * Should not throw if the file does not exist.
   */
  deleteFile(fileUrl: string): Promise<void>;
}
