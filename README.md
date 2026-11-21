# ShopLedger: safe invoice reconciliation fix

ShopLedger is a synthetic legacy POS, inventory, Khata and invoice application.
This workshop submission addresses **Ticket 1**: printed invoices disagree with
the amount billed at checkout.

The invoice now uses checkout's existing calculator for HSN GST, eligible capped
coupons and line rounding. Only `lib/invoice.js` changes production behavior.
The supplied eight-order example improves from seven mismatches to zero.

## Run

Use Node.js 22 or newer. Install the existing dependencies with `npm install`
if needed, then run `npm start` and open `http://localhost:3000`.
Placing orders changes the application database; use a disposable copy for demos.

## Verify the test-first sequence

```sh
node --test
node scripts/replay-checkpoints.js
```

The complete suite has 37 tests. The replay reconstructs 14 passing baseline
characterization tests, 20 expected regression failures, then 37 passing tests.
It uses isolated temporary folders without a database. No test reads or writes
`data/db.json`; fixtures are hand-authored in memory. The legacy `npm test`
placeholder is unchanged; use the commands above.

## Evidence and submission

- Architecture: `docs/architecture.svg` and `docs/architecture.png` (pre-fix map).
- Contributor instructions: `AGENTS.md`; uploadable copy: `docs/AGENTS.pdf`.
- Captured test logs, before/after HTTP responses and manual review: `docs/evidence/`.
- Five-checkpoint capture guide and form text: `docs/submission-guide.txt`.
- Pull request draft: `docs/pull-request.txt` (publishing and issue number pending).

The original database is unchanged. No dependencies were added. Inventory,
date filtering and settlement defects are deliberately outside this ticket.
Invoices still recompute with current configuration; preserving historical
tax/coupon snapshots requires a separate design change.
