const { spawnSync } = require('node:child_process');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '../..');
const repositoryRoot = path.resolve(backendRoot, '..');
const composeFile = path.join(repositoryRoot, 'docker-compose.yml');
const compose = ['compose', '-f', composeFile];
const databaseName = 'stellar_save_test';
const databaseUrl =
  process.env.TEST_DATABASE_URL ||
  `postgresql://stellar:stellar_dev@localhost:5432/${databaseName}`;
const npmExec = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}`);
  }
}

run('docker', [...compose, 'up', '-d', 'postgres'], repositoryRoot);

let postgresReady = false;
for (let attempt = 0; attempt < 30; attempt += 1) {
  const readiness = spawnSync(
    'docker',
    [...compose, 'exec', '-T', 'postgres', 'pg_isready', '-U', 'stellar', '-d', 'stellar_save'],
    { cwd: repositoryRoot, stdio: 'ignore', shell: process.platform === 'win32' },
  );
  if (readiness.status === 0) {
    postgresReady = true;
    break;
  }
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
}
if (!postgresReady) {
  throw new Error('PostgreSQL did not become ready within 30 seconds');
}

if (!process.env.TEST_DATABASE_URL) {
  const exists = spawnSync(
    'docker',
    [
      ...compose,
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'stellar',
      '-d',
      'postgres',
      '-tAc',
      `SELECT 1 FROM pg_database WHERE datname = '${databaseName}'`,
    ],
    { cwd: repositoryRoot, encoding: 'utf8', shell: process.platform === 'win32' },
  );
  if (exists.error) throw exists.error;
  if (exists.status !== 0) {
    throw new Error(`Could not check for the ${databaseName} integration database`);
  }
  if (!exists.stdout.trim()) {
    run(
      'docker',
      [
        ...compose,
        'exec',
        '-T',
        'postgres',
        'psql',
        '-U',
        'stellar',
        '-d',
        'postgres',
        '-c',
        `CREATE DATABASE ${databaseName} OWNER stellar`,
      ],
      repositoryRoot,
    );
  }
}

const integrationEnv = { ...process.env, DATABASE_URL: databaseUrl };
run(
  npmExec,
  ['--no-install', 'prisma', 'generate', '--schema', 'prisma/schema.prisma'],
  backendRoot,
  integrationEnv,
);
run(
  npmExec,
  ['--no-install', 'jest', '--config', 'jest.integration.config.js', '--runInBand'],
  backendRoot,
  integrationEnv,
);
