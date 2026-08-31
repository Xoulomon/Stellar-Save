import depthLimit from 'graphql-depth-limit';
import { GraphQLSchema, ValidationContext, ASTVisitor } from 'graphql';

// ── Limits ────────────────────────────────────────────────────────────────────

export const MAX_DEPTH = 5;
export const MAX_COMPLEXITY = 100;

// ── Depth limit rule ──────────────────────────────────────────────────────────

export const depthLimitRule = depthLimit(MAX_DEPTH);

// ── Complexity rule ───────────────────────────────────────────────────────────
// Field costs: list fields cost more than scalar fields.

const FIELD_COSTS: Record<string, number> = {
  groups:          10,
  members:         10,
  transactions:    10,
  recommendations: 15,
  search:          20,
  // nested list fields
  'Group.members':      5,
  'Group.transactions': 5,
  'Member.groups':      5,
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
              new (require('graphql').GraphQLError)(
                `Query complexity ${complexity} exceeds maximum allowed complexity of ${maxComplexity}.`
              )
            );
          }
        },
      },
    };
  };
}

export const validationRules = [
  depthLimitRule,
  complexityLimitRule(MAX_COMPLEXITY),
];
