import { Group } from '../../models';
import { AppError } from '../../lib/errors';
import { GroupsRepository } from './groups.repository';

/**
 * Business logic for groups. Knows nothing about Express: it takes plain
 * arguments, returns plain data, and signals failure with AppError so the
 * controller can map a status code without re-deriving intent.
 */
export class GroupsService {
  constructor(private readonly repository: GroupsRepository) {}

  async listGroups(): Promise<Group[]> {
    return this.repository.findAll();
  }

  async getGroupById(id: string): Promise<Group> {
    const trimmed = id?.trim() ?? '';
    if (!trimmed) {
      throw new AppError('GROUP_ID_REQUIRED', 'Group id is required', 400);
    }

    const group = await this.repository.findById(trimmed);
    if (!group) {
      throw new AppError('GROUP_NOT_FOUND', 'Group not found', 404);
    }

    return group;
  }

  /** True once the group has no seats left. */
  async isGroupFull(id: string): Promise<boolean> {
    const group = await this.getGroupById(id);
    return group.currentMembers >= group.maxMembers;
  }

  /** Joinable means active and not yet full. */
  async canAcceptMembers(id: string): Promise<boolean> {
    const group = await this.getGroupById(id);
    return group.status === 'Active' && group.currentMembers < group.maxMembers;
  }
}
