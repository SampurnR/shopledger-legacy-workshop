# CP3 — Characterization before the fix

Production code was unchanged at this checkpoint.
Command: `node --test --test-reporter=spec test/invoice-characterization.test.js`.
Node: v26.3.0. Result: 9 tests, 9 passed, 0 failed.
Actual complete output: `docs/cp3-test-output.txt`.
Full discovery also runs with `node --test` (see cp3-full-test-output.txt).

Files: `test/invoice-characterization.test.js` and explicit in-memory fixtures in
`test/fixtures/invoice-orders.js`. Neither loads store.js or reads a data file.

Seven tests named `CURRENT BEHAVIOUR: invoice #1001` through `#1007 complete figures`
pin subtotal, discount, tax, CGST, SGST, total and the original default 18% rates.
They cover percent and flat coupons, the ignored SAVE10 cap, mixed 5/12/18% HSN
items and tax calculated before discount. The eighth invoice test is the
all-18%, no-coupon #1008 matching control. The ninth pins the checkout pricing
authority against all eight expected billed figures, including the 150 cap.

This is historical CP3 evidence. CP4 intentionally updates seven invoice tests
after first demonstrating a failing correct-behavior regression test.
The original assertions remain in the test file as an explicitly named baseline.
Tracked data/db.json was not touched by these tests.
