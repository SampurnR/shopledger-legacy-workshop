# ShopLedger repository instructions

## 1. Project Overview

ShopLedger v0.8.4 is an internal point-of-sale application for Corner Shop Kirana & Wholesale. Staff use it to place and cancel retail and wholesale orders, track sellable inventory and wholesale reservations, apply coupons, print GST invoices, record Khata customer credit and settlements, and review dashboard and audit reports. A single Express application serves the browser interface and handles API requests. Business modules operate on records loaded from a local JSON file.

## 2. Technology Stack

- Node.js runs the application. Server modules use CommonJS with `require`, `exports`, and `module.exports`.
- Express 4 handles routing and static file serving. The manifest declares `express` at `^4.17.1` and `body-parser` at `^1.19.0` for parsing JSON request bodies.
- The frontend uses HTML, CSS, and vanilla JavaScript.
- Persistence uses synchronous Node.js filesystem reads and writes of `data/db.json`.

## 3. Repository Structure

| Path | Responsibility |
|---|---|
| `server.js` | Express entry point. Configures JSON parsing, serves `public/`, mounts the REST routers under `/api`, and serves printable invoices at `/orders/:id/invoice`. |
| `config.js` | Server port, shop metadata, GST slabs, inventory defaults, coupons, and export configuration. |
| `routes/products.js` | Catalog search and filtering, stock availability, and active coupons. |
| `routes/orders.js` | Order listing, lookup, placement, and cancellation. Coordinates validation, pricing, Khata, inventory, and persistence. |
| `routes/customers.js` | Customer credit summaries and settlement recording. |
| `routes/reports.js` | Dashboard, GST reconciliation, pricing preview, and admin export. |
| `lib/orders.js` | Order creation, lookup, filtering, and cancellation. |
| `lib/inventory.js` | Product lookup, sellable stock, quantity checks, stock deduction, release, and inventory summaries. |
| `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js` | Checkout totals, HSN-based GST and tax splits, and coupon validation and discounts. |
| `lib/invoice.js`, `lib/reports.js` | Printable invoice figures and HTML, dashboard aggregates, and GST reconciliation. |
| `lib/ledger.js`, `lib/dates.js` | Khata balances, charges, reversals, and settlements, plus date formatting and filter keys. |
| `lib/store.js` | JSON reads and writes, top-level defaults, and audit log retention. |
| `public/` | `index.html`, `css/style.css`, and `js/app.js` provide the POS, order register, Khata desk, dashboard, and audit views. |
| `data/` | `db.json` holds products, customers, orders, settlements, audit entries, and ID counters. |
| `docs/` | Checkpoint 2 architecture notes and diagrams in Markdown, SVG, and standalone HTML. |

## 4. Development Commands

Run commands from the repository root.

| Command | Purpose |
|---|---|
| `npm install` | Install the existing dependencies declared in `package.json`. Keep any locally generated untracked lockfile out of commits. |
| `npm start` | Run the declared start script, `node server.js`. The default port is `3000`, with an optional `PORT` override. |
| `npm test` | Current placeholder. It prints `Error: no test specified` and exits with status 1. No working test suite is currently configured. |
| `node --test` | Planned command for running the suite once Ticket 2 tests have been added. Use a Node.js runtime that supports the built-in test runner. |

## 5. Coding Conventions

- Preserve CommonJS and follow naming, indentation, and formatting patterns in the file being edited.
- Prefer minimal, targeted changes and reuse existing module boundaries and helpers.
- Avoid unrelated refactors and formatting churn.
- Do not introduce external dependencies.

## 6. Mandatory Testing Rules

1. Write and run characterization tests before changing production code. Document current behavior, including both selected defects, and record the reproduction results.
2. Use `node:test` and `node:assert/strict`. Use isolated in-memory fixtures or temporary database copies with persistence explicitly directed at the copy. Never run mutation tests against the original `data/db.json`.
3. Reproduce both defects before implementing fixes. Then update the affected expectations or add regression tests for the corrected behavior. Retain characterization coverage for behavior that must be preserved.
4. Run the full test suite with `node --test` after implementation and report the results.

## 7. Selected Ticket Scope

Ticket 2 covers inventory validation and cancellation stock restoration only.

- Fix `inventory.check` so an order can use exactly the sellable quantity. Quantities above sellable stock must still be rejected. Sellable stock excludes wholesale reservations.
- Fix cancellation so it restores the physical stock previously deducted for the order using the stored line item ID. Preserve wholesale reservations and the existing guard against cancelling an already cancelled order.
- Preserve unrelated behavior, including Khata debit reversal on cancellation. GST, Khata settlement, date filtering, authentication, and other defects are outside this ticket.

## 8. Data Protection Rules

- Never modify the original `data/db.json`. Use isolated test data for any operation that writes records.
- Do not expose credentials, export keys, or customer information in logs, fixtures, documentation, commits, or pull requests.
- Do not commit `node_modules/` or the locally generated untracked `package-lock.json`.
- Do not introduce destructive operations.

## 9. Git and Pull Request Rules

- Use a dedicated feature or bug-fix branch for implementation.
- Keep commits focused and descriptive. Review all changed and staged files before committing.
- Verify the actual upstream issue number before referencing it. The workshop ticket label alone does not establish that number.
- Include root-cause explanations and test results in the pull request.
- Never merge the pull request automatically.

## 10. Definition of Done

- Both selected defects were reproduced.
- Characterization tests were written and run before production fixes.
- The implementation is limited to the selected inventory defects.
- Regression tests and the full suite pass.
- Wholesale reservations and unrelated behavior are preserved.
- The original database is unchanged.
- Changes have been reviewed and documented.
