import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { prisma } from '../../src/prisma_client';

const backendRoot = path.resolve(__dirname, '../..');
const npmExec = process.platform === 'win32' ? 'npx.cmd' : 'npx';

export function applyMigrations(): void {
  execFileSync(npmExec, ['--no-install', 'prisma', 'migrate', 'deploy'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  execFileSync(npmExec, ['--no-install', 'prisma', 'db', 'push', '--skip-generate'], {
    cwd: backendRoot,
    env: process.env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
}

export async function resetDatabase(): Promise<void> {
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  if (tables.length === 0) return;

  const quotedNames = tables
    .map(({ tablename }) => `"${tablename.replace(/"/g, '""')}"`)
    .join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quotedNames} CASCADE`);
}
