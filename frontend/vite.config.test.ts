/**
 * Tests for frontend/vite.config.ts (issue #2044 — bundle size analysis and
 * tree-shaking cleanup).
 *
 * Validates that the config exposes the expected manual chunk groups so
 * regressions in the chunking strategy are caught during CI.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// Read the raw config source files so we can assert structural invariants
// without executing Vite plugins (which have network/filesystem side-effects).
const frontendConfigSource = readFileSync(join(__dirname, 'vite.config.ts'), 'utf-8');
const rootConfigSource = readFileSync(join(__dirname, '..', 'vite.config.ts'), 'utf-8');

const EXPECTED_VENDOR_CHUNKS = [
  'vendor-react',
  'vendor-mui',
  'vendor-stellar',
  'vendor-i18n',
];

const EXPECTED_ROUTE_CHUNKS = [
  'route-analytics',
  'route-admin',
  'route-charts',
];

describe('frontend/vite.config.ts — manual chunk strategy (issue #2044)', () => {
  it('declares all required vendor chunks', () => {
    for (const chunk of EXPECTED_VENDOR_CHUNKS) {
      expect(frontendConfigSource, `missing chunk: ${chunk}`).toContain(`'${chunk}'`);
    }
  });

  it('declares all required route-level chunks', () => {
    for (const chunk of EXPECTED_ROUTE_CHUNKS) {
      expect(frontendConfigSource, `missing chunk: ${chunk}`).toContain(`'${chunk}'`);
    }
  });

  it('vendor-react chunk includes react-dom', () => {
    expect(frontendConfigSource).toContain("'react-dom'");
  });

  it('vendor-stellar chunk includes @stellar/stellar-sdk', () => {
    expect(frontendConfigSource).toContain('@stellar/stellar-sdk');
  });

  it('enables gzip and brotli size reporting in the visualizer', () => {
    expect(frontendConfigSource).toContain('gzipSize: true');
    expect(frontendConfigSource).toContain('brotliSize: true');
  });

  it('sets a chunkSizeWarningLimit for the production build', () => {
    expect(frontendConfigSource).toContain('chunkSizeWarningLimit');
  });
});

describe('root vite.config.ts — no duplicated production settings (issue #2044)', () => {
  it('root config does not duplicate manualChunks', () => {
    expect(rootConfigSource).not.toContain('manualChunks');
  });

  it('root config does not duplicate chunkSizeWarningLimit', () => {
    expect(rootConfigSource).not.toContain('chunkSizeWarningLimit');
  });

  it('root config documents that the frontend has its own config', () => {
    expect(rootConfigSource).toContain('frontend/vite.config.ts');
  });
});
