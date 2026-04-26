# Runbook: High Memory Usage

**Alert:** `HighHeapUsage`  
**Severity:** Warning  
**Trigger:** Node.js heap > 85% of total for 5 minutes

## Immediate Steps

1. Check current heap:
   ```bash
   curl http://localhost:3001/metrics | grep nodejs_heap
   ```

2. If heap is still growing, take a heap snapshot (requires `--inspect`):
   ```bash
   kill -USR2 <pid>   # triggers heapdump if heapdump module is loaded
   ```

3. Restart to recover immediately:
   ```bash
   docker restart stellar-save-backend
   ```

4. Common causes:

   | Cause | Fix |
   |-------|-----|
   | Unbounded in-memory cache | Add TTL / max-size to cache |
   | Event listener leak | Audit `on()` calls without `off()` |
   | Large export/backup buffered in RAM | Stream instead of buffer |

## Escalation

- Heap > 95% or OOM kill → page on-call immediately.
- Recurring within 1h of restart → memory leak; escalate to engineering.
