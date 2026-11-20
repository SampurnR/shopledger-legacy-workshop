# ShopLedger contributor notes

## Stack and entry points
- This is a Node.js and Express application. `server.js` mounts the API routers and serves the browser UI from `public/`.
- Business logic lives in `lib/`; configuration is in `config.js`; the JSON store is `data/db.json`.
- Use the built-in Node test runner with `npm test`. Do not add dependencies for tests unless a task requires them.

## Safe change rules
- Add characterization or regression tests before changing behavior.
- Keep a fix within the modules its ticket concerns; avoid unrelated cleanup.
- Never write to or run tests against `data/db.json`. Use in-memory fixtures or a disposable project copy.
- For checkout and invoice calculations, `lib/pricing.js` is the checkout source of truth; it uses `lib/tax.js` and `lib/coupons.js`.
- Do not add dependencies unless the task needs them.
