import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Repository layer for the notifications domain.
 * Owns all Prisma query construction so routes and services stay free of
 * direct `prisma.` calls and can be tested/mocked cleanly.
 */
export class NotificationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.notification.findUnique({
      where: { id },
    });
  }

  findManyByUser(userId: string, args?: Prisma.NotificationFindManyArgs) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      ...args,
    });
  }

  countUnread(userId: string) {
    return this.prisma.notification.count({
      where: { userId, read: false },
    });
  }

  create(data: Prisma.NotificationCreateInput) {
    return this.prisma.notification.create({
      data,
    });
  }

  markAsRead(id: string) {
    return this.prisma.notification.update({
      where: { id },
      data: { read: true },
    });
  }

  markAllAsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  delete(id: string) {
    return this.prisma.notification.delete({
      where: { id },
    });
  }
}
