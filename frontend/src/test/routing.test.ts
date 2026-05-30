import { describe, it, expect } from 'vitest';
import { ROUTES, buildRoute } from '../routing/constants';

describe('ROUTES constants', () => {
  it('defines HOME route', () => {
    expect(ROUTES.HOME).toBe('/');
  });

  it('defines DASHBOARD route', () => {
    expect(ROUTES.DASHBOARD).toBe('/dashboard');
  });

  it('defines GROUPS route', () => {
    expect(ROUTES.GROUPS).toBe('/groups');
  });

  it('defines GROUP_DETAIL route with param', () => {
    expect(ROUTES.GROUP_DETAIL).toBe('/groups/:groupId');
  });

  it('defines GROUP_CREATE route', () => {
    expect(ROUTES.GROUP_CREATE).toBe('/groups/create');
  });

  it('defines GROUPS_BROWSE route', () => {
    expect(ROUTES.GROUPS_BROWSE).toBe('/groups/browse');
  });

  it('defines NOT_FOUND route', () => {
    expect(ROUTES.NOT_FOUND).toBe('/404');
  });

  it('defines ERROR route', () => {
    expect(ROUTES.ERROR).toBe('/500');
  });

  it('defines PROFILE_DETAIL route with param', () => {
    expect(ROUTES.PROFILE_DETAIL).toBe('/profile/:address');
  });
});

describe('buildRoute helpers', () => {
  it('builds group detail route with groupId', () => {
    expect(buildRoute.groupDetail('abc-123')).toBe('/groups/abc-123');
  });

  it('handles numeric string groupId', () => {
    expect(buildRoute.groupDetail('42')).toBe('/groups/42');
  });

  it('builds profile route with address', () => {
    expect(buildRoute.profile('GABC1234')).toBe('/profile/GABC1234');
  });
});
