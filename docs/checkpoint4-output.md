# Checkpoint 4 — Reproduce and fix

Ticket reproduced with the existing Order #1002 invoice in a temporary project copy. The working repository's `data/db.json` was never modified.

Before: the invoice displayed 18% GST for both HSN 1006 and 1512 items, a ₹120.36 SAVE10 discount, ₹183.60 GST, ₹1,083.24 total, and a reconciliation warning against the ledger's ₹963.90.

Failing test: the correct-behaviour assertions in `test/invoice.test.js` failed before the change, demonstrating the mismatch.

After: the invoice displays 5% GST for both items, the stored ₹102 discount, ₹45.90 GST, and the ledger's ₹963.90 total. The mismatch warning is gone.

Smallest fix: `lib/invoice.js` only. It now resolves rates through the existing tax module and uses order subtotal, discount, tax, and total recorded at checkout. Updated tests replace the old-behaviour assertions with the expected invoice behaviour.

Review: checked the diff and confirmed tests use only in-memory fixtures. `node --test` passes (3/3); `git diff --check` passes. No dependencies were added.

Evidence images: `checkpoint4-before.png` and `checkpoint4-after.png`.
