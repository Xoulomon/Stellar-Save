# Implementation Plan: create-group-page

## Overview

Implement the Create Group page for Stellar Save: a 4-step form that collects group details, validates inputs, converts values to the Soroban contract format, and handles loading/success/error states before redirecting to the new group. The work touches six files across utils, routing, components, and pages.

## Tasks

- [x] 1. Set up groupApi utility and routing constants
  - Create `frontend/src/utils/groupApi.ts` with the `GroupData` interface and `createGroup` stub that returns a mock group ID
  - Add `GROUP_CREATE: "/groups/create"` to the `ROUTES` constant object in `frontend/src/routing/constants.ts`
  - Add `groupDetail` helper already exists; add no duplicate — only the constant entry is needed
  - _Requirements: 1.3, 7.1, 7.2_

- [x] 2. Wire CreateGroupPage into the router
  - Add a lazy import for `CreateGroupPage` in `frontend/src/routing/routes.tsx`
  - Add a route config entry `{ path: ROUTES.GROUP_CREATE, component: CreateGroupPage, protected: true, title: 'Create Group - Stellar Save', description: 'Create a new savings group' }` to `routeConfig`
  - _Requirements: 1.3, 1.4_

- [x] 3. Upgrade CreateGroupForm — validation logic
  - In `frontend/src/components/CreateGroupForm.tsx`, update `FormErrors` to use `string | undefined` values (not `Partial<FormData>`)
  - Update `validateStep` for step 1: name length 3–50 with exact error messages from the spec; description length 1–200
  - Update `validateStep` for step 2: contribution amount > 0 with exact error message; cycleDuration non-empty with exact error message
  - Update `validateStep` for step 3: maxMembers ≥ 2, minMembers ≥ 2, maxMembers ≥ minMembers — all with exact error messages from the spec
  - Export a pure `validateField` or `validateStep` function so it can be unit-tested in isolation
  - _Requirements: 3.3, 3.4, 3.5, 3.6, 4.3, 4.4, 5.3, 5.4, 5.5_

  - [ ]* 3.1 Write property test for group name length validation (Property 3)
    - **Property 3: group name length validation**
    - Generate strings of length 0–2 (expect "Group name must be at least 3 characters"), 51+ (expect "Group name must be 50 characters or fewer"), and 3–50 (expect no error)
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 3.2 Write property test for description length validation (Property 4)
    - **Property 4: description length validation**
    - Generate strings of length 0 (expect "Description is required"), 201+ (expect "Description must be 200 characters or fewer"), and 1–200 (expect no error)
    - **Validates: Requirements 3.5, 3.6**

  - [ ]* 3.3 Write property test for contribution amount validation (Property 6)
    - **Property 6: contribution amount validation**
    - Generate numbers ≤ 0 (expect "Contribution amount must be greater than 0") and positive numbers (expect no error)
    - **Validates: Requirements 4.3**

  - [ ]* 3.4 Write property test for member count validation (Property 7)
    - **Property 7: member count validation**
    - Generate integers < 2 for max (expect "Maximum members must be at least 2"), integers < 2 for min (expect "Minimum members must be at least 2"), and pairs where max < min (expect "Maximum members must be greater than or equal to minimum members")
    - **Validates: Requirements 5.3, 5.4, 5.5**

- [x] 4. Upgrade CreateGroupForm — step 2 cycle duration select
  - Replace the raw number input for `cycleDuration` with an `AppSelectField` (or equivalent select control) rendering the three `CYCLE_DURATION_OPTIONS`: Weekly (604800), Bi-Weekly (1209600), Monthly (2592000)
  - Export `CYCLE_DURATION_OPTIONS` constant from `CreateGroupForm.tsx` or a shared location so tests can import it
  - _Requirements: 4.2_

- [x] 5. Upgrade CreateGroupForm — review step and XLM→stroops conversion
  - On step 4, display cycle duration as a human-readable label ("Weekly" / "Bi-Weekly" / "Monthly") by looking up the selected value in `CYCLE_DURATION_OPTIONS`
  - Update `handleSubmit` to convert `contributionAmount` to stroops (`Math.round(parseFloat(contributionAmount) * 10_000_000)`) and call `onSubmit` with a `GroupData`-shaped payload (not raw `FormData`)
  - Update `CreateGroupFormProps.onSubmit` signature to accept `GroupData` instead of `FormData`
  - _Requirements: 6.1, 7.2_

  - [ ]* 5.1 Write property test for XLM to stroops conversion (Property 9)
    - **Property 9: XLM to stroops conversion**
    - Generate random positive floats; assert `contribution_amount` in submitted payload equals `Math.round(xlm * 10_000_000)`
    - **Validates: Requirements 7.2**

  - [ ]* 5.2 Write property test for review step displaying all form data (Property 8)
    - **Property 8: review step displays all form data**
    - Generate random valid `FormData`; render form at step 4; assert group name, description, XLM amount, human-readable cycle label, max members, and min members all appear in the summary
    - **Validates: Requirements 6.1**

