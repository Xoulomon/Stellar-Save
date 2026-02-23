# React Router Configuration

This document describes the routing setup for the Stellar-Save frontend application.

## Installation

React Router DOM v6 has been installed:

```bash
npm install react-router-dom
```

## Route Structure

### Public Routes
- `/` - Home page (landing page)
- `*` - 404 Not Found page

### Protected Routes (require wallet connection)
- `/dashboard` - User dashboard
- `/groups` - List all savings groups
- `/groups/create` - Create a new savings group
- `/groups/:groupId` - View specific group details

## File Structure

```
src/
├── constants/
│   └── routes.ts           # Route path constants
├── router/
│   └── index.tsx           # Router configuration
├── components/
│   ├── ProtectedRoute.tsx  # Protected route wrapper
│   └── index.ts            # Component exports
├── pages/
│   ├── Home.tsx            # Landing page
│   ├── Dashboard.tsx       # User dashboard
│   ├── Groups.tsx          # Groups list
│   ├── GroupDetail.tsx     # Group detail view
│   ├── CreateGroup.tsx     # Create group form
│   ├── NotFound.tsx        # 404 page
│   └── index.ts            # Page exports
└── App.tsx                 # Main app component
```

## Usage

### Route Constants

Use route constants from `constants/routes.ts` for type-safe navigation:

```typescript
import { ROUTES } from '../constants/routes';
import { Link } from 'react-router-dom';

<Link to={ROUTES.DASHBOARD}>Dashboard</Link>
```

### Protected Routes

Protected routes automatically redirect to home if the wallet is not connected:

```typescript
import ProtectedRoute from '../components/ProtectedRoute';

<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### Navigation

Use React Router's navigation hooks:

```typescript
import { useNavigate, useParams } from 'react-router-dom';

// Navigate programmatically
const navigate = useNavigate();
navigate(ROUTES.GROUPS);

// Access route parameters
const { groupId } = useParams<{ groupId: string }>();
```

## Features

- Type-safe route constants
- Protected routes with wallet authentication
- 404 error handling
- Programmatic navigation
- Dynamic route parameters
- Nested routing support

## Next Steps

Consider adding:
- Loading states during navigation
- Route-based code splitting with React.lazy()
- Breadcrumb navigation
- Route transitions/animations
- SEO metadata per route
