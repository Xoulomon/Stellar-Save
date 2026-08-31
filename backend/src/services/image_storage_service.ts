/**
 * Group Metadata Image Storage Service Abstraction & Implementations
 *
 * Provides reusable image validation (size, MIME type, magic bytes) and storage
 * abstraction across local filesystem and AWS S3 storage providers.
 *
 * Issue #1302
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import * as fs from 'fs';
import * as path from 'path';
import { config } from '../config';
import { logger } from '../logger';
import { ImageValidationError } from '../lib/errors';

export { ImageValidationError };

export interface ImageUploadOptions {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  maxSizeBytes?: number;
  allowedMimeTypes?: string[];
}

export interface ImageUploadResult {
  url: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
}

export interface ImageStorageService {
  uploadGroupImage(groupId: string, options: ImageUploadOptions): Promise<ImageUploadResult>;
  deleteGroupImage(key: string): Promise<void>;
  validateImage(options: ImageUploadOptions): void;
}

const DEFAULT_MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const DEFAULT_ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Base abstract service providing unified validation logic.
 */
export abstract class BaseImageStorageService implements ImageStorageService {
  public validateImage(options: ImageUploadOptions): void {
    const { buffer, mimeType, maxSizeBytes = DEFAULT_MAX_SIZE_BYTES, allowedMimeTypes = DEFAULT_ALLOWED_MIME_TYPES } = options;

    if (!buffer || buffer.length === 0) {
      throw new ImageValidationError('Image file buffer cannot be empty');
    }

    if (buffer.length > maxSizeBytes) {
      throw new ImageValidationError(`Image size (${(buffer.length / 1024 / 1024).toFixed(2)} MB) exceeds maximum allowed limit of ${(maxSizeBytes / 1024 / 1024).toFixed(2)} MB`);
    }

    if (!allowedMimeTypes.includes(mimeType.toLowerCase())) {
      throw new ImageValidationError(`MIME type '${mimeType}' is not supported. Allowed: ${allowedMimeTypes.join(', ')}`);
    }

    // Magic Bytes Verification
    if (!this.verifyMagicBytes(buffer, mimeType)) {
      throw new ImageValidationError(`Image file header does not match declared MIME type '${mimeType}'`);
    }
  }

  private verifyMagicBytes(buffer: Buffer, mimeType: string): boolean {
    if (buffer.length < 4) return false;

    switch (mimeType.toLowerCase()) {
      case 'image/jpeg':
        return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
      case 'image/png':
        return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
      case 'image/webp':
        return (
          buffer[0] === 0x52 && // R
          buffer[1] === 0x49 && // I
          buffer[2] === 0x46 && // F
          buffer[3] === 0x46 && // F
          buffer.length >= 12 &&
          buffer[8] === 0x57 && // W
          buffer[9] === 0x45 && // E
          buffer[10] === 0x42 && // B
          buffer[11] === 0x50 // P
        );
      default:
        return false;
    }
  }

  abstract uploadGroupImage(groupId: string, options: ImageUploadOptions): Promise<ImageUploadResult>;
  abstract deleteGroupImage(key: string): Promise<void>;
}

/**
 * Local Filesystem implementation for development and testing.
 */
export class LocalImageStorageService extends BaseImageStorageService {
  constructor(private readonly uploadDir = path.join(process.cwd(), 'uploads', 'groups')) {
    super();
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadGroupImage(groupId: string, options: ImageUploadOptions): Promise<ImageUploadResult> {
    this.validateImage(options);

    const ext = path.extname(options.filename) || this.getExtensionFromMime(options.mimeType);
    const key = `groups/${groupId}/${Date.now()}_${path.basename(options.filename, ext)}${ext}`;
    const filePath = path.join(this.uploadDir, `${groupId}_${Date.now()}${ext}`);

    await fs.promises.writeFile(filePath, options.buffer);

    const baseUrl = config.urls.app || 'http://localhost:3001';
    const url = `${baseUrl}/uploads/${path.basename(filePath)}`;

    logger.info('[ImageStorage] Uploaded group image locally', { groupId, key, size: options.buffer.length });
    return { url, key, sizeBytes: options.buffer.length, mimeType: options.mimeType };
  }

  async deleteGroupImage(key: string): Promise<void> {
    logger.info('[ImageStorage] Deleted group image locally', { key });
  }

  private getExtensionFromMime(mimeType: string): string {
    switch (mimeType.toLowerCase()) {
      case 'image/jpeg': return '.jpg';
      case 'image/png': return '.png';
      case 'image/webp': return '.webp';
      default: return '.img';
    }
  }
}

/**
 * AWS S3 Storage Service Implementation for Production.
 */
export class S3ImageStorageService extends BaseImageStorageService {
  private s3Client: S3Client;
  private bucket: string;

  constructor(s3Client?: S3Client, bucket?: string) {
    super();
    this.bucket = bucket || config.backup.bucket || 'stellar-save-assets';
    this.s3Client =
      s3Client ||
      new S3Client({
        region: config.aws.region,
        credentials:
          config.aws.accessKeyId && config.aws.secretAccessKey
            ? { accessKeyId: config.aws.accessKeyId, secretAccessKey: config.aws.secretAccessKey }
            : undefined,
      });
  }

  async uploadGroupImage(groupId: string, options: ImageUploadOptions): Promise<ImageUploadResult> {
    this.validateImage(options);

    const ext = path.extname(options.filename) || '.jpg';
    const key = `groups/${groupId}/${Date.now()}_${path.basename(options.filename, ext)}${ext}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: options.buffer,
        ContentType: options.mimeType,
      })
    );

    const url = `https://${this.bucket}.s3.${config.aws.region}.amazonaws.com/${key}`;

    logger.info('[ImageStorage] Uploaded group image to S3', { groupId, key, bucket: this.bucket });
    return { url, key, sizeBytes: options.buffer.length, mimeType: options.mimeType };
  }

  async deleteGroupImage(key: string): Promise<void> {
    await this.s3Client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })
    );
    logger.info('[ImageStorage] Deleted group image from S3', { key });
  }
}
