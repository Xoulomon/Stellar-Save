import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormField } from './FormField';

describe('FormField', () => {
  it('associates the label and required indicator with its control', () => {
    render(
      <FormField id="group-name" label="Group name" required>
        <input id="group-name" />
      </FormField>
    );

    expect(screen.getByLabelText(/Group name/)).toHaveAttribute('id', 'group-name');
  });

  it('shows validation errors instead of helper text', () => {
    render(
      <FormField id="group-name" error="Name is required." helperText="Enter a group name">
        <input id="group-name" aria-describedby="group-name-error" />
      </FormField>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Name is required.');
    expect(screen.queryByText('Enter a group name')).not.toBeInTheDocument();
  });
});
