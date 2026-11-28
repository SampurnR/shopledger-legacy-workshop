# Repository Guidelines

## Project Structure

`server.js` creates the Express application, serves `public/`, mounts API routers, and renders invoice pages. `config.js` contains shop, GST, inventory, and coupon settings.

- `routes/` contains product, order, customer, and report HTTP handlers.
- `lib/` contains the corresponding business rules and JSON storage adapter.
- `public/` contains plain HTML, CSS, and browser JavaScript.
- `data/db.json` is the live application data store, never a test fixture.
- `test/` contains Node test files named `*.test.js`.
- `.knowledge/` contains concise, ticket-specific engineering records.

## Commands

- `npm start` runs `node server.js` on port 3000 or `PORT`.
- `node --test test/*.test.js` runs the Node built-in test suite.
- `npm test` is a placeholder that currently exits with an error.

There is no build step, formatter, linter, or configured coverage threshold.

## Style and Scope

Use CommonJS, two-space indentation, semicolons, single-quoted strings, and camelCase names. Match the surrounding module. Change only modules required by the ticket and add no dependencies. Add comments for business invariants and non-obvious decisions, not line-by-line narration.

## Ticket Workflow

1. Translate the ticket into testable acceptance criteria and inspect existing coverage.
2. If coverage is missing, commit characterization tests before production changes. Prefix intentionally surprising cases with `CURRENT BEHAVIOUR:`.
3. Investigate callers and data shapes. Critique the proposed fix against edge cases and rejected alternatives.
4. Implement the smallest complete fix, update superseded characterization tests, and run all tests.
5. Add `.knowledge/ticket-N-topic.md` with the ask, findings, considered approaches, final design, verification, and remaining limitations.
6. Keep commits atomic and categorized, for example `test(ticket-2): ...`, `fix(ticket-2): ...`, and `docs(ticket-2): ...`.

Tests must use in-memory or isolated data and must never read or write `data/db.json`. Before committing, inspect every changed path for credentials, tokens, personal files, machine-specific paths, and customer data.

## Pull Requests

Describe the user-visible problem, root cause, fix, and exact test result. Link the ticket and include screenshots for browser or invoice presentation changes. Never mix unrelated ticket work into a ticket commit.
