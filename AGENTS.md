# ShopLedger

ShopLedger is a Node.js app using CommonJS, Express 4, and body-parser. The
browser UI uses static HTML, CSS, and JavaScript. The app stores its data in
a local JSON file.

## Module map

- `server.js` serves the UI, mounts the API routers, and serves printable invoices.
- `public/` contains the POS, order register, Khata, dashboard, and GST audit UI.
- `routes/` handles products, orders, customers, and reports.
- `lib/` implements pricing, coupons, GST, inventory, orders, dates, Khata,
  invoices, reporting, and JSON persistence.
- `config.js` holds shop settings, tax rates, coupons, and inventory defaults.
- `data/db.json` is the app's tracked data file.

## Commands

- `npm install` installs the existing dependencies.
- `npm start` starts the app, which defaults to port 3000.
- `node --test` runs the built-in Node test runner. The `npm test` script is
  still a placeholder.

## Workshop rules

- Write characterization tests before changing behavior.
- Limit production code changes to the modules involved in the selected ticket.
- Use in-memory fixtures in tests. Tests must never read or write `data/db.json`.
- Add no dependencies.
