import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { SearchBar } from '../components/SearchBar';

import { renderWithA11y, expectNoA11yViolations } from './a11yHelpers';

describe('SearchBar – accessibility', () => {
  it('has no axe violations (empty)', async () => {
    const { container } = renderWithA11y(<SearchBar onSearch={vi.fn()} />);
    await expectNoA11yViolations(container);
  });

  it('has no axe violations (with suggestions)', async () => {
    const user = userEvent.setup();
    const { container } = renderWithA11y(
      <SearchBar onSearch={vi.fn()} suggestions={['Alpha Group', 'Beta Circle']} />
    );
    await user.type(screen.getByRole('searchbox'), 'al');
    await expectNoA11yViolations(container);
  });

  it('input has role="searchbox" or type="search"', () => {
    renderWithA11y(<SearchBar onSearch={vi.fn()} />);
    expect(screen.getByRole('searchbox')).toBeInTheDocument();
  });

  it('input has aria-label', () => {
    renderWithA11y(<SearchBar onSearch={vi.fn()} />);
    expect(screen.getByLabelText(/search/i)).toBeInTheDocument();
  });

  it('clear button has aria-label', async () => {
    const user = userEvent.setup();
    renderWithA11y(<SearchBar onSearch={vi.fn()} />);
    await user.type(screen.getByRole('searchbox'), 'test');
    expect(screen.getByRole('button', { name: /clear search/i })).toBeInTheDocument();
  });

  it('suggestions list has role="listbox"', async () => {
    const user = userEvent.setup();
    renderWithA11y(<SearchBar onSearch={vi.fn()} suggestions={['Alpha Group', 'Beta Circle']} />);
    await user.type(screen.getByRole('searchbox'), 'al');
    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('search icon is aria-hidden', () => {
    renderWithA11y(<SearchBar onSearch={vi.fn()} />);
    const icon = document.querySelector('.search-bar-icon');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });
});
