# ShopLedger contributor guidance

## Architecture

- `server.js` creates and exports the Express application and starts the listener when run directly.
- `config.js` contains runtime defaults, shop metadata, tax slabs, coupons, and inventory policy.
- `routes/` contains Express HTTP handlers. Keep handlers focused on request validation, orchestration, and responses.
- `lib/` contains reusable business logic for orders, inventory, pricing, tax, coupons, customers, reports, invoices, dates, and JSON persistence.
- `data/db.json` is the application data store. Preserve its structure and existing data unless a task explicitly requires otherwise.
- `public/` contains the static browser application (HTML, CSS, and JavaScript), served by Express.

## Node.js and code conventions

- Use the existing Node.js runtime and CommonJS (`require` / `module.exports`) conventions.
- Preserve the current architecture; do not add frameworks or dependencies without a clear need.
- Follow nearby formatting and naming conventions. Keep changes focused on the requested behavior.
- Validate untrusted request data on the server before business logic or persistence. Do not silently coerce malformed input into a valid business value.

## Express and routes

- `server.js` mounts route modules under `/api`; route modules export Express routers.
- Return appropriate HTTP status codes and JSON error messages for API failures.
- Keep business rules in `lib/` where practical so routes and tests can share them.

## JSON storage and data safety

- `lib/store.js` synchronously reads and writes the complete `data/db.json` file.
- Preserve the existing JSON shape and use the store module for normal application persistence.
- Never overwrite or reset committed application data as part of tests. Tests should use isolated fixtures or temporary data.
- Validate a multi-item inventory change before applying mutations, to avoid partial in-memory updates on failure.
- The JSON store has no transaction or concurrent-write protection; avoid broad persistence changes unless explicitly requested.

## Error handling

- Business logic should return explicit success/failure results when an operation can fail.
- Callers must stop before persistence or follow-on side effects when business logic reports failure.
- Avoid reporting success when required records are missing or state changes were not applied.

## Installation, startup, and tests

- Install dependencies with `npm install`.
- Start the application with `npm start` (default port 3000; configurable through `PORT`).
- Run tests with `npm test` (`node --test`, using Node's built-in test runner).
- Keep tests focused and deterministic; do not require network access or mutate `data/db.json`.

## Git workflow

- Work on the task branch requested by the user; do not switch branches without instruction.
- Review `git status` before and after changes. Do not stage, commit, or push unless explicitly asked.
- Do not modify unrelated files or include pre-existing untracked changes in task work.
