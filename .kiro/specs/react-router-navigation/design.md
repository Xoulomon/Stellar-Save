# Design Document: React Router Navigation

## Overview

This design document specifies the technical implementation for adding React Router navigation to the Stellar-Save frontend application. The navigation system will enable client-side routing with protected routes for wallet-authenticated users, centralized route management, and seamless integration with existing UI components.

### Goals

- Implement React Router DOM v6 for client-side navigation
- Create a type-safe, centralized route configuration system
- Implement protected routes that require wallet authentication
- Provide programmatic navigation utilities throughout the application
- Integrate routing with existing Header, WalletButton, and GroupCard components
- Handle navigation errors gracefully with 404 and error boundary pages

### Non-Goals

- Server-side rendering (SSR) or static site generation (SSG)
- Route-based code splitting (can be added later)
- Nested routing beyond one level deep
- Route-based data loading/prefetching
- Browser history state persistence across sessions

## Architecture

### High-Level Architecture

The navigation system follows a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│                    Application Root                      │
│                      (main.tsx)                          │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                   BrowserRouter                          │
│              (HTML5 History API)                         │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                  Route Configuration                     │
│           (routes.tsx - centralized)                     │
└─────────────────────────────────────────────────────────┘
                            │
                ┌───────────┴───────────┐
                ▼                       ▼
┌───────────────────────┐   ┌───────────────────────┐
│    Public Routes      │   │   Protected Routes    │
│  - Home               │   │  - Dashboard          │
│  - 404                │   │  - Groups             │
└───────────────────────┘   │  - Group Details      │
                            │  - Profile            │
                            │  - Settings           │
                            └───────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │  ProtectedRoute       │
                            │  (Auth Guard)         │
                            └───────────────────────┘
                                        │
                                        ▼
                            ┌───────────────────────┐
                            │  WalletProvider       │
                            │  (Auth Context)       │
                            └───────────────────────┘
```

### Design Decisions

**1. React Router DOM v6**
- Chosen for its declarative routing API, hooks-based navigation, and strong TypeScript support
- v6 provides improved bundle size and performance over v5
- Native support for nested routes and relative navigation

**2. Centralized Route Configuration**
- Single source of truth for all routes prevents inconsistencies
- Type-safe route definitions enable compile-time validation
- Easier to maintain and audit route permissions

**3. Component-Based Route Guards**
- ProtectedRoute component wraps protected pages for reusability
- Integrates with existing WalletProvider context
- Preserves intended destination for post-authentication redirect

**4. Constant-Based Route Paths**
- Prevents typos and enables IDE autocomplete
- Facilitates refactoring and route path changes
- Type-safe route parameter definitions

## Components and Interfaces

### Route Constants

**File:** `src/routing/constants.ts`

```typescript
/**
 * Application route paths as immutable constants.
 * Use these constants instead of hardcoded strings throughout the application.
 */
export const ROUTES = {
  HOME: '/',
  DASHBOARD: '/dashboard',
  GROUPS: '/groups',
  GROUP_DETAIL: '/groups/:groupId',
  PROFILE: '/profile',
  SETTINGS: '/settings',
  NOT_FOUND: '/404',
} as const;

/**
 * Type-safe route path type
 */
export type RoutePath = typeof ROUTES[keyof typeof ROUTES];

/**
 * Helper to build parameterized routes
 */
export const buildRoute = {
  groupDetail: (groupId: string) => `/groups/${groupId}`,
} as const;
```

### Route Configuration Types

**File:** `src/routing/types.ts`

```typescript
import { ComponentType } from 'react';

/**
 * Route metadata and configuration
 */
export interface RouteConfig {
  /** Unique route path */
  path: string;
  /** Component to render for this route */
  component: ComponentType;
  /** Whether this route requires authentication */
  protected: boolean;
  /** Optional route title for document.title */
  title?: string;
  /** Optional route description for metadata */
  description?: string;
}

/**
 * Route parameter types for type-safe parameter access
 */
