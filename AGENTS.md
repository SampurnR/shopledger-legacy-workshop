# ShopLedger: agent instructions

## Current stack and entry points

- Node.js 22+; CommonJS JavaScript; Express 4 and body-parser.
- `server.js` exports the Express app and listens only when run directly.
- `public/index.html`, `public/js/app.js`, `public/css/style.css`: browser UI.
- `routes/products.js`: catalog and active coupons.
- `routes/orders.js`: order lookup, creation, filtering and cancellation.
- `routes/customers.js`: Khata accounts and settlement requests.
- `routes/reports.js`: dashboard, GST reconciliation, preview and admin export.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout monetary rules.
- `lib/invoice.js`: printable invoice figures and HTML.
- `lib/inventory.js`, `lib/orders.js`, `lib/ledger.js`, `lib/dates.js`: business operations.
- `lib/reports.js`: dashboard and invoice-versus-ledger audit.
- `lib/store.js`: synchronous JSON persistence to `data/db.json`.
- `config.js`: shop metadata, tax slabs, coupon rules and runtime port.

## Commands

- Install existing dependencies: `npm install --no-package-lock`.
- Start locally: `npm start` (default http://localhost:3000).
- Run tests: `node --test`. Use the built-in `node:test` and strict assertions.
- `npm test` is still the original placeholder; use `node --test`.
- Review: `git diff --check`, `git diff`, then the relevant tests.

## Mandatory boundaries

1. Read and explain the relevant flow before editing.
2. Write and run characterization tests before changing behaviour. Name known
   incorrect existing behaviour `CURRENT BEHAVIOUR` until intentionally replaced.
3. Change production code only in the module(s) required by the selected ticket.
   For ticket #1 that boundary is `lib/invoice.js`; reuse existing pricing rules.
4. Tests never read or write `data/db.json`. Use authored fixtures, in-memory
   stores, or temporary copies. Fail closed if a test reaches the real store.
5. Reproduce browser scenarios in temporary project copies; leave the original
   database byte-for-byte unchanged.
6. Add no dependencies. Do not commit `node_modules/` or `package-lock.json`.
7. First show a failing regression test for correct behaviour, then apply the
   smallest fix. Explain which characterization expectations changed and why.
8. Review money values, coupon eligibility/caps, HSN slabs, rounding, rendered
   output, missing orders and data mutation before declaring success.
9. Keep evidence authentic: retain actual command outputs and screenshots;
   distinguish a generated report from a screenshot of the Codex conversation.
10. Commit on a `fix/` branch, push to the participant's fork, open a PR into
    upstream `main`, and leave it unmerged. Never publish credentials or tokens.

## Role handoffs within this workflow

These are sequential responsibilities, not a claim that separate agents ran.

- Explorer: module map, order flow, facts versus hypotheses. No source edits.
- Test author: passing characterization baseline, then failing regressions.
- Developer: smallest production fix with a written reason for each change.
- QA: run unit and HTTP tests, inspect browser behaviour and database integrity.
- Reviewer: inspect the diff, limitations and regression risk before release.

Each handoff names its inputs, produced files, verification command and remaining
uncertainty. Never treat another role's unverified claim as evidence.
