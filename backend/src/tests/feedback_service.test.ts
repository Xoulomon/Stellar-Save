import { FeedbackService, FeedbackInput } from '../feedback_service';

describe('FeedbackService', () => {
  let prisma: {
    feedback: {
      create: jest.Mock;
      findMany: jest.Mock;
      update: jest.Mock;
    };
  };
  let service: FeedbackService;

  beforeEach(() => {
    prisma = {
      feedback: {
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
    };
    service = new FeedbackService(prisma);
  });

  describe('submit', () => {
    const baseInput: FeedbackInput = { category: 'bug', message: 'Something broke' };

    it('creates feedback for a valid input', async () => {
      prisma.feedback.create.mockResolvedValue({ id: 'f1', ...baseInput });

      const result = await service.submit(baseInput);

      expect(prisma.feedback.create).toHaveBeenCalledWith({ data: baseInput });
      expect(result).toEqual({ id: 'f1', ...baseInput });
    });

    it('rejects an empty message', async () => {
      await expect(service.submit({ ...baseInput, message: '   ' })).rejects.toThrow(
        'message is required'
      );
      expect(prisma.feedback.create).not.toHaveBeenCalled();
    });

    it('rejects an invalid category', async () => {
      await expect(
        service.submit({ ...baseInput, category: 'invalid' as FeedbackInput['category'] })
      ).rejects.toThrow('invalid category');
    });
  });

  describe('list', () => {
    it('applies default pagination when no filter is given', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list();

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
        take: 50,
        skip: 0,
      });
    });

    it('filters by category and status and applies custom pagination', async () => {
      prisma.feedback.findMany.mockResolvedValue([]);

      await service.list({ category: 'feature', status: 'open', limit: 10, offset: 20 });

      expect(prisma.feedback.findMany).toHaveBeenCalledWith({
        where: { category: 'feature', status: 'open' },
        orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
        take: 10,
        skip: 20,
      });
    });
  });

  describe('vote', () => {
    it('increments the vote count for the given id', async () => {
      prisma.feedback.update.mockResolvedValue({ id: 'f1', votes: 2 });

      const result = await service.vote('f1');

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: { votes: { increment: 1 } },
      });
      expect(result).toEqual({ id: 'f1', votes: 2 });
    });
  });

  describe('respond', () => {
    it('sets a response and respondedAt without changing status when omitted', async () => {
      prisma.feedback.update.mockResolvedValue({ id: 'f1' });

      await service.respond('f1', 'Thanks for the report');

      expect(prisma.feedback.update).toHaveBeenCalledWith({
        where: { id: 'f1' },
        data: expect.objectContaining({ response: 'Thanks for the report' }),
      });
      const call = prisma.feedback.update.mock.calls[0][0];
      expect(call.data.respondedAt).toBeInstanceOf(Date);
      expect(call.data.status).toBeUndefined();
    });

    it('sets status when provided', async () => {
      prisma.feedback.update.mockResolvedValue({ id: 'f1' });

      await service.respond('f1', 'Fixed in next release', 'resolved');

      const call = prisma.feedback.update.mock.calls[0][0];
      expect(call.data.status).toBe('resolved');
    });
  });
});
