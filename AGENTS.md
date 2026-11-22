# Repository Guidelines

## Project Structure & Module Organization

ShopLedger is a small CommonJS/Express billing and inventory app. `server.js` mounts the API routers and serves the UI; `config.js` holds shop, tax, coupon, inventory, and port settings. Keep HTTP handlers in `routes/` (`products.js`, `orders.js`, `customers.js`, `reports.js`) and business logic in focused `lib/` modules. The browser UI is in `public/index.html`, `public/js/app.js`, and `public/css/style.css`. `data/db.json` is the persistent JSON store. Regression coverage currently lives in `test/invoice.test.js`; architecture material is in `docs/`.

## Build, Test, and Development Commands

- `npm install` installs the dependencies listed in `package.json`.
- `npm start` runs `server.js` locally (default port `3000`; override with `PORT`).
- `node test/invoice.test.js` runs the invoice regression checks using in-memory fixtures; it does not load `data/db.json`.

There is no build step configured. `npm test` is currently a placeholder that exits with “no test specified”; use the direct test command above until the script is updated.

## Coding Style & Naming

Match the existing JavaScript style: CommonJS `require`/`module.exports`, two-space indentation, `var` declarations, camelCase functions and variables, and lowercase module filenames. Keep route handlers thin and place reusable calculations or persistence behavior in `lib/`. No formatter or linter is configured in `package.json`.

## Testing Guidelines

Add focused regression cases to `test/` using descriptive `.test.js` filenames. Use in-memory fixtures for data-dependent behavior; never run tests against the persistent `data/db.json` file. Include expected totals and relevant row-level values when testing pricing or tax calculations.

## Commits and Pull Requests

Recent commits use short, descriptive, lowercase subjects (for example, `invoice page for accountant`). Follow that pattern. No PR template is present; describe the behavior changed, link the related issue when available, and list the checks run. Include a screenshot for visible UI changes.

## Data and Configuration

`data/db.json` is mutable application data. Keep test fixtures separate from it. `config.js` contains a hard-coded admin key alongside operational settings; do not copy credentials into new files or expose the key in logs or documentation.
