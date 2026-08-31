import {
  LocalImageStorageService,
  S3ImageStorageService,
  ImageValidationError,
  ImageUploadOptions,
} from '../services/image_storage_service';

describe('ImageStorageService Unit Tests', () => {
  // Sample valid magic byte buffers
  const validJpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);
  const validPngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const validWebpBuffer = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // RIFF
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x45, 0x42, 0x50, // WEBP
  ]);
  const invalidBuffer = Buffer.from([0x00, 0x11, 0x22, 0x33]);

  describe('Validation Logic', () => {
    const service = new LocalImageStorageService();

    it('accepts valid JPEG image buffer with correct header', () => {
      const options: ImageUploadOptions = {
        filename: 'avatar.jpg',
        buffer: validJpegBuffer,
        mimeType: 'image/jpeg',
      };
      expect(() => service.validateImage(options)).not.toThrow();
    });

    it('accepts valid PNG image buffer with correct header', () => {
      const options: ImageUploadOptions = {
        filename: 'group.png',
        buffer: validPngBuffer,
        mimeType: 'image/png',
      };
      expect(() => service.validateImage(options)).not.toThrow();
    });

    it('accepts valid WebP image buffer with correct header', () => {
      const options: ImageUploadOptions = {
        filename: 'banner.webp',
        buffer: validWebpBuffer,
        mimeType: 'image/webp',
      };
      expect(() => service.validateImage(options)).not.toThrow();
    });

    it('throws error when buffer is empty', () => {
      const options: ImageUploadOptions = {
        filename: 'empty.jpg',
        buffer: Buffer.alloc(0),
        mimeType: 'image/jpeg',
      };
      expect(() => service.validateImage(options)).toThrow(ImageValidationError);
      expect(() => service.validateImage(options)).toThrow(/empty/i);
    });

    it('throws error when file size exceeds maxSizeBytes', () => {
      const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6 MB
      largeBuffer[0] = 0xff;
      largeBuffer[1] = 0xd8;
      largeBuffer[2] = 0xff;

      const options: ImageUploadOptions = {
        filename: 'huge.jpg',
        buffer: largeBuffer,
        mimeType: 'image/jpeg',
      };
      expect(() => service.validateImage(options)).toThrow(ImageValidationError);
      expect(() => service.validateImage(options)).toThrow(/exceeds/i);
    });

    it('throws error when MIME type is not allowed', () => {
      const options: ImageUploadOptions = {
        filename: 'document.pdf',
        buffer: validPngBuffer,
        mimeType: 'application/pdf',
      };
      expect(() => service.validateImage(options)).toThrow(ImageValidationError);
      expect(() => service.validateImage(options)).toThrow(/not supported/i);
    });

    it('throws error when magic bytes do not match declared MIME type', () => {
      const options: ImageUploadOptions = {
        filename: 'fake_png.png',
        buffer: invalidBuffer,
        mimeType: 'image/png',
      };
      expect(() => service.validateImage(options)).toThrow(ImageValidationError);
      expect(() => service.validateImage(options)).toThrow(/magic bytes|header/i);
    });
  });

  describe('S3ImageStorageService with Mocked S3 Client', () => {
    let mockS3Client: any;
    let s3Service: S3ImageStorageService;

    beforeEach(() => {
      mockS3Client = {
        send: jest.fn().mockResolvedValue({}),
      };
      s3Service = new S3ImageStorageService(mockS3Client, 'test-bucket');
    });

    it('uploads valid image to S3 successfully', async () => {
      const result = await s3Service.uploadGroupImage('group-123', {
        filename: 'test.png',
        buffer: validPngBuffer,
        mimeType: 'image/png',
      });

      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
      expect(result.url).toContain('https://test-bucket.s3.us-east-1.amazonaws.com/groups/group-123/');
      expect(result.mimeType).toBe('image/png');
    });

    it('deletes image from S3 successfully', async () => {
      await s3Service.deleteGroupImage('groups/group-123/test.png');
      expect(mockS3Client.send).toHaveBeenCalledTimes(1);
    });
  });
});
