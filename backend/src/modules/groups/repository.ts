import { PrismaClient, Prisma } from '@prisma/client';

/**
 * Repository layer for the groups domain.
 * Owns all Prisma query construction so routes and services stay free of
 * direct `prisma.` calls and can be tested/mocked cleanly.
 */
export class GroupsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findById(id: string) {
    return this.prisma.group.findUnique({
      where: { id },
      include: {
        members: true,
        creator: true,
      },
    });
  }

  findMany(args?: Prisma.GroupFindManyArgs) {
    return this.prisma.group.findMany({
      include: {
        members: true,
        creator: true,
      },
      ...args,
    });
  }

  findManyByMember(userId: string) {
    return this.prisma.group.findMany({
      where: {
        members: {
          some: { userId },
        },
      },
      include: {
        members: true,
        creator: true,
      },
    });
  }

  create(data: Prisma.GroupCreateInput) {
    return this.prisma.group.create({
      data,
      include: {
        members: true,
        creator: true,
      },
    });
  }

  update(id: string, data: Prisma.GroupUpdateInput) {
    return this.prisma.group.update({
      where: { id },
      data,
      include: {
        members: true,
        creator: true,
      },
    });
  }

  delete(id: string) {
    return this.prisma.group.delete({
      where: { id },
    });
  }

  addMember(groupId: string, userId: string) {
    return this.prisma.groupMember.create({
      data: { groupId, userId },
    });
  }

  removeMember(groupId: string, userId: string) {
    return this.prisma.groupMember.delete({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
  }

  findMember(groupId: string, userId: string) {
    return this.prisma.groupMember.findUnique({
      where: {
        groupId_userId: { groupId, userId },
      },
    });
  }
}
