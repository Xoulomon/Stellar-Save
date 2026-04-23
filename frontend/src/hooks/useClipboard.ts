import { useState, useCallback } from 'react';

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

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setError(null);
      setCopied(true);
      setTimeout(() => setCopied(false), timeout);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to copy'));
      setCopied(false);
    }
  }, [timeout]);

  return { copied, copy, error };
}
