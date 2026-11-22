# Load-test scenarios

Run a scenario with `k6 run tests/load/<file>.js`. Set `BASE_URL` and
`FRONTEND_URL` to a staging-like environment before running. The default profile
ramps to 50 VUs, holds for 3 minutes, then ramps down; use `SCENARIO=smoke` for
the 1-VU, 30-second check or `SCENARIO=stress` for the 200-VU profile where
supported.

| Scenario | File | Endpoints / workload | Load throughput target | Latency target |
|---|---|---|---|---|
| Backend API | [`api.test.js`](./api.test.js) | `GET /api/v1/health`, `GET /api/v1/recommendations/:id`, `GET /api/v1/search`, `POST /api/v1/preferences`, occasional `POST /api/v1/export`, `GET /metrics` | At least 25 counted requests/s for load and stress profiles (`api_request_ops`) | HTTP p95 < 500 ms and p99 < 1,000 ms; error rate < 1% under load |
| Contribution journey | [`contribution.test.js`](./contribution.test.js) | Group list/detail, analytics contribution event, indexed-event query, group stats | More than 50 successful contribution-event writes per load run (`contribution_event_ops`) | Event write p95 < 400 ms / p99 < 800 ms; group reads p95 < 300 ms / p99 < 600 ms; stats p95 < 300 ms |
| Frontend delivery | [`frontend.test.js`](./frontend.test.js) | `/`, `/groups/browse`, `/groups/create`, `/leaderboard`, `/about`, `/vite.svg` | At least 10 page loads/s under load and stress profiles (`page_load_ops`) | Page p95 < 3,000 ms; asset p95 < 1,000 ms; HTTP errors < 1% |
| Event streaming | [`event-streaming.test.js`](./event-streaming.test.js) | SSE `/api/v1/events/groups/:id`, WebSocket `/ws/groups/:id`, reconnect and fan-out | More than 10 events received per run; 20–50 streaming VUs | SSE first event p95 < 500 ms; WebSocket message p95 < 300 ms; setup p95 < 200 ms |
| Keeper / relayer | [`keeper.test.js`](./keeper.test.js) | Health, single/batch payout trigger, payout status, pending-groups queue | More than 50 payout operations per run | Single payout p95 < 800 ms / p99 < 2,000 ms; batch payout p95 < 1,500 ms |

The former `contract.test.js` duplicated the recommendation and preference
requests from the backend API profile. Its unique export and metrics requests
now live in `api.test.js`; the duplicate scenario was removed.

## Backend-specific load checks

These additional scripts live under `backend/tests/load/` and use a distinct
10-VU, 50-second shared profile. They cover workloads not represented by the
five canonical scenarios above.

| Scenario | File | Endpoints / workload | Load throughput target | Latency target |
|---|---|---|---|---|
| Authentication | `backend/tests/load/auth.test.js` | `POST /api/auth/challenge`, `POST /api/auth/verify` | At least 5 requests/s (`auth_request_ops`) at 10 VUs | Shared profile HTTP p95 < 3,000 ms |
| Group browsing | `backend/tests/load/groups.test.js` | `GET /api/v1/groups` with filter/search and `GET /api/v1/groups/:id` | At least 10 requests/s (`group_request_ops`) at 10 VUs | Shared profile HTTP p95 < 3,000 ms |
| Analytics reads | `backend/tests/load/analytics.test.js` | User/group analytics and group stats | At least 5 reads/s (`analytics_read_ops`) at 10 VUs | Shared profile HTTP p95 < 3,000 ms |
| Concurrent deposits | `backend/tests/load/concurrent-deposits.js` | Concurrent contribution POSTs and group-balance reads | 20 simultaneous deposits in the burst, followed by 5 sustained VUs | Deposit p99 < 5,000 ms; HTTP p95 < 3,000 ms; zero balance drift |
| Deadline contributions | `backend/tests/load/deadline-contributions.js` | Synchronized contribution POSTs and balance/payout verification | Configured member-count writes in the burst, ramp, and three-cycle repeat | Contribution p99 < 5,000 ms; HTTP p95 < 3,000 ms; zero balance drift and no duplicate payout |

Analytics reads intentionally omit the group-list request used by group browsing,
so the two backend profiles do not duplicate the same endpoint workload.
