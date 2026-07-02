/**
 * tracing.ts
 *
 * Browser distributed-tracing bootstrap (OpenTelemetry Web → OTLP → Jaeger).
 *
 * The frontend is the *start* of a trace: it creates a root span for each user
 * action / page load and injects a W3C `traceparent` header into outgoing
 * `fetch`/XHR calls to the backend. The backend (and downstream indexer /
 * Soroban calls) continue that same trace, so a request can be followed
 * end-to-end by its trace ID.
 *
 * Design goals:
 *  - **Opt-in:** does nothing unless `VITE_OTEL_ENABLED === 'true'`. Disabled by
 *    default so the production bundle and tests are unaffected.
 *  - **Lazy / no bundle bloat:** all `@opentelemetry/*` packages are loaded via
 *    dynamic `import()` so they only enter a chunk that is fetched at runtime
 *    when tracing is on.
 *  - **SSR / test safe:** bails out when `window` is unavailable and never
 *    throws into the caller.
 *
 * Env vars (Vite, must be prefixed with VITE_):
 *   VITE_OTEL_ENABLED=true
 *   VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318   (OTLP/HTTP base URL)
 *   VITE_OTEL_SERVICE_NAME=stellar-save-frontend             (optional)
 *   VITE_OTEL_TRACES_SAMPLER_ARG=0.1                         (root sample ratio)
 *   VITE_OTEL_PROPAGATE_URLS=/api,http://localhost:3001      (CSV of URL prefixes
 *                                                             to attach traceparent to)
 */

let started = false;

function enabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    import.meta.env.VITE_OTEL_ENABLED === 'true'
  );
}

/**
 * Build the list of URL matchers that should receive the `traceparent` header.
 * Defaults to same-origin `/api` calls plus anything in VITE_OTEL_PROPAGATE_URLS.
 */
function propagateUrls(): Array<string | RegExp> {
  const csv =
    (import.meta.env.VITE_OTEL_PROPAGATE_URLS as string | undefined) ?? '/api';
  return csv
    .split(',')
    .map((u) => u.trim())
    .filter(Boolean)
    // Escape for use as a "contains" regex so query strings still match.
    .map((u) => new RegExp(u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
}

/**
 * Initialise web tracing. Safe to call unconditionally and more than once — it
 * is a no-op when disabled or already started, and any failure is swallowed.
 */
export async function startTracing(): Promise<void> {
  if (started || !enabled()) return;
  started = true;

  try {
    const [
      { WebTracerProvider, BatchSpanProcessor, TraceIdRatioBasedSampler, ParentBasedSampler },
      { OTLPTraceExporter },
      { ZoneContextManager },
      { registerInstrumentations },
      { FetchInstrumentation },
      { resourceFromAttributes },
      { ATTR_SERVICE_NAME },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/exporter-trace-otlp-http'),
      import('@opentelemetry/context-zone'),
      import('@opentelemetry/instrumentation'),
      import('@opentelemetry/instrumentation-fetch'),
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
    ]);

    const base =
      (import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT as string | undefined) ??
      'http://localhost:4318';
    const ratio = Number(
      import.meta.env.VITE_OTEL_TRACES_SAMPLER_ARG ?? '0.1',
    );

    const exporter = new OTLPTraceExporter({
      url: `${base.replace(/\/$/, '')}/v1/traces`,
    });

    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]:
          (import.meta.env.VITE_OTEL_SERVICE_NAME as string | undefined) ??
          'stellar-save-frontend',
      }),
      sampler: new ParentBasedSampler({
        root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 0.1),
      }),
      spanProcessors: [new BatchSpanProcessor(exporter)],
    });

    provider.register({ contextManager: new ZoneContextManager() });

    registerInstrumentations({
      instrumentations: [
        new FetchInstrumentation({
          // Attach traceparent to backend calls so traces link end-to-end.
          propagateTraceHeaderCorsUrls: propagateUrls(),
          clearTimingResources: true,
        }),
      ],
    });

    // eslint-disable-next-line no-console
    console.info(
      `[tracing] OpenTelemetry web tracing enabled (sampler ratio=${ratio})`,
    );
  } catch (err) {
    started = false;
    // eslint-disable-next-line no-console
    console.warn('[tracing] web tracing init failed; continuing without it', err);
  }
}
