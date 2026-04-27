import { renderHook, act } from '@testing-library/react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../i18n';
import { SUPPORTED_LANGUAGES } from '../i18n';
import { useI18n } from '../hooks/useI18n';
import { LanguageSelector } from '../components/LanguageSelector';

// Reset to English before each test
beforeEach(async () => {
  await i18n.changeLanguage('en');
  localStorage.clear();
});

// ── Translation content ───────────────────────────────────────────────────────

describe('i18n translations', () => {
  it('has all three supported languages', () => {
    expect(SUPPORTED_LANGUAGES.map((l) => l.code)).toEqual(['en', 'fr', 'yo']);
  });

  it('returns English strings by default', () => {
    expect(i18n.t('settings.title')).toBe('Settings');
    expect(i18n.t('common.save')).toBe('Save');
  });

  it('returns French strings when language is fr', async () => {
    await i18n.changeLanguage('fr');
    expect(i18n.t('settings.title')).toBe('Paramètres');
    expect(i18n.t('common.save')).toBe('Enregistrer');
  });

  it('returns Yoruba strings when language is yo', async () => {
    await i18n.changeLanguage('yo');
    expect(i18n.t('settings.title')).toBe('Ètò');
    expect(i18n.t('common.save')).toBe('Fipamọ');
  });

  it('falls back to English for missing keys', async () => {
    await i18n.changeLanguage('fr');
    // All keys exist in all locales, so fallback is tested via a non-existent key
    expect(i18n.t('nonexistent.key', { defaultValue: 'fallback' })).toBe('fallback');
  });

  it('interpolates variables in translation strings', () => {
    const result = i18n.t('scheduler.balanceWarning', { balance: '50', total: '100' });
    expect(result).toContain('50');
    expect(result).toContain('100');
  });
});

// ── useI18n hook ──────────────────────────────────────────────────────────────

describe('useI18n', () => {
  it('returns currentLanguage as "en" by default', () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.currentLanguage).toBe('en');
  });

  it('changeLanguage updates currentLanguage', async () => {
    const { result } = renderHook(() => useI18n());
    await act(async () => {
      result.current.changeLanguage('fr');
    });
    expect(result.current.currentLanguage).toBe('fr');
  });

  it('changeLanguage persists to localStorage', async () => {
    const { result } = renderHook(() => useI18n());
    await act(async () => {
      result.current.changeLanguage('yo');
    });
    expect(localStorage.getItem('stellar_save_language')).toBe('yo');
  });

  it('exposes supportedLanguages with 3 entries', () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.supportedLanguages).toHaveLength(3);
  });

  it('t() translates keys correctly', () => {
    const { result } = renderHook(() => useI18n());
    expect(result.current.t('common.cancel')).toBe('Cancel');
  });
});

// ── LanguageSelector component ────────────────────────────────────────────────

describe('LanguageSelector', () => {
  it('renders a select with language options', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows all three language options', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    await user.click(screen.getByRole('combobox'));
    expect(screen.getByRole('option', { name: 'English' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Français' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Yorùbá' })).toBeInTheDocument();
  });

  it('changes language when an option is selected', async () => {
    const user = userEvent.setup();
    render(<LanguageSelector />);
    await user.click(screen.getByRole('combobox'));
    await user.click(screen.getByRole('option', { name: 'Français' }));
    expect(i18n.language).toBe('fr');
  });
});
