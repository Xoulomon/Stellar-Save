/**
 * Unit tests for Input Sanitization (Issue #1103)
 */

import { InputSanitizer } from '../../src/input_sanitization_middleware';

describe('InputSanitizer', () => {
  describe('XSS Prevention', () => {
    it('should encode HTML entities', () => {
      const input = '<script>alert("XSS")</script>';
      const result = InputSanitizer.sanitizeString(input);
      
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('should block dangerous script tags', () => {
      const inputs = [
        '<script>malicious()</script>',
        '<iframe src="evil.com"></iframe>',
        '<embed src="evil.swf">',
        '<object data="evil.pdf">',
      ];

      for (const input of inputs) {
        const result = InputSanitizer.sanitizeString(input);
        expect(result).not.toContain(input);
      }
    });

    it('should sanitize event handlers', () => {
      const input = '<div onclick="malicious()">Click me</div>';
      const result = InputSanitizer.sanitizeString(input);
      
      expect(result).not.toContain('onclick=');
      expect(result).toContain('&lt;');
    });

    it('should handle javascript: protocol', () => {
      const input = '<a href="javascript:alert(1)">Click</a>';
      const result = InputSanitizer.sanitizeString(input);
      
      expect(result).not.toContain('javascript:');
    });

    it('should handle data URIs', () => {
      const input = '<img src="data:text/html,<script>alert(1)</script>">';
      const result = InputSanitizer.sanitizeString(input);
      
      expect(result).not.toContain('data:text/html');
    });
  });

  describe('SQL Injection Prevention', () => {
    it('should detect UNION SELECT attacks', () => {
      const input = "' UNION SELECT * FROM users--";
      
      expect(() => {
        InputSanitizer.sanitizeString(input, { stripSql: true });
      }).toThrow('Invalid input detected');
    });

    it('should detect INSERT INTO attacks', () => {
      const input = "'; INSERT INTO users VALUES('hacker', 'pass')--";
      
      expect(() => {
        InputSanitizer.sanitizeString(input, { stripSql: true });
      }).toThrow('Invalid input detected');
    });

    it('should detect DROP TABLE attacks', () => {
      const input = "'; DROP TABLE users--";
      
      expect(() => {
        InputSanitizer.sanitizeString(input, { stripSql: true });
      }).toThrow('Invalid input detected');
    });

    it('should detect OR-based attacks', () => {
      const input = "admin' OR '1'='1";
      
      expect(() => {
        InputSanitizer.sanitizeString(input, { stripSql: true });
      }).toThrow('Invalid input detected');
    });
  });

  describe('Group Metadata Sanitization', () => {
    it('should sanitize group name', () => {
      const metadata = {
        name: '<script>alert("xss")</script>Savings Group',
        description: 'A group for <b>saving</b> money',
      };

      const sanitized = InputSanitizer.sanitizeGroupMetadata(metadata);
      
      expect(sanitized.name).not.toContain('<script>');
      expect(sanitized.description).not.toContain('<b>');
    });

    it('should enforce max length', () => {
      const metadata = {
        name: 'A'.repeat(1000),
      };

      const sanitized = InputSanitizer.sanitizeGroupMetadata(metadata);
      
      expect(sanitized.name.length).toBeLessThanOrEqual(500);
    });

    it('should handle nested objects', () => {
      const metadata = {
        name: 'Test Group',
        settings: {
          theme: '<script>alert(1)</script>',
          description: 'Safe text',
        },
      };

      const sanitized = InputSanitizer.sanitizeGroupMetadata(metadata);
      
      expect(sanitized.settings.theme).not.toContain('<script>');
    });
  });

  describe('Profile Data Sanitization', () => {
    it('should sanitize user profile', () => {
      const profile = {
        displayName: 'John<script>alert(1)</script>Doe',
        bio: 'I love <iframe src="evil.com"></iframe> coding',
        website: 'https://example.com',
      };

      const sanitized = InputSanitizer.sanitizeProfileData(profile);
      
      expect(sanitized.displayName).not.toContain('<script>');
      expect(sanitized.bio).not.toContain('<iframe>');
    });
  });

  describe('Comment Sanitization', () => {
    it('should sanitize comments', () => {
      const comment = 'Great group! <script>steal_cookies()</script>';
      
      const sanitized = InputSanitizer.sanitizeComment(comment);
      
      expect(sanitized).not.toContain('<script>');
    });

    it('should enforce comment length limit', () => {
      const comment = 'A'.repeat(3000);
      
      const sanitized = InputSanitizer.sanitizeComment(comment);
      
      expect(sanitized.length).toBeLessThanOrEqual(2000);
    });
  });

  describe('Validation Helpers', () => {
    it('should validate Stellar addresses', () => {
      const valid = 'GBRPYHIL2CI3FNQ4BXLFMNDLFJUNPU2HY3ZMFSHONUCEOASW7QC7OX2H';
      const invalid = 'not-a-stellar-address';

      expect(InputSanitizer.validateStellarAddress(valid)).toBe(true);
      expect(InputSanitizer.validateStellarAddress(invalid)).toBe(false);
    });

    it('should validate email addresses', () => {
      const valid = 'user@example.com';
      const invalid = 'not-an-email';

      expect(InputSanitizer.validateEmail(valid)).toBe(true);
      expect(InputSanitizer.validateEmail(invalid)).toBe(false);
    });

    it('should sanitize URLs', () => {
      const validUrl = 'https://example.com';
      const javascriptUrl = 'javascript:alert(1)';

      expect(() => InputSanitizer.sanitizeUrl(validUrl)).not.toThrow();
      expect(() => InputSanitizer.sanitizeUrl(javascriptUrl)).toThrow('Invalid protocol');
    });
  });

  describe('HTML Encoding/Decoding', () => {
    it('should encode HTML entities', () => {
      const text = '&<>"\'/';
      const encoded = InputSanitizer.encodeHtml(text);

      expect(encoded).toBe('&amp;&lt;&gt;&quot;&#x27;&#x2F;');
    });

    it('should decode HTML entities', () => {
      const encoded = '&amp;&lt;&gt;&quot;&#x27;&#x2F;';
      const decoded = InputSanitizer.decodeHtml(encoded);

      expect(decoded).toBe('&<>"\'/');
    });
  });

  describe('Object Sanitization', () => {
    it('should handle null and undefined', () => {
      expect(InputSanitizer.sanitizeObject(null)).toBeNull();
      expect(InputSanitizer.sanitizeObject(undefined)).toBeUndefined();
    });

    it('should handle arrays', () => {
      const input = ['<script>alert(1)</script>', 'safe text', '<b>bold</b>'];
      const result = InputSanitizer.sanitizeObject(input);

      expect(result[0]).not.toContain('<script>');
      expect(result[1]).toBe('safe text');
      expect(result[2]).not.toContain('<b>');
    });

    it('should handle nested objects', () => {
      const input = {
        level1: {
          level2: {
            value: '<script>alert(1)</script>',
          },
        },
      };

      const result = InputSanitizer.sanitizeObject(input);

      expect(result.level1.level2.value).not.toContain('<script>');
    });

    it('should preserve numbers and booleans', () => {
      const input = {
        number: 42,
        boolean: true,
        string: '<script>',
      };

      const result = InputSanitizer.sanitizeObject(input);

      expect(result.number).toBe(42);
      expect(result.boolean).toBe(true);
      expect(result.string).not.toContain('<script>');
    });
  });
});
