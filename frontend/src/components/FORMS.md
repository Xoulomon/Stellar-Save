# Form State Management

`frontend/src` standardizes on **[react-hook-form](https://react-hook-form.com/)** for form
state, validation, and submission. New forms should follow this pattern instead of wiring up
ad-hoc `useState` per field or reading values from uncontrolled refs by hand.

## Why

Before this convention, forms in this codebase mixed two styles:

- A `useState` object holding all field values, updated via a hand-written `updateField` /
  `setValues` helper, with a second `useState` for field errors (e.g. `CreateGroupForm`,
  `GroupSettings`, `ContributionFlow`).
- Native `<textarea>`/`<input>` elements wired directly to `useState` with no shared validation
  helper (e.g. `GroupComments`).

Both styles work, but they duplicate boilerplate per form, make validation timing inconsistent
(some validate on every keystroke, some only on submit, some only on blur), and make it easy to
forget to clear an error or reset a field after submit. `react-hook-form` gives every form the
same building blocks (`register`, `handleSubmit`, `formState.errors`, `watch`, `reset`) so the
validation UX is consistent across the app.

## Pattern

```tsx
import { useForm } from "react-hook-form";

interface FormValues {
  name: string;
  amount: string;
}

function ExampleForm({ onSubmit }: { onSubmit: (values: FormValues) => void }) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    defaultValues: { name: "", amount: "" },
    mode: "onSubmit", // validate on submit; use "onChange" for live feedback (e.g. char counters)
  });

  const onValid = (values: FormValues) => {
    onSubmit(values);
    reset();
  };

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate>
      <input
        {...register("name", { required: "Name is required." })}
        aria-invalid={!!errors.name}
      />
      {errors.name && <span role="alert">{errors.name.message}</span>}

      <button type="submit" disabled={isSubmitting}>
        Save
      </button>
    </form>
  );
}
```

Key points:

- **`register(field, rules)`** wires an uncontrolled `<input>`/`<textarea>`/`<select>` to the
  form. Spread it directly onto the native element, or onto a component that forwards `ref`
  (MUI's `TextField` does; this repo's plain `Input` component does not — see below).
- **`handleSubmit(onValid)`** replaces hand-rolled `e.preventDefault()` + manual validation.
  Validation runs first; `onValid` only fires once every field passes.
- **`formState.errors`** replaces a parallel `useState<Errors>` object — one source of truth for
  both values and errors.
- **`watch(field)`** replaces reading from a `values` state object when you need the live value
  for something other than the input itself (character counters, cross-field previews, submit
  button disabled state).
- **`reset(values?)`** replaces manually setting state back to an empty object after a
  successful submit, and also clears the underlying DOM value for uncontrolled inputs.
- Prefer `validate` functions (or the built-in `required` / `minLength` / `maxLength` / `pattern`
  rules) co-located with the field's `register` call over a separate hand-written validator,
  unless the schema is already shared elsewhere (e.g. `schemas/groupSchema.ts`), in which case
  drive `register`'s `validate` off the shared schema/constants rather than duplicating limits.

### Components without `forwardRef`

This repo's plain `Input` component (`components/Input.tsx`) is a function component that does
not forward refs, so `register`'s `ref` cannot attach to it directly. For forms built on `Input`,
either wrap the field with react-hook-form's `Controller` and pass `field.value` /
`field.onChange` explicitly, or migrate the component to `forwardRef` first. Forms built on MUI's
`TextField` (which does forward refs) can spread `register(...)` directly, as `GroupSettings`
does.

## Migrated examples

- `components/GroupSettings.tsx` — MUI `TextField` fields wired with `register`, validation
  errors from `formState.errors`, live character counts from `watch`.
- `components/GroupComments.tsx` — a single-field comment form; `watch` drives the character
  counter and the submit button's disabled state, `reset` clears the textarea after posting.

Multi-step forms with existing schema-driven validation (e.g. `CreateGroupForm`, which already
validates against `schemas/groupSchema.ts` per wizard step) were left as-is in this pass to keep
the change scoped — they are reasonable candidates for a follow-up migration onto
`useForm`'s multi-step / `trigger()` support, ideally paired with `@hookform/resolvers/zod` so the
existing Zod schema drives validation directly instead of the hand-written `validateFormStep`
helper.
