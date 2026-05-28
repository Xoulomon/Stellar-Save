import { Request, Response, NextFunction } from 'express';

export const SUPPORTED_VERSIONS = ['v1', 'v2'] as const;
export type ApiVersion = (typeof SUPPORTED_VERSIONS)[number];

export const DEPRECATED_VERSIONS: Partial<Record<ApiVersion, { sunsetDate: string; message: string }>> = {
  v1: {
    sunsetDate: '2027-01-01',
    message: 'API v1 is deprecated. Please migrate to v2. See /docs/api-versioning.md',
  },
};

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