export interface RouteParams {
  groupId?: string;
}
```

### Route Configuration

**File:** `src/routing/routes.tsx`

```typescript
import { lazy } from 'react';
import { ROUTES } from './constants';
import type { RouteConfig } from './types';

// Lazy load page components
const HomePage = lazy(() => import('../pages/HomePage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const GroupsPage = lazy(() => import('../pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('../pages/GroupDetailPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

/**
 * Centralized route configuration.
 * All application routes are defined here with their properties.
 */
export const routeConfig: RouteConfig[] = [
  {
    path: ROUTES.HOME,
    component: HomePage,
    protected: false,
    title: 'Stellar Save - Secure DeFi Savings',
    description: 'Transparent, on-chain savings powered by Stellar',
  },
  {
    path: ROUTES.DASHBOARD,
    component: DashboardPage,
    protected: true,
    title: 'Dashboard - Stellar Save',
    description: 'View your savings groups and contributions',
  },
  {
    path: ROUTES.GROUPS,
    component: GroupsPage,
    protected: true,
    title: 'Groups - Stellar Save',
    description: 'Browse and join savings groups',
  },
  {
    path: ROUTES.GROUP_DETAIL,
    component: GroupDetailPage,
    protected: true,
    title: 'Group Details - Stellar Save',
  },
  {
    path: ROUTES.PROFILE,
    component: ProfilePage,
    protected: true,
    title: 'Profile - Stellar Save',
  },
  {
    path: ROUTES.SETTINGS,
    component: SettingsPage,
    protected: true,
    title: 'Settings - Stellar Save',
  },
  {
    path: ROUTES.NOT_FOUND,
    component: NotFoundPage,
    protected: false,
    title: '404 - Page Not Found',
  },
];
```

### Protected Route Component

**File:** `src/routing/ProtectedRoute.tsx`

```typescript
import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { ROUTES } from './constants';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * Route guard component that requires wallet authentication.
 * Redirects to home page if user is not authenticated.
 * Preserves the intended destination for post-authentication redirect.
 */
export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { status } = useWallet();
  const location = useLocation();

  // Store the intended destination in sessionStorage
  useEffect(() => {
    if (status !== 'connected') {
      sessionStorage.setItem('redirectAfterAuth', location.pathname + location.search);
    }
  }, [status, location]);

  // Redirect to home if not authenticated
  if (status !== 'connected') {
    return <Navigate to={ROUTES.HOME} replace />;
  }

  return <>{children}</>;
}
```

### Router Setup Component

**File:** `src/routing/AppRouter.tsx`

```typescript
import { Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { routeConfig } from './routes';
import { ProtectedRoute } from './ProtectedRoute';
import { ErrorBoundary } from '../components/ErrorBoundary/ErrorBoundary';
import { ROUTES } from './constants';

/**
 * Loading fallback component for lazy-loaded routes
 */
function RouteLoadingFallback() {
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      minHeight: '400px' 
    }}>
      <div>Loading...</div>
    </div>
  );
}

/**
 * Main application router component.
 * Renders routes based on centralized configuration.
 */
