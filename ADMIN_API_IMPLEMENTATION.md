# Admin Dashboard API Implementation

## Overview
Built a robust set of API endpoints for the admin dashboard to monitor platform health and manage users.

## Features Implemented

### 1. Admin API Endpoints
- `GET /admin/stats`: Provides platform-wide statistics (users, groups, transactions, volume).
- `GET /admin/users`: Lists all members/users in the system.
- `GET /admin/users/:id`: Retrieves detailed information for a specific user.
- `PATCH /admin/users/:id`: Allows updating user details.
- `DELETE /admin/users/:id`: Handles user removal.
- `GET /admin/audit-logs`: Retrieves a history of administrative actions.

### 2. Authentication and Authorization
- Implemented `adminAuthMiddleware` to protect all `/admin/*` routes.
- Requires `x-admin-secret` header for access.
- Provides a mock `adminId` for audit logging.

### 3. Platform Statistics
- Total users count.
- Total groups count.
- Total transactions count and total volume.
- Mocked system health and last backup timestamp.

### 4. User Management
- Full CRUD-like capabilities for users (List, Read, Update, Delete).
- Logic encapsulated in `AdminService` for maintainability.

### 5. Audit Logging
- Automatically logs `UPDATE_USER` and `DELETE_USER` actions.
- Tracks `adminId`, `action`, `targetId`, `targetType`, `timestamp`, and `metadata`.
- Logs are stored in memory (following the existing mock data pattern).

### 6. Admin API Tests
- Created `src/tests/admin.test.ts`.
- Verified platform stats retrieval.
- Verified user lookup and updates.
- Verified audit log generation for administrative actions.
- Verified user deletion.

## Files Modified/Created
- `backend/src/models.ts`: Added `AuditLog` interface.
- `backend/src/mock_data.ts`: Created to share mock data between services and tests.
- `backend/src/admin_service.ts`: Core logic for admin operations.
- `backend/src/auth_middleware.ts`: Security layer for admin routes.
- `backend/src/index.ts`: Integrated admin routes and middleware.
- `backend/src/tests/admin.test.ts`: Test suite for admin features.

## How to Run Tests
```bash
cd backend
npm install
npx tsx src/tests/admin.test.ts
```
