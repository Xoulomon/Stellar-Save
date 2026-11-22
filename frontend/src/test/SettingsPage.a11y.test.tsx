import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import SettingsPage from '../pages/SettingsPage';

import { withRouter, expectNoA11yViolations } from './a11yHelpers';

describe('SettingsPage – accessibility', () => {
  it('has no axe violations', async () => {
    const { container } = withRouter(<SettingsPage />);
    await expectNoA11yViolations(container);
  });

  it('theme radio buttons are labelled', () => {
    withRouter(<SettingsPage />);
    expect(screen.getByRole('radio', { name: /light/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /dark/i })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /system/i })).toBeInTheDocument();
  });

  it('theme radio buttons share a name attribute (radio group)', () => {
    withRouter(<SettingsPage />);
    const radios = screen.getAllByRole('radio');
    const names = radios.map((r) => r.getAttribute('name'));
    expect(new Set(names).size).toBe(1);
  });

  it('radio buttons are keyboard navigable', async () => {
    const user = userEvent.setup();
    withRouter(<SettingsPage />);
    const lightRadio = screen.getByRole('radio', { name: /light/i });
    lightRadio.focus();
    expect(document.activeElement).toBe(lightRadio);
    await user.keyboard('{ArrowDown}');
    expect(['dark', 'system', 'light']).toContain(
      (document.activeElement as HTMLInputElement)?.value
    );
  });
});
