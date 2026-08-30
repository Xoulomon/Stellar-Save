import 'vitest';

declare module 'jest-axe' {
  import type { ReactElement } from 'react';

  export interface AxeResults {
    violations: Array<{
      id: string;
      impact?: string;
      tags: string[];
      description: string;
      help: string;
      helpUrl: string;
      nodes: unknown[];
    }>;
    passes: unknown[];
    incomplete: unknown[];
    inapplicable: unknown[];
  }

  export function axe(element: Element | ReactElement): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(this: unknown, results: AxeResults): { pass: boolean; message(): string };
  };
}

declare module 'vitest' {
  interface Assertion {
    toHaveNoViolations(): void;
  }
  interface AsymmetricMatchersContaining {
    toHaveNoViolations(): void;
  }
}
