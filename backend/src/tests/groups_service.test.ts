import { GroupsService } from '../services/group/groups.service';
import { GroupsRepository, InMemoryGroupsRepository } from '../services/group/groups.repository';
import { AppError } from '../lib/errors';
import { Group } from '../models';

/*
 * Service-layer tests: no Express, no supertest. The repository is the only
 * seam, so business rules are asserted directly.
 */

const groups: Group[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly'] },
  { id: '2', name: 'Full Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 5, status: 'Active', tags: [] },
  { id: '3', name: 'Closed Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 8, currentMembers: 2, status: 'Completed', tags: [] },
];

function makeService(repository: GroupsRepository = new InMemoryGroupsRepository(groups)): GroupsService {
  return new GroupsService(repository);
}

describe('GroupsService.listGroups', () => {
  it('returns every group from the repository', async () => {
    await expect(makeService().listGroups()).resolves.toEqual(groups);
  });

  it('returns an empty list when the repository is empty', async () => {
    const service = makeService(new InMemoryGroupsRepository([]));
    await expect(service.listGroups()).resolves.toEqual([]);
  });

  it('delegates to the repository exactly once', async () => {
    const findAll = jest.fn<Promise<Group[]>, []>().mockResolvedValue(groups);
    const service = makeService({ findAll, findById: jest.fn() });

    await service.listGroups();

    expect(findAll).toHaveBeenCalledTimes(1);
  });
});

describe('GroupsService.getGroupById', () => {
  it('returns the matching group', async () => {
    const group = await makeService().getGroupById('1');
    expect(group.name).toBe('Weekly Savers');
  });

  it('trims the id before lookup', async () => {
    const group = await makeService().getGroupById('  1  ');
    expect(group.id).toBe('1');
  });

  it('throws a 404 AppError for an unknown id', async () => {
    await expect(makeService().getGroupById('nonexistent')).rejects.toMatchObject({
      code: 'GROUP_NOT_FOUND',
      statusCode: 404,
    });
  });

  it('throws a 400 AppError for a blank id without hitting the repository', async () => {
    const findById = jest.fn();
    const service = makeService({ findAll: jest.fn(), findById });

    await expect(service.getGroupById('   ')).rejects.toBeInstanceOf(AppError);
    expect(findById).not.toHaveBeenCalled();
  });

  it('propagates an unexpected repository failure unchanged', async () => {
    const service = makeService({
      findAll: jest.fn(),
      findById: jest.fn().mockRejectedValue(new Error('db down')),
    });

    await expect(service.getGroupById('1')).rejects.toThrow('db down');
  });
});

describe('GroupsService.isGroupFull', () => {
  it('is false while seats remain', async () => {
    await expect(makeService().isGroupFull('1')).resolves.toBe(false);
  });

  it('is true once members reach the maximum', async () => {
    await expect(makeService().isGroupFull('2')).resolves.toBe(true);
  });

  it('surfaces the not-found error rather than a boolean', async () => {
    await expect(makeService().isGroupFull('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('GroupsService.canAcceptMembers', () => {
  it('accepts members for an active group with room', async () => {
    await expect(makeService().canAcceptMembers('1')).resolves.toBe(true);
  });

  it('rejects a full group', async () => {
    await expect(makeService().canAcceptMembers('2')).resolves.toBe(false);
  });

  it('rejects a group that is not active even with room', async () => {
    await expect(makeService().canAcceptMembers('3')).resolves.toBe(false);
  });
});

describe('InMemoryGroupsRepository', () => {
  it('finds a group by id', async () => {
    await expect(new InMemoryGroupsRepository(groups).findById('2')).resolves.toMatchObject({
      name: 'Full Circle',
    });
  });

  it('returns null for an unknown id', async () => {
    await expect(new InMemoryGroupsRepository(groups).findById('99')).resolves.toBeNull();
  });
});
