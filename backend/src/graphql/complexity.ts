import { GraphQLError } from 'graphql';
import depthLimit from 'graphql-depth-limit';

import type { ValidationContext, ASTVisitor } from 'graphql';

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_DEPTH = 5;
export const MAX_COMPLEXITY = 100;

// ── Depth limit rule ──────────────────────────────────────────────────────────

export const depthLimitRule = depthLimit(MAX_DEPTH);

// ── Complexity rule ───────────────────────────────────────────────────────────
// Field costs: list fields cost more than scalar fields.

// Keys must stay in sync with the composed schema (see schema/index.ts).
// Root list fields cost more; nested list fields add a smaller surcharge.
const FIELD_COSTS: Record<string, number> = {
  groups: 10,
  members: 10,
  transactions: 10,
  recommendations: 15,
  search: 20,
  // nested list fields
  'Group.members': 5,
  'Group.transactions': 5,
  'Member.groups': 5,
  'Recommendation.group': 3,
};

export function complexityLimitRule(maxComplexity: number) {
  return (context: ValidationContext): ASTVisitor => {
    let complexity = 0;
    const typeStack: string[] = [];

    return {
      Field: {
        enter(node) {
          const fieldName = node.name.value;
          const parentType = typeStack[typeStack.length - 1];
          const key = parentType ? `${parentType}.${fieldName}` : fieldName;
          complexity += FIELD_COSTS[key] ?? FIELD_COSTS[fieldName] ?? 1;
          typeStack.push(fieldName);
        },
        leave() {
          typeStack.pop();
        },
      },
      Document: {
        leave() {
          if (complexity > maxComplexity) {
            context.reportError(
              new GraphQLError(
                `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}.`
              )
            );
          }
        },
      },
    };
  };
}

export const validationRules = [depthLimitRule, complexityLimitRule(MAX_COMPLEXITY)];

// ── Tests ─────────────────────────────────────────────────────────────────────
// Jest: backend/src/graphql/__tests__/complexity.test.ts
//
// import { parse, validate, buildSchema } from 'graphql';
// import { complexityLimitRule, MAX_COMPLEXITY } from '../complexity';
//
// const schema = buildSchema(`
//   type Query {
//     groups: [Group]
//     members: [Member]
//     transactions: [Transaction]
//     recommendations: [Recommendation]
//     search(term: String): [SearchResult]
//   }
//   type Group { id: ID members: [Member] transactions: [Transaction] }
//   type Member { id: ID groups: [Group] }
//   type Transaction { id: ID }
//   type Recommendation { id: ID group: Group }
//   type SearchResult { id: ID }
// `);
//
// const run = (query: string) =>
//   validate(schema, parse(query), [complexityLimitRule(MAX_COMPLEXITY)]);
//
// describe('complexityLimitRule', () => {
//   it('accepts queries under the budget', () => {
//     expect(run('{ groups { id } }')).toHaveLength(0);
//   });
//
//   it('rejects queries over the budget', () => {
//     const errors = run('{ search { id } recommendations { id } groups { id } }');
//     expect(errors).toHaveLength(1);
//     expect(errors[0].message).toMatch(/exceeds maximum allowed complexity/);
//   });
// });
