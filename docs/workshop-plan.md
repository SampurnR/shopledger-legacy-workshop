# Legacy codebase workshop plan

The workshop ticket descriptions are the acceptance criteria below. Ticket 1 is the primary demonstration; tickets 2 and 3 are also in scope. Keep changes focused on the existing JavaScript application and its current data format.

## Acceptance criteria

- INV-1: Invoice totals and GST match checkout for the stored example orders, including HSN rates, coupons and discount caps.
- INV-2: Invoice line and tax breakdowns are consistent with the checkout calculation, including rounding.
- STOCK-1: An order may use exactly the available sellable stock, but not more; reserved stock remains unavailable.
- STOCK-2: Cancelling an order restores its stock once and preserves reservations.
- DATE-1: Order history is newest first and date-range filters compare calendar dates inclusively.
- KHATA-1: Recording a valid settlement adds numeric amounts and updates the balance correctly; invalid payments do not mutate the ledger.

## Workflow

1. Understand the current order flow and document the architecture.
2. For each ticket, characterize current behavior with isolated `node:test` fixtures, then write tests for the correct behavior and observe failures before fixing it.
3. Make focused fixes and update tests that describe behavior intentionally changed. Tests must not write to `data/db.json` or use the network.
4. Run `node --test`, review the combined changes, and exercise the app using a temporary copy of its data.
5. Record test results and known limitations; prepare a reviewable pull request and the workshop checkpoint evidence. Do not commit `package-lock.json` or changes to the seed data.

## Running locally

Use Node.js 22 or newer. Run `npm install`, then `npm start` and open `http://localhost:3000`. Run tests with `npm test` (or `node --test`). Application actions can modify the tracked `data/db.json`; use a temporary copy for demonstrations that change data.

## Verification and known limitations

- The isolated API smoke test reconciled all eight seed invoices, and exercised chronological order history, a string-valued settlement, selling the last unit and cancelling that order.
- Characterization tests passed before each fix; tests for the corrected behavior were observed failing before implementation.
- Invoices use the current coupon and tax configuration to recalculate historical orders. If those rules change, a past invoice can differ from its recorded ledger total; preserving historical pricing rules requires a separate data-model change.

## Review notes

The repository's `AGENTS.md` and applicable rules in `docs/rules/` govern this work. The workshop requests no new dependencies, narrowly scoped fixes, and a review before the pull request. The app is JavaScript; TypeScript-specific architecture is not introduced as part of these repairs.
