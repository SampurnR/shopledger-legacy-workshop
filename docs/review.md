# Ticket 3 review

## Result

Manual diff review completed. No remaining actionable findings were identified within Ticket 3's scope. This is a hand review, not a claim that a `/review` slash command or separate reviewer was run.

## Production scope

Only `lib/dates.js`, `lib/orders.js`, and `lib/ledger.js` change. No routes, UI, dependencies, pricing, invoice, inventory, configuration, or original data are changed.

## Checks and evidence

- CP3: 21 characterization tests passed against original production code in commit `23c8691`.
- CP4 red: correct expectations produced 20 failures / 46 tests against original production code in commit `ed0238d`.
- Review found that an extremely large finite number can overflow the currency-rounding operation. A new test demonstrated that failure; validation now checks the rounded amount. See `evidence/review-overflow-red.txt`.
- Final `node --test --test-reporter=spec`: 47 passed, zero failures.
- Tests construct independent in-memory fixtures and never load the store or `data/db.json`.
- Date coverage includes year/month transitions, mixed supported formats, inclusive/one-sided ranges, same-date stability, combined status/search filters, source-array immutability, and unchanged fiscal-year boundaries.
- Ledger coverage includes the browser's string payload, repeated payments, decimal rounding, existing numeric strings, metadata/IDs, unknown customers, credit-limit preservation, and invalid amount rejection without mutation.
- Browser reproduction used original and fixed temporary copies on ports 3103 and 3104. Original application data in this checkout was not used for writes.
- Browser/API results: January returns only 1004/1003/1002; a 500 payment changes settled funds to 1700 and Meera's balance to 732.01.
- An invalid HTTP payment returns 400 without changing customer/settlement data.
- Original data SHA256 remains `378042ACAEF84300A04A1B6EA043A3E279ED0969D76DC1F9DEFFD91D095CEB49`.

## Characterization tests intentionally updated

1. ISO date becomes a day-first comparison key -> ISO date retains a chronological comparison key.
2. Stored day-first date remains a day-first comparison key -> stored date becomes the equivalent chronological key.
3. History sorts by day text -> history sorts chronologically newest first.
4. January range includes all eight orders -> January includes only its three orders.
5. String settlement concatenates and corrupts the balance -> string settlement produces numeric totals and the correct balance.

The original assertions remain available in the CP3 commit. Unaffected characterization expectations remain in the final suite.

## Practical limits

This repair assumes valid calendar dates in the documented formats; it does not introduce a general date-validation policy. It preserves existing overpayment behavior and does not repair historical corruption in stored customer accounts. Whole-file JSON persistence and the other two workshop tickets are outside scope. The displayed GST mismatch banner is expected to remain.
