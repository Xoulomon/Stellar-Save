/**
 * Input Sanitization Middleware (Issue #1103)
 * 
 * Comprehensive input sanitization for all user inputs to prevent
 * XSS, SQL injection, and other injection attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

// HTML entity encoding map
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
};

// Dangerous patterns that should be blocked or sanitized
const DANGEROUS_PATTERNS = [
  /<script[^>]*>[\s\S]*?<\/script>/gi,
  /<iframe[^>]*>[\s\S]*?<\/iframe>/gi,
  /javascript:/gi,
  /on\w+\s*=/gi, // Event handlers like onclick=
  /<embed[^>]*>/gi,
  /<object[^>]*>/gi,
  /data:text\/html/gi,
  /vbscript:/gi,
];

// SQL injection patterns
const SQL_INJECTION_PATTERNS = [
  /(\bUNION\b.*\bSELECT\b)/gi,
  /(\bINSERT\b.*\bINTO\b)/gi,
  /(\bUPDATE\b.*\bSET\b)/gi,
  /(\bDELETE\b.*\bFROM\b)/gi,
  /(\bDROP\b.*\bTABLE\b)/gi,
  /('.*OR.*'=')/gi,
  /(--)/g,
  /(;.*DROP)/gi,
];

export interface SanitizationOptions {
  allowHtml?: boolean;
  maxLength?: number;
  stripSql?: boolean;
  fieldName?: string;
}

export class InputSanitizer {
  /**
   * Sanitize a string value
   */
  static sanitizeString(
    value: string,
    options: SanitizationOptions = {}
  ): string {
    let sanitized = value;

    // Trim whitespace
    sanitized = sanitized.trim();

    // Apply length limits
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
    }

    // Check for SQL injection patterns
    if (options.stripSql) {
      for (const pattern of SQL_INJECTION_PATTERNS) {
        if (pattern.test(sanitized)) {
          logger.warn('SQL injection attempt detected', {
            field: options.fieldName,
            pattern: pattern.source,
          });
          throw new Error('Invalid input detected');
        }
      }
    }

    // HTML encode if not allowing HTML
    if (!options.allowHtml) {
      sanitized = this.encodeHtml(sanitized);
      
      // Check for dangerous patterns even after encoding
      for (const pattern of DANGEROUS_PATTERNS) {
        if (pattern.test(value)) { // Check original value
          logger.warn('XSS attempt detected', {
            field: options.fieldName,
            pattern: pattern.source,
          });
        }
      }
    }

    return sanitized;
  }

  /**
   * HTML entity encoding
   */
  static encodeHtml(text: string): string {
    return text.replace(/[&<>"'\/]/g, (char) => HTML_ENTITIES[char] || char);
  }

  /**
   * Decode HTML entities
   */
  static decodeHtml(text: string): string {
    return text.replace(/&amp;|&lt;|&gt;|&quot;|&#x27;|&#x2F;/g, (entity) => {
      const decoded = Object.entries(HTML_ENTITIES).find(([_, v]) => v === entity);
      return decoded ? decoded[0] : entity;
    });
  }

  /**
   * Sanitize an entire object recursively
   */
  static sanitizeObject(
    obj: any,
    options: SanitizationOptions = {}
  ): any {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.sanitizeString(obj, options);
    }

    if (typeof obj === 'number' || typeof obj === 'boolean') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, options));
    }

    if (typeof obj === 'object') {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        // Sanitize the key as well
        const sanitizedKey = this.sanitizeString(key, { ...options, maxLength: 100 });
        sanitized[sanitizedKey] = this.sanitizeObject(value, {
          ...options,
          fieldName: key,
        });
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate and sanitize common field types
   */
  static sanitizeGroupMetadata(metadata: any): any {
    return this.sanitizeObject(metadata, {
      allowHtml: false,
      maxLength: 500,
      stripSql: true,
    });
  }

  static sanitizeProfileData(profile: any): any {
    return this.sanitizeObject(profile, {
      allowHtml: false,
      maxLength: 1000,
      stripSql: true,
    });
  }

  static sanitizeComment(comment: string): string {
    return this.sanitizeString(comment, {
      allowHtml: false,
      maxLength: 2000,
      stripSql: true,
      fieldName: 'comment',
    });
  }

  /**
   * Validate Stellar address format
   */
  static validateStellarAddress(address: string): boolean {
    // Stellar addresses are 56 characters and start with G
    return /^G[A-Z0-9]{55}$/.test(address);
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /**
   * Sanitize URL
   */
  static sanitizeUrl(url: string): string {
    // Only allow http and https protocols
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error('Invalid protocol');
      }
      return parsed.toString();
    } catch {
      throw new Error('Invalid URL format');
    }
  }
}

/**
 * Express middleware for automatic input sanitization
 */
export const sanitizeInputMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Sanitize body
    if (req.body && typeof req.body === 'object') {
      req.body = InputSanitizer.sanitizeObject(req.body, {
        allowHtml: false,
        stripSql: true,
      });
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = InputSanitizer.sanitizeObject(req.query, {
        allowHtml: false,
        maxLength: 500,
      });
    }

    // Sanitize params
    if (req.params && typeof req.params === 'object') {
      req.params = InputSanitizer.sanitizeObject(req.params, {
        allowHtml: false,
        maxLength: 100,
      });
    }

    next();
  } catch (error) {
    logger.error('Input sanitization failed', { error });
    res.status(400).json({
      error: 'Invalid input detected',
      message: 'The request contains potentially malicious content',
    });
  }
};

/**
 * Middleware specifically for group metadata validation
 */
export const sanitizeGroupMetadataMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.body?.metadata) {
      req.body.metadata = InputSanitizer.sanitizeGroupMetadata(req.body.metadata);
    }
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid metadata',
      message: 'Group metadata contains invalid content',
    });
  }
};

/**
 * Middleware for profile data validation
 */
export const sanitizeProfileMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    if (req.body?.profile) {
      req.body.profile = InputSanitizer.sanitizeProfileData(req.body.profile);
    }
    next();
  } catch (error) {
    res.status(400).json({
      error: 'Invalid profile data',
      message: 'Profile contains invalid content',
    });
  }
};

export { InputSanitizer as sanitizer };
