# Migration Cleanup Checklist

This file documents steps to identify and remove unused or superseded migration
scripts and to consolidate the canonical schema documentation.

Checklist
- Inventory migrations: `ls -1 database/migrations`
- Identify squashed or superseded files by comparing with `migrations/README.md` and git history.
- Mark candidates for removal in a temporary branch and run integration tests.
- Update `database/README.md` to reference the current canonical migration and schema generation steps.

Tooling
- Consider using `prisma migrate status` or `diesel` equivalents depending on migration tool.

TODO: remove orphaned files after review.
