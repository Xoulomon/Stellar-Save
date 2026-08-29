/**
 * Shared clipboard & share-link utilities.
 *
 * Consolidates the copy-to-clipboard and Web Share logic that was previously
 * re-implemented inline across action components (member cards, the badge
 * gallery, the invite modal, the transaction-template modal, …).
 *
 * All helpers are safe to call in non-browser environments (SSR, tests): they
 * feature-detect the underlying APIs and degrade gracefully instead of throwing.
 */

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export type ShareResult = 'shared' | 'copied' | 'unsupported';

/** True when the async Clipboard API (`navigator.clipboard.writeText`) is available. */
export function isClipboardSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function';
}

/** True when the Web Share API (`navigator.share`) is available — typically mobile / Safari. */
export function isShareSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
}

/**
 * Copy `text` to the clipboard. Resolves `true` on success and `false` otherwise.
 *
 * Uses the async Clipboard API when available and falls back to a hidden
 * `<textarea>` + `document.execCommand('copy')` for browsers or contexts
 * (e.g. insecure origins) that do not expose it.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (isClipboardSupported()) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission denied or transient failure — fall through to the legacy path.
    }
  }
  return legacyCopy(text);
}

function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Share `data` through the native Web Share sheet when available, otherwise copy
 * a textual representation (URL, then text, then title) to the clipboard.
 *
 * A user-cancelled share (`AbortError`) resolves as `'shared'` — it is an
 * expected outcome, not an error.
 */
export async function shareOrCopy(data: ShareData): Promise<ShareResult> {
  if (isShareSupported()) {
    try {
      await navigator.share(data);
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'shared';
      // Any other failure falls through to the clipboard fallback below.
    }
  }

  const fallback = data.url ?? data.text ?? data.title ?? '';
  if (fallback && (await copyToClipboard(fallback))) return 'copied';
  return 'unsupported';
}
