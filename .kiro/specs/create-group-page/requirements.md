# Requirements Document

## Introduction

This feature introduces a `CreateGroupPage` — a fully functional, responsive page in the Stellar Save web application that allows authenticated users to create a new ROSCA (Rotational Savings and Credit Association) savings group. The page embeds a multi-step form for entering group details, validates inputs, submits the group creation request to the Stellar/Soroban smart contract backend, and guides the user through loading, error, and success states before redirecting them to the newly created group.

## Glossary

- **CreateGroupPage**: The top-level page component that hosts the group creation flow.
- **CreateGroupForm**: The multi-step form component embedded within `CreateGroupPage`.
- **FormState**: The in-memory state object tracking all field values, validation errors, submission status, and step index.
- **GroupData**: The validated payload derived from `FormState` that is passed to the API/contract handler.
- **Validator**: The client-side validation logic that checks each field against defined rules.
- **API_Handler**: The async function or hook responsible for invoking the Soroban smart contract `create_group` call.
- **Router**: The React Router instance used for programmatic navigation.
- **SuccessState**: The UI state displayed after a group is successfully created, before redirect.
- **LoadingState**: The UI state displayed while the API call is in-flight.
- **ErrorState**: The UI state displayed when the API call returns an error.
- **XLM**: The native currency of the Stellar network.
- **Stroops**: The smallest unit of XLM (1 XLM = 10,000,000 stroops); used internally by the smart contract.

---

## Requirements

### Requirement 1: Page Rendering and Layout

**User Story:** As an authenticated user, I want to navigate to a dedicated Create Group page, so that I can start the group creation process in a focused, uncluttered view.

#### Acceptance Criteria

1. THE `CreateGroupPage` SHALL render within the existing `AppLayout` component, consistent with other pages such as `DashboardPage` and `GroupsPage`.
2. THE `CreateGroupPage` SHALL display a page title of "Create Group" and a subtitle of "Set up your savings circle".
3. THE `CreateGroupPage` SHALL be accessible at the route `/groups/create`.
4. WHEN a user navigates to `/groups/create`, THE `Router` SHALL render `CreateGroupPage` without a full page reload.
5. THE `CreateGroupPage` SHALL be fully responsive, adapting its layout for viewport widths of 320px (mobile), 768px (tablet), and 1024px and above (desktop).

---

### Requirement 2: Multi-Step Form Structure

**User Story:** As a user creating a group, I want the form broken into logical steps, so that I am not overwhelmed by all fields at once.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL present the form in exactly 4 sequential steps: (1) Basic Information, (2) Financial Settings, (3) Group Settings, (4) Review & Confirm.
2. THE `CreateGroupForm` SHALL display a progress indicator showing the current step out of 4 total steps.
3. WHEN the user is on step 1, 2, or 3, THE `CreateGroupForm` SHALL display a "Next" button to advance to the subsequent step.
4. WHEN the user is on step 2, 3, or 4, THE `CreateGroupForm` SHALL display a "Back" button to return to the previous step.
5. WHEN the user is on step 4, THE `CreateGroupForm` SHALL display a "Create Group" submit button in place of the "Next" button.
6. THE `CreateGroupForm` SHALL display a "Cancel" button on all steps that navigates the user back to the `/groups` route.

---

### Requirement 3: Form Fields — Basic Information (Step 1)

**User Story:** As a user, I want to provide a name and description for my group, so that other members can identify and understand the group's purpose.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL render a "Group Name" text input field on step 1.
2. THE `CreateGroupForm` SHALL render a "Description" textarea field on step 1.
3. WHEN the "Group Name" field value has fewer than 3 characters, THE `Validator` SHALL produce the error message "Group name must be at least 3 characters".
4. WHEN the "Group Name" field value exceeds 50 characters, THE `Validator` SHALL produce the error message "Group name must be 50 characters or fewer".
5. IF the "Description" field is empty when the user attempts to advance from step 1, THEN THE `Validator` SHALL produce the error message "Description is required".
6. WHEN the "Description" field value exceeds 200 characters, THE `Validator` SHALL produce the error message "Description must be 200 characters or fewer".
7. WHEN a validation error is present on a field, THE `CreateGroupForm` SHALL display the error message directly below the corresponding input, associated via `aria-describedby`.

---

### Requirement 4: Form Fields — Financial Settings (Step 2)

**User Story:** As a user, I want to specify the contribution amount and cycle duration, so that all members know the financial commitment.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL render a "Contribution Amount (XLM)" numeric input field on step 2.
2. THE `CreateGroupForm` SHALL render a "Cycle Duration" selection control on step 2, offering the options: Weekly (604800 seconds), Bi-Weekly (1209600 seconds), and Monthly (2592000 seconds).
3. IF the "Contribution Amount" field value is not a positive number greater than 0 when the user attempts to advance from step 2, THEN THE `Validator` SHALL produce the error message "Contribution amount must be greater than 0".
4. IF the "Cycle Duration" field has no selection when the user attempts to advance from step 2, THEN THE `Validator` SHALL produce the error message "Cycle duration is required".
5. THE `CreateGroupForm` SHALL display helper text "Amount each member contributes per cycle" beneath the contribution amount field.

---

