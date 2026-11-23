# Repository Guidelines

## Project Structure & Module Organization

This is a small Express application using CommonJS modules and a JSON-file data store. `server.js` wires the app; `routes/` contains API handlers; `lib/` contains business logic, including pricing, tax, inventory, invoice, and reporting. The browser interface is in `public/`. `config.js` contains application settings, while `data/db.json` stores local application data.

The architecture diagram is available at `docs/architecture.svg`.

Automated tests are located in `test/`.

## Build, Test, and Development Commands

- `npm install` installs dependencies.
- `npm start` runs the application using `node server.js`.
- `node --test` runs the automated Node.js tests.

The existing `npm test` script is a placeholder and is not configured to run the test suite.

## Coding Style & Naming Conventions

Follow the existing JavaScript style: two-space indentation, semicolons, single-quoted strings, CommonJS modules, and descriptive lowercase filenames.

Keep business calculations in `lib/` rather than duplicating them in routes or browser code.

## Testing Guidelines

- Write characterization tests before changing legacy behavior.
- Use in-memory test data where possible.
- Do not modify production data in `data/db.json` during tests.
- Run `node --test` after changes.
- Keep tests focused on the behavior being changed.

## Commit & Pull Request Guidelines

Keep commits focused and use short, descriptive commit messages.

Pull requests should explain the problem, root cause, implementation, affected files, and test results.

Do not merge a pull request unless explicitly requested.

## Security & Data Notes

Treat `config.js` and `data/db.json` as sensitive. Never commit real credentials or customer data.

Preserve existing records when changing store logic and review authorization and input handling for new endpoints.