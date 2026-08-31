# Admin API Reference

**Version:** 1.0.0  
**Endpoint Base:** `/api/v1/admin/`  
**Authentication:** Required (adminAuthMiddleware)

> Endpoints for platform administration and moderation. All endpoints require admin authentication. Logs are recorded in the audit trail for compliance and accountability.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Platform Statistics](#platform-statistics)
4. [User Management](#user-management)
5. [Group Management](#group-management)
6. [Audit Logs](#audit-logs)
7. [Error Handling](#error-handling)

---

## Overview

The Admin API provides platform administrators with tools to monitor platform health, manage users, moderate groups, and maintain audit logs. All administrative actions are logged to the audit trail for compliance purposes.

### Key Features

- **Platform Statistics**: Real-time platform health metrics
- **User Management**: View, flag, and delete users for moderation
- **Group Management**: Monitor and flag groups for review
- **Audit Trail**: Complete record of all administrative actions
- **Authorization**: All endpoints protected with admin authentication middleware

### Base URL

```
https://api.stellar-save.app/api/v1/admin/
http://localhost:3001/api/v1/admin/  (development)
```

### Authentication

All admin endpoints require authentication via the `adminAuthMiddleware`. The admin identity is verified server-side by checking the `x-admin-secret` header or JWT claims.

---

## Authentication

### Admin Identity Verification

Admin access is controlled via environment variables and request middleware:

**Server-Side:**
- `ADMIN_SECRET` environment variable defines the admin secret
- Requests must include `x-admin-secret` header with correct value
- Or provide a valid admin JWT token

**Client-Side (Frontend):**
- `VITE_ADMIN_ADDRESSES` environment variable (comma-separated list of Stellar addresses)
- UI-only optimistic guard that hides admin routes from non-admins
- Server-side authentication is the authoritative gate

**Example Header:**
```bash
Authorization: Bearer <admin-jwt-token>
# or
x-admin-secret: <admin-secret-value>
```

### Error Responses

```json
{
  "error": "Unauthorized",
  "statusCode": 401
}
```

---

## Platform Statistics

### GET /admin/stats

Retrieves overall platform statistics for the admin dashboard health metrics.

**Request:**
```bash
GET /api/v1/admin/stats
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "totalUsers": 150,
  "totalGroups": 45,
  "totalTransactions": 1280,
  "totalVolume": 12500.50,
  "systemHealth": "Healthy",
  "lastBackup": 1690000000000
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `totalUsers` | number | Total number of registered users |
| `totalGroups` | number | Total number of active groups |
| `totalTransactions` | number | Total number of completed transactions |
| `totalVolume` | number | Total XLM volume in the platform |
| `systemHealth` | string | System health status (`"Healthy"`, `"Degraded"`, `"Critical"`) |
| `lastBackup` | number | Unix timestamp of last backup (milliseconds) |

**Errors:**
- `500`: Failed to fetch platform stats

**Audit Log Entry:**
```json
{
  "action": "GET_PLATFORM_STATS",
  "targetType": null,
  "targetId": null,
  "timestamp": 1690000000000
}
```

---

## User Management

### GET /admin/users

Lists all users on the platform for moderation review.

**Request:**
```bash
GET /api/v1/admin/users
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "users": [
    {
      "id": "user_123",
      "address": "GDZST3XVCDTUJ76ZAV2HA72KYXM4Y5HFXWPLF72PZOHVFVJZKGXO3S2Y",
      "name": "Alice",
      "joinedAt": 1690000000000,
      "groupIds": ["group_1", "group_2"],
      "flagged": false
    },
    {
      "id": "user_456",
      "address": "GBXE23SHFBKXFVFKJX3L5BF4JOZFZUL5SJ6XCV3M7PKXRWYX7KQRQFA7",
      "name": "Bob",
      "joinedAt": 1690100000000,
      "groupIds": ["group_3"],
      "flagged": true
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | User unique identifier |
| `address` | string | Stellar wallet address |
| `name` | string | User's display name |
| `joinedAt` | number | Registration timestamp (milliseconds) |
| `groupIds` | array | IDs of groups user is member of |
| `flagged` | boolean | Whether user is flagged for review |

**Errors:**
- `500`: Failed to fetch users

**Audit Log Entry:**
```json
{
  "action": "LIST_USERS",
  "targetType": null,
  "targetId": null,
  "timestamp": 1690000000000
}
```

---

### PATCH /admin/users/:id

Updates user information. Commonly used to flag/unflag users for review.

**Request:**
```bash
PATCH /api/v1/admin/users/user_123
Authorization: Bearer <token>
Content-Type: application/json

{
  "updates": {
    "name": "Alice Smith",
    "flagged": true
  },
  "adminId": "admin_001"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `updates` | object | Yes | Partial user object with fields to update |
| `adminId` | string | Yes | ID of the admin performing the action (for audit) |

**Valid Update Fields:**
- `name`: string - User's display name
- `flagged`: boolean - Flag user for moderation review

**Response (200 OK):**
```json
{
  "id": "user_123",
  "address": "GDZST3XVCDTUJ76ZAV2HA72KYXM4Y5HFXWPLF72PZOHVFVJZKGXO3S2Y",
  "name": "Alice Smith",
  "joinedAt": 1690000000000,
  "groupIds": ["group_1", "group_2"],
  "flagged": true
}
```

**Errors:**
- `400`: Missing required field (`updates` or `adminId`) or invalid data type
- `404`: User not found
- `500`: Failed to update user

**Audit Log Entry:**
```json
{
  "action": "UPDATE_USER",
  "targetType": "Member",
  "targetId": "user_123",
  "timestamp": 1690000000000,
  "metadata": {
    "changes": {
      "name": "Alice Smith",
      "flagged": true
    }
  }
}
```

---

### DELETE /admin/users/:id

Permanently removes a user from the platform. This action is irreversible and logged to audit trail.

**Request:**
```bash
DELETE /api/v1/admin/users/user_123
Authorization: Bearer <token>
Content-Type: application/json

{
  "adminId": "admin_001"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `adminId` | string | Yes | ID of the admin performing the delete (for audit) |

**Response (200 OK):**
```json
{
  "message": "User deleted successfully"
}
```

**Errors:**
- `400`: Missing `adminId` in request body
- `404`: User not found
- `500`: Failed to delete user

**Audit Log Entry:**
```json
{
  "action": "DELETE_USER",
  "targetType": "Member",
  "targetId": "user_123",
  "timestamp": 1690000000000,
  "metadata": {
    "reason": "admin_moderation"
  }
}
```

**Important:** This operation will:
1. Remove user from all groups
2. Cancel any pending payouts
3. Delete user profile data
4. Create immutable audit log entry

---

## Group Management

### GET /admin/groups

Lists all groups on the platform for moderation review.

**Request:**
```bash
GET /api/v1/admin/groups
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "groups": [
    {
      "id": "group_1",
      "name": "Weekly Savings",
      "contributionAmount": 100000000,
      "cycleDuration": 604800,
      "maxMembers": 5,
      "currentMembers": 4,
      "status": "active",
      "tags": ["savings", "weekly"],
      "flagged": false
    },
    {
      "id": "group_2",
      "name": "Monthly Investment",
      "contributionAmount": 500000000,
      "cycleDuration": 2592000,
      "maxMembers": 10,
      "currentMembers": 7,
      "status": "active",
      "tags": ["investment", "monthly"],
      "flagged": true
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Group unique identifier |
| `name` | string | Group's display name |
| `contributionAmount` | number | XLM per member per cycle (stroops, 1 XLM = 10^7 stroops) |
| `cycleDuration` | number | Cycle length in seconds |
| `maxMembers` | number | Maximum allowed members |
| `currentMembers` | number | Current number of members |
| `status` | string | Group status (`"pending"`, `"active"`, `"paused"`, `"completed"`, `"cancelled"`) |
| `tags` | array | Optional category tags |
| `flagged` | boolean | Whether group is flagged for review |

**Errors:**
- `500`: Failed to fetch groups

**Audit Log Entry:**
```json
{
  "action": "LIST_GROUPS",
  "targetType": null,
  "targetId": null,
  "timestamp": 1690000000000
}
```

---

### POST /admin/groups/:id/flag

Flags or unflags a group for moderation review. Used for marking suspicious activity or policy violations.

**Request:**
```bash
POST /api/v1/admin/groups/group_123/flag
Authorization: Bearer <token>
Content-Type: application/json

{
  "flagged": true,
  "adminId": "admin_001"
}
```

**Request Body:**
| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `flagged` | boolean | Yes | true to flag, false to clear flag |
| `adminId` | string | Yes | ID of the admin performing the action (for audit) |

**Response (200 OK):**
```json
{
  "id": "group_123",
  "name": "Weekly Savings",
  "contributionAmount": 100000000,
  "cycleDuration": 604800,
  "maxMembers": 5,
  "currentMembers": 4,
  "status": "active",
  "tags": ["savings", "weekly"],
  "flagged": true
}
```

**Errors:**
- `400`: `flagged` is not a boolean or `adminId` missing
- `404`: Group not found
- `500`: Failed to flag group

**Audit Log Entry:**
```json
{
  "action": "FLAG_GROUP",
  "targetType": "Group",
  "targetId": "group_123",
  "timestamp": 1690000000000,
  "metadata": {
    "flagged": true
  }
}
```

**Use Cases:**
- Potential fraud or money laundering patterns
- Non-compliance with group rules
- Excessive member disputes
- Policy violation reports

---

## Audit Logs

### GET /admin/audit-logs

Retrieves the audit trail of all administrative actions.

**Request:**
```bash
GET /api/v1/admin/audit-logs
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "logs": [
    {
      "id": "log_1690000000000",
      "userId": "admin_001",
      "action": "DELETE_USER",
      "targetId": "user_123",
      "targetType": "Member",
      "timestamp": 1690000000000,
      "metadata": {
        "reason": "admin_moderation"
      }
    },
    {
      "id": "log_1690100000000",
      "userId": "admin_002",
      "action": "UPDATE_USER",
      "targetId": "user_456",
      "targetType": "Member",
      "timestamp": 1690100000000,
      "metadata": {
        "changes": {
          "flagged": true
        }
      }
    },
    {
      "id": "log_1690200000000",
      "userId": "admin_001",
      "action": "FLAG_GROUP",
      "targetId": "group_789",
      "targetType": "Group",
      "timestamp": 1690200000000,
      "metadata": {
        "flagged": true
      }
    }
  ]
}
```

**Response Fields:**
| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Audit log entry unique identifier |
| `userId` | string | Admin ID who performed the action |
| `action` | string | Action type (e.g., `DELETE_USER`, `UPDATE_USER`, `FLAG_GROUP`) |
| `targetId` | string | ID of affected resource (user/group ID) |
| `targetType` | string | Type of resource (`"Member"`, `"Group"`, etc.) |
| `timestamp` | number | Action timestamp (milliseconds) |
| `metadata` | object | Additional action details (context-specific) |

**Errors:**
- `500`: Failed to fetch audit logs

**Audit Log Entry:**
```json
{
  "action": "LIST_AUDIT_LOGS",
  "targetType": null,
  "targetId": null,
  "timestamp": 1690000000000
}
```

### Action Types

| Action | Trigger | Details |
|--------|---------|---------|
| `GET_PLATFORM_STATS` | `/admin/stats` read | Platform statistics accessed |
| `LIST_USERS` | `/admin/users` read | User list accessed |
| `UPDATE_USER` | `/admin/users/:id` PATCH | User record modified |
| `DELETE_USER` | `/admin/users/:id` DELETE | User removed from platform |
| `LIST_GROUPS` | `/admin/groups` read | Group list accessed |
| `FLAG_GROUP` | `/admin/groups/:id/flag` POST | Group flagged for review |

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Example |
|------|---------|---------|
| 200 | Success | Operation completed successfully |
| 400 | Bad Request | Missing required field or invalid data type |
| 401 | Unauthorized | Missing or invalid admin credentials |
| 404 | Not Found | User or group ID doesn't exist |
| 500 | Server Error | Internal server error during operation |

### Error Response Format

```json
{
  "error": "Error message here",
  "statusCode": 400,
  "details": {
    "field": "adminId",
    "message": "adminId is required"
  }
}
```

### Common Errors

#### Missing Authentication
```json
{
  "error": "Unauthorized",
  "statusCode": 401
}
```

#### Missing Required Fields
```json
{
  "error": "adminId is required",
  "statusCode": 400
}
```

#### Resource Not Found
```json
{
  "error": "User not found",
  "statusCode": 404
}
```

#### Invalid Data Type
```json
{
  "error": "flagged must be boolean",
  "statusCode": 400
}
```

---

## Usage Examples

### Example 1: Flag a Suspicious User

```bash
# Flag a user for review
curl -X PATCH https://api.stellar-save.app/api/v1/admin/users/user_123 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "updates": {
      "flagged": true
    },
    "adminId": "admin_001"
  }'

# Response
{
  "id": "user_123",
  "address": "GDZST3XVCDTUJ76ZAV2HA72KYXM4Y5HFXWPLF72PZOHVFVJZKGXO3S2Y",
  "name": "Suspicious User",
  "flagged": true
}
```

### Example 2: Delete a User

```bash
# Delete a user permanently
curl -X DELETE https://api.stellar-save.app/api/v1/admin/users/user_456 \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "adminId": "admin_001"
  }'

# Response
{
  "message": "User deleted successfully"
}
```

### Example 3: Flag a Group for Review

```bash
# Flag a group with suspicious activity
curl -X POST https://api.stellar-save.app/api/v1/admin/groups/group_789/flag \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "flagged": true,
    "adminId": "admin_001"
  }'

# Response
{
  "id": "group_789",
  "name": "Weekly Savings",
  "flagged": true
}
```

### Example 4: Review Audit Trail

```bash
# Get all admin actions for compliance review
curl https://api.stellar-save.app/api/v1/admin/audit-logs \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# Response shows chronological record of all admin actions
{
  "logs": [
    {
      "id": "log_1690000000000",
      "userId": "admin_001",
      "action": "DELETE_USER",
      "targetId": "user_123",
      "timestamp": 1690000000000
    }
  ]
}
```

---

## Best Practices

### For Administrators

1. **Document Your Actions**: Include metadata when flagging/deleting for audit trail
2. **Verify Before Deleting**: Always check user's group memberships before deletion
3. **Use Flag Before Delete**: Flag for review first, delete only if necessary
4. **Monitor Health Metrics**: Check platform stats regularly for anomalies
5. **Review Audit Logs**: Audit trail helps track changes and resolve disputes

### For Integration

1. **Cache Admin Addresses**: Store admin allowlist locally to reduce API calls
2. **Handle Rate Limits**: Respect rate limiting on admin endpoints
3. **Log Admin Actions**: Maintain your own audit trail of API calls
4. **Error Handling**: Implement proper error handling for 401/404/500 responses
5. **Secure Credentials**: Never commit admin secrets or tokens to version control

---

## Compliance & Security

### Audit Trail

All admin actions are logged with:
- **Admin ID**: Who performed the action
- **Timestamp**: When the action occurred
- **Action Type**: What was done
- **Resource IDs**: Which resources were affected
- **Metadata**: Additional context (reason, changes, etc.)

This immutable audit trail enables:
- Compliance reporting
- Dispute resolution
- Security investigations
- Performance analysis

### Authorization

- All endpoints require valid admin credentials
- Server-side verification is authoritative
- Client-side role checks are optimistic UI guards only
- Invalid credentials return 401 Unauthorized

### Data Protection

- Deleted users cannot be recovered
- Flagged users/groups remain accessible but marked
- Audit logs cannot be modified or deleted
- All changes are timestamped and attributed

---

## Version History

### v1.0.0 (Current)
- Initial release of Admin API
- Platform statistics endpoint
- User management endpoints (list, update, delete)
- Group management endpoints (list, flag)
- Audit logging for all operations

### Planned Features (v1.1+)
- Bulk user import/export
- Advanced group filtering and search
- Scheduled reports
- Role-based access control (RBAC)
- Webhook notifications for flagged items

---

## Support

- **Issues**: [https://github.com/Xoulomon/Stellar-Save/issues](https://github.com/Xoulomon/Stellar-Save/issues)
- **Discussions**: [https://github.com/Xoulomon/Stellar-Save/discussions](https://github.com/Xoulomon/Stellar-Save/discussions)
- **API Status**: Contact dev team for current API status

---

**Last Updated:** 2026-07-28  
**API Version:** 1.0.0  
**Stellar SDK Version:** 23.0.3
