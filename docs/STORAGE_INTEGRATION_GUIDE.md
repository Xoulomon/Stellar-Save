# Storage Integration Guide

## Overview

This guide details how Stellar-Save manages asset and metadata image storage. Group creators and administrators can upload group metadata images (avatars, banners, proof documents) which are processed through the `ImageStorageService` abstraction.

---

## Storage Architecture

Stellar-Save decouples controllers from underlying storage implementations using the `ImageStorageService` interface.

```
┌─────────────────────────────────────────────────────────┐
│               Controller / Route Handler                │
└───────────────────────────┬─────────────────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │    ImageStorageService    │
              │        Interface          │
              └─────────────┬─────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│ LocalImageStorage     │       │ S3ImageStorage        │
│ Service (Dev/Test)    │       │ Service (Production)  │
└───────────────────────┘       └───────────────────────┘
```

---

## `ImageStorageService` Interface

Defined in `backend/src/services/image_storage_service.ts`:

```typescript
export interface ImageUploadOptions {
  filename: string;
  buffer: Buffer;
  mimeType: string;
  maxSizeBytes?: number;       // Default: 5MB (5,242,880 bytes)
  allowedMimeTypes?: string[]; // Default: ['image/jpeg', 'image/png', 'image/webp']
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
```

---

## Validation & Security Controls

Before persisting any image, `validateImage()` enforces:

1. **Non-empty Buffer**: Rejects zero-byte payloads.
2. **File Size Limit**: Defaults to max 5MB per image.
3. **MIME Type Whitelist**: Accepts `image/jpeg`, `image/png`, and `image/webp`.
4. **Magic Bytes Verification**: Inspects file header signatures to prevent file extension spoofing:
   - `JPEG`: Starts with `0xFF 0xD8 0xFF`
   - `PNG`: Starts with `0x89 0x50 0x4E 0x47`
   - `WebP`: Starts with `RIFF` and contains `WEBP` header signature

If validation fails, an `ImageValidationError` is thrown with a descriptive message.

---

## Storage Providers

### 1. `LocalImageStorageService`
Used in local development and testing environments. Saves files to `./uploads/groups` and returns local URLs.

```typescript
import { LocalImageStorageService } from './services/image_storage_service';

const storage = new LocalImageStorageService();
const result = await storage.uploadGroupImage('group-42', {
  filename: 'group_avatar.png',
  buffer: imageBuffer,
  mimeType: 'image/png',
});
```

### 2. `S3ImageStorageService`
Used in production deployments. Uploads files to AWS S3 using `@aws-sdk/client-s3`.

Configuration environment variables:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `BACKUP_S3_BUCKET` (or default `stellar-save-assets`)

```typescript
import { S3ImageStorageService } from './services/image_storage_service';

const s3Storage = new S3ImageStorageService();
const result = await s3Storage.uploadGroupImage('group-42', {
  filename: 'avatar.jpg',
  buffer: imageBuffer,
  mimeType: 'image/jpeg',
});
```

---

## Error Handling

When calling `uploadGroupImage`, handlers should catch `ImageValidationError` and return HTTP `400 Bad Request`:

```typescript
try {
  const result = await storageService.uploadGroupImage(groupId, { filename, buffer, mimeType });
  return res.status(201).json(result);
} catch (err) {
  if (err instanceof ImageValidationError) {
    return res.status(400).json({ error: err.message });
  }
  return res.status(500).json({ error: 'Internal storage failure' });
}
```
