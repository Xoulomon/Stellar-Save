// Test-only fixtures. Do not import from backend/src/.
// Moved from backend/src/mock_data.ts per issue #1882.

export interface MockUser {
  id: string;
  name: string;
  email: string;
}

export interface MockProject {
  id: string;
  name: string;
  ownerId: string;
}

export const mockUsers: MockUser[] = [
  { id: 'user-1', name: 'Alice Example', email: 'alice@example.com' },
  { id: 'user-2', name: 'Bob Example', email: 'bob@example.com' },
];

export const mockProjects: MockProject[] = [
  { id: 'project-1', name: 'Sample Project', ownerId: 'user-1' },
  { id: 'project-2', name: 'Second Project', ownerId: 'user-2' },
];

export function getMockUser(id: string): MockUser | undefined {
  return mockUsers.find((user) => user.id === id);
}

export function getMockProject(id: string): MockProject | undefined {
  return mockProjects.find((project) => project.id === id);
}
