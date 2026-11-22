/**
 * Minimal type declaration for jsonwebtoken (v9.x).
 *
 * @types/jsonwebtoken is not installed. This shim provides the minimal
 * typings needed to satisfy TypeScript strict mode for auth_service.ts.
 * Install @types/jsonwebtoken to replace this with full typings.
 */
declare module 'jsonwebtoken' {
  export type Algorithm =
    | 'HS256' | 'HS384' | 'HS512'
    | 'RS256' | 'RS384' | 'RS512'
    | 'ES256' | 'ES384' | 'ES512'
    | 'PS256' | 'PS384' | 'PS512'
    | 'none';

  export interface SignOptions {
    algorithm?: Algorithm;
    expiresIn?: string | number;
    notBefore?: string | number;
    audience?: string | string[];
    subject?: string;
    issuer?: string;
    jwtid?: string;
    mutatePayload?: boolean;
    noTimestamp?: boolean;
    header?: object;
    encoding?: string;
  }

  export interface VerifyOptions {
    algorithms?: Algorithm[];
    audience?: string | RegExp | (string | RegExp)[];
    clockTimestamp?: number;
    clockTolerance?: number;
    complete?: boolean;
    issuer?: string | string[];
    ignoreExpiration?: boolean;
    ignoreNotBefore?: boolean;
    jwtid?: string;
    nonce?: string;
    subject?: string;
    maxAge?: string | number;
  }

  export interface JwtPayload {
    iss?: string;
    sub?: string;
    aud?: string | string[];
    exp?: number;
    nbf?: number;
    iat?: number;
    jti?: string;
    [key: string]: unknown;
  }

  export class JsonWebTokenError extends Error {}
  export class TokenExpiredError extends JsonWebTokenError {
    expiredAt: Date;
  }
  export class NotBeforeError extends JsonWebTokenError {
    date: Date;
  }

  export function sign(
    payload: string | Buffer | object,
    secretOrPrivateKey: string | Buffer,
    options?: SignOptions
  ): string;

  export function verify(
    token: string,
    secretOrPublicKey: string | Buffer,
    options?: VerifyOptions
  ): JwtPayload | string;

  export function decode(
    token: string,
    options?: { complete?: boolean; json?: boolean }
  ): null | JwtPayload | string;
}
