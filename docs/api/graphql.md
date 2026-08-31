# GraphQL API Reference

**Endpoint:** `POST /graphql`  
**Server:** Apollo Server 4 on Express  
**Schema source:** `backend/src/graphql/schema.ts`

---

## Authentication

The `/graphql` endpoint requires a valid JWT access token for all queries and mutations **except** `health`.

### Obtaining a token

1. **Request a challenge** — `POST /api/auth/challenge` with `{ walletAddress }`.  
   The server issues a one-time nonce message valid for **5 minutes**.
2. **Sign the challenge** with your Stellar wallet (Freighter, Albedo, or Lobstr).
3. **Verify & exchange** — `POST /api/auth/verify` with `{ walletAddress, signedMessage, signature }`.  
   The server returns `{ accessToken, refreshToken }`.
4. **Attach the token** to every GraphQL request:

```http
Authorization: Bearer <accessToken>
```

Access tokens expire in **15 minutes** (configurable via `JWT_ACCESS_TOKEN_TTL`).  
Use `POST /api/auth/refresh` with the refresh token to rotate both tokens (refresh tokens expire in **30 days** by default).

### Rate limiting

The `/graphql` endpoint has a **strict auth rate limiter** applied before normal tiered limits:

| Tier | Requests / min | Requests / hour |
|------|---------------|----------------|
| Free | 30 | 500 |
| Pro | 300 | 10 000 |
| Enterprise | 3 000 | 100 000 |

Each GraphQL request costs **2 quota units** regardless of query size.  
Auth violations on `/graphql` are enforced at **10 requests per 15 minutes per IP**.

---

## Query complexity limits

Queries are validated before execution against two limits:

| Limit | Value |
|-------|-------|
| Max depth | 5 |
| Max complexity | 100 |

**Field costs** used in complexity scoring:

| Field | Cost |
|-------|------|
| `groups` | 10 |
| `members` | 10 |
| `transactions` | 10 |
| `recommendations` | 15 |
| `search` | 20 |
| `Group.members` (nested) | 5 |
| `Group.transactions` (nested) | 5 |
| `Member.groups` (nested) | 5 |
| `Recommendation.group` (nested) | 3 |
| Any other scalar | 1 |

Queries that exceed either limit receive an error response and are **not executed**.

---

## Types

### `Group`

Represents a ROSCA savings group.

```graphql
type Group {
  id:                 ID!
  name:               String!
  contributionAmount: Float!      # in XLM stroops or token smallest unit
  cycleDuration:      Int!        # duration of one cycle in seconds
  maxMembers:         Int!
  currentMembers:     Int!
  status:             String!     # "active" | "completed" | "paused"
  tags:               [String!]!
  members:            [Member!]!        # nested — adds 5 complexity
  transactions:       [Transaction!]!   # nested — adds 5 complexity
}
```

### `Member`

A wallet address participating in one or more groups.

```graphql
type Member {
  id:       ID!
  address:  String!    # Stellar public key (G...)
  name:     String!
  joinedAt: Float!     # Unix timestamp (ms)
  groupIds: [String!]!
  groups:   [Group!]!  # nested
}
```

### `Transaction`

A contribution or payout event linked to a Stellar transaction.

```graphql
type Transaction {
  id:            ID!
  groupId:       String!
  memberAddress: String!
  amount:        Float!
  type:          TransactionType!
  timestamp:     Float!          # Unix timestamp (ms)
  stellarTxHash: String!
}
```

### `TransactionType`

```graphql
enum TransactionType {
  contribution
  payout
}
```

### `Recommendation`

A group recommendation with a scoring signal.

```graphql
type Recommendation {
  groupId:   String!
  score:     Float!
  algorithm: String!
  group:     Group     # nullable — resolves via Group field resolver
}
```

### `RecommendationResult`

```graphql
type RecommendationResult {
  userId:          String!
  bucket:          String!
  algorithm:       String!
  recommendations: [Recommendation!]!
}
```

### `SearchResult`

Cross-entity search response.

```graphql
type SearchResult {
  groups:       [Group!]!
  members:      [Member!]!
  transactions: [Transaction!]!
}
```

---

## Queries

> All queries require `Authorization: Bearer <token>` unless noted.

### `health`

Returns `"ok"` when the server is running. **No auth required.**

```graphql
query {
  health
}
```

**Response:**
```json
{ "data": { "health": "ok" } }
```

---

### `groups`

Returns all groups.

```graphql
query {
  groups {
    id
    name
    contributionAmount
    cycleDuration
    maxMembers
    currentMembers
    status
    tags
  }
}
```

**Complexity:** 10 (list) + 1 per scalar selected.

---

### `group(id: ID!)`

Returns a single group by ID, or `null` if not found.

```graphql
query GetGroup($id: ID!) {
  group(id: $id) {
    id
    name
    status
    members {
      address
      name
    }
  }
}
```

