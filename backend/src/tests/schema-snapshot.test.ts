/**
 * GraphQL Schema Snapshot / Breaking-Change Detection
 *
 * This test compares the current schema (built from `typeDefs`) against the
 * committed snapshot at `src/graphql/snapshots/schema.graphql`.  It fails if
 * any **breaking** change is detected without explicit approval.
 *
 * --- How to approve an intentional breaking change ---
 * See `docs/graphql-breaking-changes.md` for the full process.
 * Short version:
 *   1. Make your schema change.
 *   2. Set ALLOW_BREAKING_SCHEMA=1 locally to confirm the test would pass.
 *   3. Regenerate the snapshot:  npm run schema:update
 *   4. Commit BOTH the updated snapshot AND a changelog entry.
 *   5. Remove ALLOW_BREAKING_SCHEMA before opening the PR.
 *
 * The `ALLOW_BREAKING_SCHEMA=1` env var is intentionally NOT honoured in CI
 * (backend-ci.yml never sets it), so a forgotten snapshot update will always
 * fail the pipeline.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { buildSchema, printSchema } from 'graphql';
import { diff, CriticalityLevel, type Change } from '@graphql-inspector/core';
import { typeDefs } from '../graphql/schema';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SNAPSHOT_PATH = resolve(__dirname, '../graphql/snapshots/schema.graphql');

/** Build the printed SDL for the current typeDefs. */
function currentSchemaSdl(): string {
  return printSchema(buildSchema(typeDefs));
}

/** Load the committed snapshot SDL. */
function snapshotSdl(): string {
  if (!existsSync(SNAPSHOT_PATH)) {
    throw new Error(
      `Schema snapshot not found at ${SNAPSHOT_PATH}.\n` +
        'Run  npm run schema:update  to generate it.',
    );
  }
  return readFileSync(SNAPSHOT_PATH, 'utf8');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('GraphQL schema snapshot', () => {
  it('snapshot file exists and is valid SDL', () => {
    const sdl = snapshotSdl();
    // buildSchema throws if the SDL is invalid
    expect(() => buildSchema(sdl)).not.toThrow();
    expect(sdl.length).toBeGreaterThan(0);
  });

  it('current schema matches the committed snapshot (no drift)', () => {
    const current = currentSchemaSdl();
    const snapshot = snapshotSdl();

    // Normalise: printSchema is deterministic; both sides go through it so
    // whitespace/comment differences don't trigger false positives.
    const normalisedSnapshot = printSchema(buildSchema(snapshot));

    expect(current).toBe(normalisedSnapshot);
  });

  it('detects no BREAKING changes vs snapshot unless explicitly approved', async () => {
    const allowBreaking = process.env.ALLOW_BREAKING_SCHEMA === '1';

    const oldSchema = buildSchema(snapshotSdl());
    const newSchema = buildSchema(typeDefs);

    const changes: Change[] = await diff(oldSchema, newSchema);

    const breakingChanges = changes.filter(
      (c) => c.criticality.level === CriticalityLevel.Breaking,
    );

    if (breakingChanges.length > 0) {
      const descriptions = breakingChanges
        .map((c) => `  • [${c.type}] ${c.message}`)
        .join('\n');

      const hint =
        'To approve this intentional breaking change:\n' +
        '  1. Run  npm run schema:update  to regenerate the snapshot.\n' +
        '  2. Commit the updated snapshot with a changelog entry.\n' +
        'See docs/graphql-breaking-changes.md for the full process.';

      if (allowBreaking) {
        // Developer explicitly opted in – warn but do not fail.
        console.warn(
          `⚠️  ALLOW_BREAKING_SCHEMA=1 is set. Breaking changes are present:\n${descriptions}\n\n${hint}`,
        );
      } else {
        throw new Error(
          `${breakingChanges.length} breaking schema change(s) detected.\n${descriptions}\n\n${hint}`,
        );
      }
    }
  });

  it('reports non-breaking (dangerous/safe) changes as informational', async () => {
    const oldSchema = buildSchema(snapshotSdl());
    const newSchema = buildSchema(typeDefs);

    const changes: Change[] = await diff(oldSchema, newSchema);

    const dangerousChanges = changes.filter(
      (c) => c.criticality.level === CriticalityLevel.Dangerous,
    );
    const safeChanges = changes.filter(
      (c) => c.criticality.level === CriticalityLevel.NonBreaking,
    );

    // These do not fail the test, but are logged so reviewers can see them.
    if (dangerousChanges.length > 0) {
      console.warn(
        `⚠️  ${dangerousChanges.length} dangerous (non-breaking but risky) change(s):\n` +
          dangerousChanges.map((c) => `  • ${c.message}`).join('\n'),
      );
    }
    if (safeChanges.length > 0) {
      console.info(
        `ℹ️  ${safeChanges.length} safe change(s) detected:\n` +
          safeChanges.map((c) => `  • ${c.message}`).join('\n'),
      );
    }

    // Non-breaking and dangerous changes are always allowed; just assert types.
    expect(Array.isArray(dangerousChanges)).toBe(true);
    expect(Array.isArray(safeChanges)).toBe(true);
  });
});
