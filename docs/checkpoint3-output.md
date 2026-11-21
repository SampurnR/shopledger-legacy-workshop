# Checkpoint 3 — Characterization tests

Ticket: Invoice total and GST breakdown do not match what the customer was billed.

Test file: `test/invoice.test.js`  
Runner: `node --test`  
Data: in-memory order fixtures only; `data/db.json` is not read by the tests.

The initial `CURRENT BEHAVIOUR` suite passed before the fix and recorded the invoice's tax-inclusive uncapped coupon discount, 18% fallback instead of HSN tax, and independent recalculation instead of persisted checkout totals.

After writing correct-behaviour assertions, all three failed before the fix. The output showed Order #1004 discount ₹264.32 instead of ₹150, Order #1002 tax ₹183.60 instead of ₹45.90 and total ₹1,083.24 instead of ₹963.90, and a non-coupon 5% HSN order taxed at 18%.

After the fix, `node --test` passes 3 tests, 0 failures. The tests verify the capped coupon and ledger total for Order #1004, HSN GST and billed total for Order #1002, and persisted totals for a 5% HSN order.
