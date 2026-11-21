declare module 'jest-axe' {
  import type { ReactElement } from 'react';

  interface AxeNode {
    html?: string;
    target?: string[];
    failureSummary?: string;
    [key: string]: unknown;
  }

  interface AxeResult {
    id?: string;
    impact?: string;
    tags?: string[];
    description?: string;
    help?: string;
    helpUrl?: string;
    nodes?: AxeNode[];
    [key: string]: unknown;
  }

  export interface AxeResults {
    violations: Array<{
      id: string;
      impact?: string;
      tags: string[];
      description: string;
      help: string;
      helpUrl: string;
      nodes: AxeNode[];
    }>;
    passes: AxeResult[];
    incomplete: AxeResult[];
    inapplicable: AxeResult[];
  }

  export function axe(element: Element | ReactElement): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(
      this: { currentTestName?: string },
      results: AxeResults
    ): { pass: boolean; message(): string };
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