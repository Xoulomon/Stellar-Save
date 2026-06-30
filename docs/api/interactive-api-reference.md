# Public API Reference - Interactive Documentation

**Version:** 1.0.0  
**Base URLs:**
- **Production:** `https://api.stellar-save.app`
- **Local Development:** `http://localhost:3001`

> This interactive API reference is generated from the OpenAPI specification. For contract-level API documentation, see [Contract API Reference](../contract-api-reference.md).

## Quick Start

### 1. Get a Sandbox API Key

For testing, use the sandbox environment:

```bash
# Request a challenge
curl -X POST https://api.stellar-save.app/api/auth/challenge \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "YOUR_TESTNET_ADDRESS"}'

# Sign the challenge with your Stellar wallet and verify
curl -X POST https://api.stellar-save.app/api/auth/verify \
  -H "Content-Type: application/json" \
  -d '{
    "walletAddress": "YOUR_TESTNET_ADDRESS",
    "challenge": "CHALLENGE_STRING",
    "signature": "BASE64_SIGNATURE"
  }'
```

Response:
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Make Your First API Call

```bash
curl https://api.stellar-save.app/api/user/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

Response:
```json
{
  "walletAddress": "YOUR_TESTNET_ADDRESS"
}
```

## Interactive Documentation

### Option 1: Swagger UI

Visit the interactive Swagger UI:

**Production:** [https://api.stellar-save.app/docs](https://api.stellar-save.app/docs)  
**Local:** [http://localhost:3001/docs](http://localhost:3001/docs)

Features:
- Try API calls directly from the browser
- Automatic request/response formatting
- Built-in authentication
- Real-time validation

### Option 2: Redoc

Visit the clean, readable Redoc interface:

**Production:** [https://api.stellar-save.app/redoc](https://api.stellar-save.app/redoc)  
**Local:** [http://localhost:3001/redoc](http://localhost:3001/redoc)

Features:
- Three-panel layout
- Search functionality
- Code examples in multiple languages
- Download OpenAPI spec

### Option 3: OpenAPI Spec File

Download the raw OpenAPI specification:

```bash
curl https://api.stellar-save.app/openapi.yaml > stellar-save-api.yaml
```

Use with your preferred tools:
- **Postman:** Import → OpenAPI → Browse File
- **Insomnia:** Import → From File
- **VS Code:** Use REST Client with OpenAPI support

## Rate Limits

### General Endpoints
- **Rate:** 100 requests per 15 minutes
- **Key:** IP address
- **Header:** `X-RateLimit-Remaining`

### Auth & Admin Endpoints
- **Rate:** 10 requests per 15 minutes
- **Key:** IP address
- **Header:** `X-RateLimit-Remaining`

### Analytics Write Endpoints
- **Rate:** 50 requests per 15 minutes
- **Key:** User ID (from JWT)
- **Header:** `X-RateLimit-Remaining`

### Rate Limit Response

When rate limited:
```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded",
  "retryAfter": 900
}
```

**Status Code:** `429 Too Many Requests`  
**Header:** `Retry-After: 900` (seconds)

## Error Formats

All errors follow this structure:

```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "details": { }
}
```

### Common Error Codes

| Status | Error Type | Description |
|--------|-----------|-------------|
| `400` | `Bad Request` | Invalid request parameters |
| `401` | `Unauthorized` | Missing or invalid authentication |
| `403` | `Forbidden` | Insufficient permissions |
| `404` | `Not Found` | Resource does not exist |
| `429` | `Too Many Requests` | Rate limit exceeded |
| `500` | `Internal Server Error` | Server error occurred |
| `503` | `Service Unavailable` | Service temporarily unavailable |

### Example Error Responses

**400 Bad Request:**
```json
{
  "error": "Bad Request",
  "message": "Validation failed",
  "details": {
    "fields": {
      "walletAddress": "Invalid Stellar address format"
    }
  }
}
```

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or expired token"
}
```

**404 Not Found:**
```json
{
  "error": "Not Found",
  "message": "Group with ID 123 not found"
}
```

## Pagination

Paginated endpoints follow this pattern:

### Request Parameters

```
GET /api/v1/endpoint?limit=20&offset=0
```

- `limit` — Number of items per page (max 100)
- `offset` — Number of items to skip

### Response Format

```json
{
  "count": 150,
  "items": [ ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

### Cursor-based Pagination

Some endpoints use cursor-based pagination:

```
GET /api/v1/groups?cursor=0&limit=10
```

- `cursor` — Last item ID from previous page (0 = start)
- `limit` — Number of items per page

Response includes next cursor:
```json
{
  "items": [ ],
  "nextCursor": 10,
  "hasMore": true
}
```

## Authentication

### Challenge-Response Flow

1. **Request Challenge:**
```bash
POST /api/auth/challenge
Content-Type: application/json

