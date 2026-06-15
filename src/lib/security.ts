import path from 'path';

const BLOCKED_EXTENSIONS = [
  '.exe', '.sh', '.bat', '.cmd', '.msi', '.php', '.js', '.jsx', '.ts', '.tsx',
  '.py', '.pl', '.jsp', '.asp', '.aspx', '.vbs', '.scr', '.com', '.htm', '.html'
];

/**
 * Validates the file name and size against security constraints.
 * Throws an Error if security rules are violated.
 */
export function validateFileSecurity(fileName: string, fileSize: number) {
  // 1. File size check (2.5 GB max limit)
  const MAX_FILE_SIZE = 2.5 * 1024 * 1024 * 1024; // 2.5 GB in bytes
  if (fileSize > MAX_FILE_SIZE) {
    throw new Error('File size exceeds the maximum allowed limit of 2.5 GB');
  }

  // 2. Extension check
  const ext = path.extname(fileName).toLowerCase();
  if (BLOCKED_EXTENSIONS.includes(ext)) {
    throw new Error('Forbidden: Executable files, scripts, and HTML files are not allowed for security reasons.');
  }

  // Double check double-extension tricks (e.g. file.png.exe)
  const baseName = path.basename(fileName).toLowerCase();
  for (const blocked of BLOCKED_EXTENSIONS) {
    if (baseName.includes(blocked + '.')) {
      throw new Error('Forbidden: Malicious file name detected.');
    }
  }
}

/**
 * Simple sanitizer to escape HTML tags to prevent XSS.
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}
