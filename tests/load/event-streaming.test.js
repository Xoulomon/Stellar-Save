/**
 * k6 load + stress test — Event streaming (WebSocket / SSE gateway) — issue #1114
 *
 * Validates the real-time event layer under many concurrent subscribers.
 * Covers:
 *   - SSE endpoint: open a stream, receive at least one event, close cleanly
 *   - WebSocket endpoint: connect, subscribe to a group topic, receive events
 *   - Subscription fan-out: many clients subscribed to the same group
 *   - Cold-start reconnect: drop and re-open connections rapidly
 *
 * SLOs (enforced as k6 thresholds):
 *   - SSE first-event latency p95 < 500 ms
 *   - WebSocket message latency p95 < 300 ms
 *   - Subscription error rate < 1% under load, < 5% under stress
 *   - Connection setup p95 < 200 ms
 *
 * Run:
 *   k6 run tests/load/event-streaming.test.js
 *   k6 run --env SCENARIO=stress tests/load/event-streaming.test.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/event-streaming.test.js
 */
import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';
import { BASE_URL, loadOptions, smokeOptions, stressOptions } from './config.js';

// === Custom metrics

const sseFirstEventLatency  = new Trend('sse_first_event_latency_ms', true);
const wsMessageLatency      = new Trend('ws_message_latency_ms', true);
const connectionSetupTime   = new Trend('stream_connection_setup_ms', true);
const streamErrorRate       = new Rate('stream_error_rate');
const sseConnections        = new Counter('sse_connections_total');
const wsConnections         = new Counter('ws_connections_total');
const eventsReceived        = new Counter('stream_events_received');

// === Options

const SCENARIO = __ENV.SCENARIO || 'load';
const GROUP_COUNT = parseInt(__ENV.GROUP_COUNT || '200');

// SSE gateway is on the same host; WebSocket may use a different port.
const WS_URL = (__ENV.WS_URL || BASE_URL)
  .replace(/^http/, 'ws');

const scenarioOptions = {
  smoke: smokeOptions,
  load: {
    ...loadOptions,
    // Fewer VUs for streaming tests — each connection is long-lived.
    stages: [
      { duration: '30s', target: 20  },
      { duration: '2m',  target: 50  },
      { duration: '30s', target: 0   },
    ],
  },
  stress: {
    ...stressOptions,
    stages: [
      { duration: '1m',  target: 100 },
      { duration: '2m',  target: 200 },
      { duration: '30s', target: 0   },
    ],
  },
};

export const options = {
  ...(scenarioOptions[SCENARIO] || scenarioOptions.load),
  thresholds: {
    sse_first_event_latency_ms:  ['p(95)<500'],
    ws_message_latency_ms:       ['p(95)<300'],
    stream_connection_setup_ms:  ['p(95)<200'],
    stream_error_rate:           SCENARIO === 'stress'
      ? ['rate<0.05']
      : ['rate<0.01'],
    stream_events_received:      ['count>10'],
    http_req_failed:             ['rate<0.01'],
  },
};

const HEADERS = { 'Content-Type': 'application/json' };

// === Helpers

function randomGroupId() {
  return Math.floor(Math.random() * GROUP_COUNT) + 1;
}

// === Test scenarios

export default function () {
  const groupId = randomGroupId();

  // SSE connection: open the stream, wait for at least one event, then close.
  group('SSE subscription', () => {
    const start = Date.now();
    const res = http.get(
      `${BASE_URL}/api/v1/events/groups/${groupId}`,
      {
        headers: { Accept: 'text/event-stream', ...HEADERS },
        // Limit to 5 s so the VU does not block indefinitely waiting for events.
        timeout: '5s',
      },
    );
    const setupMs = Date.now() - start;
    connectionSetupTime.add(setupMs);
    sseConnections.add(1);

    const ok = check(res, {
      'SSE stream opened': (r) => r.status === 200,
      'SSE content-type': (r) =>
        (r.headers['Content-Type'] || '').includes('text/event-stream'),
    });
    streamErrorRate.add(!ok);

    if (ok && res.body && res.body.includes('data:')) {
      sseFirstEventLatency.add(setupMs);
      eventsReceived.add(
        (res.body.match(/^data:/gm) || []).length,
      );
    }
  });

  sleep(0.5);

  // WebSocket connection: connect, subscribe to a group topic, receive events.
  group('WebSocket subscription', () => {
    const url = `${WS_URL}/ws/groups/${groupId}`;
    const start = Date.now();

    const res = ws.connect(url, {}, function (socket) {
      connectionSetupTime.add(Date.now() - start);
      wsConnections.add(1);

      socket.on('open', () => {
        socket.send(
          JSON.stringify({ type: 'subscribe', groupId }),
        );
      });

      socket.on('message', (msg) => {
        const elapsed = Date.now() - start;
        wsMessageLatency.add(elapsed);
        eventsReceived.add(1);

        try {
          const data = JSON.parse(msg);
          check(data, {
            'ws event has type field': (d) => typeof d.type === 'string',
          });
        } catch {
          // Non-JSON frames are valid for ping/pong
        }
      });

      socket.on('error', () => {
        streamErrorRate.add(1);
      });

      // Hold the connection open for 3 s to receive events, then close cleanly.
      socket.setTimeout(() => {
        socket.send(JSON.stringify({ type: 'unsubscribe', groupId }));
        socket.close();
      }, 3000);
    });

    const ok = check(res, {
      'ws connected': (r) => r && r.status === 101,
    });
    streamErrorRate.add(!ok);
  });

  sleep(0.3);

  // Fan-out check: multiple subscribers for the same popular group.
  // 30% of VUs subscribe to group 1 to simulate a high-membership group.
  if (Math.random() < 0.3) {
    group('SSE fan-out — popular group', () => {
      const start = Date.now();
      const res = http.get(
        `${BASE_URL}/api/v1/events/groups/1`,
        {
          headers: { Accept: 'text/event-stream' },
          timeout: '3s',
        },
      );
      connectionSetupTime.add(Date.now() - start);
      sseConnections.add(1);

      const ok = check(res, {
        'fan-out SSE opened': (r) => r.status === 200,
      });
      streamErrorRate.add(!ok);
    });
    sleep(0.2);
  }

  // Reconnect stress: rapidly open and close an SSE stream to test connection churn.
  if (Math.random() < 0.1) {
    group('reconnect churn', () => {
      for (let i = 0; i < 3; i++) {
        const res = http.get(
          `${BASE_URL}/api/v1/events/groups/${randomGroupId()}`,
          {
            headers: { Accept: 'text/event-stream' },
            timeout: '1s',
          },
        );
        const ok = check(res, {
          'reconnect opens': (r) => r.status === 200 || r.status === 503,
        });
        streamErrorRate.add(!ok);
        sleep(0.1);
      }
    });
  }

  sleep(0.5);
}

export function handleSummary(data) {
  return {
    'tests/load/results/event-streaming-summary.json': JSON.stringify(data, null, 2),
  };
}
