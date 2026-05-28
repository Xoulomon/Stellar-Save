# Runbook: High Latency

**Alert:** `HighP95Latency`  
**Severity:** Warning  
**Trigger:** P95 response time > 2s for 5 minutes

## Immediate Steps

1. Identify slow routes:
   ```promql
   histogram_quantile(0.95,
     sum by (le, route) (rate(http_request_duration_seconds_bucket[5m]))
   )
   ```

2. Check Node.js event loop lag and heap:
   ```
   Grafana → Backend dashboard → "Heap Used" panel
   ```

3. Common causes:

   | Symptom | Likely cause | Fix |
   |---------|-------------|-----|
   | `/search` slow | Elasticsearch overloaded | Scale ES or reduce query complexity |
   | `/recommendations` slow | Large dataset in memory | Paginate or cache results |
   | All routes slow | High heap / GC pressure | Restart; investigate memory leak |
   | Spike at specific time | Scheduled backup/export | Stagger cron jobs |

4. Restart if GC pressure is confirmed:
   ```bash
   docker restart stellar-save-backend
   ```

## Escalation

- P95 > 5s → page on-call.
- Latency correlated with backup jobs → see backup-failure runbook.
