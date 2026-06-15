import { validateFileSecurity, sanitizeInput } from '../lib/security';

describe('Security Hardening Helper Tests', () => {
  describe('validateFileSecurity', () => {
    it('should throw an error for files exceeding the 2.5 GB limit', () => {
      const hugeSize = 3 * 1024 * 1024 * 1024; // 3 GB
      expect(() => {
        validateFileSecurity('safe_image.png', hugeSize);
      }).toThrow('File size exceeds the maximum allowed limit of 2.5 GB');
    });

    it('should throw an error for blocked executable extensions', () => {
      const size = 1024 * 1024; // 1 MB
      expect(() => {
        validateFileSecurity('malicious_script.sh', size);
      }).toThrow('Forbidden: Executable files, scripts, and HTML files are not allowed for security reasons.');

      expect(() => {
        validateFileSecurity('trojan.exe', size);
      }).toThrow('Forbidden: Executable files, scripts, and HTML files are not allowed for security reasons.');
    });

    it('should detect double-extension tricks', () => {
      const size = 1024 * 1024; // 1 MB
      expect(() => {
        validateFileSecurity('image.exe.png', size);
      }).toThrow('Forbidden: Malicious file name detected.');

      expect(() => {
        validateFileSecurity('doc.sh.pdf', size);
      }).toThrow('Forbidden: Malicious file name detected.');
    });

    it('should pass for safe extensions under the size limit', () => {
      const size = 50 * 1024 * 1024; // 50 MB
      expect(() => {
        validateFileSecurity('logo.png', size);
      }).not.toThrow();

      expect(() => {
        validateFileSecurity('presentation.pdf', size);
      }).not.toThrow();

      expect(() => {
        validateFileSecurity('video.mp4', size);
      }).not.toThrow();
    });
  });

  describe('sanitizeInput', () => {
    it('should escape HTML characters to prevent Cross-Site Scripting (XSS)', () => {
      const unsafeInput = '<script>alert("xss")</script>';
      const sanitized = sanitizeInput(unsafeInput);
      expect(sanitized).toBe('&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;');
    });

    it('should return non-string inputs unmodified', () => {
      expect(sanitizeInput(null as any)).toBeNull();
      expect(sanitizeInput(undefined as any)).toBeUndefined();
    });
  });
});
