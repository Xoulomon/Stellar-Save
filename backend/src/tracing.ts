/**
 * tracing.ts
 *
 * OpenTelemetry distributed-tracing bootstrap for the Stellar-Save backend.
 *
 * This module MUST be imported *before* any instrumented library (express, http,
 * pg, ioredis, …) so the auto-instrumentations can patch them. It is therefore
 * imported on the very first line of `index.ts`.
 *
 * Tracing is **disabled by default** and only activates when a collector
 * endpoint is configured, so nothing changes when tracing is off (tests, local
 * dev without a collector, etc.).
 *
 * Enable it by setting either:
 *   OTEL_TRACES_ENABLED=true
 *   OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318   (OTLP/HTTP base URL)
 *
 * Spans are exported via OTLP/HTTP to the OpenTelemetry Collector (or directly
 * to Jaeger's OTLP receiver) and propagated across services using the W3C
 * `traceparent` header (the OTel default propagator), giving end-to-end traces.
 *
 * Sampling: a parent-based + trace-id-ratio sampler keeps trace volume sane.
 *   - Honour the upstream sampling decision (parent-based) so a sampled request
 *     from the frontend stays sampled across every service.
 *   - For root spans, sample a configurable ratio (default 10%).
 *   Configure with OTEL_TRACES_SAMPLER_ARG (0.0–1.0).
 */

import { context, trace, SpanStatusCode, type Span } from '@opentelemetry/api';
import { config } from './config';

const SERVICE_NAME = config.tracing.serviceName;

function tracingEnabled(): boolean {
  return config.tracing.enabled || Boolean(config.tracing.otlpEndpoint);
}

let started = false;

/**
 * Initialise the OpenTelemetry Node SDK. Safe to call once; subsequent calls and
 * the disabled path are no-ops. All heavyweight imports are done lazily so that
 * the OTel packages are only required when tracing is actually turned on (keeps
 * the dependency optional / backward-compatible).
 */
export function startTracing(): void {
  if (started || !tracingEnabled()) return;
  started = true;

  try {
    /* eslint-disable @typescript-eslint/no-var-requires */
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const {
      getNodeAutoInstrumentations,
    } = require('@opentelemetry/auto-instrumentations-node');
    const {
      OTLPTraceExporter,
    } = require('@opentelemetry/exporter-trace-otlp-http');
    const { resourceFromAttributes } = require('@opentelemetry/resources');
    const {
      ATTR_SERVICE_NAME,
      ATTR_SERVICE_VERSION,
    } = require('@opentelemetry/semantic-conventions');
    const {
      ParentBasedSampler,
      TraceIdRatioBasedSampler,
    } = require('@opentelemetry/sdk-trace-base');
    /* eslint-enable @typescript-eslint/no-var-requires */

    const ratio = config.tracing.samplerArg;
    const sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 0.1),
    });

    // OTLP/HTTP exporter. If only a base endpoint is given, the exporter appends
    // the standard /v1/traces path automatically.
    const endpoint = process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || config.tracing.otlpEndpoint + '/v1/traces';
    const exporter = new OTLPTraceExporter({ url: endpoint });

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: process.env.npm_package_version || '1.0.0',
      }),
      sampler,
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // fs instrumentation is very noisy and rarely useful — turn it off.
          '@opentelemetry/instrumentation-fs': { enabled: false },
        }),
      ],
    });

    sdk.start();
    // eslint-disable-next-line no-console
    console.log(
      `[tracing] OpenTelemetry enabled for "${SERVICE_NAME}" ` +
        `(sampler ratio=${ratio}, exporter=OTLP/HTTP)`,
    );

    const shutdown = () =>
      sdk
        .shutdown()
        .catch((err: unknown) => console.error('[tracing] shutdown error', err))
        .finally(() => process.exit(0));
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch (err) {
    started = false;
    // Missing optional deps or misconfig must never crash the server.
    // eslint-disable-next-line no-console
    console.warn(
      '[tracing] Failed to initialise OpenTelemetry; continuing without tracing.',
      err instanceof Error ? err.message : err,
    );
  }
}

/** Tracer used for manual spans (contract calls, indexer loops, …). */
export function getTracer() {
  return trace.getTracer(SERVICE_NAME);
}

/**
 * Run `fn` inside a new span. The span is closed automatically and its status is
 * set to ERROR if `fn` throws. When tracing is disabled this is a thin wrapper
 * that just runs `fn`, so call sites stay clean and cheap.
 *
 * @param name  Span name (e.g. `soroban.invoke contribute`)
 * @param attrs Initial span attributes
 * @param fn    The work to trace; receives the active span
 */
export async function withSpan<T>(
  name: string,
  attrs: Record<string, string | number | boolean>,
  fn: (span: Span) => Promise<T>,
): Promise<T> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { attributes: attrs }, async (span) => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err),
      });
      if (err instanceof Error) span.recordException(err);
      throw err;
    } finally {
      span.end();
    }
  });
}

export { context, trace };
