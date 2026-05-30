# ADR-003: Backend Event Indexing Approach vs. Pure On-Chain Queries

**Status**: Accepted  
**Date**: 2026-05-29  
**Author**: Stellar-Save Team  
**Deciders**: Architecture & Backend Team

## Context

The frontend needs to display transaction history, group statistics, and member activity. This data is stored on-chain in Stellar, but querying it directly has performance implications:

- **Pure on-chain queries**: Query Stellar Horizon API directly for each request
- **Backend indexing**: Run an indexer service that caches events in a database

The team needed to decide on the architecture for serving historical data to the frontend.

### Alternatives Considered

1. **Pure On-Chain Queries (Horizon API)**
   - Query Stellar Horizon API directly for events
   - No additional infrastructure
   - Always fresh data
   - Slower queries (1-5 seconds per request)
   - Limited filtering and aggregation capabilities
   - Rate-limited by Horizon API

2. **Backend Event Indexer (Chosen)**
   - Run indexer service that streams events from Horizon
   - Store events in PostgreSQL database
   - Provide REST API for fast queries
   - Requires additional infrastructure
   - Slightly delayed data (5-10 seconds behind)
   - Unlimited query capabilities

3. **Hybrid Approach**
   - Use indexer for historical data
   - Query Horizon for real-time data
   - Best of both worlds
   - Increased complexity
   - Potential for data inconsistencies

4. **GraphQL Endpoint**
   - Use GraphQL for flexible queries
   - Better developer experience
   - Requires GraphQL server
   - Additional complexity
   - Overkill for current use cases

## Decision

**Implement a backend event indexer with PostgreSQL database.**

The indexer streams events from Stellar Horizon API and stores them in a database, providing a fast REST API for the frontend to query historical data.

## Rationale

### 1. **Performance**
- Horizon API queries: 1-5 seconds per request
- Indexed database queries: 50-200ms per request
- **Impact**: 10-50x faster response times
- **Benefit**: Better user experience, especially on slow networks

### 2. **Scalability**
- Horizon API has rate limits (~3600 requests/hour)
- Database can handle unlimited queries
- **Impact**: Can support many concurrent users
- **Benefit**: Scales with user growth without infrastructure changes

### 3. **Filtering and Aggregation**
- Horizon API has limited filtering capabilities
- Database enables complex queries (by date, type, amount, etc.)
- **Impact**: Rich analytics and reporting features
- **Benefit**: Better insights for users and platform operators

### 4. **Offline Resilience**
- If Horizon API is temporarily down, indexed data still available
- Horizon API issues don't affect user experience
- **Impact**: Improved reliability
- **Benefit**: Better uptime and user trust

### 5. **Cost Efficiency**
- Fewer Horizon API calls = lower bandwidth costs
- Cached data reduces redundant queries
- **Impact**: Lower operational costs
- **Benefit**: More sustainable long-term

### 6. **Data Consistency**
- Single source of truth for historical data
- Easier to implement caching strategies
- Simpler to add derived data (statistics, aggregations)
- **Impact**: Fewer bugs and inconsistencies
- **Benefit**: More reliable platform

## Consequences

### Positive
- ✅ 10-50x faster queries
- ✅ Unlimited query capabilities
- ✅ Better scalability for concurrent users
- ✅ Offline resilience
- ✅ Enables rich analytics and reporting
- ✅ Lower operational costs
- ✅ Single source of truth for historical data

### Negative
- ❌ Requires additional infrastructure (PostgreSQL, indexer service)
- ❌ Data is 5-10 seconds behind real-time
- ❌ Additional operational complexity
- ❌ Potential for indexer failures
- ❌ Database maintenance and backups required
- ❌ Increased deployment complexity

### Mitigation
- Use managed PostgreSQL service (AWS RDS, Heroku, etc.)
- Implement health checks and alerting for indexer
- Automatic recovery and resume from last indexed ledger
- Regular backups and disaster recovery procedures
- Monitor indexer lag and alert if > 30 seconds

## Implementation Details

### Architecture
```
Stellar Horizon API
        ↓
   Indexer Service
        ↓
   PostgreSQL Database
        ↓
   REST API
        ↓
   Frontend
```

### Database Schema
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

### Indexer Service
- Polls Horizon API every 5 seconds
- Streams events in real-time
- Stores events in PostgreSQL
- Tracks last indexed ledger for recovery
- Implements exponential backoff for failures

### REST API Endpoints
```
GET /api/v1/events
  - Filter by contractId, eventType, timestamp range
  - Pagination support
  - Response time: 50-200ms

GET /api/v1/events/stats
  - Event type breakdown
  - Time-series aggregations
  - Response time: 100-500ms
```

## Deployment

### Development
- Use local PostgreSQL or Docker container
- Indexer runs locally
- API runs on localhost:3000

### Production
- Use managed PostgreSQL (AWS RDS, Heroku, etc.)
- Deploy indexer as background service
- Deploy API as containerized service
- Use load balancer for API scaling

## Monitoring

- Track indexer lag (should be < 30 seconds)
- Monitor database query performance
- Alert on indexer failures
- Track API response times
- Monitor database disk usage

## Future Considerations

- **v2.0**: Add GraphQL endpoint for more flexible queries
- **v2.0**: Implement caching layer (Redis) for common queries
- **v2.0**: Add real-time WebSocket subscriptions
- **v3.0**: Implement data warehouse for analytics
- **v3.0**: Add machine learning for fraud detection

## Related Decisions

- ADR-001: Choice of Soroban platform
- ADR-002: Sequential payout order design

## References

- [Stellar Horizon API](https://developers.stellar.org/api/introduction/index/)
- [Contract Event Indexer Documentation](../contract-event-indexer.md)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Prisma ORM](https://www.prisma.io/)
