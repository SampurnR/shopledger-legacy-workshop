# Checkpoint 4 - invoice fix and manual review

## Reproduction
Ran the Express app from `tmp/cp4-app` with a copied database. HTTP GET requests to `/orders/1002/invoice` and `/api/reports/gst-reconciliation` returned 200 before and after the fix. No write endpoint was called.

Before: 7 mismatches among 8 orders. Order 1002 invoice total 1083.24 and GST 183.60 differed from ledger total 963.90 and GST 45.90.

## Red, then green
Added the synthetic SAVE10 regression first and ran it before editing application code. It failed: actual total 1083.24, expected 963.90. Output is in `failing-test.txt`.

Only application module changed: `lib/invoice.js`. It now delegates calculations to the existing checkout pricing module, preserving invoice row metadata and the existing figures interface. Printed totals include taxable value, CGST and SGST separately. No dependencies added.

Updated seven old-behavior cases in `test/invoice-current-behaviour.test.js`: HSN slab handling; SAVE10 calculation; discount cap; minimum spend; inactive coupon; flat-discount tax; separate CGST/SGST display. The existing matching 18% case remains.

Added four regression tests in `test/invoice-regression.test.js`: ticket example; mixed-slab proportional rounding and input immutability; unknown coupon/HSN fallback; empty invoice and odd-paise GST splitting.

All 12 tests pass using `node --test`. Output is in `passing-tests.txt`.

After: 0 mismatches among 8 orders. Order 1002 invoice total 963.90 and GST 45.90 now match the ledger. HTTP results and rendered invoice HTML are saved in this directory.

## Manual review
Reviewed the application diff and both test files by hand instead of invoking a `/review` slash command. Checked shared pricing use, discount-before-tax behavior, row metadata, separate tax totals, output escaping, synthetic fixtures, and scope. Exercised unknown coupons, unknown HSN codes, empty items and rounding boundaries. `git diff --check` passed. No blocking findings.

No claim is made that this is a full security audit or that unrelated inventory, date and Khata bugs are fixed.

## Data protection
Original `data/db.json` SHA-256 before and after:
`378042ACAEF84300A04A1B6EA043A3E279ED0969D76DC1F9DEFFD91D095CEB49`

Tests do not access the database. The temporary app's HTTP checks read only its database copy.