{
  "walletAddress": "GABC1234EXAMPLESTELLARADDRESS"
}
```

2. **Sign Challenge (Client-side):**
```typescript
import { Keypair } from '@stellar/stellar-sdk';

const keypair = Keypair.fromSecret('YOUR_SECRET_KEY');
const challenge = "challenge_string_from_step_1";
const signature = keypair.sign(Buffer.from(challenge)).toString('base64');
```

3. **Verify Signature:**
```bash
POST /api/auth/verify
Content-Type: application/json

{
  "walletAddress": "GABC1234EXAMPLESTELLARADDRESS",
  "challenge": "challenge_string",
  "signature": "BASE64_ED25519_SIGNATURE"
}
```

4. **Use JWT Token:**
```bash
GET /api/user/me
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Token Lifetime

- **Duration:** 24 hours
- **Refresh:** Request new token before expiration
- **Storage:** Store securely (use httpOnly cookies in production)

## Code Examples

### JavaScript/TypeScript

```typescript
// 1. Request challenge
const challengeRes = await fetch('https://api.stellar-save.app/api/auth/challenge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ walletAddress: 'YOUR_ADDRESS' })
});
const { challenge } = await challengeRes.json();

// 2. Sign challenge
import { Keypair } from '@stellar/stellar-sdk';
const keypair = Keypair.fromSecret('YOUR_SECRET');
const signature = keypair.sign(Buffer.from(challenge)).toString('base64');

// 3. Verify and get token
const verifyRes = await fetch('https://api.stellar-save.app/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    walletAddress: 'YOUR_ADDRESS',
    challenge,
    signature
  })
});
const { token } = await verifyRes.json();

// 4. Use authenticated endpoint
const userRes = await fetch('https://api.stellar-save.app/api/user/me', {
  headers: { 'Authorization': `Bearer ${token}` }
});
const user = await userRes.json();
console.log('Authenticated as:', user.walletAddress);
```

### Python

```python
import requests
from stellar_sdk import Keypair

BASE_URL = 'https://api.stellar-save.app'

# 1. Request challenge
response = requests.post(f'{BASE_URL}/api/auth/challenge', json={
    'walletAddress': 'YOUR_ADDRESS'
})
challenge = response.json()['challenge']

# 2. Sign challenge
keypair = Keypair.from_secret('YOUR_SECRET')
signature = keypair.sign(challenge.encode()).hex()

# 3. Verify and get token
response = requests.post(f'{BASE_URL}/api/auth/verify', json={
    'walletAddress': 'YOUR_ADDRESS',
    'challenge': challenge,
    'signature': signature
})
token = response.json()['token']

# 4. Use authenticated endpoint
headers = {'Authorization': f'Bearer {token}'}
response = requests.get(f'{BASE_URL}/api/user/me', headers=headers)
user = response.json()
print(f"Authenticated as: {user['walletAddress']}")
```

### cURL

```bash
#!/bin/bash
set -e

BASE_URL="https://api.stellar-save.app"
WALLET_ADDRESS="YOUR_ADDRESS"

# 1. Request challenge
CHALLENGE=$(curl -s -X POST "$BASE_URL/api/auth/challenge" \
  -H "Content-Type: application/json" \
  -d "{\"walletAddress\": \"$WALLET_ADDRESS\"}" | jq -r '.challenge')

echo "Challenge: $CHALLENGE"

# 2. Sign challenge (requires stellar CLI)
SIGNATURE=$(echo -n "$CHALLENGE" | stellar keys sign --secret YOUR_SECRET | base64)

# 3. Verify and get token
TOKEN=$(curl -s -X POST "$BASE_URL/api/auth/verify" \
  -H "Content-Type: application/json" \
  -d "{
    \"walletAddress\": \"$WALLET_ADDRESS\",
    \"challenge\": \"$CHALLENGE\",
    \"signature\": \"$SIGNATURE\"
  }" | jq -r '.token')

echo "Token: $TOKEN"

# 4. Use authenticated endpoint
curl -s "$BASE_URL/api/user/me" \
  -H "Authorization: Bearer $TOKEN" | jq
```

### Go

