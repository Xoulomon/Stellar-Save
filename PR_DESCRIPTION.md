## Summary
Implements [Frontend/Util] Create calculateCycleProgress utility (#364)

## Changes
- ✅ Created `calculateCycleProgress` utility: computes time/contribution/overall progress % with edge cases
- ✅ Added `CycleProgressResult` types
- ✅ Utils index.ts re-exports
- ✅ Refactored CycleProgress.tsx to use utility (replaces manual logic)
- ✅ Comprehensive Vitest tests (time/contrib/formatting/edges/throws)
- 📄 Updated TODO.md

## Testing
Tests cover:
- Time progress (0%, 50%, 100%, overdue)
- Contribution clamping
- Overall = min(time, contrib)
- Formatting (days/hours/mins)
- Validation (0 duration/members)

No runtime tests executed per instructions.

## Usage
```ts
import { calculateCycleProgress } from '@/utils';
// Or fromDeadline overload
```

Closes #364
