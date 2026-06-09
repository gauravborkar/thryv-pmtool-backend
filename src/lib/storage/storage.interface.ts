/**
 * Generic storage provider interface.
 * Any storage backend (Firebase, S3, R2, etc.) must implement this contract.
 * Swap providers by changing STORAGE_PROVIDER in .env — no other code changes needed.
 */

export interface PresignResult {
  /** Short-lived signed URL — frontend does a PUT to this URL with the raw file bytes */
  uploadUrl: string;
  /** Permanent public URL stored in the database */
  fileUrl: string;
}

export interface StorageProvider {
  /**
   * Generate a presigned URL for direct client-side upload.
   * @param options.fileName  Original file name (used to build a unique storage path)
   * @param options.fileType  MIME type (e.g. "image/png")
   * @param options.folder    Storage folder prefix (default: "uploads")
   */
  getSignedUploadUrl(options: {
    fileName: string;
    fileType: string;
    folder?: string;
  }): Promise<PresignResult>;

  /**
   * Delete a file by its public URL.
   * Should not throw if the file does not exist.
   */
  deleteFile(fileUrl: string): Promise<void>;
}