**Variables:** `{ "id": "group_abc123" }`  
**Complexity:** 1 (scalar) + 5 (nested `members`) + 1 per member scalar.

---

### `members`

Returns all members.

```graphql
query {
  members {
    id
    address
    name
    joinedAt
    groupIds
  }
}
```

**Complexity:** 10.

---

### `member(id: ID!)`

Returns a single member by ID, or `null`.

```graphql
query GetMember($id: ID!) {
  member(id: $id) {
    id
    address
    name
    groups {
      id
      name
    }
  }
}
```

**Variables:** `{ "id": "member_xyz" }`

---

### `transactions(groupId: ID)`

Returns all transactions, optionally filtered by group.

```graphql
query GetGroupTransactions($groupId: ID) {
  transactions(groupId: $groupId) {
    id
    memberAddress
    amount
    type
    timestamp
    stellarTxHash
  }
}
```

**Variables:** `{ "groupId": "group_abc123" }` (omit to get all)  
**Complexity:** 10.

---

### `transaction(id: ID!)`

Returns a single transaction by ID, or `null`.

```graphql
query GetTransaction($id: ID!) {
  transaction(id: $id) {
    id
    groupId
    memberAddress
    amount
    type
    timestamp
    stellarTxHash
  }
}
```

---

### `recommendations(userId: ID!)`

Returns personalised group recommendations using collaborative filtering.

```graphql
query GetRecommendations($userId: ID!) {
  recommendations(userId: $userId) {
    userId
    bucket
    algorithm
    recommendations {
      groupId
      score
      algorithm
      group {
        id
        name
        contributionAmount
      }
    }
  }
}
```

**Variables:** `{ "userId": "GABC...XYZ" }`  
**Complexity:** 15 + 3 per `group` nested field.  
**Auth:** Required. The `userId` should match the authenticated wallet address.

---

### `search(query: String!)`

Full-text search across groups (by name/tags), members (by name/address), and transactions (by hash/address).

```graphql
query Search($query: String!) {
  search(query: $query) {
    groups {
      id
      name
      tags
    }
    members {
      id
      address
      name
    }
    transactions {
      id
      stellarTxHash
      amount
    }
  }
}
```

**Variables:** `{ "query": "weekly savings" }`  
**Complexity:** 20.

---

## Mutations

> All mutations require `Authorization: Bearer <token>`.

### `setPreferences`

Saves user contribution preferences and tag affinity for the recommendation engine.

```graphql
mutation SetPreferences(
  $userId: ID!
  $minContribution: Float
  $maxContribution: Float
  $preferredDuration: Int
  $tags: [String!]!
) {
  setPreferences(
    userId: $userId
    minContribution: $minContribution
    maxContribution: $maxContribution
    preferredDuration: $preferredDuration
    tags: $tags
  )
}
```

**Variables:**
```json
{
  "userId": "GABC...XYZ",
  "minContribution": 10.0,
  "maxContribution": 100.0,
  "preferredDuration": 604800,
  "tags": ["weekly", "community"]
}
```

**Returns:** `Boolean!` — `true` on success.  
**Auth:** Required. Use the authenticated wallet address as `userId`.

---

## Error handling

GraphQL errors follow the standard `errors` array format:

```json
{
  "errors": [
    {
      "message": "Unauthorized: Missing or malformed Authorization header",
      "extensions": { "code": "UNAUTHENTICATED" }
    }
  ]
}
```

Common error messages:

| Message | Cause |
|---------|-------|
| `Unauthorized: Missing or malformed Authorization header` | No `Bearer` token provided |
| `Unauthorized: Token expired` | JWT has expired; use refresh token |
| `Unauthorized: Invalid token` | JWT signature invalid or tampered |
| `Query complexity N exceeds maximum allowed complexity of 100` | Query too complex; narrow the selection set |
| `'N' exceeds maximum operation depth of 5` | Query too deeply nested |

---

## Example: full authentication + query flow

```bash
# 1. Request challenge
curl -X POST http://localhost:3001/api/auth/challenge \
  -H 'Content-Type: application/json' \
  -d '{ "walletAddress": "GABC...XYZ" }'

# 2. Sign the returned message with your wallet, then verify
curl -X POST http://localhost:3001/api/auth/verify \
  -H 'Content-Type: application/json' \
  -d '{
    "walletAddress": "GABC...XYZ",
    "signedMessage": "<challenge message>",
    "signature": "<base64 signature>"
  }'
# → { "accessToken": "eyJ...", "refreshToken": "..." }

# 3. Query the GraphQL API
curl -X POST http://localhost:3001/graphql \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer eyJ...' \
  -d '{
    "query": "{ groups { id name status contributionAmount } }"
  }'
```

---

## Related

- [REST API Reference](../api-reference.md)
- [Interactive API Docs](interactive-api-reference.md)
- [Auth Service source](../../backend/src/auth_service.ts)
- [GraphQL schema source](../../backend/src/graphql/schema.ts)
- [Complexity rules source](../../backend/src/graphql/complexity.ts)
