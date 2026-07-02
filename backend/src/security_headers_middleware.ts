/**
 * Security Headers Middleware (Issue #1103)
 * 
 * Implements Content Security Policy (CSP) and other security headers
 * to prevent XSS, clickjacking, and other client-side attacks.
 */

import { Request, Response, NextFunction } from 'express';
import { config } from './config';

export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'frame-src'?: string[];
  'object-src'?: string[];
  'base-uri'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'upgrade-insecure-requests'?: boolean;
}

export class SecurityHeadersMiddleware {
  private cspDirectives: CSPDirectives;

  constructor(customDirectives?: Partial<CSPDirectives>) {
    // Default CSP directives
    this.cspDirectives = {
      'default-src': ["'self'"],
      'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Adjust based on your needs
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", config.stellar.rpcUrl],
      'frame-src': ["'none'"],
      'object-src': ["'none'"],
      'base-uri': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'upgrade-insecure-requests': config.nodeEnv === 'production',
      ...customDirectives,
    };
  }

  /**
   * Generate CSP header value from directives
   */
  private buildCSPHeader(): string {
    const directives: string[] = [];

    for (const [key, value] of Object.entries(this.cspDirectives)) {
      if (value === true) {
        directives.push(key);
      } else if (Array.isArray(value) && value.length > 0) {
        directives.push(`${key} ${value.join(' ')}`);
      }
    }

    return directives.join('; ');
  }

  /**
   * Apply all security headers
   */
  applyHeaders(req: Request, res: Response, next: NextFunction): void {
    // Content Security Policy
    res.setHeader('Content-Security-Policy', this.buildCSPHeader());

    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');

    // Referrer Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions Policy (formerly Feature Policy)
    res.setHeader(
      'Permissions-Policy',
      'geolocation=(), microphone=(), camera=(), payment=()'
    );

    // Strict Transport Security (HSTS) - only in production
    if (config.nodeEnv === 'production') {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload'
      );
    }

    // Remove X-Powered-By header
    res.removeHeader('X-Powered-By');

    next();
  }

  /**
   * Update CSP directives
   */
  updateDirectives(directives: Partial<CSPDirectives>): void {
    this.cspDirectives = { ...this.cspDirectives, ...directives };
  }
}

// Default instance with standard configuration
const securityHeaders = new SecurityHeadersMiddleware();

/**
 * Express middleware for security headers
 */
export const securityHeadersMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  securityHeaders.applyHeaders(req, res, next);
};

/**
 * Create custom security headers middleware with specific CSP
 */
export function createSecurityHeadersMiddleware(
  customDirectives?: Partial<CSPDirectives>
): (req: Request, res: Response, next: NextFunction) => void {
  const customHeaders = new SecurityHeadersMiddleware(customDirectives);
  return (req, res, next) => customHeaders.applyHeaders(req, res, next);
}

export { SecurityHeadersMiddleware };
