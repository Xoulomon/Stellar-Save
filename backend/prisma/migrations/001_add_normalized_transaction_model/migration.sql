-- Add normalized Transaction model to separate business logic from on-chain data.
-- Issue #1508: Prevents denormalization drift between transaction types.

CREATE TABLE "transaction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "stellarTxHash" TEXT,
  "rampTxId" TEXT,
  "groupId" TEXT,
  "userId" TEXT,
  "walletAddress" TEXT,
  "amountStroops" BIGINT NOT NULL DEFAULT 0,
  "amountXlm" DECIMAL(18,8) NOT NULL,
  "feePaid" INTEGER NOT NULL DEFAULT 0,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmedAt" TIMESTAMP(3),
  "settledAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  UNIQUE("stellarTxHash"),
  UNIQUE("rampTxId")
);

CREATE INDEX "transaction_userId_idx" ON "transaction"("userId");
CREATE INDEX "transaction_groupId_idx" ON "transaction"("groupId");
CREATE INDEX "transaction_walletAddress_idx" ON "transaction"("walletAddress");
CREATE INDEX "transaction_type_idx" ON "transaction"("type");
CREATE INDEX "transaction_status_idx" ON "transaction"("status");
CREATE INDEX "transaction_createdAt_idx" ON "transaction"("createdAt");
CREATE INDEX "transaction_confirmedAt_idx" ON "transaction"("confirmedAt");

COMMENT ON TABLE "transaction" IS 'Normalized transaction records. Separates business logic (amount, status, participants) from on-chain data (linked via stellarTxHash or rampTxId).';
COMMENT ON COLUMN "transaction"."type" IS 'contribution | payout | ramp-deposit | ramp-withdraw';
COMMENT ON COLUMN "transaction"."status" IS 'pending | confirmed | failed | reverted';
COMMENT ON COLUMN "transaction"."amountStroops" IS 'Canonical amount in Stroops (1 XLM = 10M stroops). Use this for calculations.';
COMMENT ON COLUMN "transaction"."amountXlm" IS 'Human-readable amount for display. Derived from amountStroops.';
