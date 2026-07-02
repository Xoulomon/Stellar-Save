declare module 'jest-axe' {
  import { ReactElement } from 'react';

  export interface AxeResults {
    violations: Array<{
      id: string;
      impact?: string;
      tags: string[];
      description: string;
      help: string;
      helpUrl: string;
      nodes: any[];
    }>;
    passes: any[];
    incomplete: any[];
    inapplicable: any[];
  }

  export function axe(element: Element | ReactElement): Promise<AxeResults>;

  export const toHaveNoViolations: {
    toHaveNoViolations(this: any, results: AxeResults): { pass: boolean; message(): string };
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
