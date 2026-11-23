import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, beforeEach } from 'vitest';

import { AppThemeProvider, useTheme } from './ThemeContext';

describe('AppThemeProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shares theme state through a scoped context', () => {
    const { result } = renderHook(() => useTheme(), {
      wrapper: AppThemeProvider,
    });

    act(() => result.current.setMode('dark'));

    expect(result.current.mode).toBe('dark');
    expect(result.current.resolvedMode).toBe('dark');
    expect(result.current.isDark).toBe(true);
    expect(localStorage.getItem('stellar-save-theme')).toBe('dark');
  });

  it('toggles a resolved system preference', () => {
    localStorage.setItem('stellar-save-theme', 'light');
    const { result } = renderHook(() => useTheme(), {
      wrapper: AppThemeProvider,
    });

    act(() => result.current.toggleTheme());

    expect(result.current.mode).toBe('dark');
  });

  it('throws when used outside the provider', () => {
    expect(() => renderHook(() => useTheme())).toThrow(
      'useThemeMode must be used inside <AppThemeProvider>.'
    );
  });
});
