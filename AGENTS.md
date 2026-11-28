# ShopLedger contributor notes

The browser UI in public/ calls Express routers in routes/. Billing, inventory, dates, orders, credit, reconciliation, and persistence live in lib/. config.js holds shop settings. The local server starts with npm start and the automated suite runs with npm test.

Write characterization tests before changing behaviour. Limit production edits to the modules involved in the ticket. Use synthetic fixtures and never run tests against the tracked data/db.json. Workshop fixes should use existing dependencies.