- [x] 6. Upgrade CreateGroupForm — accessibility attributes
  - Add `aria-required="true"` to all required `<Input>` and select elements
  - Ensure each `<Input>` has `aria-invalid` and `aria-describedby` wired to the error message element when an error is present
  - Ensure `<label>` elements use `htmlFor` matching the input `id` on every field
  - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [ ]* 6.1 Write property test for validation error accessibility (Property 5)
    - **Property 5: validation errors are accessible**
    - For any field with an error: assert `aria-invalid="true"`, `aria-describedby` points to the error element id, and a `<label>` with matching `htmlFor` is present
    - **Validates: Requirements 3.7, 10.1, 10.2, 10.3**

- [x] 7. Upgrade CreateGroupForm — step navigation and progress indicator
  - Ensure "Cancel" button is rendered on all 4 steps (currently gated on `onCancel` being defined — make it always rendered when prop is provided, and `CreateGroupPage` always passes it)
  - Verify progress indicator marks segments 1 through `step` as active (already implemented; confirm it matches spec: exactly `step` active segments)
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_

  - [ ]* 7.1 Write property test for step navigation controls (Property 1)
    - **Property 1: step navigation controls are consistent**
    - For each step in {1,2,3,4}: assert "Next" present iff step ∈ {1,2,3}; "Back" present iff step ∈ {2,3,4}; "Create Group" present iff step = 4; "Cancel" present on all steps
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**

  - [ ]* 7.2 Write property test for progress indicator (Property 2)
    - **Property 2: progress indicator reflects current step**
    - For each step in {1,2,3,4}: count `.progress-step.active` elements; assert count equals step value
    - **Validates: Requirements 2.2**

- [x] 8. Checkpoint — form component complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Create CreateGroupPage component
  - Create `frontend/src/pages/CreateGroupPage.tsx`
  - Define `SubmitStatus = 'idle' | 'loading' | 'success' | 'error'` and `PageState` interface
  - Render `AppLayout` with `title="Create Group"` and `subtitle="Set up your savings circle"`
  - Render `CreateGroupForm` passing `onSubmit`, `onCancel` (navigates to `/groups`), and `isSubmitting` prop
  - On submit: set status to `'loading'`, call `createGroup(payload)`, on resolve set `'success'` + `groupId`, on reject extract error message with fallback `"Failed to create group. Please try again."`
  - Add an `aria-live="polite"` region that renders the success message or error message based on `PageState.status`
  - _Requirements: 1.1, 1.2, 7.1, 7.3, 7.4, 9.1, 9.2, 9.3, 9.4, 10.5_

- [x] 10. Implement success redirect in CreateGroupPage
  - After `status` transitions to `'success'`, use `useNavigate` to redirect to `/groups/${groupId}` after a 2000ms delay
  - Clean up the timeout on component unmount to avoid state updates on unmounted components
  - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 10.1 Write property test for redirect using returned group ID (Property 10)
    - **Property 10: redirect uses returned group ID**
    - Generate random group ID strings; mock `createGroup` to resolve with each ID; submit the form; assert `useNavigate` was called with `/groups/${groupId}`
    - **Validates: Requirements 8.3**

  - [ ]* 10.2 Write property test for form fields preserved on error (Property 11)
    - **Property 11: form fields preserved on error**
    - Generate random valid `FormData`; mock `createGroup` to reject; submit; assert all field values are unchanged after the error is received
    - **Validates: Requirements 9.3**

- [x] 11. Upgrade CreateGroupForm.css for status, review, and responsive layout
  - Add `.form-submitting` styles that visually indicate the disabled/loading state (reduced opacity, cursor not-allowed)
  - Add `.form-error-banner` styles for the `aria-live` error region (e.g., red border-left, background tint)
  - Add `.form-success-banner` styles for the success region
  - Ensure `.review-section` and `.review-item` styles are complete per the existing skeleton
  - Add responsive rules: full-width padding on viewports < 768px; `max-width: 640px; margin: 0 auto` on ≥ 768px; `min-height: 44px` on buttons and inputs
  - _Requirements: 1.5, 11.1, 11.2, 11.3_

- [x] 12. Write unit tests for CreateGroupPage and routing
  - In `frontend/src/test/`, create `CreateGroupPage.test.tsx` and `CreateGroupForm.test.tsx` (or extend existing)
  - Test: `CreateGroupPage` renders with title "Create Group" and subtitle "Set up your savings circle"
  - Test: route `/groups/create` maps to `CreateGroupPage` (check `routeConfig` entry)
  - Test: step 4 shows "Create Group" button and no "Next" button
  - Test: step 4 renders no editable `<input>` elements
  - Test: `onSubmit` called with correct `GroupData` (including stroops conversion) when form is submitted on step 4
  - Test: loading state disables submit button and shows spinner
  - Test: success state shows "Group created successfully!" and group name
  - Test: error state shows error message and re-enables the button
  - Test: fallback error message shown when error message is empty/undefined
  - Test: `aria-live` region present and updated on success/error
  - Test: `minMembers` pre-populated with `"2"` on step 3
  - Test: cycle duration select renders 3 options (Weekly, Bi-Weekly, Monthly)
  - Test: helper text "Amount each member contributes per cycle" shown beneath contribution amount field
  - _Requirements: 1.1, 1.2, 2.5, 6.1, 7.1, 7.2, 7.3, 8.1, 9.1, 9.2, 9.4, 10.5_

- [x] 13. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Property tests use `fast-check` with a minimum of 100 iterations each; tag format: `Feature: create-group-page, Property N: <text>`
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
