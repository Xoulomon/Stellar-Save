import { describe, expect, it } from 'vitest';

import { getRoutePatterns, paths, routes } from './routes';

describe('routes table', () => {
  it('exposes typed builders for every route', () => {
    expect(paths.home()).toBe(routes.home);
    expect(paths.dashboard()).toBe(routes.dashboard);
    expect(paths.groups()).toBe(routes.groups);
    expect(paths.group('42')).toBe('/groups/42');
    expect(paths.profile()).toBe(routes.profile);
    expect(paths.settings()).toBe(routes.settings);
    expect(paths.transactions()).toBe(routes.transactions);
    expect(paths.transaction('7')).toBe('/transactions/7');
    expect(paths.notFound()).toBe(routes.notFound);
  });

  it('encodes dynamic segments', () => {
    expect(paths.group('a/b')).toBe('/groups/a%2Fb');
    expect(paths.transaction('a b')).toBe('/transactions/a%20b');
  });

  it('lists every route pattern', () => {
    expect(getRoutePatterns()).toEqual(Object.values(routes));
  });
});
