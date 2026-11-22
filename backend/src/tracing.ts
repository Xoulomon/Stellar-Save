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
 *
 * Request correlation: `getTraceContext()` returns the active trace/span IDs so
 * the logger can stamp every log line, and `injectTraceHeaders()` forwards the
 * W3C `traceparent`/`tracestate` headers on outgoing RPC, Horizon and webhook
 * calls so a single user action can be followed across services.
 */

import {
  context,
  trace,
  propagation,
  SpanStatusCode,
  type Span,
  type SpanContext,
} from '@opentelemetry/api';

import { config } from './config';
import { logger } from './logger';

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
    // Synchronous `require()` (not a static/dynamic `import`) is deliberate here:
    // it keeps these heavyweight OTel packages truly optional, loaded only on
    // this call path when tracing is actually enabled, and must complete before
    // startTracing() returns so instrumentation patching is in place before the
    // caller's subsequent requires run (see this function's doc comment).
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
    const { resourceFromAttributes } = require('@opentelemetry/resources');
    const {
      ATTR_SERVICE_NAME,
      ATTR_SERVICE_VERSION,
    } = require('@opentelemetry/semantic-conventions');
    const {
      ParentBasedSampler,
      TraceIdRatioBasedSampler,
    } = require('@opentelemetry/sdk-trace-base');
    /* eslint-enable @typescript-eslint/no-require-imports */

    const ratio = config.tracing.samplerArg;
    const sampler = new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(Number.isFinite(ratio) ? ratio : 0.1),
    });

    // OTLP/HTTP exporter. If only a base endpoint is given, the exporter appends
    // the standard /v1/traces path automatically.
    const endpoint =
      config.tracing.otlpTracesEndpoint || config.tracing.otlpEndpoint + '/v1/traces';
    const exporter = new OTLPTraceExporter({ url: endpoint });

    const sdk = new NodeSDK({
      resource: resourceFromAttributes({
        [ATTR_SERVICE_NAME]: SERVICE_NAME,
        [ATTR_SERVICE_VERSION]: config.serviceVersion,
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
    logger.info(
      `[tracing] OpenTelemetry enabled for "${SERVICE_NAME}" ` +
        `(sampler ratio=${ratio}, exporter=OTLP/HTTP)`
    );

    const shutdown = () =>
      sdk
        .shutdown()
        .catch((err: unknown) => logger.error('[tracing] shutdown error', err))
        .finally(() => process.exit(0));
    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
  } catch (err) {
    started = false;
    // Missing optional deps or misconfig must never crash the server.
    logger.warn(
      '[tracing] Failed to initialise OpenTelemetry; continuing without tracing.',
      err instanceof Error ? err.message : err
    );
  }
}

/** Tracer used for manual spans (contract calls, indexer loops, …). */
export function getTracer() {
  return trace.getTracer(SERVICE_NAME);
}

/**
 * Return the active trace/span IDs (if any) so callers — notably the logger —
 * can stamp every log line with the trace context. Returns `undefined` when no
 * span is active (tracing disabled or outside a request).
 */
export function getTraceContext(): { traceId: string; spanId: string } | undefined {
  const spanContext: SpanContext | undefined = trace.getSpan(context.active())?.spanContext();
  if (!spanContext || !spanContext.traceId) return undefined;
  return { traceId: spanContext.traceId, spanId: spanContext.spanId };
}

/**
 * Inject the W3C trace context (`traceparent`/`tracestate`) into an outgoing
 * header bag. Used to propagate correlation on Soroban RPC, Horizon and webhook
 * calls. When tracing is disabled this is a no-op and the headers are returned
 * unchanged, so call sites stay clean.
 */
export function injectTraceHeaders(
  headers: Record<string, string> = {}
): Record<string, string> {
  propagation.inject(context.active(), headers);
  return headers;
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
  fn: (span: Span) => Promise<T>
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
