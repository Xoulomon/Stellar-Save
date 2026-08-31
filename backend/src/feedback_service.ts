export interface FeedbackInput {
  userId?: string;
  category: 'bug' | 'feature' | 'general' | 'other';
  message: string;
  page?: string;
  userAgent?: string;
}

export class FeedbackService {
  constructor(private prisma: any) {}

  async submit(input: FeedbackInput) {
    if (!input.message?.trim()) throw new Error('message is required');
    if (!['bug', 'feature', 'general', 'other'].includes(input.category)) {
      throw new Error('invalid category');
    }
    return this.prisma.feedback.create({ data: input });
  }

  async list(filter: { category?: string; status?: string; limit?: number; offset?: number } = {}) {
    const where: Record<string, string> = {};
    if (filter.category) where.category = filter.category;
    if (filter.status) where.status = filter.status;
    return this.prisma.feedback.findMany({
      where,
      orderBy: [{ votes: 'desc' }, { createdAt: 'desc' }],
      take: filter.limit ?? 50,
      skip: filter.offset ?? 0,
    });
  }

  async vote(id: string) {
    return this.prisma.feedback.update({ where: { id }, data: { votes: { increment: 1 } } });
  }

  async respond(id: string, response: string, status?: string) {
    return this.prisma.feedback.update({
      where: { id },
      data: { response, respondedAt: new Date(), ...(status ? { status } : {}) },
    });
  }
}
