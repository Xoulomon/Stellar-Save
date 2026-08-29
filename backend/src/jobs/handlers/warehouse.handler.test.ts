import { WarehouseHandler } from './warehouse.handler';
import { WarehouseExportPipeline } from '../../warehouse_export';

jest.mock('../../warehouse_export');

describe('WarehouseHandler', () => {
  let mockS3Client: any;
  let mockWarehousePipeline: jest.Mocked<WarehouseExportPipeline>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3Client = {};
    mockWarehousePipeline = new WarehouseExportPipeline({
      s3Client: mockS3Client,
      bucket: 'test-bucket',
    }) as any;
  });

  it('should execute warehouse export successfully', async () => {
    const mockResult = { files: 5, size: 1024 };
    (WarehouseExportPipeline as jest.MockedClass<typeof WarehouseExportPipeline>).prototype.run =
      jest.fn().mockResolvedValue(mockResult);

    const handler = new WarehouseHandler({
      bucket: 'test-bucket',
      alertWebhook: 'http://webhook.test',
    });
    const result = await handler.execute();

    expect(result).toEqual(mockResult);
  });

  it('should propagate warehouse export errors', async () => {
    const error = new Error('S3 upload failed');
    (WarehouseExportPipeline as jest.MockedClass<typeof WarehouseExportPipeline>).prototype.run =
      jest.fn().mockRejectedValue(error);

    const handler = new WarehouseHandler({
      bucket: 'test-bucket',
    });

    await expect(handler.execute()).rejects.toThrow('S3 upload failed');
  });

  it('should initialize with S3 client', async () => {
    const mockResult = { files: 0, size: 0 };
    (WarehouseExportPipeline as jest.MockedClass<typeof WarehouseExportPipeline>).prototype.run =
      jest.fn().mockResolvedValue(mockResult);

    const handler = new WarehouseHandler({
      s3Client: mockS3Client,
      bucket: 'custom-bucket',
      alertWebhook: 'http://alert.test',
    });

    const result = await handler.execute();
    expect(result).toEqual(mockResult);
  });
});
