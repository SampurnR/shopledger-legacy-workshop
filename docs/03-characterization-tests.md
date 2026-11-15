# CP3: Characterization tests before the fix

Selected ticket: [workshop issue #2](https://github.com/SampurnR/shopledger-legacy-workshop/issues/2).

## Passing baseline

Command: `node --test` in `shopledger-legacy-workshop`.

- `test/inventory.characterization.test.js`: 15 tests.
- `test/orders.cancellation.test.js`: 6 tests.
- Result: **21 passed, 0 failed**.
- Historical commit: `162dc3f` (application code still unchanged).
- [Recorded command output](evidence/cp3-characterization.txt).

Tests exercise exported inventory functions and the real `orders.cancel()` caller,
using only fresh object fixtures. They never import the persistence module, read
the seed data, or write a database. No test dependencies were added.

The baseline covers stock/hold arithmetic, unknown products, accepted and rejected
quantities, physical deductions, summary counts, cancellation status and dates,
khata debit reversal, completed cash orders, and repeated/unknown cancellations.

## Known incorrect behavior pinned first

The following original tests were named `CURRENT BEHAVIOUR` and passed before the fix:

| Original test | Updated correct behavior after the fix |
| --- | --- |
| stock check rejects the exact remaining sellable quantity | accepts exact sellable quantity |
| stock check rejects the last unreserved unit | accepts the last unreserved unit |
| release ignores order lines identified by id | restores physical stock using id |
| cancelling a pending order does not restore physical stock | restores physical stock and preserves holds |

Only these four characterization tests were updated when their recorded bugs were
fixed. Other baseline assertions were retained.

## Reproduce each stage from Git history

Use a separate checkout if inspecting historical commits; do not reset an active
working directory with uncommitted work.

- At `162dc3f`, run `node --test`: 21 passing tests.
- At `84b4966`, run `node --test`: 28 tests, including 6 expected failures.
- At the final branch head, run `node --test`: all 28 tests pass.

The historical failing state is intentional evidence, not the final submission state.
