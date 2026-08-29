import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  copyToClipboard,
  isClipboardSupported,
  isShareSupported,
  shareOrCopy,
} from '../lib/clipboard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function setClipboard(writeText: ((text: string) => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: writeText ? { writeText } : undefined,
  });
}

function setShare(share: ((data: ShareData) => Promise<void>) | undefined): void {
  Object.defineProperty(navigator, 'share', {
    configurable: true,
    value: share,
  });
}

type ShareData = { title?: string; text?: string; url?: string };

const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const originalShare = Object.getOwnPropertyDescriptor(navigator, 'share');

afterEach(() => {
  if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
  if (originalShare) Object.defineProperty(navigator, 'share', originalShare);
  else Object.defineProperty(navigator, 'share', { configurable: true, value: undefined });
  vi.restoreAllMocks();
});

// ── copyToClipboard ───────────────────────────────────────────────────────────

describe('copyToClipboard', () => {
  it('writes to the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(copyToClipboard('hello')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to execCommand when the Clipboard API is missing', async () => {
    setClipboard(undefined);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    await expect(copyToClipboard('legacy')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('falls back to execCommand when the Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    setClipboard(writeText);
    const execCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, 'execCommand', { configurable: true, value: execCommand });

    await expect(copyToClipboard('retry')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('retry');
    expect(execCommand).toHaveBeenCalledWith('copy');
  });

  it('resolves false when every strategy fails', async () => {
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    await expect(copyToClipboard('nope')).resolves.toBe(false);
  });
});

// ── shareOrCopy ───────────────────────────────────────────────────────────────

describe('shareOrCopy', () => {
  it('uses the Web Share API when available', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);

    await expect(shareOrCopy({ title: 'T', url: 'https://x.test' })).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', url: 'https://x.test' });
  });

  it('treats a cancelled share (AbortError) as success without copying', async () => {
    const abort = Object.assign(new Error('cancelled'), { name: 'AbortError' });
    setShare(vi.fn().mockRejectedValue(abort));
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(shareOrCopy({ url: 'https://x.test' })).resolves.toBe('shared');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to copying the url when Web Share is unavailable', async () => {
    setShare(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(shareOrCopy({ text: 'ignored', url: 'https://x.test' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('https://x.test');
  });

  it('falls back to the text when no url is provided', async () => {
    setShare(undefined);
    const writeText = vi.fn().mockResolvedValue(undefined);
    setClipboard(writeText);

    await expect(shareOrCopy({ text: 'plain text' })).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('plain text');
  });

  it('reports unsupported when share is unavailable and the copy fails', async () => {
    setShare(undefined);
    setClipboard(undefined);
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });

    await expect(shareOrCopy({ url: 'https://x.test' })).resolves.toBe('unsupported');
  });
});

// ── feature detection ─────────────────────────────────────────────────────────

describe('feature detection', () => {
  beforeEach(() => {
    setClipboard(undefined);
    setShare(undefined);
  });

  it('isClipboardSupported reflects navigator.clipboard.writeText', () => {
    expect(isClipboardSupported()).toBe(false);
    setClipboard(vi.fn().mockResolvedValue(undefined));
    expect(isClipboardSupported()).toBe(true);
  });

  it('isShareSupported reflects navigator.share', () => {
    expect(isShareSupported()).toBe(false);
    setShare(vi.fn().mockResolvedValue(undefined));
    expect(isShareSupported()).toBe(true);
  });
});
