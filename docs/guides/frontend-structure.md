# Frontend component structure

Organize components by product domain, then by component. Keep each component's implementation, public entry point, and focused tests together:

```text
src/components/<domain>/<ComponentName>/
├── <ComponentName>.tsx
├── <ComponentName>.test.tsx
├── index.ts
└── types.ts              # when the component exposes domain-specific types
```

Use `index.ts` as the stable import surface. Import components and shared UI through the `@/` alias (mapped to `src/`) rather than relative paths across component or domain boundaries. Relative imports are appropriate within a component folder.

Keep page-level and cross-domain tests in `src/test/`; component-specific tests belong beside their component. When migrating a domain, move its component tests with the components and update imports in the same change. Migrate one domain per pull request, beginning with the largest remaining component domain, so reviewers can verify each move independently.

The landing domain is the first migrated example. Its components each have a folder, barrel export, and colocated test. `LandingNav/types.ts` demonstrates where component-specific public types live; components without public types do not need an empty `types.ts` file.