export function AppRouter() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoadingFallback />}>
        <Routes>
          {routeConfig.map((route) => {
            const Component = route.component;
            const element = route.protected ? (
              <ProtectedRoute>
                <Component />
              </ProtectedRoute>
            ) : (
              <Component />
            );

            return <Route key={route.path} path={route.path} element={element} />;
          })}
          
          {/* Catch-all route for undefined paths */}
          <Route path="*" element={<Navigate to={ROUTES.NOT_FOUND} replace />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Navigation Hook

**File:** `src/routing/useNavigation.ts`

```typescript
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import type { RouteParams } from './types';

/**
 * Custom navigation hook that wraps React Router's navigation utilities.
 * Provides type-safe navigation and parameter access.
 */
export function useNavigation() {
  const navigate = useNavigate();
  const params = useParams<RouteParams>();
  const location = useLocation();

  return {
    /** Navigate to a route */
    navigateTo: (path: string, options?: { replace?: boolean; state?: unknown }) => {
      navigate(path, options);
    },
    
    /** Navigate back in history */
    goBack: () => {
      navigate(-1);
    },
    
    /** Navigate forward in history */
    goForward: () => {
      navigate(1);
    },
    
    /** Current route parameters */
    params,
    
    /** Current location object */
    location,
    
    /** Navigate with state data */
    navigateWithState: <T>(path: string, state: T) => {
      navigate(path, { state });
    },
  };
}
```

### Post-Authentication Redirect Hook

**File:** `src/routing/useAuthRedirect.ts`

```typescript
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWallet } from '../hooks/useWallet';
import { ROUTES } from './constants';

/**
 * Hook to handle post-authentication redirects.
 * Redirects user to their intended destination after successful wallet connection.
 */
export function useAuthRedirect() {
  const { status } = useWallet();
  const navigate = useNavigate();

  useEffect(() => {
    if (status === 'connected') {
      const redirectPath = sessionStorage.getItem('redirectAfterAuth');
      
      if (redirectPath && redirectPath !== ROUTES.HOME) {
        sessionStorage.removeItem('redirectAfterAuth');
        navigate(redirectPath, { replace: true });
      }
    }
  }, [status, navigate]);
}
```

## Data Models

### Route Configuration Model

```typescript
interface RouteConfig {
  path: string;           // Route path pattern (e.g., "/groups/:groupId")
  component: ComponentType; // React component to render
  protected: boolean;     // Requires authentication
  title?: string;         // Page title for document.title
  description?: string;   // Page description for metadata
}
```

### Route Parameters Model

```typescript
interface RouteParams {
  groupId?: string;  // Group ID from URL parameter
  // Additional parameters can be added as needed
}
```

### Navigation State Model

```typescript
interface NavigationState {
  from?: string;        // Previous route path
  data?: unknown;       // Arbitrary state data passed during navigation
}
```

## Integration Points

### 1. Application Root Integration

**File:** `src/main.tsx`

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppThemeProvider } from './ui/providers/AppThemeProvider';
import { WalletProvider } from './wallet/WalletProvider';
import { AppRouter } from './routing/AppRouter';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppThemeProvider>
      <WalletProvider>
        <BrowserRouter>
          <AppRouter />
        </BrowserRouter>
      </WalletProvider>
    </AppThemeProvider>
  </StrictMode>
);
```

### 2. Header Component Integration

Update `src/components/Header.tsx` to use React Router Link components:

```typescript
import { Link } from 'react-router-dom';
import { ROUTES } from '../routing/constants';

// Replace anchor tags with Link components
<nav className={`header-nav ${isMenuOpen ? 'open' : ''}`}>
  <Link to={ROUTES.GROUPS}>Groups</Link>
  <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
  <Link to={ROUTES.PROFILE}>Profile</Link>
</nav>
```

### 3. WalletButton Component Integration

Update `src/components/WalletButton.tsx` to trigger navigation after connection:

```typescript
import { useNavigation } from '../routing/useNavigation';
import { useAuthRedirect } from '../routing/useAuthRedirect';

export function WalletButton() {
  const { status, activeAddress, connect, disconnect } = useWallet();
  useAuthRedirect(); // Handle post-auth redirect
  
  // Rest of component implementation...
}
```

### 4. GroupCard Component Integration

Update `src/components/GroupCard.tsx` to use Link for navigation:

```typescript
import { Link } from 'react-router-dom';
import { buildRoute } from '../routing/constants';

// Add groupId prop
interface GroupCardProps {
  groupId: string;
  groupName: string;
  // ... other props
}

// Wrap card in Link or use onClick with navigation
<Link to={buildRoute.groupDetail(groupId)} className="group-card-link">
  {/* Card content */}
