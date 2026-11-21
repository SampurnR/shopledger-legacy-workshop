Fixes #1

## Tests added first

Six in-memory characterization tests passed against the original invoice engine in `0b9863e`. They captured the incorrect results for #1002, #1004 and #1007, alongside the correct 18% control order, a legacy line without HSN, and an empty invoice. Four regression tests in `3814de5` then failed against the same engine. One measured a ₹119.34 difference between invoice #1002 and the ledger.

## Cause

Checkout apportioned discounts before applying each item's GST slab. The invoice applied a default 18% rate to lines with only an HSN, calculated GST on gross amounts, and calculated percentage discounts on the tax-inclusive subtotal without the coupon cap.

## Fix

`lib/invoice.js` now uses the same pricing function as checkout for the totals and each printed line. The audit still compares those figures independently with the stored ledger. The three old-behavior tests now assert the corrected discount base for #1002, the ₹150 cap for #1004, and the 12% and 5% rates for #1007.

## Verification

- `node --test` passed all 10 tests. A deliberately introduced one-paisa ledger difference still triggers the reconciliation notice.
- On temporary copies, the GST audit moved from 7 mismatches with ₹612.01 in absolute differences to 8 balanced invoices. Order #1002 prints ₹963.90 including ₹45.90 GST. Order #1004 prints ₹2,194.50 including ₹104.50 GST.
- A fresh checkout on the fixed temporary copy also reconciled, bringing the audit to 9 balanced invoices.
- Manual diff review covered the printer and report callers, legacy fallback rate, coupon cap, and rounding. The tracked database and package manifest match the baseline. No dependencies were added.
