import type { Request, Response, NextFunction } from 'express';

export const SUPPORTED_VERSIONS = ['v1', 'v2'] as const;
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

export const DEPRECATED_VERSIONS: Partial<
  Record<ApiVersion, { sunsetDate: string; message: string }>
> = {
  v1: {
    sunsetDate: '2027-01-01',
    message: 'API v1 is deprecated. Please migrate to v2. See /docs/api-versioning.md',
  },
};

/**
 * Route inventory for the v1 surface.
 *
 * Every route exposed by `backend/src/routes/v1.ts` is listed here with its
 * documented status. Routes that have a v2 equivalent are marked `deprecated`
 * and emit `Deprecation` / `Sunset` headers; routes without a v2 equivalent
 * remain `supported` until a replacement ships.
 *
 * See `docs/api/versioning.md` for the full sunset plan.
 */
export interface RouteStatus {
  /** HTTP method, e.g. `GET`. */
  method: string;
  /** Path relative to the version prefix, e.g. `/export`. */
  path: string;
  /** `deprecated` when a v2 equivalent exists, otherwise `supported`. */
  status: 'deprecated' | 'supported';
  /** The v2 equivalent path, if any. */
  v2Equivalent?: string;
}

export const V1_ROUTE_INVENTORY: readonly RouteStatus[] = [
  { method: 'GET', path: '/export', status: 'supported' },
  { method: 'GET', path: '/backup', status: 'supported' },
  { method: 'POST', path: '/admin/groups/:id/flag', status: 'supported' },
];

/** Returns the inventory entry for a v1 route, if documented. */
export function getV1RouteStatus(method: string, path: string): RouteStatus | undefined {
  return V1_ROUTE_INVENTORY.find(
    (route) => route.method === method.toUpperCase() && route.path === path,
  );
}

/**
 * Marks a v1 route as deprecated by emitting `Deprecation` and `Sunset`
 * response headers. Used by v1 routes that have a v2 equivalent.
 */
export function markRouteDeprecated(res: Response, v2Equivalent: string): void {
  const deprecation = DEPRECATED_VERSIONS.v1;
  const sunsetDate = deprecation?.sunsetDate ?? '2027-01-01';
  res.setHeader('Deprecation', 'true');
  res.setHeader('Sunset', sunsetDate);
  res.setHeader(
    'Link',
    `<${v2Equivalent}>; rel="successor-version"`,
  );
  res.setHeader(
    'X-API-Deprecation-Notice',
    deprecation?.message ?? 'API v1 is deprecated. Please migrate to v2.',
  );
}

/** Extracts the version from the URL path (e.g. /api/v1/...) and attaches it to req. */
export function versionMiddleware(req: Request, res: Response, next: NextFunction): void {
  const match = req.path.match(/^\/api\/(v\d+)\//);
  const version = (match?.[1] ?? 'v1') as ApiVersion;

  if (!SUPPORTED_VERSIONS.includes(version)) {
    res.status(400).json({
      error: `Unsupported API version "${version}". Supported: ${SUPPORTED_VERSIONS.join(', ')}`,
    });
    return;
  }

  const deprecation = DEPRECATED_VERSIONS[version];
  if (deprecation) {
    res.setHeader('Deprecation', 'true');
    res.setHeader('Sunset', deprecation.sunsetDate);
    res.setHeader('X-API-Deprecation-Notice', deprecation.message);
  }

  res.setHeader('X-API-Version', version);
  (req as Request & { apiVersion: ApiVersion }).apiVersion = version;
  next();
}

/** Returns a 410 Gone response for a fully removed version. */
export function removedVersionHandler(_req: Request, res: Response): void {
  res.status(410).json({ error: 'This API version has been removed. Please upgrade.' });
}
