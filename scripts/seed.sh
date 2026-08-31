#!/bin/sh
# scripts/seed.sh — runs once after the stack is healthy.
# Installs pg client, runs Prisma migrations, and inserts test data.
set -e

echo "[seed] Installing dependencies..."
apk add --no-cache postgresql-client curl

echo "[seed] Running database migrations via backend..."
# Wait until backend responds (depends_on health check should handle this,
# but add an extra poll just in case)
for i in $(seq 1 20); do
  curl -sf "$BACKEND_URL/health" > /dev/null 2>&1 && break
  echo "[seed] Waiting for backend... ($i/20)"
  sleep 3
done

echo "[seed] Inserting seed data..."
psql "$DATABASE_URL" <<'SQL'
-- Idempotent seed: insert only if table is empty

INSERT INTO "ContractEvent" (
  id, "contractId", "eventType", topics, data, "txHash",
  "ledgerSeq", timestamp, "blockTime", "createdAt"
)
SELECT
  'seed-event-1',
  'LOCAL_CONTRACT_PLACEHOLDER',
  'group_created',
  '["group_created","1"]'::jsonb,
  '{"group_id":1,"creator":"GCDEV","contribution_amount":100000000,"max_members":3}'::jsonb,
  'seed-tx-hash-0000000000000001',
  100,
  NOW(),
  NOW(),
  NOW()
WHERE NOT EXISTS (SELECT 1 FROM "ContractEvent" WHERE id = 'seed-event-1');
SQL

echo "[seed] Done. Test data loaded."
