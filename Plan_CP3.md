# Characterize invoice and billing discrepancies

## Summary

Add `node:test` coverage that preserves today’s behavior, including incorrect-looking results. Change no application code, configuration, dependencies, or public interfaces.

## Test implementation

Create `test/invoice-characterization.test.js` using `node:assert/strict`. Prefix test names with `CURRENT BEHAVIOUR`.

Use synthetic items and in-memory orders exclusively. Import calculation modules directly; never invoke storage or start the server. Assert literal expected figures rather than calculating expectations with production helpers.

Cover:

- Mixed HSN slabs: three ₹100 items produce billed GST ₹35 and total ₹335; invoice GST ₹54 and total ₹354.
- Flat coupon: ₹300 with `FLAT50` produces billed total ₹295 and invoice total ₹304.
- Percentage coupon cap: ₹2,000 with `SAVE10` yields billed discount ₹150 versus invoice discount ₹236.
- Coupon handling differences: invoice lookup ignores normalization, eligibility, expiry, and discount caps.
- Explicit GST rates: percentage, fractional, and zero rates; pin the invoice’s different treatment of fractional and zero values.
- Rounding: three ₹0.03 lines yield billed GST ₹0.03 versus invoice GST ₹0.02, despite invoice row taxes summing to ₹0.03.
- GST splits, line breakdowns, empty items, and a matching default-rate baseline.
- Stored order figures: invoice calculations recompute figures instead of using recorded totals.
- Rendered invoice totals and reconciliation notices for positive, negative, and zero differences.
- Reconciliation reports: detect total or tax discrepancies, omit cancelled orders, and sum absolute total differences.

## Validation

Run `node --test` and require every characterization test to pass. Review the diff to confirm only tests were added and run `git diff --check`.

## Constraints

Plan Mode currently permits inspection only; no test files have been written or test suite run. Implementation will preserve existing untracked files and never read or write `data/db.json`.