### Requirement 5: Form Fields — Group Settings (Step 3)

**User Story:** As a user, I want to define the membership limits for my group, so that the group size is controlled.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL render a "Maximum Members" numeric input field on step 3.
2. THE `CreateGroupForm` SHALL render a "Minimum Members" numeric input field on step 3, pre-populated with the value `2`.
3. IF the "Maximum Members" value is less than 2 when the user attempts to advance from step 3, THEN THE `Validator` SHALL produce the error message "Maximum members must be at least 2".
4. IF the "Minimum Members" value is less than 2 when the user attempts to advance from step 3, THEN THE `Validator` SHALL produce the error message "Minimum members must be at least 2".
5. IF the "Maximum Members" value is less than the "Minimum Members" value when the user attempts to advance from step 3, THEN THE `Validator` SHALL produce the error message "Maximum members must be greater than or equal to minimum members".

---

### Requirement 6: Review Step (Step 4)

**User Story:** As a user, I want to review all my inputs before submitting, so that I can confirm the details are correct.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL display all entered values on step 4 in a read-only summary layout, including: Group Name, Description, Contribution Amount (in XLM), Cycle Duration (as a human-readable label, e.g., "Weekly"), Maximum Members, and Minimum Members.
2. THE `CreateGroupForm` SHALL NOT allow editing of fields directly on step 4; the user SHALL use the "Back" button to return to a prior step to make changes.

---

### Requirement 7: Form Submission

**User Story:** As a user, I want to submit the form and have the group created on-chain, so that I can start inviting members.

#### Acceptance Criteria

1. WHEN the user clicks "Create Group" on step 4, THE `CreateGroupPage` SHALL invoke the `API_Handler` with the validated `GroupData` payload.
2. THE `GroupData` payload SHALL include: `name` (string), `description` (string), `contribution_amount` (number, converted to stroops by multiplying XLM value by 10,000,000), `cycle_duration` (number in seconds), `max_members` (integer), and `min_members` (integer).
3. WHILE the `API_Handler` call is in-flight, THE `CreateGroupPage` SHALL display the `LoadingState`, disabling the "Create Group" button and showing a spinner.
4. WHILE the `API_Handler` call is in-flight, THE `CreateGroupPage` SHALL prevent duplicate submissions by disabling all form interaction.

---

### Requirement 8: Success State and Redirect

**User Story:** As a user, after successfully creating a group, I want to see a confirmation and be redirected, so that I know the action succeeded and can proceed.

#### Acceptance Criteria

1. WHEN the `API_Handler` resolves successfully, THE `CreateGroupPage` SHALL display the `SuccessState`, showing a success message "Group created successfully!" and the name of the created group.
2. WHEN the `SuccessState` is displayed, THE `Router` SHALL automatically redirect the user to `/groups` after a delay of 2000 milliseconds.
3. WHERE the `API_Handler` returns a new group ID, THE `Router` SHALL redirect to `/groups/:groupId` instead of `/groups`.

---

### Requirement 9: Error Handling

**User Story:** As a user, if group creation fails, I want to see a clear error message, so that I understand what went wrong and can try again.

#### Acceptance Criteria

1. WHEN the `API_Handler` rejects or throws an error, THE `CreateGroupPage` SHALL display the `ErrorState`, showing the error message returned by the handler or a fallback message of "Failed to create group. Please try again.".
2. WHEN the `ErrorState` is displayed, THE `CreateGroupPage` SHALL re-enable the "Create Group" button so the user can retry submission.
3. WHEN the `ErrorState` is displayed, THE `CreateGroupPage` SHALL NOT clear the form fields, preserving the user's input.
4. IF the `API_Handler` error message is empty or undefined, THEN THE `CreateGroupPage` SHALL display the fallback message "Failed to create group. Please try again.".

---

### Requirement 10: Accessibility

**User Story:** As a user relying on assistive technology, I want the form to be navigable and understandable, so that I can complete group creation without barriers.

#### Acceptance Criteria

1. THE `CreateGroupForm` SHALL associate every input field with a visible `<label>` element using matching `for`/`id` attributes.
2. THE `CreateGroupForm` SHALL mark all required fields with an `aria-required="true"` attribute.
3. WHEN a validation error is present, THE `CreateGroupForm` SHALL set `aria-invalid="true"` on the corresponding input and link the error message via `aria-describedby`.
4. THE `CreateGroupForm` SHALL ensure all interactive elements (buttons, inputs, selects) are reachable and operable via keyboard navigation in logical tab order.
5. WHEN the `SuccessState` or `ErrorState` is displayed, THE `CreateGroupPage` SHALL announce the state change to screen readers using an `aria-live="polite"` region.

---

### Requirement 11: Responsiveness

**User Story:** As a user on any device, I want the Create Group page to display correctly, so that I can create a group from mobile, tablet, or desktop.

#### Acceptance Criteria

1. THE `CreateGroupPage` SHALL use a single-column layout on viewports narrower than 768px.
2. THE `CreateGroupPage` SHALL use a centered, max-width-constrained layout (max-width: 640px) on viewports 768px and wider.
3. THE `CreateGroupForm` SHALL ensure touch targets for buttons and inputs are at least 44px in height on mobile viewports.
