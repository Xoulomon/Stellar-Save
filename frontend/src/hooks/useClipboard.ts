import { useState, useCallback } from 'react';

import { copyToClipboard } from '../lib/clipboard';

export interface UseClipboardOptions {
  timeout?: number;
}

export interface UseClipboardReturn {
  copied: boolean;
  copy: (text: string) => Promise<void>;
  error: Error | null;
}

export function useClipboard({ timeout = 2000 }: UseClipboardOptions = {}): UseClipboardReturn {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const copy = useCallback(
    async (text: string) => {
      const ok = await copyToClipboard(text);
      if (ok) {
        setError(null);
        setCopied(true);
        setTimeout(() => setCopied(false), timeout);
      } else {
        setError(new Error('Failed to copy'));
        setCopied(false);
      }
    },
    [timeout]
  );

  return { copied, copy, error };
}
