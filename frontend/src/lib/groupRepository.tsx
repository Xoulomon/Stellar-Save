/* eslint-disable react-refresh/only-export-components -- this module also exports repository APIs. */
import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Group {
  id: string;
  name: string;
  description: string;
  members: string[];
  createdAt: number;
  creator: string;
  contributionAmount: number;
  currency: string;
  cycleDuration: number;
  status: 'active' | 'pending' | 'completed' | 'cancelled';
}

export interface CreateGroupInput {
  name: string;
  description: string;
  contributionAmount: number;
  currency: string;
  cycleDuration: number;
  creator: string;
}

export interface FetchGroupsOptions {
  creator?: string;
  member?: string;
  status?: Group['status'];
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class NotImplementedError extends Error {
  readonly code = 'NOT_IMPLEMENTED' as const;

  constructor(method: string) {
    super(`SorobanGroupRepository.${method} is not implemented yet`);
    this.name = 'NotImplementedError';
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}

export function isNotImplementedError(err: unknown): err is NotImplementedError {
  return err instanceof NotImplementedError;
}

// ---------------------------------------------------------------------------
// Repository interface
// ---------------------------------------------------------------------------

export interface GroupRepository {
  createGroup(input: CreateGroupInput): Promise<Group>;
  fetchGroups(options?: FetchGroupsOptions): Promise<Group[]>;
  fetchGroup(id: string): Promise<Group | null>;
  joinGroup(groupId: string, member: string): Promise<Group>;
  leaveGroup(groupId: string, member: string): Promise<Group>;
}

// ---------------------------------------------------------------------------
// Mock dataset
// ---------------------------------------------------------------------------

export const MOCK_GROUPS: Group[] = [
  {
    id: 'group-1',
    name: 'Sunrise Savers',
    description: 'A rotating savings group for early risers.',
    members: [
      'GAAAAA1111111111111111111111111111111111111111111111111',
      'GBBBBB2222222222222222222222222222222222222222222222222',
    ],
    createdAt: 1_700_000_000_000,
    creator: 'GAAAAA1111111111111111111111111111111111111111111111111',
    contributionAmount: 50,
    currency: 'XLM',
    cycleDuration: 30,
    status: 'active',
  },
  {
    id: 'group-2',
    name: 'Builders Circle',
    description: 'Monthly contributions for community projects.',
    members: ['GCCCCC3333333333333333333333333333333333333333333333333'],
    createdAt: 1_701_000_000_000,
    creator: 'GCCCCC3333333333333333333333333333333333333333333333333',
    contributionAmount: 100,
    currency: 'XLM',
    cycleDuration: 30,
    status: 'pending',
  },
  {
    id: 'group-3',
    name: 'Harvest Fund',
    description: 'Completed savings cycle for the harvest season.',
    members: [
      'GDDDDD4444444444444444444444444444444444444444444444444',
      'GEEEEE5555555555555555555555555555555555555555555555555',
      'GFFFFF6666666666666666666666666666666666666666666666666',
    ],
    createdAt: 1_690_000_000_000,
    creator: 'GDDDDD4444444444444444444444444444444444444444444444444',
    contributionAmount: 25,
    currency: 'XLM',
    cycleDuration: 14,
    status: 'completed',
  },
];

// ---------------------------------------------------------------------------
// Stub implementation
// ---------------------------------------------------------------------------

export class StubGroupRepository implements GroupRepository {
  private groups: Group[];

  constructor(seed: Group[] = MOCK_GROUPS) {
    this.groups = seed.map((g) => ({ ...g, members: [...g.members] }));
  }

  async createGroup(input: CreateGroupInput): Promise<Group> {
    const group: Group = {
      id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: input.name,
      description: input.description,
      members: [input.creator],
      createdAt: Date.now(),
      creator: input.creator,
      contributionAmount: input.contributionAmount,
      currency: input.currency,
      cycleDuration: input.cycleDuration,
      status: 'pending',
    };
    this.groups = [...this.groups, group];
    return { ...group, members: [...group.members] };
  }

  async fetchGroups(options?: FetchGroupsOptions): Promise<Group[]> {
    let result = this.groups;
    if (options?.creator) {
      result = result.filter((g) => g.creator === options.creator);
    }
    if (options?.member) {
      result = result.filter((g) => g.members.includes(options.member as string));
    }
    if (options?.status) {
      result = result.filter((g) => g.status === options.status);
    }
    return result.map((g) => ({ ...g, members: [...g.members] }));
  }

  async fetchGroup(id: string): Promise<Group | null> {
    const found = this.groups.find((g) => g.id === id);
    return found ? { ...found, members: [...found.members] } : null;
  }

  async joinGroup(groupId: string, member: string): Promise<Group> {
    const index = this.groups.findIndex((g) => g.id === groupId);
    if (index === -1) {
      throw new Error(`Group not found: ${groupId}`);
    }
    const existing = this.groups[index];
    if (existing.members.includes(member)) {
      return { ...existing, members: [...existing.members] };
    }
    const updated: Group = { ...existing, members: [...existing.members, member] };
    this.groups = [...this.groups.slice(0, index), updated, ...this.groups.slice(index + 1)];
    return { ...updated, members: [...updated.members] };
  }

  async leaveGroup(groupId: string, member: string): Promise<Group> {
    const index = this.groups.findIndex((g) => g.id === groupId);
    if (index === -1) {
      throw new Error(`Group not found: ${groupId}`);
    }
    const existing = this.groups[index];
    const updated: Group = {
      ...existing,
      members: existing.members.filter((m) => m !== member),
    };
    this.groups = [...this.groups.slice(0, index), updated, ...this.groups.slice(index + 1)];
    return { ...updated, members: [...updated.members] };
  }
}

// ---------------------------------------------------------------------------
// Soroban implementation (skeleton)
// ---------------------------------------------------------------------------

export class SorobanGroupRepository implements GroupRepository {
  constructor(_contractId?: string) {}

  async createGroup(_input: CreateGroupInput): Promise<Group> {
    throw new NotImplementedError('createGroup');
  }

  async fetchGroups(_options?: FetchGroupsOptions): Promise<Group[]> {
    throw new NotImplementedError('fetchGroups');
  }

  async fetchGroup(_id: string): Promise<Group | null> {
    throw new NotImplementedError('fetchGroup');
  }

  async joinGroup(_groupId: string, _member: string): Promise<Group> {
    throw new NotImplementedError('joinGroup');
  }

  async leaveGroup(_groupId: string, _member: string): Promise<Group> {
    throw new NotImplementedError('leaveGroup');
  }
}

// ---------------------------------------------------------------------------
// React context
// ---------------------------------------------------------------------------

const GroupRepositoryContext = createContext<GroupRepository | null>(null);

export interface GroupRepositoryProviderProps {
  repository?: GroupRepository;
  children: ReactNode;
}

export function GroupRepositoryProvider({
  repository,
  children,
}: GroupRepositoryProviderProps): React.ReactElement {
  const value = useMemo<GroupRepository>(
    () => repository ?? new StubGroupRepository(),
    [repository]
  );
  return (
    <GroupRepositoryContext.Provider value={value}>{children}</GroupRepositoryContext.Provider>
  );
}

export function useGroupRepository(): GroupRepository {
  const repo = useContext(GroupRepositoryContext);
  if (!repo) {
    throw new Error('useGroupRepository must be used within a <GroupRepositoryProvider>');
  }
  return repo;
}
