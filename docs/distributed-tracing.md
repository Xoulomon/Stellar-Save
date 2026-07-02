# Distributed Tracing

Stellar-Save is instrumented with [OpenTelemetry](https://opentelemetry.io/)
distributed tracing so a single user request can be followed **end-to-end**
across every service — browser → backend API → indexer → Soroban contract
execution — and its latency broken down per service and per endpoint.

Traces are exported via **OTLP** to a centralised **OpenTelemetry Collector**,
which forwards them to **Jaeger** for storage and visualisation. Grafana also
queries Jaeger for latency dashboards.

> Tracing is **disabled by default** in every service. Nothing changes (bundle
> size, behaviour, tests) until you explicitly enable it and point it at a
> collector. This keeps the instrumentation backward-compatible.

---

## Architecture

```
                         W3C traceparent header propagated on every hop
   ┌───────────┐   fetch   ┌───────────┐   span    ┌──────────────┐
   │ Frontend  │ ────────▶ │  Backend  │ ────────▶ │  Indexer +   │
   │ (browser) │           │ (Express) │           │ Soroban RPC  │
   └─────┬─────┘           └─────┬─────┘           └──────┬───────┘
         │ OTLP/HTTP             │ OTLP/HTTP              │ OTLP/HTTP
         └──────────────┬───────┴────────────────────────┘
                        ▼
              ┌────────────────────┐   OTLP    ┌──────────┐
              │ OpenTelemetry      │ ────────▶ │  Jaeger  │ ◀── Grafana
              │ Collector (:4318)  │           │ (:16686) │     dashboards
              └────────────────────┘           └──────────┘
```

- **Frontend** (`frontend/src/lib/tracing.ts`) — `@opentelemetry/sdk-trace-web`
  creates a root span per page load / user action and injects a `traceparent`
  header into `fetch`/XHR calls to the backend.
- **Backend** (`backend/src/tracing.ts`) — `@opentelemetry/sdk-node` auto-
  instruments Express/HTTP/PG, continuing the trace from the incoming
  `traceparent` and propagating it on outbound calls.
- **Indexer** (`backend/src/contract_event_indexer.ts`) — manual spans around
  each poll iteration, event processing, and DB write.
- **Contract execution** (`backend/src/lib/soroban.ts`) — each Soroban
  simulate/invoke RPC call is wrapped in a span labelled with the contract
  function name.

---

## Contract-tracing limitation

Full in-wasm OpenTelemetry tracing is **not feasible** inside a Soroban
contract: guest code runs in a sandboxed, deterministic host with no clock,
network, or thread-locals, so it cannot emit OTLP spans or read/write a W3C
`traceparent`. Instead, distributed tracing for contract execution is done
**host-side**: wherever the backend or indexer invokes/simulates a contract
call (`SorobanClientPool.withClient(fn, op)`), the call is wrapped in a span
carrying the contract function name and the active trace context. This gives a
latency datapoint for "time spent executing the contract via RPC" within the
larger request trace. A `host-tracing` Cargo feature is reserved for optional
lightweight tracing in the **native** (testutils / off-chain simulation) build
only; it is never compiled into the on-chain wasm build.

---

## Running Jaeger locally

The collector, Jaeger, and Grafana are part of the monitoring stack:

```bash
cd monitoring
docker compose up -d jaeger otel-collector grafana
```

Endpoints:

| Service                  | URL                       | Purpose                          |
| ------------------------ | ------------------------- | -------------------------------- |
| Jaeger UI                | http://localhost:16686    | Search & view traces             |
| OTLP/HTTP (collector)    | http://localhost:4318     | Apps/browser send spans here     |
| OTLP/gRPC (collector)    | http://localhost:4317     | gRPC span ingestion              |
| Grafana                  | http://localhost:3000     | Latency dashboards (Jaeger DS)   |

The Grafana **Jaeger** datasource and the **Stellar-Save Distributed Tracing**
dashboard are auto-provisioned
(`monitoring/grafana/provisioning/`, `monitoring/grafana/dashboards/distributed-tracing.json`).

---

## Enabling tracing in each service

### Backend / Indexer

Set in `backend/.env` (see `backend/.env.example`):

```bash
OTEL_TRACES_ENABLED=true
OTEL_SERVICE_NAME=stellar-save-backend
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318   # /v1/traces appended automatically
OTEL_TRACES_SAMPLER_ARG=0.1                          # 10% root sampling
```

Install the OpenTelemetry packages (already listed in `backend/package.json`):

```bash
cd backend && npm install
```

`startTracing()` is the first thing called in `backend/src/index.ts`, so the
auto-instrumentations patch Express/HTTP/PG before they load.

### Frontend

Set in `.env` (Vite, see `.env.example`):

```bash
VITE_OTEL_ENABLED=true
VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318
VITE_OTEL_SERVICE_NAME=stellar-save-frontend
VITE_OTEL_TRACES_SAMPLER_ARG=0.1
VITE_OTEL_PROPAGATE_URLS=/api,http://localhost:3001  # where to attach traceparent
```

```bash
cd frontend && npm install
```

The OTel web packages are loaded via dynamic `import()` and only when
`VITE_OTEL_ENABLED=true`, so they never enter the default production bundle.

---

## Sampling strategy

Each service uses a **parent-based + trace-id-ratio** sampler:

- **Parent-based**: if an incoming request already carries a sampling decision
  (via `traceparent`), it is honoured. This is what keeps a single request
  consistently sampled (or not) across *all* services, avoiding partial traces.
- **Trace-id-ratio (root)**: for requests that *start* a trace, a configurable
  fraction is sampled. Default **0.1 (10%)**, set via `OTEL_TRACES_SAMPLER_ARG`
  / `VITE_OTEL_TRACES_SAMPLER_ARG`.

A second, defence-in-depth `probabilistic_sampler` runs in the collector
(`monitoring/otel-collector/config.yaml`); lower its `sampling_percentage` to
shed more load centrally without redeploying services.

Tune the ratio up (toward 1.0) in dev for full visibility, and down in
production to protect the trace store.

---

## Tracing a request end-to-end by trace ID

1. Make a request from the browser with tracing enabled (e.g. load a page that
   calls the backend API).
2. Grab the trace ID. Options:
   - Open browser devtools → Network → a backend request → look at the
     `traceparent` request header: `00-<trace-id>-<span-id>-01`. The middle
     segment is the **trace ID**.
   - Or just search by service/operation in Jaeger / the Grafana dashboard.
3. In **Jaeger UI** (http://localhost:16686), paste the trace ID in *Lookup by
   Trace ID*, or in the **Grafana** "Trace lookup by ID" panel.
4. You'll see the full waterfall:
   `frontend HTTP GET` → `backend GET /api/...` → `indexer.*` / `soroban.invoke
   <fn>` → `db.insert_event`, with the latency contributed by each service.

Because every hop propagates the same W3C `traceparent`, the trace ID is stable
across all services.

---

## Files

| Area      | File                                                        |
| --------- | ----------------------------------------------------------- |
| Backend   | `backend/src/tracing.ts`, wired in `backend/src/index.ts`   |
| Contract  | spans in `backend/src/lib/soroban.ts`                       |
| Indexer   | spans in `backend/src/contract_event_indexer.ts`            |
| Frontend  | `frontend/src/lib/tracing.ts`, wired in `frontend/src/main.tsx` |
| Collector | `monitoring/otel-collector/config.yaml`                     |
| Jaeger    | `monitoring/docker-compose.yml`                             |
| Dashboard | `monitoring/grafana/dashboards/distributed-tracing.json`    |
| Datasource| `monitoring/grafana/provisioning/datasources/datasources.yml` |
