# Implementation Plan: React Router Navigation

## Overview

This implementation plan breaks down the React Router navigation feature into actionable coding tasks following the 5-phase migration strategy outlined in the design document. The tasks cover dependency installation, route configuration, component creation, integration with existing components, testing, and server configuration.

## Tasks

- [-] 1. Phase 1: Setup and Foundation
  - [x] 1.1 Install react-router-dom dependencies
    - Run `npm install react-router-dom` to add routing library
    - Run `npm install -D @types/react-router-dom` for TypeScript support
    - Verify package.json includes both dependencies
    - _Requirements: 1.1, 1.2, 1.3_

  - [x] 1.2 Create routing directory structure
    - Create `src/routing/` directory
    - Create `src/routing/__tests__/` directory for unit tests
    - Create `src/routing/__tests__/properties/` directory for property-based tests
    - Create `src/pages/` directory for page components
    - _Requirements: 2.4_

  - [x] 1.3 Define route constants and types
    - Create `src/routing/constants.ts` with ROUTES object and buildRoute helpers
    - Create `src/routing/types.ts` with RouteConfig and RouteParams interfaces
    - Ensure all route paths use TypeScript const assertions for type safety
    - Export RoutePath type for type-safe route references
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [ ]* 1.4 Write unit tests for route constants
    - Test that ROUTES object contains all expected paths
    - Test that buildRoute.groupDetail generates correct parameterized paths
    - Test type safety of RoutePath type
    - _Requirements: 2.1, 2.2_

- [ ] 2. Phase 2: Core Routing Infrastructure
  - [x] 2.1 Create route configuration
    - Create `src/routing/routes.tsx` with routeConfig array
    - Define all routes with paths, components (lazy-loaded), protected flags, titles, and descriptions
    - Use lazy() for all page component imports
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 2.2 Write unit tests for route configuration
    - Test that routeConfig includes all expected routes
    - Test that protected routes are correctly marked
    - Test that public routes are correctly marked
    - Verify lazy loading configuration
    - _Requirements: 3.1, 3.2, 3.3_

  - [x] 2.3 Implement ProtectedRoute component
    - Create `src/routing/ProtectedRoute.tsx` with authentication check logic
    - Integrate with useWallet hook from WalletProvider
    - Implement redirect to home page for unauthenticated users
    - Store intended destination in sessionStorage for post-auth redirect
    - Render children when authenticated
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 2.4 Write unit tests for ProtectedRoute
    - Test redirect behavior when unauthenticated
    - Test rendering children when authenticated
    - Test sessionStorage preservation of intended URL
    - Test integration with WalletProvider context
    - _Requirements: 4.1, 4.2, 4.3, 4.5_

  - [ ]* 2.5 Write property test for ProtectedRoute authentication check
    - **Property 1: Protected Route Authentication Check**
    - **Validates: Requirements 4.1**
    - Test that all protected routes check wallet authentication status before rendering
    - _Requirements: 4.1_

  - [ ]* 2.6 Write property test for unauthenticated redirect
    - **Property 2: Unauthenticated Redirect**
    - **Validates: Requirements 4.2**
    - Test that all protected routes redirect unauthenticated users to home page
    - _Requirements: 4.2_

  - [ ]* 2.7 Write property test for authenticated access
    - **Property 3: Authenticated Access**
    - **Validates: Requirements 4.3**
    - Test that all protected routes render content for authenticated users
    - _Requirements: 4.3_

  - [ ]* 2.8 Write property test for URL preservation
    - **Property 4: URL Preservation for Redirect**
    - **Validates: Requirements 4.5**
    - Test that all protected routes preserve intended URL in sessionStorage
    - _Requirements: 4.5_

  - [x] 2.9 Create AppRouter component
    - Create `src/routing/AppRouter.tsx` with Routes and Route components
    - Implement RouteLoadingFallback component for Suspense
    - Wrap routes in ErrorBoundary for error handling
    - Map routeConfig to Route elements with conditional ProtectedRoute wrapping
    - Add catch-all route for 404 handling
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 6.1, 6.3_

  - [ ]* 2.10 Write unit tests for AppRouter
    - Test that routes render correct components
    - Test that protected routes are wrapped in ProtectedRoute
    - Test that public routes render without protection
    - Test catch-all route redirects to 404
    - Test Suspense fallback during lazy loading
    - _Requirements: 5.5, 6.1_

  - [ ]* 2.11 Write property test for route matching
    - **Property 6: Route Matching**
    - **Validates: Requirements 5.5**
    - Test that all valid route paths render their corresponding components
    - _Requirements: 5.5_

  - [ ]* 2.12 Write property test for 404 handling
    - **Property 7: 404 Handling**
    - **Validates: Requirements 6.1**
    - Test that all undefined route paths render the 404 page
    - _Requirements: 6.1_

  - [x] 2.13 Integrate BrowserRouter in main.tsx
    - Update `src/main.tsx` to wrap AppRouter with BrowserRouter
    - Ensure BrowserRouter is inside WalletProvider and AppThemeProvider
    - Replace any existing App component with AppRouter
    - _Requirements: 5.1, 5.2, 5.4_

