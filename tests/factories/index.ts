/**
 * Shared test factories for users and groups.
 *
 * Centralizes fixture creation so tests stop duplicating inline objects.
 * Every factory accepts an optional `overrides` object that is shallow-merged
 * over the defaults, keeping existing call sites backwards compatible.
 */

export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member';
  groupIds: string[];
  createdAt: string;
}

export interface TestGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  createdAt: string;
}

let userSequence = 0;
let groupSequence = 0;

/** Reset the internal id counters so tests stay deterministic. */
export function resetFactorySequences(): void {
  userSequence = 0;
  groupSequence = 0;
}

/**
 * Build a user fixture with sensible defaults.
 * Pass `overrides` to customize any field for a specific test.
 */
export function createUser(overrides: Partial<TestUser> = {}): TestUser {
  userSequence += 1;
  const id = `user-${userSequence}`;
  return {
    id,
    name: `Test User ${userSequence}`,
    email: `user${userSequence}@example.com`,
    role: 'member',
    groupIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build a group fixture with sensible defaults.
 * Pass `overrides` to customize any field for a specific test.
 */
export function createGroup(overrides: Partial<TestGroup> = {}): TestGroup {
  groupSequence += 1;
  const id = `group-${groupSequence}`;
  return {
    id,
    name: `Test Group ${groupSequence}`,
    description: `Description for group ${groupSequence}`,
    memberIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build a user that is a member of the given groups.
 * Convenience wrapper over `createUser` for membership scenarios.
 */
export function createUserInGroups(
  groupIds: string[],
  overrides: Partial<TestUser> = {},
): TestUser {
  return createUser({ groupIds, ...overrides });
}

/**
 * Build a group populated with the given member ids.
 * Convenience wrapper over `createGroup` for membership scenarios.
 */
export function createGroupWithMembers(
  memberIds: string[],
  overrides: Partial<TestGroup> = {},
): TestGroup {
  return createGroup({ memberIds, ...overrides });
}
