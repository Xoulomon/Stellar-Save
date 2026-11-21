export interface TestUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'member' | 'guest';
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

const nextUserIndex = (): number => {
  userSequence += 1;
  return userSequence;
};

const nextGroupIndex = (): number => {
  groupSequence += 1;
  return groupSequence;
};

/**
 * Build a test user with sensible defaults. Any field can be overridden.
 * Defaults are deterministic per call via an incrementing sequence so that
 * ids/emails stay unique within a test run.
 */
export function buildUser(overrides: Partial<TestUser> = {}): TestUser {
  const index = nextUserIndex();
  return {
    id: `user-${index}`,
    name: `Test User ${index}`,
    email: `user${index}@example.com`,
    role: 'member',
    groupIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build a test group with sensible defaults. Any field can be overridden.
 */
export function buildGroup(overrides: Partial<TestGroup> = {}): TestGroup {
  const index = nextGroupIndex();
  return {
    id: `group-${index}`,
    name: `Test Group ${index}`,
    description: `Description for test group ${index}`,
    memberIds: [],
    createdAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  };
}

/**
 * Build a user that is a member of the given groups.
 */
export function buildUserInGroups(
  groupIds: string[],
  overrides: Partial<TestUser> = {},
): TestUser {
  return buildUser({ groupIds: [...groupIds], ...overrides });
}

/**
 * Build a group populated with the given member ids.
 */
export function buildGroupWithMembers(
  memberIds: string[],
  overrides: Partial<TestGroup> = {},
): TestGroup {
  return buildGroup({ memberIds: [...memberIds], ...overrides });
}

/**
 * Reset the internal sequences. Useful in beforeEach to keep fixtures
 * deterministic across tests.
 */
export function resetFactorySequences(): void {
  userSequence = 0;
  groupSequence = 0;
}
