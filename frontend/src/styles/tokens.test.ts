import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

describe('index.css design tokens', () => {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  const declared = [...new Set([...css.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]))];
  const corpus = walk(SRC).map((f) => readFileSync(f, 'utf8')).join('\n');

  it('declares tokens', () => {
    expect(declared.length).toBeGreaterThan(0);
  });

  it('has no unused custom properties', () => {
    const unused = declared.filter((token) => {
      const escaped = token.replace(/[-]/g, '\\-');
      const uses = corpus.match(new RegExp(`${escaped}(?![\\w-])`, 'g')) ?? [];
      const decls = corpus.match(new RegExp(`${escaped}\\s*:`, 'g')) ?? [];
      return uses.length - decls.length <= 0;
    });
    expect(unused).toEqual([]);
  });

  it('does not duplicate token declarations within a theme block', () => {
    const root = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));
    const names = [...root.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]);
    expect(names.length).toBe(new Set(names).size);
  });
});