```go
package main

import (
    "bytes"
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "github.com/stellar/go/keypair"
)

const baseURL = "https://api.stellar-save.app"

func main() {
    walletAddress := "YOUR_ADDRESS"
    secretKey := "YOUR_SECRET"

    // 1. Request challenge
    challengeReq := map[string]string{"walletAddress": walletAddress}
    challengeBody, _ := json.Marshal(challengeReq)
    resp, _ := http.Post(baseURL+"/api/auth/challenge", "application/json", bytes.NewBuffer(challengeBody))
    
    var challengeRes struct {
        Challenge string `json:"challenge"`
    }
    json.NewDecoder(resp.Body).Decode(&challengeRes)
    resp.Body.Close()

    // 2. Sign challenge
    kp, _ := keypair.Parse(secretKey)
    signature, _ := kp.Sign([]byte(challengeRes.Challenge))

    // 3. Verify and get token
    verifyReq := map[string]string{
        "walletAddress": walletAddress,
        "challenge":     challengeRes.Challenge,
        "signature":     string(signature),
    }
    verifyBody, _ := json.Marshal(verifyReq)
    resp, _ = http.Post(baseURL+"/api/auth/verify", "application/json", bytes.NewBuffer(verifyBody))
    
    var verifyRes struct {
        Token string `json:"token"`
    }
    json.NewDecoder(resp.Body).Decode(&verifyRes)
    resp.Body.Close()

    // 4. Use authenticated endpoint
    req, _ := http.NewRequest("GET", baseURL+"/api/user/me", nil)
    req.Header.Set("Authorization", "Bearer "+verifyRes.Token)
    
    client := &http.Client{}
    resp, _ = client.Do(req)
    body, _ := io.ReadAll(resp.Body)
    resp.Body.Close()
    
    fmt.Println("User:", string(body))
}
```

## Common Use Cases

### Get Platform Statistics

```bash
curl https://api.stellar-save.app/api/v1/stats/groups
```

Response:
```json
{
  "totalGroups": 150,
  "activeGroups": 42,
  "completedGroups": 108,
  "totalMembers": 580,
  "totalContributions": "15000000000",
  "totalPayouts": "12000000000"
}
```

### Search for Groups

```bash
curl "https://api.stellar-save.app/api/v1/search?q=weekly+savings"
```

Response:
```json
{
  "results": [
    {
      "type": "group",
      "id": 42,
      "name": "Weekly Savings Circle",
      "contributionAmount": "50000000",
      "memberCount": 5,
      "status": "Active"
    }
  ],
  "total": 1
}
```

### Get Group Analytics

```bash
curl "https://api.stellar-save.app/api/v1/analytics/groups/42?date=2026-06-28" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

Response:
```json
{
  "groupId": "42",
  "date": "2026-06-28",
  "contributionsCount": 5,
  "contributionsTotal": "250000000",
  "payoutsCount": 1,
  "payoutsTotal": "250000000",
  "activeMembers": 5
}
```

### Export Member History

```bash
curl "https://api.stellar-save.app/api/v1/members/YOUR_ADDRESS/export.csv" \
  -H "Authorization: Bearer YOUR_TOKEN" > history.csv
```

## Versioning

The API uses URL-based versioning:

- **v1:** `/api/v1/*` — Current stable version
- **v2:** `/api/v2/*` — Development version (some routes return 501)

### Migration Guide

When migrating from v1 to v2:

1. Test v2 endpoints in sandbox
2. Update base URL in your code
3. Handle new response fields
4. Monitor deprecation notices

### Deprecation Policy

- Endpoints marked deprecated: 6 months notice
- Breaking changes: Only in new major versions
- Legacy routes without version prefix: Removed 2027-01-01

## Support & Resources

- **OpenAPI Spec:** [Download YAML](https://api.stellar-save.app/openapi.yaml)
- **Swagger UI:** [https://api.stellar-save.app/docs](https://api.stellar-save.app/docs)
- **Redoc:** [https://api.stellar-save.app/redoc](https://api.stellar-save.app/redoc)
- **Status Page:** [https://status.stellar-save.app](https://status.stellar-save.app)
- **GitHub Issues:** [Report bugs](https://github.com/Xoulomon/Stellar-Save/issues)
- **Discussions:** [Ask questions](https://github.com/Xoulomon/Stellar-Save/discussions)

## Testing Checklist

Before going to production, test these scenarios:

- [ ] Successful authentication flow
- [ ] Invalid signature rejection
- [ ] Token expiration handling
- [ ] Rate limit response (429)
- [ ] Network error handling
- [ ] Pagination with different limits
- [ ] Invalid group ID (404)
- [ ] Unauthorized access (403)
- [ ] Malformed requests (400)

## Changelog

### v1.0.0 (2026-06-28)
- Initial public API release
- Authentication via Ed25519 challenge-response
- Health, stats, and analytics endpoints
- Group recommendations and search
- Data export functionality
- Backup management APIs
