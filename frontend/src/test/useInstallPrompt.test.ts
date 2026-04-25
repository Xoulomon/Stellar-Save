import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useInstallPrompt } from '../hooks/useInstallPrompt';

function makePromptEvent(outcome: 'accepted' | 'dismissed') {
  return Object.assign(new Event('beforeinstallprompt'), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome }),
  });
}

describe('useInstallPrompt', () => {
  beforeEach(() => {
    vi.spyOn(window, 'addEventListener');
    vi.spyOn(window, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('canInstall is false initially', () => {
    const { result } = renderHook(() => useInstallPrompt());
    expect(result.current.canInstall).toBe(false);
  });

  it('canInstall becomes true when beforeinstallprompt fires', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = makePromptEvent('accepted');

    act(() => {
      window.dispatchEvent(event);
    });

    expect(result.current.canInstall).toBe(true);
  });

  it('install calls prompt() and returns outcome', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = makePromptEvent('accepted');

    act(() => { window.dispatchEvent(event); });

    let outcome: string | null = null;
    await act(async () => {
      outcome = await result.current.install();
    });

    expect(event.prompt).toHaveBeenCalledTimes(1);
    expect(outcome).toBe('accepted');
    expect(result.current.canInstall).toBe(false); // cleared after install
  });

  it('install returns null when no prompt is available', async () => {
    const { result } = renderHook(() => useInstallPrompt());
    const outcome = await result.current.install();
    expect(outcome).toBeNull();
  });

  it('dismiss clears the deferred prompt', () => {
    const { result } = renderHook(() => useInstallPrompt());
    const event = makePromptEvent('dismissed');

    act(() => { window.dispatchEvent(event); });
    expect(result.current.canInstall).toBe(true);

    act(() => { result.current.dismiss(); });
    expect(result.current.canInstall).toBe(false);
  });

  it('removes event listener on unmount', () => {
    const { unmount } = renderHook(() => useInstallPrompt());
    unmount();
    expect(window.removeEventListener).toHaveBeenCalledWith('beforeinstallprompt', expect.any(Function));
  });
});
