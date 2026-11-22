#!/usr/bin/env tsx
/**
 * scripts/generate-api-reference.ts
 *
 * Reads backend/openapi.yaml and generates docs/api/README.md so the
 * published reference can never drift from the spec.
 *
 * Usage:
 *   npx tsx scripts/generate-api-reference.ts           # generate
 *   npx tsx scripts/generate-api-reference.ts --check    # CI mode: exit 1 if stale
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { load } from 'js-yaml';

const ROOT = resolve(__dirname, '..');
const OPENAPI_PATH = join(ROOT, 'backend', 'openapi.yaml');
const OUTPUT_DIR = join(ROOT, 'docs', 'api');
const OUTPUT_PATH = join(OUTPUT_DIR, 'README.md');

interface PathItem {
  [method: string]: OperationObject | undefined;
}

interface OperationObject {
  tags?: string[];
  summary?: string;
  description?: string;
  operationId?: string;
  security?: Record<string, string[]>[];
  'x-status'?: 'current' | 'deprecated' | 'internal-only';
  'x-replacement'?: string;
}

interface OpenApiSpec {
  info: { title: string; version: string; description?: string };
  tags?: { name: string; description?: string }[];
  paths: Record<string, PathItem>;
  components?: {
    securitySchemes?: Record<string, { type: string; scheme?: string; name?: string; in?: string }>;
  };
}

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head'] as const;

function loadSpec(): OpenApiSpec {
  const raw = readFileSync(OPENAPI_PATH, 'utf8');
  return load(raw) as OpenApiSpec;
}

function resolveAuth(op: OperationObject): string {
  if (!op.security || op.security.length === 0) return '—';
  const schemes = op.security.flatMap((s) => Object.keys(s));
  if (schemes.includes('bearerAuth')) return 'JWT';
  if (schemes.includes('apiKeyAuth')) return 'API Key';
  return schemes.join(', ');
}

function resolveStatus(op: OperationObject): string {
  return op['x-status'] ?? 'current';
}

interface EndpointRow {
  method: string;
  path: string;
  auth: string;
  status: string;
  tag: string;
  replacement?: string;
}

function collectEndpoints(spec: OpenApiSpec): EndpointRow[] {
  const rows: EndpointRow[] = [];
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const op = pathItem[method] as OperationObject | undefined;
      if (!op) continue;
      const tag = op.tags?.[0] ?? 'Other';
      rows.push({
        method: method.toUpperCase(),
        path,
        auth: resolveAuth(op),
        status: resolveStatus(op),
        tag,
        replacement: op['x-replacement'],
      });
    }
  }
  return rows;
}

function generateMarkdown(spec: OpenApiSpec, endpoints: EndpointRow[]): string {
  const lines: string[] = [];

  lines.push('# Stellar-Save API Reference');
  lines.push('');
  lines.push('> **Source of truth:** [`backend/openapi.yaml`](../../backend/openapi.yaml)');
  lines.push('>');
  lines.push('> This file is **generated** — do not edit by hand.');
  lines.push('> Run `npx tsx scripts/generate-api-reference.ts` to regenerate it.');
  lines.push('');

  // Overview from spec description
  lines.push('## Overview');
  lines.push('');
  if (spec.info.description) {
    lines.push(spec.info.description.trim());
    lines.push('');
  }
  lines.push('---');
  lines.push('');

  // Authentication
  lines.push('## Authentication');
  lines.push('');
  lines.push('| Method | Header | Issued by |');
  lines.push('|--------|--------|-----------|');
  lines.push('| **Bearer JWT** | `Authorization: Bearer <token>` | `POST /api/auth/verify` |');
  lines.push('| **API Key** | `X-API-Key: <key>` | `POST /api/v1/api-keys` |');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Versioning
  lines.push('## Versioning');
  lines.push('');
  lines.push('| Version | Prefix | Status |');
  lines.push('|---------|--------|--------|');
  lines.push('| **v2** | `/api/v2/` | **Current** — active development |');
  lines.push('| **v1** | `/api/v1/` | **Deprecated** — sunset 2027-01-01 |');
  lines.push('| _(none)_ | `/api/` | Legacy unversioned paths — will be removed with v1 |');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Error envelope
  lines.push('## Error Envelope');
  lines.push('');
  lines.push('All error responses use a consistent JSON shape:');
  lines.push('');
  lines.push('```json');
  lines.push('{');
  lines.push('  "error": "ERROR_CODE",');
  lines.push('  "message": "Human-readable description",');
  lines.push('  "statusCode": 400,');
  lines.push('  "details": {}');
  lines.push('}');
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Status key
  lines.push('## Endpoint Status Key');
  lines.push('');
  lines.push('| Badge | Meaning |');
  lines.push('|-------|---------|');
  lines.push('| **current** | Stable, production-ready |');
  lines.push('| **deprecated** | Will be removed; use the listed replacement |');
  lines.push('| **internal-only** | Not for external consumers — admin or system use |');
  lines.push('');
  lines.push('---');
  lines.push('');

  // Group by tag
  const byTag = new Map<string, EndpointRow[]>();
  for (const row of endpoints) {
    if (!byTag.has(row.tag)) byTag.set(row.tag, []);
    byTag.get(row.tag)!.push(row);
  }

  lines.push('## Endpoints');
  lines.push('');

  for (const [tag, rows] of byTag) {
    lines.push(`### ${tag}`);
    lines.push('');
    lines.push('| Method | Path | Auth | Status |');
    lines.push('|--------|------|------|--------|');
    for (const r of rows) {
      lines.push(`| ${r.method} | \`${r.path}\` | ${r.auth} | ${r.status} |`);
    }
    lines.push('');
  }

  // Deprecated migration guide
  const deprecated = endpoints.filter((e) => e.status === 'deprecated');
  if (deprecated.length > 0) {
    lines.push('---');
    lines.push('');
    lines.push('## Deprecated Endpoints — Migration Guide');
    lines.push('');
    lines.push('| Deprecated | Replacement | Sunset |');
    lines.push('|-----------|-------------|--------|');
    for (const d of deprecated) {
      const repl = d.replacement ?? '_(see v2 equivalent)_';
      lines.push(`| \`${d.method} ${d.path}\` | ${repl} | 2027-01-01 |`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

function main(): void {
  const checkMode = process.argv.includes('--check');

  if (!existsSync(OPENAPI_PATH)) {
    console.error(`ERROR: ${OPENAPI_PATH} not found`);
    process.exit(1);
  }

  const spec = loadSpec();
  const endpoints = collectEndpoints(spec);
  const markdown = generateMarkdown(spec, endpoints);

  console.log(`Parsed ${Object.keys(spec.paths).length} paths, ${endpoints.length} operations`);

  if (checkMode) {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`ERROR: ${OUTPUT_PATH} does not exist. Run without --check first.`);
      process.exit(1);
    }
    const existing = readFileSync(OUTPUT_PATH, 'utf8');
    if (existing !== markdown) {
      console.error('ERROR: docs/api/README.md is out of date. Run:');
      console.error('  npx tsx scripts/generate-api-reference.ts');
      process.exit(1);
    }
    console.log('docs/api/README.md is up to date.');
    return;
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, markdown, 'utf8');
  console.log(`Wrote ${OUTPUT_PATH}`);
}

main();
