# Snapshot review guidance

Snapshot tests fail when output changes. That is the point — but it is only
useful if a human reads the diff, because a snapshot will happily lock in a
regression just as readily as a fix.

This document is the review contract for the financial-display snapshots in
`financialDisplay.snapshot.test.tsx`. It exists because the most common way
snapshot suites get devalued is a reviewer clicking **accept** without reading,
after which every later diff is noise.

## The rule

**A snapshot diff is never self-approving.** If a diff touches a component that
displays money, counts, dates, or percentages, read the changed lines against
the component that produced them before you accept.

## When to accept

Accept when the change is what the PR claims to do:

- The diff matches the PR description, and the new values are correct.
- A new test case was added and its snapshot reflects intended behaviour.
- A deliberate copy or formatting change was made, and the diff shows exactly
  that string changing in exactly the places you expect.
- A dependency bump changed generated markup with no behavioural change (see
  [MUI class names](#mui-class-names) below).

## When to investigate

Stop and ask if the diff shows any of these:

| Signal                                          | Why it matters                                                              |
| ----------------------------------------------- | --------------------------------------------------------------------------- |
| A currency amount lost or gained digits         | A user reads this number and acts on it. Highest-severity diff in the file. |
| A sign flip (`+`/`-`) on a payout or withdrawal | Turns a payment into a receipt, or worse.                                   |
| A percentage changed that no input explains     | Usually a division or rounding regression.                                  |
| A row, column, or total disappeared             | Silent data loss.                                                           |
| A date shifted                                  | Usually a timezone bug (see [Dates](#dates-and-timezones)).                 |
| `NaN`, `undefined`, or `Infinity` appeared      | A real bug is now pinned. Fix the component, not the snapshot.              |
| A label or currency code changed                | Wrong instrument or wrong unit.                                             |
| A loading/error/empty state changed             | Users see this state during real outages.                                   |

## How to review in practice

```bash
cd frontend
npx vitest run src/test/financialDisplay.snapshot.test.tsx
```

Vitest prints a side-by-side `- Expected` / `+ Received` diff. Read the changed
lines in order. The snapshot file itself is
`src/test/__snapshots__/financialDisplay.snapshot.test.tsx.snap`; each entry is
keyed by test name, so you can find the relevant block directly.

To accept a reviewed change, regenerate and commit the snapshot:

```bash
npx vitest run -u src/test/financialDisplay.snapshot.test.tsx
git add src/test/__snapshots__/financialDisplay.snapshot.test.tsx.snap
```

Never regenerate snapshots in bulk to make a suite green. If several snapshots
change at once, something non-local changed — a shared formatter, a theme, a
provider, or a dependency.

## Things that legitimately change a snapshot

### Dates and timezones

Several components call `toLocaleDateString()` without a time zone, so the same
instant can render as a different calendar day on a different machine. The suite
pins `process.env.TZ = 'UTC'` and uses mid-day UTC timestamps in its fixtures for
this reason.

If you add a component to this suite, do the same. If a date-only snapshot
mismatch shows up with no code change, suspect the timezone before suspecting
the component.

Note that `TransactionTables` renders one date column through a bare
`toLocaleDateString()` with **no locale argument**, which also makes it depend
on the machine's default locale. A diff in that one column is more likely to be
environment than intent — confirm the locale before accepting.

### MUI class names

MUI v7 generates emotion class names (`css-axw7ok`). These are derived from the
style rules, so a styling change, a theme change, or an MUI upgrade reshuffles
them across every snapshot in the file at once. That is expected; what matters
is that the structural and textual content around them is unchanged.

### Relative timestamps

`BalanceDisplay` renders "1m ago"-style strings computed against `Date.now()`.
The suite uses fake timers with a fixed system time. If you add a case that
depends on elapsed time, set the system time explicitly rather than accepting
whatever the wall clock produced.

## Known issues captured by these snapshots

These snapshots deliberately record current, incorrect behaviour so that a fix
shows up as a reviewable diff. They are **not** expectations.

- `PayoutQueue` renders `NaN%` when `totalMembers` is `0`, because the progress
  calculation divides by `totalMembers` with no guard. See the comment on the
  `renders an empty queue with no entries` case. Tracked separately.

When one of these is fixed, fix the component and regenerate — do not edit the
`.snap` file by hand, and do not accept the `NaN` diff as "just a snapshot
update".

## Relationship to the other visual test layers

This suite is not the only visual check in the repo, and it is not a substitute
for them:

- `src/test/visual/**` — Playwright PNG baselines for full-page and component
  appearance. Use these for layout and theme regressions.
- `src/test/visual/components/core-components.spec.ts-snapshots/` — committed
  PNG matrices for core components in light and dark mode.
- Percy — full-page snapshots on CI, gated behind `PERCY_TOKEN`.

This suite is the fastest and most precise of the three for **what the component
renders**: exact text, exact numbers, exact ordering, in the jsdom tree. It
cannot tell you whether the result _looks_ right, which is what the PNG layers
are for.