</Link>
```

### 5. App.tsx Refactoring

The current `App.tsx` will be refactored into separate page components:
- `HomePage.tsx` - Landing page with wallet connection
- `DashboardPage.tsx` - User dashboard with groups overview
- `GroupsPage.tsx` - Browse all groups
- `GroupDetailPage.tsx` - Individual group details
- `ProfilePage.tsx` - User profile and settings
- `SettingsPage.tsx` - Application settings


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, the following properties were identified as testable through property-based testing. Several redundancies were eliminated:

- Criteria 3.3 (public routes) is redundant with 3.2 (protected routes) - they are inverse concepts
- Criteria 6.4 (error boundary prevents crashes) is subsumed by 6.3 (error boundary displays message) - if it displays a message, it caught the error
- Multiple "example" criteria verify structure and setup rather than universal properties

The following properties represent unique, testable behaviors that should hold across all valid inputs:

### Property 1: Protected Route Authentication Check

*For any* protected route in the route configuration, when a user attempts to access it, the ProtectedRoute component must check the wallet authentication status before rendering content.

**Validates: Requirements 4.1**

### Property 2: Unauthenticated Redirect

*For any* protected route accessed without wallet authentication, the system must redirect the user to the home page.

**Validates: Requirements 4.2**

### Property 3: Authenticated Access

*For any* protected route accessed with valid wallet authentication, the system must render the requested component without redirection.

**Validates: Requirements 4.3**

### Property 4: URL Preservation for Redirect

*For any* protected route accessed without authentication, the system must preserve the originally requested URL (including path and query parameters) in sessionStorage for post-authentication redirect.

**Validates: Requirements 4.5**

### Property 5: Post-Authentication Redirect

*For any* preserved URL in sessionStorage, when wallet authentication status changes from unauthenticated to authenticated, the system must navigate to the preserved URL and clear it from storage.

**Validates: Requirements 4.6**

### Property 6: Route Matching

*For any* valid route path in the route configuration, when the application initializes with that path as the current URL, the router must render the corresponding component.

**Validates: Requirements 5.5**

### Property 7: 404 Handling

*For any* URL path that is not defined in the route configuration, the router must render the 404 Not Found page.

**Validates: Requirements 6.1**

### Property 8: Error Boundary Containment

*For any* route component that throws an error during rendering, the error boundary must catch the error and display an error message without crashing the entire application.

**Validates: Requirements 6.3, 6.4**

### Property 9: Programmatic Navigation

*For any* valid route path constant, the navigation hook must be able to navigate to that route successfully.

**Validates: Requirements 7.2**

### Property 10: Navigation State Preservation

*For any* state data passed during navigation, the state must be accessible at the destination route through the location.state property.

**Validates: Requirements 7.4**

### Property 11: Route Parameter Access

*For any* parameterized route with a parameter value in the URL, components rendered on that route must be able to access the parameter value through the useNavigation hook.

**Validates: Requirements 8.3**

### Property 12: Post-Connection Navigation

*For any* stored redirect path in sessionStorage, when the wallet connection status changes to "connected", the WalletButton component must trigger navigation to the stored path.

**Validates: Requirements 9.2**

### Property 13: Application State Preservation

*For any* navigation between routes within the application, React context state (WalletProvider, ThemeProvider) must be preserved and remain accessible.

**Validates: Requirements 9.5**

## Error Handling

### Navigation Errors

**404 Not Found**
- Trigger: User navigates to undefined route
- Handling: Redirect to `/404` route with NotFoundPage component
- User Experience: Display friendly message with link to home page
- Recovery: User can click home link or use browser back button

**Protected Route Access Denied**
- Trigger: Unauthenticated user attempts to access protected route
- Handling: Redirect to home page, preserve intended URL
- User Experience: User sees home page with wallet connection prompt
- Recovery: User connects wallet and is automatically redirected to intended destination

### Component Loading Errors

**Lazy Loading Failure**
- Trigger: Network error or chunk loading failure for lazy-loaded route component
- Handling: Error boundary catches error and displays fallback UI
- User Experience: Error message with retry option
- Recovery: User can refresh page or navigate to different route

**Component Render Error**
- Trigger: Runtime error in route component during render
- Handling: Error boundary catches error, logs to console, displays error UI
- User Experience: Error message indicating something went wrong
- Recovery: Error boundary provides "Go Home" button for navigation

### Error Boundary Implementation

The existing `ErrorBoundary` component will be enhanced to handle route-specific errors:

```typescript
// Enhanced error boundary for routing errors
export class RouteErrorBoundary extends Component<Props, State> {
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Route error:', error, errorInfo);
    
