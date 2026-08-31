import { Group } from '../../models';

/**
 * Data access for groups. The service depends on this interface only, so the
 * in-memory implementation below can be swapped for a Prisma-backed one
 * without touching business logic or the controller.
 */
export interface GroupsRepository {
  findAll(): Promise<Group[]>;
  findById(id: string): Promise<Group | null>;
}

const DEFAULT_GROUPS: Group[] = [
  { id: '1', name: 'Weekly Savers', contributionAmount: 100, cycleDuration: 604800, maxMembers: 10, currentMembers: 5, status: 'Active', tags: ['weekly', 'low-entry'] },
  { id: '2', name: 'Monthly Builders', contributionAmount: 1000, cycleDuration: 2592000, maxMembers: 12, currentMembers: 3, status: 'Active', tags: ['monthly', 'high-entry'] },
  { id: '3', name: 'Student Circle', contributionAmount: 50, cycleDuration: 604800, maxMembers: 5, currentMembers: 4, status: 'Active', tags: ['weekly', 'students'] },
];

/**
 * In-memory group source. Still the production source for these read
 * endpoints; the group of record lives on chain and is indexed separately.
 */
export class InMemoryGroupsRepository implements GroupsRepository {
  private readonly groups: Group[];

  constructor(groups: Group[] = DEFAULT_GROUPS) {
    this.groups = groups;
  }

  async findAll(): Promise<Group[]> {
    return this.groups;
  }

  async findById(id: string): Promise<Group | null> {
    return this.groups.find((group) => group.id === id) ?? null;
  }
}
