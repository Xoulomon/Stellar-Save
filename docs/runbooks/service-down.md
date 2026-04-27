# Runbook: Service Down

**Alert:** `ServiceDown`  
**Severity:** Critical  
**Trigger:** `up{job="stellar-save-backend"} == 0` for > 1 minute

## Immediate Steps

1. Check if the process is running:
   ```bash
   docker ps | grep stellar-save-backend
   # or
   systemctl status stellar-save-backend
   ```

2. Check recent logs for crash reason:
   ```bash
   docker logs --tail 100 stellar-save-backend
   # or Kibana: index=stellar-save-backend-* level=error
   ```

3. Attempt restart:
   ```bash
   docker restart stellar-save-backend
   # Wait 30s, then verify:
   curl http://localhost:3001/api/v2/health
   ```

4. If restart fails, check for port conflict or OOM:
   ```bash
   lsof -i :3001
   dmesg | grep -i oom | tail -20
   ```

## Escalation

- Not resolved in 10 min → page the backend on-call engineer.
- Suspected data corruption → do **not** restart; escalate immediately.

## Post-Incident

- File an incident report within 24 hours.
- Add a test covering the failure mode if one is missing.
