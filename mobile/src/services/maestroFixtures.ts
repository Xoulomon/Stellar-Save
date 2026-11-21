import type { Group } from './contractService';

export const MAESTRO_GROUP_ID = '1';

const TEST_CREATOR = 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

let nextGroupId = 3;
let groups: Group[] = [
  {
    id: MAESTRO_GROUP_ID,
    name: 'Lagos Ajo Circle',
    contributionAmount: 1_000_000_000,
    cycleDuration: 2_592_000,
    maxMembers: 10,
    memberCount: 2,
    status: 'active',
    creator: TEST_CREATOR,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  },
  {
    id: '2',
    name: 'Accra Savings Circle',
    contributionAmount: 500_000_000,
    cycleDuration: 604_800,
    maxMembers: 8,
    memberCount: 1,
    status: 'pending',
    creator: TEST_CREATOR,
    createdAt: new Date('2026-01-02T00:00:00.000Z'),
  },
];

function copyGroup(group: Group): Group {
  return { ...group, createdAt: new Date(group.createdAt) };
}

export function listMaestroGroups(): Group[] {
  return groups.map(copyGroup);
}

export function getMaestroGroup(groupId: string): Group | null {
  const group = groups.find((item) => item.id === groupId);
  return group ? copyGroup(group) : null;
}

export function createMaestroGroup(params: {
  contributionAmount: bigint;
  cycleDuration: bigint;
  maxMembers: number;
}): string {
  const id = String(nextGroupId++);
  groups = [
    ...groups,
    {
      id,
      name: `Test Savings Group ${id}`,
      contributionAmount: Number(params.contributionAmount),
      cycleDuration: Number(params.cycleDuration),
      maxMembers: params.maxMembers,
      memberCount: 1,
      status: 'pending',
      creator: TEST_CREATOR,
      createdAt: new Date(),
    },
  ];
  return id;
}

export function joinMaestroGroup(groupId: string): void {
  groups = groups.map((group) =>
    group.id === groupId
      ? { ...group, memberCount: Math.min(group.memberCount + 1, group.maxMembers) }
      : group,
  );
}

export function resetMaestroFixtures(): void {
  nextGroupId = 3;
  groups = [
    {
      id: MAESTRO_GROUP_ID,
      name: 'Lagos Ajo Circle',
      contributionAmount: 1_000_000_000,
      cycleDuration: 2_592_000,
      maxMembers: 10,
      memberCount: 2,
      status: 'active',
      creator: TEST_CREATOR,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: '2',
      name: 'Accra Savings Circle',
      contributionAmount: 500_000_000,
      cycleDuration: 604_800,
      maxMembers: 8,
      memberCount: 1,
      status: 'pending',
      creator: TEST_CREATOR,
      createdAt: new Date('2026-01-02T00:00:00.000Z'),
    },
  ];
}
