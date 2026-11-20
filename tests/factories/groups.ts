export interface GroupOverrides {
  id?: string;
  name?: string;
  description?: string;
  memberIds?: string[];
  createdAt?: Date;
  updatedAt?: Date;
  [key: string]: unknown;
}

export interface TestGroup {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
}

let groupSequence = 0;

/**
 * Build a test group with sensible defaults and optional overrides.
 * Shared factory to avoid duplication across the test suite.
 */
export function buildGroup(overrides: GroupOverrides = {}): TestGroup {
  groupSequence += 1;
  const now = new Date();

  return {
    id: `group-${groupSequence}`,
    name: `Test Group ${groupSequence}`,
    description: `Description for test group ${groupSequence}`,
    memberIds: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Build a list of test groups, applying the same overrides to each.
 */
export function buildGroups(
  count: number,
  overrides: GroupOverrides = {},
): TestGroup[] {
  return Array.from({ length: count }, () => buildGroup(overrides));
}

/**
 * Reset the internal sequence so tests remain deterministic.
 */
export function resetGroupFactory(): void {
  groupSequence = 0;
}
