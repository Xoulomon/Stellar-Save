# Contract Event Indexer

The Contract Event Indexer is a service that indexes Stellar-Save contract events from the Horizon API for faster queries.

## Overview

The indexer connects to Stellar Horizon API, streams contract events in real-time, and stores them in a PostgreSQL database for efficient querying.

## Architecture

- **Data Source**: Stellar Horizon API `/events` endpoint
- **Database**: PostgreSQL with Prisma ORM
- **API**: REST endpoints for querying indexed events
- **Streaming**: Continuous polling of new events

## Database Schema

```sql
model ContractEvent {
  id          String   @id @default(cuid())
  contractId  String
  eventType   String
  topics      Json     // Array of event topics
  data        Json     // Event data payload
  txHash      String
  ledgerSeq   Int
  timestamp   DateTime
  blockTime   DateTime
  createdAt   DateTime @default(now())

  @@index([contractId])
  @@index([eventType])
  @@index([ledgerSeq])
  @@index([timestamp])
}
```

## API Endpoints

### Get Events

```
GET /api/v1/events
```

Query parameters:
- `contractId`: Filter by contract ID
- `eventType`: Filter by event type
- `startLedger`: Filter events from ledger sequence
- `endLedger`: Filter events to ledger sequence
- `startTime`: Filter events from timestamp (ISO string)
- `endTime`: Filter events to timestamp (ISO string)
- `limit`: Maximum number of events to return (default: 50)
- `offset`: Number of events to skip (default: 0)

Response:
```json
{
  "events": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Get Event Statistics

```
GET /api/v1/events/stats
```

Query parameters:
- `contractId`: Filter statistics by contract ID

Response:
```json
{
  "totalEvents": 1000,
  "eventTypeBreakdown": [
    { "type": "contribution_made", "count": 600 },
    { "type": "payout_distributed", "count": 400 }
  ]
}
```

## Configuration

Environment variables:

- `HORIZON_URL`: Horizon API URL (default: https://horizon-testnet.stellar.org)
- `CONTRACT_ID`: Contract ID to index events for
- `DATABASE_URL`: PostgreSQL connection string
- `INDEXER_ENABLED`: Enable/disable the indexer (default: true)

## Usage

1. Set up PostgreSQL database
2. Configure environment variables
3. Run database migrations: `npx prisma migrate dev`
4. Start the backend service
5. The indexer will automatically start streaming events

## Testing

Run indexer tests:
```bash
npm test src/tests/indexer.test.ts
```

## Implementation Notes

- Events are polled from Horizon API every 5 seconds when no new events are found
- Failed API calls retry after 10 seconds
- Events are stored with UTC timestamps
- The indexer supports resuming from a specific ledger sequence
- Database indexes are created for efficient querying by contract, type, ledger, and timestamp