    // Log to error tracking service in production
    if (import.meta.env.PROD) {
      // logErrorToService(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="route-error">
          <h1>Something went wrong</h1>
          <p>We encountered an error loading this page.</p>
          <button onClick={this.handleReset}>Go Home</button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

### Error States

| Error Type | User Impact | System Response | Recovery Path |
|------------|-------------|-----------------|---------------|
| 404 Not Found | Cannot access non-existent page | Show 404 page | Navigate to home or valid route |
| Unauthorized Access | Cannot access protected route | Redirect to home | Connect wallet, auto-redirect |
| Component Load Failure | Cannot view page content | Show error boundary | Refresh or navigate away |
| Component Render Error | Cannot view page content | Show error boundary | Navigate to home |
| Navigation Error | Cannot complete navigation | Stay on current page | Retry navigation |

## Testing Strategy

### Dual Testing Approach

The navigation system will be validated using both unit tests and property-based tests:

**Unit Tests** - Verify specific examples, edge cases, and integration points:
- Route configuration structure validation
- ProtectedRoute component with specific auth states
- Navigation hook function calls
- Component integration (Header, WalletButton, GroupCard)
- Error boundary specific error scenarios
- 404 page rendering and home link functionality

**Property-Based Tests** - Verify universal properties across all inputs:
- Protected route authentication checks for all protected routes
- Redirect behavior for all unauthenticated access attempts
- Route matching for all valid route paths
- 404 handling for all invalid paths
- Navigation state preservation for all state data
- Parameter access for all parameterized routes
- Application state preservation across all navigation sequences

### Property-Based Testing Configuration

**Library:** `@fast-check/vitest` (fast-check integration for Vitest)

**Configuration:**
- Minimum 100 iterations per property test
- Each test tagged with feature name and property number
- Tag format: `Feature: react-router-navigation, Property {N}: {description}`

**Example Property Test:**

```typescript
import { test } from 'vitest';
import { fc } from '@fast-check/vitest';

// Feature: react-router-navigation, Property 2: Unauthenticated Redirect
test.prop([fc.constantFrom(...protectedRoutePaths)])(
  'protected routes redirect unauthenticated users to home',
  async (routePath) => {
    // Arrange: Set up unauthenticated state
    const { result } = renderHook(() => useWallet(), {
      wrapper: createMockWalletProvider({ status: 'idle' }),
    });
    
    // Act: Attempt to navigate to protected route
    const { container } = render(
      <MemoryRouter initialEntries={[routePath]}>
        <AppRouter />
      </MemoryRouter>
    );
    
    // Assert: Should redirect to home
    await waitFor(() => {
      expect(window.location.pathname).toBe('/');
    });
  },
  { numRuns: 100 }
);
```

### Test Coverage Goals

- **Unit Test Coverage:** 90%+ for routing components and utilities
- **Property Test Coverage:** All 13 correctness properties implemented
- **Integration Test Coverage:** All component integrations (Header, WalletButton, GroupCard)
- **E2E Test Coverage:** Critical user flows (auth redirect, navigation, 404 handling)

### Testing Tools

- **Vitest:** Test runner and assertion library
- **@testing-library/react:** Component testing utilities
- **@fast-check/vitest:** Property-based testing library
- **@testing-library/user-event:** User interaction simulation
- **react-router-dom:** MemoryRouter for isolated routing tests

### Test Organization

```
src/
├── routing/
│   ├── __tests__/
│   │   ├── constants.test.ts          # Unit tests for route constants
│   │   ├── routes.test.ts             # Unit tests for route config
│   │   ├── ProtectedRoute.test.tsx    # Unit tests for route guard
│   │   ├── AppRouter.test.tsx         # Integration tests for router
│   │   ├── useNavigation.test.ts      # Unit tests for navigation hook
│   │   └── properties/
│   │       ├── auth.property.test.tsx      # Properties 1-5 (auth)
│   │       ├── routing.property.test.tsx   # Properties 6-8 (routing)
│   │       ├── navigation.property.test.tsx # Properties 9-11 (navigation)
│   │       └── integration.property.test.tsx # Properties 12-13 (integration)
```

### Example Unit Tests

```typescript
// Unit test for specific scenario
describe('ProtectedRoute', () => {
  it('redirects to home when user is not authenticated', () => {
    const { container } = render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <WalletProvider initialStatus="idle">
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div>Dashboard</div>
              </ProtectedRoute>
            } />
            <Route path="/" element={<div>Home</div>} />
          </Routes>
        </WalletProvider>
      </MemoryRouter>
    );
    
    expect(container.textContent).toBe('Home');
  });

  it('preserves intended URL in sessionStorage', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard?tab=groups']}>
        <WalletProvider initialStatus="idle">
          <Routes>
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <div>Dashboard</div>
              </ProtectedRoute>
            } />
          </Routes>
        </WalletProvider>
      </MemoryRouter>
    );
    
    expect(sessionStorage.getItem('redirectAfterAuth')).toBe('/dashboard?tab=groups');
  });
});
```

### Continuous Integration

All tests must pass before merging:
- Unit tests run on every commit
- Property tests run on every pull request
- Coverage reports generated and tracked
- Failed tests block deployment

## Implementation Notes

### Migration Strategy

1. **Phase 1: Setup** (Day 1)
   - Install react-router-dom and types
   - Create routing directory structure
   - Define route constants and types

2. **Phase 2: Core Routing** (Day 2)
   - Implement route configuration
   - Create ProtectedRoute component
   - Set up AppRouter with error boundary
   - Integrate BrowserRouter in main.tsx

3. **Phase 3: Page Components** (Day 3)
   - Create placeholder page components
   - Migrate existing App.tsx content to HomePage
   - Implement NotFoundPage

4. **Phase 4: Component Integration** (Day 4)
   - Update Header with Link components
   - Update WalletButton with navigation
   - Update GroupCard with Link components
   - Implement useAuthRedirect hook

5. **Phase 5: Testing** (Day 5)
   - Write unit tests for all routing components
   - Implement property-based tests
   - Verify all 13 correctness properties
   - Test integration points

### Performance Considerations

- **Code Splitting:** Route components are lazy-loaded to reduce initial bundle size
- **Suspense Boundaries:** Loading states prevent layout shift during component loading
- **Memoization:** Route configuration is defined once and reused
- **Navigation Optimization:** React Router's built-in optimizations prevent unnecessary re-renders

### Accessibility Considerations

- **Focus Management:** Focus moves to main content on route change
- **Announcements:** Route changes announced to screen readers via live region
- **Skip Links:** Skip navigation links available on all pages
- **Keyboard Navigation:** All navigation links keyboard accessible

### Security Considerations

- **Route Protection:** Authentication checked on every protected route access
- **URL Validation:** Invalid routes handled gracefully without exposing system info
- **State Management:** Sensitive data not stored in URL parameters
- **Redirect Validation:** Redirect URLs validated to prevent open redirect vulnerabilities

### Browser Compatibility

- **HTML5 History API:** Required for BrowserRouter (supported in all modern browsers)
- **Fallback:** Server must be configured to serve index.html for all routes
- **IE11:** Not supported (React 18 requirement)

### Development Server Configuration

Vite dev server must be configured to handle client-side routing:

```typescript
// vite.config.ts
export default defineConfig({
  server: {
    historyApiFallback: true, // Redirect all requests to index.html
  },
});
```

### Production Build Configuration

Production server (e.g., Nginx) must redirect all routes to index.html:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```
