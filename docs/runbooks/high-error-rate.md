# Runbook: High Error Rate

**Alerts:** `HighErrorRate` (>5%), `CriticalErrorRate` (>20%)  
**Severity:** Warning / Critical  
**Trigger:** 5xx rate over 5-minute window exceeds threshold

## Immediate Steps

1. Identify which routes are erroring:
   ```
   Grafana → Backend dashboard → "Error Rate" panel → break down by route
   ```
   Or in Prometheus:
   ```promql
   topk(5, sum by (route) (rate(http_requests_total{status_code=~"5.."}[5m])))
   ```

2. Check logs for the error detail:
   ```bash
   docker logs --tail 200 stellar-save-backend 2>&1 | grep '"level":"error"'
   # Kibana: level=error AND service=stellar-save-backend
   ```

3. Common causes and fixes:

   | Symptom | Likely cause | Fix |
   |---------|-------------|-----|
   | `/backup` 500s | S3 unreachable | Check `BACKUP_S3_*` env vars; verify S3 bucket |
   | `/export` 500s | Email service down | Check `EMAIL_*` env vars |
   | All routes 500 | DB/dependency crash | Restart dependency, then backend |
   | Spike then recovery | Transient timeout | Monitor; no action if self-resolved |

4. If a bad deploy caused the spike, roll back:
   ```bash
   docker pull stellar-save-backend:<previous-tag>
   docker restart stellar-save-backend
   ```

## Escalation

- CriticalErrorRate firing for > 5 min → page on-call.
- Revenue-impacting routes (backup, export) → escalate immediately.

## Post-Incident

- Identify root cause and add regression test.
- Update alert thresholds if they were too sensitive.
