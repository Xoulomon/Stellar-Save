import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { useTransactionConfirmation } from '../../hooks/useTransactionConfirmation';

// ── Helpers ───────────────────────────────────────────────────────────────────

function setup(
  onConfirm: () => Promise<string> = vi.fn().mockResolvedValue('tx_hash_123'),
  onSuccess?: (h: string) => void,
  onError?: (e: Error) => void,
) {
  return renderHook(() => useTransactionConfirmation(onConfirm, onSuccess, onError));
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('useTransactionConfirmation – initial state', () => {
  it('starts in review step', () => {
    const { result } = setup();
    expect(result.current.state.step).toBe('review');
  });

  it('isClosePrevented is false initially', () => {
    const { result } = setup();
    expect(result.current.isClosePrevented).toBe(false);
  });
});

// ── review → confirm ──────────────────────────────────────────────────────────

describe('proceedToConfirm', () => {
  it('transitions review → confirm', () => {
    const { result } = setup();
    act(() => result.current.proceedToConfirm());
    expect(result.current.state.step).toBe('confirm');
  });
});

// ── confirm → review ──────────────────────────────────────────────────────────

describe('goBackToReview', () => {
  it('transitions confirm → review', () => {
    const { result } = setup();
    act(() => result.current.proceedToConfirm());
    act(() => result.current.goBackToReview());
    expect(result.current.state.step).toBe('review');
  });
});

// ── submit → success ──────────────────────────────────────────────────────────

describe('submit – success path', () => {
  it('transitions to submitting immediately', () => {
    const onConfirm = vi.fn(() => new Promise<string>(() => {})); // never resolves
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    act(() => result.current.submit());
    expect(result.current.state.step).toBe('submitting');
  });

  it('isClosePrevented is true while submitting', () => {
    const onConfirm = vi.fn(() => new Promise<string>(() => {}));
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    act(() => result.current.submit());
    expect(result.current.isClosePrevented).toBe(true);
  });

  it('transitions submitting → success on resolve', async () => {
    const onConfirm = vi.fn().mockResolvedValue('tx_abc');
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(result.current.state.step).toBe('success');
  });

  it('success state carries the tx hash', async () => {
    const onConfirm = vi.fn().mockResolvedValue('tx_abc');
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    if (result.current.state.step === 'success') {
      expect(result.current.state.txHash).toBe('tx_abc');
    }
  });

  it('calls onSuccess with the tx hash', async () => {
    const onSuccess = vi.fn();
    const { result } = setup(vi.fn().mockResolvedValue('tx_abc'), onSuccess);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(onSuccess).toHaveBeenCalledWith('tx_abc');
  });

  it('isClosePrevented is false after success', async () => {
    const { result } = setup(vi.fn().mockResolvedValue('tx_abc'));
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(result.current.isClosePrevented).toBe(false);
  });
});

// ── submit → error ────────────────────────────────────────────────────────────

describe('submit – error path', () => {
  it('transitions submitting → error on rejection', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('User rejected'));
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(result.current.state.step).toBe('error');
  });

  it('error state carries the message', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('User rejected'));
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    if (result.current.state.step === 'error') {
      expect(result.current.state.message).toBe('User rejected');
    }
  });

  it('calls onError with the error', async () => {
    const onError = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = setup(onConfirm, undefined, onError);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });

  it('non-Error rejections are wrapped in Error', async () => {
    const onError = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue('string error');
    const { result } = setup(onConfirm, undefined, onError);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    expect(onError).toHaveBeenCalledWith(expect.any(Error));
  });
});

// ── retry ─────────────────────────────────────────────────────────────────────

describe('retry', () => {
  it('transitions error → review', async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error('fail'));
    const { result } = setup(onConfirm);
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    act(() => result.current.retry());
    expect(result.current.state.step).toBe('review');
  });
});

// ── reset ─────────────────────────────────────────────────────────────────────

describe('reset', () => {
  it('returns to review from any step', async () => {
    const { result } = setup(vi.fn().mockResolvedValue('tx'));
    act(() => result.current.proceedToConfirm());
    await act(async () => result.current.submit());
    // now in success
    act(() => result.current.reset());
    expect(result.current.state.step).toBe('review');
  });
});