- [ ] 3. Checkpoint - Verify core routing infrastructure
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Phase 3: Page Components
  - [x] 4.1 Create HomePage component
    - Create `src/pages/HomePage.tsx` with landing page content
    - Migrate existing App.tsx landing page content to HomePage
    - Include wallet connection prompt for unauthenticated users
    - _Requirements: 3.1_

  - [x] 4.2 Create DashboardPage component
    - Create `src/pages/DashboardPage.tsx` with user dashboard layout
    - Display user's savings groups overview
    - Include navigation to groups and profile
    - _Requirements: 3.1, 3.2_

  - [x] 4.3 Create GroupsPage component
    - Create `src/pages/GroupsPage.tsx` with groups browsing interface
    - Display list of available savings groups
    - Include search and filter functionality placeholders
    - _Requirements: 3.1, 3.2_

  - [x] 4.4 Create GroupDetailPage component
    - Create `src/pages/GroupDetailPage.tsx` with individual group details
    - Use useNavigation hook to access groupId parameter
    - Display group information, members, and contribution history
    - _Requirements: 3.1, 3.2, 8.1, 8.3_

  - [x] 4.5 Create ProfilePage component
    - Create `src/pages/ProfilePage.tsx` with user profile interface
    - Display user information and wallet address
    - Include navigation to settings
    - _Requirements: 3.1, 3.2_

  - [x] 4.6 Create SettingsPage component
    - Create `src/pages/SettingsPage.tsx` with application settings
    - Include theme preferences and notification settings placeholders
    - _Requirements: 3.1, 3.2_

  - [x] 4.7 Create NotFoundPage component
    - Create `src/pages/NotFoundPage.tsx` with 404 error message
    - Include friendly message explaining page not found
    - Add Link component to navigate back to home page
    - _Requirements: 6.1, 6.2_

  - [ ]* 4.8 Write unit tests for page components
    - Test that each page component renders without errors
    - Test that NotFoundPage includes home link
    - Test that GroupDetailPage accesses route parameters
    - _Requirements: 6.1, 6.2, 8.3_

