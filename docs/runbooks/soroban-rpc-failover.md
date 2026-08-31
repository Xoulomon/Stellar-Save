# Soroban RPC failover

The backend sends each operation to `STELLAR_RPC_URL` first. If that endpoint
fails, it retries the operation against the comma-separated
`STELLAR_RPC_FALLBACK_URLS` in order. Configure at least one independently
operated staging endpoint.

The Soroban circuit breaker treats the endpoint set as one dependency. A
successful fallback keeps the circuit closed. It opens only when every
configured endpoint fails for the configured volume/error threshold, causing
subsequent calls to fail fast. After `RPC_BREAKER_RESET_TIMEOUT_MS` (30 seconds
by default), one half-open probe is allowed; success closes the circuit.

Expected recovery time is therefore immediate when a fallback is healthy,
plus the failed primary request's network timeout. During a total outage,
automatic recovery is bounded by `RPC_BREAKER_RESET_TIMEOUT_MS` plus one
successful probe. Operators should alert on `circuit_breaker_state` and
`circuit_breaker_trips_total`.

Run the integration test with:

```sh
npm run test:integration -- --runTestsByPath test/integration/rpc-failover.test.ts
```
