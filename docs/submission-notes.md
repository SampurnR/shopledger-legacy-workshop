# Day One on a Legacy Codebase: submission notes

## Selected ticket

**Ticket 1: Invoice total and GST breakdown do not match what the customer was billed.**

## CP3 output

Added `node:test` coverage in `test/invoice.characterization.test.js`. Before the fix, the tests deliberately recorded the legacy behaviour:

- Invoice lines used the 18% fallback rate when the order held only an HSN code.
- The invoice calculated percentage coupons against subtotal plus tax and did not enforce the coupon cap.

The tests use literal in-memory order objects only. They do not read or write `data/db.json`.

## CP4 output

Reproduction used a disposable copy of the project and a local server on port 3100. The workspace `data/db.json` was not modified.

Before the fix, the correct-behaviour tests failed:

- Order #1002 expected subtotal ₹1,020.00, discount ₹102.00, GST ₹45.90, total ₹963.90.
- The broken invoice returned discount ₹120.36, GST ₹183.60, total ₹1,083.24.
- The ₹2,240 SAVE10 order expected the ₹150 discount cap, while the broken invoice returned ₹264.32.

Cause: `lib/invoice.js` duplicated checkout arithmetic. It ignored HSN slabs unless an explicit `gstRate` existed, calculated the coupon after tax, and skipped the configured maximum discount.

Fix: `lib/invoice.js` now delegates invoice totals and per-line tax to the existing `lib/pricing.js` calculation, the same calculation checkout uses. No new dependency was added.

Updated old-behaviour tests:

- HSN-only invoice rows now assert the correct 5% GST rate.
- SAVE10 invoice totals now assert subtotal-based discounting and the ₹150 cap.

Test result:

```text
node --test
pass 4
fail 0
```

Local app verification:

```text
GET /api/reports/gst-reconciliation
totalChecked: 8
mismatchCount: 0
totalDelta: 0
```

## CP5 status

The local work is ready to commit and push, but no fork URL, GitHub authentication, or explicit permission to create a remote branch and pull request was available. The intended pull-request body is below.

```md
Fixes #1

## Tests added
- `test/invoice.characterization.test.js`
- `test/invoice.correctness.test.js`

## Cause
`lib/invoice.js` recalculated totals independently, using the default GST rate for HSN-only lines and calculating percentage coupons against subtotal plus tax without the configured cap.

## Fix
The invoice calculation now uses `lib/pricing.js`, matching checkout totals, HSN GST slabs, coupon allocation, and discount caps.

## Test result
`node --test` passes: 4 tests, 0 failures. Local GST reconciliation checks 8 orders with 0 mismatches.
```

## Evidence files

- CP1 screenshot source: `docs/CP1-read-only-explanation.md`
- CP2 diagram: `docs/shopledger-architecture.svg`
- CP4 corrected invoice screenshot: `docs/evidence/cp4-invoice-1002.png`