- [ ] 5. Phase 4: Navigation Utilities and Component Integration
  - [x] 5.1 Create useNavigation hook
    - Create `src/routing/useNavigation.ts` wrapping React Router hooks
    - Implement navigateTo, goBack, goForward functions
    - Expose params and location objects
    - Implement navigateWithState for state passing
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 8.2, 8.3_

  - [ ]* 5.2 Write unit tests for useNavigation hook
    - Test navigateTo function with various paths
    - Test goBack and goForward functions
    - Test params extraction from parameterized routes
    - Test navigateWithState with state data
    - _Requirements: 7.2, 7.3, 7.4, 8.3_

  - [ ]* 5.3 Write property test for programmatic navigation
    - **Property 9: Programmatic Navigation**
    - **Validates: Requirements 7.2**
    - Test that navigation hook can navigate to all valid route paths
    - _Requirements: 7.2_

  - [ ]* 5.4 Write property test for navigation state preservation
    - **Property 10: Navigation State Preservation**
    - **Validates: Requirements 7.4**
    - Test that all state data passed during navigation is accessible at destination
    - _Requirements: 7.4_

  - [ ]* 5.5 Write property test for route parameter access
    - **Property 11: Route Parameter Access**
    - **Validates: Requirements 8.3**
    - Test that all parameterized routes provide access to parameter values
    - _Requirements: 8.3_

  - [x] 5.6 Create useAuthRedirect hook
    - Create `src/routing/useAuthRedirect.ts` for post-authentication redirects
    - Check sessionStorage for redirectAfterAuth on wallet connection
    - Navigate to preserved URL when wallet status becomes 'connected'
    - Clear sessionStorage after successful redirect
    - _Requirements: 4.6_

  - [ ]* 5.7 Write unit tests for useAuthRedirect hook
    - Test redirect behavior when wallet connects
    - Test sessionStorage clearing after redirect
    - Test no redirect when no preserved URL exists
    - _Requirements: 4.6_

  - [ ]* 5.8 Write property test for post-authentication redirect
    - **Property 5: Post-Authentication Redirect**
    - **Validates: Requirements 4.6**
    - Test that all preserved URLs trigger navigation when wallet connects
    - _Requirements: 4.6_

  - [x] 5.9 Update Header component with Link components
    - Update `src/components/Header.tsx` to import Link from react-router-dom
    - Replace all anchor tags with Link components using ROUTES constants
    - Update navigation menu items (Groups, Dashboard, Profile)
    - Ensure active link styling works with React Router
    - _Requirements: 9.1, 9.4_

  - [ ]* 5.10 Write unit tests for Header navigation integration
    - Test that Header renders Link components
    - Test that Links use correct route paths
    - Test navigation menu functionality
    - _Requirements: 9.1, 9.4_

  - [x] 5.11 Update WalletButton component with navigation
    - Update `src/components/WalletButton.tsx` to use useAuthRedirect hook
    - Ensure post-connection redirect works correctly
    - Maintain existing wallet connection/disconnection functionality
    - _Requirements: 9.2, 4.6_

  - [ ]* 5.12 Write unit tests for WalletButton navigation integration
    - Test that WalletButton triggers redirect after connection
    - Test that useAuthRedirect hook is called
    - Test wallet connection flow with navigation
    - _Requirements: 9.2_

  - [ ]* 5.13 Write property test for post-connection navigation
    - **Property 12: Post-Connection Navigation**
    - **Validates: Requirements 9.2**
    - Test that all stored redirect paths trigger navigation when wallet connects
    - _Requirements: 9.2_

  - [x] 5.14 Update GroupCard component with Link components
    - Update `src/components/GroupCard.tsx` to import Link and buildRoute
    - Add groupId prop to GroupCard interface
    - Wrap card content in Link component using buildRoute.groupDetail(groupId)
    - Ensure card styling works with Link wrapper
    - _Requirements: 9.3, 9.4, 8.1_

  - [ ]* 5.15 Write unit tests for GroupCard navigation integration
    - Test that GroupCard renders Link component
    - Test that Link uses correct parameterized route
    - Test that groupId is properly passed to buildRoute
    - _Requirements: 9.3, 9.4_

- [ ] 6. Checkpoint - Verify component integration
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Phase 5: Error Handling and Testing
  - [x] 7.1 Enhance ErrorBoundary for routing errors
    - Update `src/components/ErrorBoundary/ErrorBoundary.tsx` (if exists) or create new RouteErrorBoundary
    - Implement getDerivedStateFromError for error state management
    - Implement componentDidCatch for error logging
    - Add "Go Home" button for recovery
    - Display user-friendly error message for route errors
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.2 Write unit tests for ErrorBoundary
    - Test error catching and fallback UI rendering
    - Test "Go Home" button functionality
    - Test error logging in componentDidCatch
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.3 Write property test for error boundary containment
    - **Property 8: Error Boundary Containment**
    - **Validates: Requirements 6.3, 6.4**
    - Test that all route component errors are caught and displayed without crashing app
    - _Requirements: 6.3, 6.4_

  - [ ]* 7.4 Write property test for application state preservation
    - **Property 13: Application State Preservation**
    - **Validates: Requirements 9.5**
    - Test that all navigation sequences preserve React context state
    - _Requirements: 9.5_

  - [ ]* 7.5 Write integration tests for complete navigation flows
    - Test unauthenticated user attempting to access protected route
    - Test authenticated user navigating between protected routes
    - Test wallet connection triggering redirect to preserved URL
    - Test 404 page navigation and home link
    - Test error boundary catching route component errors
    - _Requirements: 4.2, 4.3, 4.6, 6.1, 6.2, 6.3_

- [ ] 8. Server Configuration
  - [ ] 8.1 Configure Vite dev server for client-side routing
    - Update `vite.config.ts` to add historyApiFallback configuration
    - Ensure all routes redirect to index.html during development
    - Test that refreshing on any route works correctly in dev mode
    - _Requirements: 5.2_

  - [ ] 8.2 Document production server configuration
    - Create or update deployment documentation with Nginx configuration example
    - Include try_files directive for client-side routing support
    - Add notes about server configuration requirements for other hosting platforms
    - _Requirements: 5.2_

- [ ] 9. Final Checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across all inputs
- Unit tests validate specific examples, edge cases, and integration points
- All 13 correctness properties from the design document are covered in property test tasks
- The implementation follows the 5-phase migration strategy: Setup → Core Routing → Pages → Integration → Testing
- TypeScript is used throughout for type safety and better developer experience
- Lazy loading is used for all page components to optimize bundle size
- Error boundaries prevent routing errors from crashing the entire application
