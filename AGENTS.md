# ShopLedger agent guide

ShopLedger runs a wholesale and retail billing desk. A single checkout can change physical stock, a customer's Khata balance, an order record, and the audit log. These instructions apply throughout the repository.

## Four rules for every workshop fix

1. **Characterize before editing.** Read the ticket, its entry point, and the modules it calls. Write passing tests for today's behavior. Prefix tests that deliberately record a bug with `CURRENT BEHAVIOUR`. Then demonstrate the intended behavior with a failing regression test before editing production code.
2. **Keep one ticket in scope.** Make the smallest change in the production module or modules responsible. Preserve the fields, status codes, and printed values that existing callers rely on unless the ticket requires changing them.
3. **Keep tests in memory.** Construct products, order lines, customers, and ledger figures inside the test. Automated tests must never read or write `data/db.json`. Use a temporary project copy with its own data file for manual app reproduction.
4. **Add no dependencies.** Use the existing modules, `node:test`, and `node:assert/strict`. Leave the install-generated `package-lock.json` out of workshop commits.

## Stack and commands

Use Node.js 22 or newer for the workshop. The server uses CommonJS, Express 4, and body-parser. The UI uses plain HTML, CSS, and browser JavaScript. Run these commands from the project root unless specified.

| Command | When to use it |
| --- | --- |
| `git status --short --branch` | Before editing, identify the active branch and any existing user changes. |
| `npm install` | Install the dependencies listed in `package.json` when they are missing. |
| `node --test` | Run the full test suite. The legacy `npm test` script is a failing placeholder. |
| `node --test test/invoice.test.js` | Run the invoice tests while working on pricing or reconciliation. |
| `npm start` | Start the app from the temporary copy for manual checks. The default address is `http://localhost:3000`. Set `PORT` to use another port. |
| `git diff --check` | Check pending edits for whitespace errors before review. |

## Where to look

| Area | Files | Responsibility |
| --- | --- | --- |
| Browser and server | `public/index.html`, `public/js/app.js`, `public/css/style.css`, `server.js` | The browser sends requests. Express serves the UI, mounts the four API routers, and handles `GET /orders/:id/invoice` directly. |
| Catalog and stock | `routes/products.js`, `lib/inventory.js` | Product availability, physical stock, wholesale reservations, and sellable quantities. |
| Orders and dates | `routes/orders.js`, `lib/orders.js`, `lib/dates.js` | Checkout, order lookup and cancellation, date handling, and filtered history. |
| Customer credit | `routes/customers.js`, `lib/ledger.js` | Khata accounts, credit limits, charges, reversals, balances, and settlements. |
| Billing rules | `lib/pricing.js`, `lib/coupons.js`, `lib/tax.js`, `config.js` | Subtotals, coupon eligibility and caps, per-line GST, and the CGST/SGST split. Configuration also supplies shop details. |
| Invoices and reports | `lib/invoice.js`, `routes/reports.js`, `lib/reports.js` | Printable invoices, cart previews, dashboard figures, and invoice-to-ledger reconciliation. |
| Persistence | `lib/store.js`, `data/db.json` | Synchronous whole-file reads and writes. The store locates the database relative to its own module. Changing the working directory alone does not isolate the data. |

## Follow an order through the code

`POST /api/orders` resolves product IDs to catalog prices and HSN codes, checks sellable stock, validates the coupon, and calls `pricing.computeTotals`. A Khata sale also checks the account and credit limit before charging the customer. The route then calls `inventory.reserve` to deduct physical stock, `orders.add` to create the order, and `store.appendAudit` and `store.write` to persist the changes. A successful checkout returns HTTP 201.

On this branch, checkout, cart preview, and printed invoices use `pricing.computeTotals`. It apportions an eligible coupon across lines and calculates each line's GST on its discounted value. Preserve the line-level rounding and use the shared result when rendering. The reconciliation report compares the calculated invoice tax **and** total with the recorded order. Keep that comparison independent so a genuine discrepancy remains visible.

## Verify the invoice ticket

- Use fixed expected amounts in regression tests. For order #1002, a ₹1,020 subtotal with `SAVE10` gives a ₹102 discount, ₹45.90 GST, and ₹963.90 total. An expectation computed by calling the same pricing function would miss a shared calculation error.
- Cover the ₹150 coupon cap on #1004, the mixed GST slabs on #1007, and the already-balanced #1008. Keep coverage for missing HSN, zero tax, and a one-paisa ledger discrepancy.
- For a manual check, open the GST Audit tab on a temporary copy of the workshop data. Compare both the tax and total for #1002 with its printable invoice. The original eight orders balance on the fixed branch. Capture this view before creating additional orders in that copy.

## Checkpoints and review

| Checkpoint | Evidence to retain |
| --- | --- |
| CP1 · Explain | A read-only walkthrough with the folder name visible. Identify verified behavior and label hypotheses. |
| CP2 · Diagram | The architecture and order flow as inspected at CP2. Show the UI, server, four routers, library modules, configuration, and data file. |
| CP3 · Characterize | Test filename, `node --test` output, and the passing baseline before the fix. |
| CP4 · Fix | The failing regression, passing suite, matching before/after app views, and the names of old-behavior tests updated. Review the diff and check the caller that exposed the bug. Use the workshop's manual diff review if automated review is unavailable. |
| CP5 · Pull request | When publication is requested, push the `fix/` branch to the fork and open a PR against the target `main`. Begin the body with `Fixes #<issue number>`, then describe the tests added first, cause, fix, and result. Leave the PR open for review. |

Keep checkpoint images in `docs/checkpoints/`. Verify that text and amounts are readable and keep tokens and personal email addresses out of screenshots. Preserve the original baseline and failing evidence when adding the passing result. For a local-only handoff, identify the local branch and label the PR body as a draft.
