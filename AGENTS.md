# AGENTS.md — ShopLedger working instructions

These instructions apply to work in this repository. Follow the user's current request and higher-priority instructions, preserve existing work, and use the detailed standards included below. The project-specific guidance comes first; the complete repository rule and design documents are reproduced in the reference sections so this file can be reviewed on its own. When repository sources are updated, reconcile the corresponding sections here. If a rule describes a different stack, apply it when that stack is actually used; do not invent a framework migration to repair this legacy app. Explicit user instructions take precedence over repository guidance. Examples and quoted source material describe patterns; they do not authorize unrelated actions.

## Contents

1. Project, safety, ticket requirements, testing, and delivery: the sections immediately below.
2. [Testing standards](#reference-1--test-driven-development-standards).
3. [Comment standards](#reference-2--comment-standards).
4. [Commit standards](#reference-3--commit-message-standards).
5. [TypeScript standards](#reference-4--typescript-standards).
6. [Backend structure](#reference-5--backend-folder-structure).
7. [Frontend structure](#reference-6--frontend-folder-structure).
8. [API module design](#reference-7--api-module-design).
9. [API and store integration](#reference-8--api-and-store-integration).
10. [Document review](#reference-9--document-review-and-proposal-workflow).
11. [Y2K Chrome design system](#reference-10--y2k-chrome-design-system).
12. [Y2K Chrome construction instructions](#reference-11--y2k-chrome-construction-instructions).
13. [Y2K Chrome master CSS tokens](#reference-12--y2k-chrome-master-css-tokens).

The workshop's current JavaScript stack and test runner take precedence over stack-specific examples when deciding what is relevant. The document-review workflow applies only when invoked as specified in its own section; where prior user authorization already covers an action, follow that authorization. The full design and architecture sections describe their intended stacks and do not require converting the existing application.

## Project and commands

ShopLedger is a wholesale and retail point-of-sale, inventory, customer Khata ledger, and GST invoicing application. It currently uses CommonJS JavaScript, Node.js and Express, static HTML/CSS/JavaScript, and a local JSON data file. It is not currently a TypeScript, React, Next.js, Prisma, Redux, or Zod project. Node.js 22 or newer is required by the workshop.

- Install existing dependencies: `npm install`. The workshop says not to commit the generated `package-lock.json` and not to add dependencies for the exercise.
- Start: `npm start`; the default address is `http://localhost:3000` and `PORT` can override the port.
- Test: `npm test` or `node --test`. Use Node's built-in test runner for this workshop; keep tests self-contained and offline.
- Inspect changes: `git status --short` and `git diff`; include untracked files in review. Never assume a clean working tree.

## Module map

- `server.js`: Express setup, static assets, API routers, and printable invoice route; `config.js`: shop, tax, inventory, coupon, and port settings.
- `public/`: browser UI, styles, and client-side interactions.
- `routes/products.js`: products and coupons; `routes/orders.js`: order creation, lookup, and cancellation; `routes/customers.js`: Khata accounts and settlements; `routes/reports.js`: dashboard, GST reconciliation, pricing preview, and export.
- `lib/pricing.js`, `lib/tax.js`, `lib/coupons.js`: checkout calculations, HSN tax rates, and discounts.
- `lib/inventory.js`, `lib/orders.js`, `lib/dates.js`: stock checks and updates, order operations, and date helpers.
- `lib/ledger.js`, `lib/invoice.js`, `lib/reports.js`: Khata balances, printable invoices, and reports.
- `lib/store.js` reads and writes `data/db.json`, the tracked local data store. `docs/` holds design guidance, rules, workshop plan, and architecture documentation where present.

Order creation validates product IDs and stock, resolves pricing and coupons, charges Khata when selected, deducts stock, records the order, and persists the data. Verify behavior against the code before relying on this map; update documentation when a change makes it inaccurate.

## Scope and safety

- Read the relevant code and trace the actual flow before changing behavior. Explain confirmed facts separately from hypotheses.
- Protect existing user changes. Do not reset, overwrite, or remove tracked data or unrelated work. Placing orders, cancelling orders, or settling balances changes `data/db.json`.
- Tests must never read from or write to the real `data/db.json`. Use in-memory fixtures or an isolated temporary project and data copy for integration and manual demonstrations. Do not depend on a real network, the real clock, or test order in the default test suite.
- Make the smallest coherent change that fixes the requested behavior. Do not add unrelated refactors, new packages, infrastructure, or TypeScript conversion. Consider interactions between tickets and preserve existing API contracts unless a change is explicitly required.
- Validate inputs and handle real failure cases at the appropriate boundary. Use `try/catch` where an exception can be meaningfully handled or propagated; do not swallow errors, invent success responses, or wrap every function indiscriminately. Never claim that a system is completely error-proof.
- Keep sensitive information out of logs, screenshots, commits, and pull requests. Do not expose credentials, make a repository public, merge a pull request, force-push, or perform destructive Git operations without the appropriate authorization.

## Workshop tickets and acceptance criteria

The user wants all three tickets fixed, with ticket 1 emphasized in the demonstration. `docs/workshop-plan.md`, when present, records the acceptance criteria and verification; re-check actual status rather than assuming work is complete.

1. **Invoice and GST:** Invoice totals and GST should agree with checkout and the recorded example orders, including HSN slabs, discounts, coupon limits, rounding, and line breakdowns. Demonstrate order #1002 and the capped SAVE10 order #1004. Historical invoices currently depend on the available stored data and pricing configuration; do not claim past rules are preserved unless that is implemented and tested.
2. **Inventory:** Permit sales up to the exact sellable quantity while respecting wholesale reservations and preventing overselling. Cancellation should restore sold physical stock once, without releasing unrelated reservations.
3. **Dates and Khata:** Sort orders newest first and compare date ranges chronologically and inclusively. Numeric settlement amounts, including values received as strings, should update customer totals and balances correctly; reject invalid payments without mutation.

## Test-first workflow and review

1. Read the ticket, identify affected modules and acceptance criteria, and enumerate meaningful cases with stable requirement references. Record current behavior with characterization tests before changing it, including wrong behavior marked `CURRENT BEHAVIOUR` while it is being characterized.
2. Write a test for the intended correction and observe it fail for the expected reason. Implement the focused change, update the characterization assertions whose behavior intentionally changed, and explain which ones changed.
3. Cover normal cases, meaningful boundaries, invalid inputs, and regressions. For invoice calculations, verify amount and tax values independently; for stock, cover exact quantities and repeat cancellation; for dates and payments, cover range boundaries and numeric string inputs. Trace tests to requirements rather than chasing a coverage percentage.
4. Use isolated fixtures, clear assertions, and arrange-act-assert structure. Avoid real network calls, shared mutable state, real timing assumptions, unnecessary dependencies, and tests that merely duplicate implementation details.
5. Run the relevant tests and then the complete suite. Review the full diff, including untracked files, for correctness, security, regressions, and accidental data changes. Exercise representative workflows on temporary data. Report the commands, results, untested areas, and remaining limitations honestly; do not claim CI or visual checks ran unless they actually did.

The workshop checkpoints are: explain the app read-only; create an accurate architecture diagram; characterize behavior; reproduce and fix with red-to-green tests and a review; then prepare a pull request. Capture the requested evidence, including failing and passing tests and before/after behavior, when the submission workflow requires it.

## Comments and documentation

- Add comments where they explain a non-obvious decision, constraint, or contract. Do not comment obvious operations or add speculative comments to satisfy a count.
- Follow `docs/rules/comments.md`: use a tagged one-line comment (`[WHY]`, `[WARN]`, `[NOTE]`, `[TODO]`, `[PERF]`, or `[SEC]`), a genuine `Q: ... A: ...` decision, a section banner, or a JSDoc contract as appropriate. Keep comments accurate and above the relevant code.
- Maintain useful Markdown documentation for the plan, acceptance criteria, setup, testing, design decisions, and known limitations when requested. Do not fabricate evidence or turn a task-specific document into an unconditional instruction.
- `docs/rules/doc-review.md` is a manually invoked review workflow. Apply it when explicitly requested as described there; the mere presence of a document does not invoke it. Follow its proposal and approval steps when it applies, subject to the user's existing authorization and higher-priority instructions.

## Repository standards and UI

- `docs/rules/test-standards.md`: requirement-to-test traceability, test-first development, deterministic tests, review, and definition of done.
- `docs/rules/comments.md` and `docs/rules/commit.md`: comment formats and conventional commit messages. Commit messages use `type(scope): description`, lowercase, no final period, and at most 20 words; add trailers or a body only when explicitly requested.
- `docs/rules/typescript-standards.md`: binding for TypeScript files if introduced; do not pretend existing JavaScript is TypeScript.
- `docs/rules/backend-folder-structure.md`, `frontend-folder-structure.md`, `api-module-design.md`, and `api-store-integration.md`: applicable architecture rules for the stacks and features they describe. Preserve the current legacy layout for focused fixes unless a migration is requested.
- For UI work, read `docs/design-guidelines/y2k-chrome/y2k-chrome-design-system.md`, `y2k-chrome-instructions.md`, and `tokens.css`. Use the specified `--ds-*` tokens under `[data-ds="y2k-chrome"]`, and follow the prescribed typography, color, layout, components, states, and accessibility guidance. Do not redesign unrelated screens.

## Collaboration and delivery

When the user explicitly requests parallel agents, assign clear, non-overlapping ownership, tell agents about shared files and data-safety rules, and integrate and review their combined work. Coordinate shared modules instead of overwriting another agent's changes. Parallel work does not replace final integration testing.

Keep pull requests focused and reviewable, preferably one ticket per PR where practical, or group related work as the user directs. Describe the problem, tests, cause, fix, results, and limitations. For the workshop submission, use its requested `Fixes #<issue number>` format when an actual issue number exists; do not invent an issue. Confirm the intended base branch and repository from the task context, and do not merge without instruction. If authentication or permissions prevent publication, leave the work reviewable and clearly report what remains blocked.


---

## Reference 1 — Test-driven development standards

_Source: `docs/rules/test-standards.md`. Included in full for standalone review._

## Test-Driven Development Standards

### 0. Purpose & How This Document Is Used

This document is handed to the implementing agent alongside `plan.md` and the feature's specification file, once planning is finished and implementation is about to start. It is the binding rule set for **how tests are designed, written, structured, and reviewed** across this full-stack TypeScript codebase (React/Next.js frontend, NestJS/Node backend, PostgreSQL + MongoDB via Prisma, Redis/BullMQ for queues/jobs).

Binding principle: **no requirement is implementation-complete until its test cases are enumerated, traceable to the spec, written, and passing.** Tests are not an afterthought bolted on to "hit coverage" — they are derived from the spec before the implementation code exists, and they are what proves the implementation satisfies the spec.

This document assumes the agent already has:
- `plan.md` — what is being built and why
- The specification file — functional requirements, acceptance criteria, config/schema shape
- `typescript-standards.md`, `backend-folder-structure.md`, `api-module-design.md`, `api-store-integration.md`, `comment-standards.md` — existing project conventions this document extends, not replaces

---

### 1. Philosophy

#### 1.1 What "test-driven" means here

Classic TDD is the red–green–refactor loop: write a failing test for a tiny unit of behavior, write the minimum code to pass it, refactor, repeat. That loop is real and used here for pure logic — validators, parsers, reducers, prompt builders — where there is no I/O and the unit is small enough to hold in your head.

For anything with a database, an external API, or a UI, literal line-by-line red-green-refactor is impractical and not how this project works. Instead this project follows **spec-driven test generation**: the spec is decomposed into requirement IDs, each requirement is decomposed into 2–5 enumerated test cases (see Section 2), and those cases are written as failing tests before the implementation of that unit, then implemented to green. The loop moves at the level of "one requirement" rather than "one line," but the discipline is the same — tests before code, always.

#### 1.2 Why this order matters

Writing the test first forces the interface and the expected behavior to be decided before implementation details creep in and start dictating the design. It also produces a naturally traceable test suite: every test exists because of a specific line in the spec, not because someone tried to think of something to test after the fact. When a requirement changes, its test cases change with it, and the mapping is visible in the code, not just in someone's memory.

#### 1.3 A requirement is not done until

- The test-case enumeration for its unit(s) exists and cites the requirement ID
- Every enumerated case has real test code
- All of it passes
- Nothing in the default test run touches a real external service
- Comment standards (Section 6) are followed

---

### 2. Test Case Enumeration — the 2–5 Rule, Formalized

Before writing implementation code for any function, module, endpoint, hook, or component named or implied by the spec, enumerate 2–5 test cases. This is not arbitrary — it maps directly onto established test-design techniques so the enumeration is systematic rather than guessed:

| # | Case type | Design technique behind it | Applies to |
|---|---|---|---|
| 1 | **Happy path** | Equivalence Partitioning (the "valid" class) | Every unit, no exception |
| 2 | **Boundary/edge case** | Boundary Value Analysis — min, max, empty, zero, just-inside/just-outside a limit | Anything with a range, length, or limit (token counts, pagination, string length, array size) |
| 3 | **Invalid input** | Equivalence Partitioning (the "invalid" classes) | Anything accepting external or user input |
| 4 | **Failure/exception mode** | Error Guessing + explicit dependency-failure modeling | Mandatory for anything touching DB, network, filesystem, or an external provider |
| 5 | **State/permission case** | State Transition Testing or Decision Tables | Anything with a lifecycle (draft → active → archived) or an authorization check |

Additional technique to reach for when a unit has several independent inputs that can combine (e.g., a config object with 4 independent booleans): use **pairwise/combinatorial testing** instead of exhaustively enumerating every combination — it catches the same defect classes with far fewer cases, and the resulting case count still fits inside the enumeration you write down.

Not every unit needs all 5 rows. A pure formatting utility might only need rows 1–3. Anything that calls the AI provider, the database, Redis, or any HTTP dependency requires row 4 without exception — this is the row most often skipped and the one most correlated with production incidents.

#### 2.1 Where the enumeration lives

Write it as a comment checklist directly above the `describe()` block, before any test code:

```typescript
// ====================================================================
// PromptBuilder.buildSystemPrompt
// Covers: SPEC-3.2 (system prompt construction)
// Cases:
//   [ ] happy path — valid config produces expected prompt structure
//   [ ] boundary — context at exactly the token limit
//   [ ] invalid — config missing required `persona` field
//   [ ] failure — template file unreadable
// ====================================================================
describe('PromptBuilder.buildSystemPrompt', () => {
  // tests go here, checking off the boxes above as they're written
});
```

The checkboxes get checked off (`[x]`) as each test is written, so the file itself shows enumeration-to-code traceability without needing an external spreadsheet.

---

### 3. Test Structure: AAA and Naming

Every test follows **Arrange–Act–Assert**, in that order, with a blank line or comment separating the three sections:

```typescript
it('should reject a conversation with more than 50 messages', () => {
  // Arrange
  const conversation = buildConversationFixture({ messageCount: 51 });

  // Act
  const result = validateConversation(conversation);

  // Assert
  expect(result.valid).toBe(false);
  expect(result.reason).toBe('MESSAGE_LIMIT_EXCEEDED');
});
```

Rules:
- One behavior per test. If a test needs "and" in its description to be accurate, split it.
- Test names read as a sentence: `it('should <expected behavior> when <condition>')`.
- `describe()` blocks mirror the module/class/function name exactly, matching the enumeration comment above them.
- No conditional logic (`if`/`for`/`try-catch` used to branch assertions) inside a test body. A test with a branch is really two tests that haven't been split yet.
- Assertions are specific. `expect(result).toBeTruthy()` is banned where `expect(result.status).toBe('success')` is possible — vague assertions pass when the code is subtly wrong.

---

### 4. Test Doubles — Which One, When

Five kinds exist; this project uses four of them deliberately (dummies are avoided — TypeScript's type system generally makes "objects that exist only to satisfy a signature" unnecessary).

| Double | What it does | Verification style | Use when |
|---|---|---|---|
| **Stub** | Returns a canned answer, doesn't care how it's called | State — check the result | Default choice. Feeding a known input to the unit under test. |
| **Fake** | A real, working, lightweight implementation (in-memory DB, in-memory queue) | State | The dependency's *behavior* matters for the test, not just its return value (e.g. testing a repository against fake-but-real query semantics). |
| **Spy** | A stub that also records how it was called | Behavior (light) | Confirming a side-effecting call happened (e.g. "was the email service invoked exactly once") without over-specifying the whole interaction. |
| **Mock** | Pre-programmed with expectations; fails the test if they're not met | Behavior (strict) | Verifying an interaction contract — e.g. "the retry handler must call the provider client with exponential backoff." Use sparingly; mocks couple tests to implementation and make refactors break tests that should have stayed green. |

Default to stubs. Reach for a mock only when the *interaction itself* is the thing being specified, not the result. Never mock the unit under test's own internals — only its collaborators.

---

### 5. The Testing Shape For This Project

Two established models exist — the **Testing Pyramid** (many unit tests, fewer integration, very few E2E) and the **Testing Trophy** (static analysis as the base, integration tests as the largest layer, unit tests reserved for complex logic, E2E thin at the top). This project uses a **hybrid**, because the codebase has two genuinely different shapes of code in it:

- **Logic-heavy modules** (prompt building, token counting/truncation, config validation, conversation-state reducers, permission checks) — these have real branching business logic and benefit from pyramid-style heavy unit testing. Mocking their dependencies is cheap because they mostly don't have any.
- **API-and-DB-heavy modules** (controllers, services that mostly orchestrate a DB call and a response shape, CRUD endpoints) — these benefit from trophy-style integration testing, because a unit test that mocks the DB just re-describes the code rather than verifying it, while an integration test against a real (containerized) database catches the actual defect class that occurs here — bad queries, wrong constraints, wrong status codes.

Layer order, bottom to top:

1. **Static analysis** — TypeScript compiler + ESLint. Catches an entire class of defects (typos, wrong types, unreachable code) before a single test runs. Non-negotiable CI gate, runs first, fails fast.
2. **Unit tests** — pure logic, no I/O. Majority of test count for logic-heavy modules.
3. **Integration tests** — controller → service → DB, with the DB either containerized (Testcontainers) or an isolated test schema, and all *external* providers (AI/LLM, third-party APIs) mocked. Majority of test count for API-heavy modules.
4. **Contract tests** — schema validation of anything crossing a trust boundary: AI/LLM structured output, third-party API responses, your own public API's response shape. Small in number, high value.
5. **E2E tests** — 1–2 golden paths and 1 error-recovery path, full stack, browser-driven. Deliberately thin — E2E is the most expensive, slowest, and flakiest layer, so it only covers what nothing else can: the full user journey actually working end to end.

---

### 6. Comment Standards Applied to Tests

Use the existing four formats from `comment-standards.md`, applied specifically to test code:

- **Tag-prefixed one-liners** `// [TAG] ...` for inline test notes — e.g. `// [EDGE] empty conversation history`, `// [FLAKY-RISK] uses real Date, see Section 10`
- **Q/A one-liners** `// Q: ... A: ...` for non-obvious assertions — e.g. `// Q: why 3 retries? A: matches provider's documented backoff window`
- **Section-banner** (`// ====`) with a purpose line, required at the top of every test file, stating which module is under test
- **JSDoc blocks** (`@param`/`@returns`/`@throws`) on every test helper, fixture builder, or custom matcher

Every top-level `describe()` opens with the enumeration checklist shown in Section 2.1 — this is a mandatory addition specific to test files, on top of the four general-purpose formats.

---

### 7. Layer-by-Layer: Frontend (React / Next.js)

#### 7.1 What belongs at the unit level
Custom hooks with real logic (not thin wrappers over a single API call), pure display-formatting functions, reducers, form-validation logic. Use `@testing-library/react-hooks` patterns or `renderHook` for hooks in isolation.

#### 7.2 What belongs at the integration level
Components rendered with their real children, real context providers, and real routing, with only network calls mocked (MSW). This is the majority of frontend test volume. Test the component the way a user encounters it, not the way it's implemented internally.

#### 7.3 Rules specific to component tests
- **Never** query by CSS class, internal state, or component instance. Query the way a user or assistive technology would: `getByRole` first, then `getByLabelText`, then `getByPlaceholderText`, then `getByText`. `getByTestId` is a last resort, not a default.
- If a query is hard to write because the element has no accessible role or label, that is itself a defect — fix the markup, don't reach for a test ID to route around it.
- Use `userEvent`, not `fireEvent`, for interactions — it models real browser event sequences (focus, then keydown, then input) rather than firing a single synthetic event.
- Async UI (loading → data, streaming chat responses) must be asserted with `findBy*` or `waitFor`, never with a fixed `setTimeout`-based delay in the test.
- A test that renders the AI chat UI must mock the network layer (MSW), including a streaming-response fixture — never let a component test hit the real chat API.

```typescript
// ====================================================================
// ChatInput component
// Covers: SPEC-4.1 (message composer)
// Cases:
//   [x] happy path — typing and submitting calls onSend with trimmed text
//   [x] boundary — submit disabled when input is empty/whitespace-only
//   [x] invalid — submit disabled when input exceeds max length
// ====================================================================
describe('ChatInput', () => {
  it('should call onSend with trimmed text when the form is submitted', async () => {
    // Arrange
    const onSend = jest.fn();
    render(<ChatInput onSend={onSend} />);
    const textbox = screen.getByRole('textbox', { name: /message/i });

    // Act
    await userEvent.type(textbox, '  hello  ');
    await userEvent.click(screen.getByRole('button', { name: /send/i }));

    // Assert
    expect(onSend).toHaveBeenCalledWith('hello');
  });
});
```

---

### 8. Layer-by-Layer: Backend (NestJS / Node)

#### 8.1 Unit tests
Test services and providers in isolation using Nest's `Test.createTestingModule`, with all injected dependencies replaced by stubs. This is where business logic (validation, transformation, orchestration decisions) is verified without touching a real database.

```typescript
describe('ConversationService.appendMessage', () => {
  it('should throw when appending to an archived conversation', async () => {
    // Arrange
    const repo = { findOne: jest.fn().mockResolvedValue({ status: 'archived' }) };
    const service = new ConversationService(repo as any);

    // Act & Assert
    await expect(service.appendMessage('conv-1', 'hi')).rejects.toThrow(
      ConversationArchivedError,
    );
  });
});
```

#### 8.2 Integration tests
Spin up the real Nest module (controllers + services + real Prisma client) against either a **Testcontainers**-provisioned Postgres instance or an isolated test database/schema, and use Supertest to drive requests through the actual HTTP layer, including guards, pipes, and interceptors. Only the AI/LLM provider client and other genuinely external services are mocked here — the database is real, because a unit test that mocks Prisma cannot catch a bad query, a missing index assumption, or a constraint violation, and those are exactly the defects that show up in production for CRUD-shaped code.

Decision rule for DB testing:
- **Testcontainers** (real Postgres/Mongo in Docker) — default for integration tests. Slower per-run than mocks but catches real query/constraint defects and matches production behavior exactly.
- **Mocked Prisma client** — acceptable only at the unit-test level, for services where the DB call is incidental to the logic actually being tested.
- Each test gets a clean database state — either a transaction that's rolled back after the test, or truncate/reseed in a `beforeEach`. Tests must never depend on data left behind by another test.

#### 8.3 Guards, pipes, interceptors, middleware
Each gets its own unit tests independent of any controller — e.g. an `AuthGuard` is tested by calling `canActivate` directly with constructed `ExecutionContext` fixtures for the valid-token, missing-token, expired-token, and wrong-scope cases, not only indirectly through a controller integration test.

---

### 9. AI / LLM-Specific Testing (the part most teams get wrong)

LLM-backed code fails in ways ordinary code doesn't: the same input can validly produce different output every run, the provider can silently change behavior on their end without any change in this repo, and a "wrong" output is often not a crash but a plausible-sounding bad answer. Standard unit-test equality assertions don't work here. This project uses a **three-layer model** for anything that touches the AI provider:

#### 9.1 Layer 1 — Unit tests (always mocked, always in the default run)
Test everything *around* the model call, never the model call itself:
- Prompt/message formatting — given inputs, does the constructed prompt have the exact expected structure
- Token counting and truncation logic
- Response parsing — given a fixed provider response payload, is it parsed into the expected shape
- Retry/backoff logic — driven with fake timers (Section 10), never real waits
- Error mapping — provider error codes map to the correct internal error types

The AI client is always a stub or a fake here. No network call ever happens in this layer.

#### 9.2 Layer 2 — Integration tests (recorded fixtures, always in the default run)
Test the full request → provider-call → response → persistence cycle against **recorded fixture responses**, not the live provider. Maintain a fixture set per endpoint/use case covering: valid success, empty/null response, malformed/unexpected schema, streaming with a premature termination, timeout, rate-limit (429), and provider error (5xx). These fixtures are checked into the repo and replayed deterministically — the equivalent of VCR-style cassette testing. This layer proves the plumbing works for every failure mode the provider can produce, without needing the provider to actually produce it on demand.

#### 9.3 Layer 3 — Evals (live calls, never in the default test run)
A separate, explicitly-invoked suite that calls the real provider against a curated golden dataset, used to catch quality regressions from a prompt change or a provider-side model update. This layer is **not** part of `npm test` and never blocks a normal CI run on every commit — it runs on a schedule or when prompt/model config changes, because it's slow, costs money, and is inherently non-deterministic. Structure eval assertions in three tiers:
- **Deterministic** — exact-match or schema checks (JSON validity, required fields present, response within a length bound). Cheapest, run these first.
- **Rubric-based** — LLM-as-judge scoring against an explicit written rubric, for qualities like tone or relevance that can't be checked with a plain assertion. The judge model's own reliability should be spot-checked against a small human-labeled set before it's trusted as a gate.
- **Composite** — combining multiple metrics into one pass/fail where a single metric would be too noisy alone.

**Hard rule:** no live call to the AI provider is permitted in any test that runs as part of the default `npm test` / CI-on-every-commit pipeline. If a test needs the real model to be meaningful, it belongs in the eval suite, not in unit or integration.

#### 9.4 Streaming-specific cases
Any chat/streaming endpoint needs explicit tests for: a complete stream consumed normally, a stream that terminates mid-message, a stream that emits a malformed chunk, a client that disconnects mid-stream (does the server clean up correctly), and a stream that never starts (provider hang) — the last one is verified with fake timers driving the timeout, never a real wait.

#### 9.5 Contract validation on AI output
Any structured output expected from the model (function-calling arguments, JSON responses) must be validated against a zod schema at the boundary, and that validation must have its own contract-test cases: valid shape, missing required field, extra unexpected field, wrong type for a field. This is the layer most teams skip, and it's where a silent provider-side format drift turns into a production incident instead of a caught test failure.

---

### 10. Flaky Test Prevention

Flakiness has five root causes, and each has a specific, known fix. A test suite that ignores these will eventually be distrusted and ignored, which defeats the entire point of testing.

| Source of flakiness | Fix |
|---|---|
| **Time** | Never use the real clock in a test that depends on timing. Use fake timers (`jest.useFakeTimers()` / `vi.useFakeTimers()`) and advance time explicitly. |
| **Randomness** | Seed any RNG used in a test, or replace `Math.random`/UUID generation with a stub returning a fixed value. |
| **I/O** | Every network call is intercepted (MSW/nock). No test in the default run touches a real external host. |
| **Shared state** | Tests must not depend on execution order or leftover state from another test. Reset mocks, clear modules, and reset/reseed the database in `beforeEach`/`afterEach`, not just at suite start. |
| **Concurrency** | Be deliberate about parallel test execution — a test that mutates module-level or global state will behave differently run alone vs. run alongside others in the same worker. |

Practical rules that follow from this:
- Every test must be **hermetic** (self-contained, controls its own inputs and dependencies) and **deterministic** (same code → same result, every run).
- A test that passes locally but fails intermittently in CI is not "probably fine" — it is treated as a real defect in the test, triaged, and fixed or explicitly quarantined with a tracked reason, never silently retried into passing.
- New or modified tests should be run multiple times before merge to surface hidden nondeterminism early, rather than discovering it days later in an unrelated PR's CI run.

---

### 11. Test Data Management

- Use factory/builder functions for fixtures (`buildConversationFixture({ overrides })`) rather than copy-pasted literal objects scattered across test files — a factory means a schema change requires one edit, not forty.
- Use a fake-data library (e.g. `@faker-js/faker`) for fields whose exact value doesn't matter, and hardcode only the fields the test actually asserts on — this keeps the reader's attention on what's relevant to the case.
- Factories live alongside the standards docs' existing folder conventions — co-located under a `test-utils` or `fixtures` module per feature, not duplicated per test file.
- Every factory function gets a JSDoc block per the comment standards, since factories are shared test infrastructure, not disposable test-local code.

---

### 12. File & Naming Conventions

- Test files are co-located with the source file they test: `subject.ts` → `subject.test.ts`. Placement within the folder tree otherwise follows `backend-folder-structure.md` — this document governs test *content*, not module layout.
- `describe()` blocks mirror the exact module/class/function name, matching the enumeration comment above them.
- Test names read as a sentence: `it('should <expected behavior> when <condition>')`.
- Fixture and helper files: `*.fixture.ts`, `*.factory.ts`, `*.mock.ts` — the suffix states what the file is for at a glance.
- E2E specs live in their own top-level test directory (not co-located), since they don't map to a single source file.

---

### 13. CI/CD Integration

Pipeline order, fail-fast at every stage:

1. **Static analysis** — `tsc --noEmit` and ESLint. Fails in seconds; no point running anything else if this fails.
2. **Unit tests** — fast, run on every commit, every PR.
3. **Integration tests** — run on every PR; Testcontainers-backed DB tests run here, isolated per CI job so parallel jobs don't collide on the same database.
4. **Contract tests** — run on every PR alongside integration.
5. **E2E tests** — run on every PR against a deployed preview/staging build, or at minimum before merge to the main branch; kept thin deliberately so this stage doesn't become the bottleneck.
6. **Evals** (AI-specific) — run on a schedule (e.g. nightly) and additionally whenever a prompt or model-config file changes, never on every commit.

A PR cannot merge with a red test at any of stages 1–5. Stage 6 failures are surfaced but don't block merge by default — a quality regression is investigated with the urgency of the metric drop, not treated as a merge-blocking hard gate, given its inherent noise.

---

### 14. Coverage Philosophy

Line/branch coverage percentage is a measurement of how much code executed during tests, not a measurement of whether the code was actually verified — a test with no assertions can produce 100% coverage of the code it calls. Chasing a coverage number produces tests that execute code without checking it means anything.

What this project checks instead:
- **Requirement-to-test traceability** (Section 2) — every acceptance criterion in the spec has a corresponding enumerated case with real test code. This is checked by review, not by a coverage tool.
- Coverage percentage is still collected and watched as a *signal*, not a *target* — a module sitting at 20% coverage while its spec has ten acceptance criteria is a red flag worth investigating, but a module at 100% coverage is not automatically considered "well tested."
- For especially critical logic (auth, payment-adjacent, prompt-injection defenses), consider mutation testing (e.g. Stryker) periodically — it verifies tests actually fail when the code is deliberately broken, which line coverage cannot tell you.

---

### 15. Workflow / Order of Operations Per Feature

1. Agent receives `plan.md` + the spec file + this document.
2. Agent extracts every requirement/acceptance criterion from the spec into a checklist, each with a stable requirement ID (e.g. `SPEC-3.2`).
3. For each unit implied by a requirement, agent writes the 2–5 case enumeration (Section 2) as a comment block — before any implementation code exists.
4. Agent writes the failing tests for that unit, following the AAA structure and naming conventions (Section 3).
5. Agent implements the unit until its tests pass.
6. Agent refactors if needed, re-running tests to confirm they stay green throughout.
7. Once all units for a layer are green, agent moves up to the next layer (unit → integration → contract → E2E), repeating the enumerate-then-write pattern at each layer.
8. E2E tests are added last, and only for the golden path(s) explicitly named in the spec — not for every branch already covered below.
9. For any AI/LLM-touching unit, Section 9's three-layer model is followed explicitly: mocked unit tests, fixture-based integration tests, and (separately, not blocking this feature's merge) an addition to the eval golden dataset if the feature introduces new prompt behavior.
10. A requirement is marked complete only when its enumerated cases all exist as tests and pass, per the Definition of Done below.

---

### 16. Definition of Done (per requirement)

- [ ] Case enumeration exists, is checked into the test file, and cites the spec requirement ID
- [ ] Every enumerated case has corresponding test code
- [ ] All tests pass locally and in CI
- [ ] No real external-service calls occur in the default test run (verified — not assumed)
- [ ] AAA structure and naming conventions followed
- [ ] Comment standards followed (section banner, enumeration checklist, tags where relevant)
- [ ] No flakiness-prone pattern introduced (real timers, unseeded randomness, shared mutable state) per Section 10
- [ ] For AI-touching units: mocked unit tests + fixture-based integration tests both present; eval dataset updated if new prompt behavior was introduced

---

### 17. Code Review Checklist For Tests

A reviewer (human or agent) checks a test PR against these questions, not just against "do tests exist":

- Does the enumeration comment match the spec requirement, and does every checkbox have a corresponding test?
- Would this test actually fail if the implementation had a bug in the behavior it claims to verify? (Mentally break the implementation and confirm the test would catch it.)
- Are assertions specific, or would the test pass on a wrong-but-similarly-shaped result?
- Is anything touching a real network, real clock, or real random source that shouldn't be?
- Is a mock being used where a stub would do — is the test coupled to *how* the code calls its dependency when it should only care *what* the code returns?
- For frontend tests: is anything queried by test ID or class name that could instead be queried by role, label, or visible text?
- For DB-touching integration tests: is cleanup between tests guaranteed, or could this test pass/fail depending on execution order?

---

### 18. Anti-Patterns — What Not To Do

- Do not write tests after implementation to backfill coverage — it breaks the traceability this whole document exists to guarantee.
- Do not chase a coverage percentage as a target; chase the spec-requirement-to-test-case mapping (Section 14).
- Do not test framework internals (React itself, Express/Nest itself, Prisma itself) — only this project's logic on top of them.
- Do not skip the failure/exception case for anything touching an external service — this is the single most common gap and the most expensive one in production.
- Do not assert on exact AI/LLM output text. Assert on structure, schema, required fields, and length/format bounds (Section 9) — exact-string assertions against a non-deterministic system will flake by design, not by accident.
- Do not call a real LLM provider, real third-party API, or real payment gateway anywhere in the default test run.
- Do not use a fixed real-time `setTimeout`/sleep to "wait for" something in a test — use fake timers or an explicit wait for a condition.
- Do not leave a case unimplemented without an explicit `// [TODO]` tag stating why and when it will be covered — an unchecked box with no explanation is not acceptable at merge.
- Do not over-mock to the point a unit test just re-describes the implementation instead of verifying behavior — if every dependency is mocked to return exactly what the code expects and every mock is asserted on, the test can pass even when the real integration is broken.
- Do not let E2E tests grow into a substitute for lower-layer coverage — if E2E is catching bugs that unit/integration should have caught, that's a gap to close at the lower layer, not a reason to add more E2E.

---

### 19. Tooling Reference

| Purpose | Tool | Notes |
|---|---|---|
| Unit/integration runner | Jest or Vitest | Vitest for Vite-based frontend tooling and faster watch mode; Jest is the more established default for Nest backends. Pick one per project, not mixed within a single package. |
| API-layer integration testing | Supertest | Drives requests through the real Nest HTTP layer including guards/pipes/interceptors. |
| DB integration testing | Testcontainers | Real Postgres/Mongo in Docker, torn down after each run — matches production behavior exactly. |
| External-service mocking | MSW (Mock Service Worker) or nock | MSW works across both frontend and backend Node contexts using the same request handlers; nock is a lighter Node-only alternative for backend-only mocking. |
| Schema/contract validation | zod | Used both in production code at trust boundaries and in contract tests asserting against the same schema. |
| Frontend component testing | React Testing Library | Enforces user-facing queries over implementation details. |
| Frontend user interaction simulation | `@testing-library/user-event` | Prefer over `fireEvent` — models real event sequences. |
| E2E | Playwright | Thin layer, golden paths only. |
| Fake data | `@faker-js/faker` | For fixture fields whose exact value is irrelevant to the assertion. |
| AI/LLM eval framework | Promptfoo or DeepEval | For the Layer 3 eval suite (Section 9.3) — declarative test configs, LLM-as-judge support, CI-schedulable. |
| Mutation testing (periodic, critical modules only) | Stryker | Verifies tests actually fail when code is deliberately broken. |

---

### 20. Appendix: Reference Test File Skeletons

#### 20.1 Unit test (pure logic)

```typescript
// ====================================================================
// TokenCounter.truncateToLimit
// Covers: SPEC-2.4 (context window management)
// Cases:
//   [x] happy path — text under limit returned unchanged
//   [x] boundary — text exactly at limit returned unchanged
//   [x] boundary — text one token over limit is truncated
//   [x] invalid — empty string returns empty string
// ====================================================================
describe('TokenCounter.truncateToLimit', () => {
  it('should return text unchanged when under the token limit', () => {
    // Arrange
    const text = 'short message';

    // Act
    const result = truncateToLimit(text, 100);

    // Assert
    expect(result).toBe(text);
  });

  it('should truncate text that exceeds the token limit by one token', () => {
    // Arrange
    const text = buildTextWithExactTokenCount(101);

    // Act
    const result = truncateToLimit(text, 100);

    // Assert
    expect(countTokens(result)).toBeLessThanOrEqual(100);
  });
});
```

#### 20.2 Integration test (NestJS + real DB via Testcontainers, AI provider mocked)

```typescript
// ====================================================================
// POST /conversations/:id/messages
// Covers: SPEC-3.5 (message append endpoint)
// Cases:
//   [x] happy path — valid message persisted and AI response returned
//   [x] invalid — empty message body rejected with 400
//   [x] failure — AI provider timeout returns 503 with retry hint
//   [x] state — appending to an archived conversation returns 409
// ====================================================================
describe('POST /conversations/:id/messages', () => {
  it('should persist the message and return the AI response on success', async () => {
    // Arrange
    const conversation = await seedConversation(prisma, { status: 'active' });
    mockAiProvider.mockSuccessResponse(fixtures.validChatResponse);

    // Act
    const response = await request(app.getHttpServer())
      .post(`/conversations/${conversation.id}/messages`)
      .send({ content: 'hello' });

    // Assert
    expect(response.status).toBe(201);
    const stored = await prisma.message.findMany({ where: { conversationId: conversation.id } });
    expect(stored).toHaveLength(2); // user message + AI response
  });

  it('should return 503 when the AI provider times out', async () => {
    // Arrange
    const conversation = await seedConversation(prisma, { status: 'active' });
    mockAiProvider.mockTimeout();

    // Act
    const response = await request(app.getHttpServer())
      .post(`/conversations/${conversation.id}/messages`)
      .send({ content: 'hello' });

    // Assert
    expect(response.status).toBe(503);
    expect(response.body.retryable).toBe(true);
  });
});
```

#### 20.3 Contract test (AI structured output)

```typescript
// ====================================================================
// ChatResponseSchema (zod contract)
// Covers: SPEC-4.3 (structured response validation)
// Cases:
//   [x] happy path — valid provider payload parses successfully
//   [x] invalid — missing required `content` field is rejected
//   [x] invalid — extra unexpected field does not break parsing
//   [x] invalid — wrong type for `finishReason` is rejected
// ====================================================================
describe('ChatResponseSchema', () => {
  it('should reject a payload missing the content field', () => {
    // Arrange
    const payload = { finishReason: 'stop' }; // content omitted

    // Act
    const result = ChatResponseSchema.safeParse(payload);

    // Assert
    expect(result.success).toBe(false);
  });
});
```


---

## Reference 2 — Comment standards

_Source: `docs/rules/comments.md`. Included in full for standalone review._

## Comment Standards

Rules for writing comments across the codebase — when to use a one-liner vs a block, which format to reach for, and where it goes. Applies to every `.ts` / `.tsx` file, frontend and backend.

There are exactly **two one-liner formats** and **two multi-line formats**. No others are permitted — consistency matters more than expressiveness here.

---

### The Four Formats at a Glance

| Format | Type | Purpose |
| -------- | ------ | --------- |
| `// [TAG] ...` | One-liner | Quick, tagged reasoning tied to a single line |
| `// Q: ... A: ...` | One-liner | Pre-empts a specific "why not X" review question |
| Section Banner | Multi-line | Divides a file into major structural regions |
| JSDoc Block | Multi-line | Documents a function's contract |

---

### One-Liner Formats

#### 1. Tag-Prefixed — `// [TAG] ...`

The default one-liner. A bracketed tag classifies the comment's purpose before the reader even parses the sentence.

**Allowed tags:**

| Tag | Use for |
| ----- | --------- |
| `[WHY]` | Explaining a non-obvious decision |
| `[WARN]` | Something that will break if misused or reordered |
| `[NOTE]` | Context worth knowing, not a warning |
| `[TODO]` | Known follow-up work, not urgent |
| `[PERF]` | A deliberate performance trade-off |
| `[SEC]` | A security-relevant decision |

```ts
// ✅
// [WHY] using findFirst not findUnique — email isn't unique pre-migration
const user = await prisma.user.findFirst({ where: { email } });

// [WARN] order matters — cache must invalidate before the response is sent
await redis.del(cacheKey);
res.json(result);

// [PERF] batching avoids an N+1 query across dog owners
const owners = await getOwnersBatch(dogIds);
```

```ts
// ❌ no tag — reads as a random aside, not classified
// this has to run first
await redis.del(cacheKey);

// ❌ invented tag not in the table above
// [FYI] ...
```

**Rule:** one tag per comment. If a line needs two tags, it needs a block comment instead (see JSDoc / Section Banner below).

---

#### 2. Q/A — `// Q: ... A: ...`

Reserved for a decision a reviewer or future-you is *likely to explicitly question*. Phrase the objection, then answer it. This is not a general-purpose format — most one-liners should be `[TAG]`, not `Q/A`.

```ts
// ✅
// Q: why raw SQL here instead of Prisma? A: Prisma can't express this window function
const rows = await prisma.$queryRaw`...`;

// Q: why not throw on duplicate? A: PM decided silent no-op is correct for retries
if (existing) return existing;
```

```ts
// ❌ overused — this isn't a real objection anyone would raise
// Q: why const? A: it doesn't change
const limit = 10;
```

**Rule of thumb:** if you can't picture someone actually asking "wait, why did you do it this way?", use `[WHY]` instead of `Q/A`.

---

#### Choosing Between the Two One-Liners

| Situation | Use |
| ----------- | ----- |
| Explaining reasoning, a warning, or a trade-off | `[TAG]` |
| Pre-empting a specific challenge to the approach | `Q/A` |
| Default when unsure | `[TAG]` |

---

### Multi-Line Formats

#### 1. Section Banner

Divides a file into major structural regions — not documentation for a single function, but a visual break between unrelated blocks (multiple thunks in one file, grouped DTOs, swagger path groups). Matches the `TYPE DEFINITIONS`-style banner already used in the codebase.

```ts
// ============================================================================
// GET MY DOG THUNK
// Fetches the authenticated user's dog profile; used on dashboard mount
// ============================================================================
```

**Spec:**

- Bar is `=` characters, same width as the longest line inside the banner (aim for 78 chars, matching existing docs)
- Line 2: the section name, SCREAMING CASE or Title Case, matching surrounding banners in the file
- Line 3 (optional): one plain-English purpose line — omit only if the section name is fully self-explanatory
- One blank line after the closing bar, before the code starts
- No blank line between the banner and the section it introduces from above

**When to use:**

- Top of a file with multiple exported thunks, services, or handlers
- Grouping related DTOs, types, or constants inside one file
- Marking off a distinct concern within a large file (e.g. `swagger/index.ts` separating `base`, `components`, `modules`)

**When NOT to use:**

- A file with only one function — there's nothing to divide
- Documenting what a function does — that's JSDoc's job

---

#### 2. JSDoc Structured Block

Documents a function's contract: what it takes, what it returns, what it can throw. Sits directly above the function signature, no blank line between them.

```ts
/**
 * Resolves the authenticated user's active dog profile.
 *
 * @param userId - ID of the requesting user
 * @returns The dog profile, or null if none exists
 * @throws {NotFoundError} if the user does not exist
 */
async function getActiveDog(userId: string): Promise<DogProfile | null> {
  ...
}
```

**Spec:**

- First line: one sentence, what the function does (not how)
- Blank comment line before tags if a description is present
- `@param` for every parameter, in signature order
- `@returns` always present, even if it just says what a void/boolean means
- `@throws` only if the function can throw or reject — omit if it can't
- No `@returns` line for `void` functions unless the void itself is meaningful (e.g. "no-ops silently on duplicate")

**When to use:**

- Every exported function in a `.service.ts`, `.controller.ts`, or thunk file
- Any function whose parameters or return shape aren't obvious from the name alone
- Public/shared utilities used across modules

**When NOT to use:**

- Private one-line helpers where the name says everything (`const toKebabCase = (s: string) => ...`)
- Getters/setters with no logic

---

#### Choosing Between the Two Multi-Liners

| Situation | Use |
| ----------- | ----- |
| Dividing a file into regions | Section Banner |
| Documenting a specific function's contract | JSDoc Block |
| Both apply (a banner-marked section containing one exported function) | Use both — banner above the section, JSDoc directly above the function inside it |

---

### Placement Rules

- Comments go **above** the code they explain — never trailing, except a `[TAG]` tied to one short expression on the same line (e.g. `const page = filters.page ?? 1; // [NOTE] defaults to page 1`)
- One-liners are exactly one line — if it wraps, it's not a one-liner anymore; convert it to a JSDoc block
- No blank line between a JSDoc block and the function it documents
- One blank line between a Section Banner's closing bar and the code below it
- Don't stack more than one one-liner format back-to-back — if a block needs several `[TAG]` lines, that's a sign it should be a JSDoc block instead

---

### Full Example

```ts
// ============================================================================
// DOG THUNKS
// Redux thunks for dog profile CRUD, consumed by the dashboard slice
// ============================================================================

/**
 * Resolves the authenticated user's active dog profile.
 *
 * @param userId - ID of the requesting user
 * @returns The dog profile, or null if none exists
 * @throws {NotFoundError} if the user does not exist
 */
export async function getActiveDog(userId: string): Promise<DogProfile | null> {
  // [WHY] using findFirst not findUnique — email isn't unique pre-migration
  const user = await prisma.user.findFirst({ where: { id: userId } });
  if (!user) throw new NotFoundError('User not found');

  // Q: why not throw when no dog exists? A: PM wants empty-state UI, not an error page
  return user.dog ?? null;
}
```

---

### Quick Reference

| Situation | Format |
| ----------- | -------- |
| Non-obvious reasoning, warning, or trade-off on one line | `// [TAG] ...` |
| Pre-empting a specific "why not X" question | `// Q: ... A: ...` |
| Dividing a file into major structural regions | Section Banner |
| Documenting an exported function's contract | JSDoc Block |

### What to Avoid

```ts
// ❌ Commenting the obvious
// increment counter by 1
counter++;

// ❌ Trailing comment longer than the code it explains
const x = 5; // this sets x to five which is used later in the calculation for the total price

// ❌ Inventing a fifth format
/* --- random custom divider --- */

// ❌ JSDoc on a self-explanatory one-liner
/**
 * Converts to kebab case.
 */
const toKebabCase = (s: string): string => s.toLowerCase().replace(/\s+/g, '-');

// ❌ [TAG] used for something that isn't reasoning, a warning, or context
// [WHY] this is a function
function getUser() { ... }
```


---

## Reference 3 — Commit message standards

_Source: `docs/rules/commit.md`. Included in full for standalone review._

## Commit Message Generator

Generate conventional commit messages that are concise, structured, and consistent.

---

### Format

```
<type>(<scope>): <short description>
```

- **type**: The category of change
- **scope**: The affected area/module (in parentheses)
- **description**: What changed, plain and direct

**Hard rules:**
- Total message must be **≤ 20 words**
- All lowercase
- No period at the end
- No co-authors, trailers, sign-offs, or extra flags unless explicitly requested
- No body or footer unless explicitly requested

---

### Types

| Type | When to use |
|------|-------------|
| `feat` | New feature |
| `fix` | Bug fix |
| `refactor` | Code restructure, no behavior change |
| `chore` | Maintenance, deps, config |
| `docs` | Documentation only |
| `style` | Formatting, whitespace, no logic change |
| `test` | Adding or updating tests |
| `perf` | Performance improvement |
| `revert` | Reverting a previous commit |

---

### Examples

```
fix(auth): resolve undefined payload in login API response
feat(dashboard): add user activity chart to overview page
refactor(cart): simplify discount calculation logic
chore(deps): upgrade react to v19
fix(api): handle null response from payment gateway
feat(profile): allow users to update avatar image
docs(readme): update setup instructions for new devs
test(auth): add unit tests for token refresh logic
fix(nav): correct broken link on mobile menu
perf(search): reduce query time by indexing user emails
```

---

### Scope Guidelines

Use the module, feature, or domain being changed. Keep it one word when possible.

| Area | Scope examples |
|------|---------------|
| Authentication | `auth`, `login`, `session` |
| API layer | `api`, `graphql`, `rest` |
| UI components | `ui`, `modal`, `nav`, `form` |
| Database | `db`, `schema`, `migration` |
| Config/infra | `config`, `ci`, `env` |
| Specific features | `cart`, `checkout`, `profile` |

---

### What NOT to include (unless asked)

- `Co-authored-by`
- `Signed-off-by`
- `--author` flag
- Commit body / extended description
- Issue/ticket references
- Breaking change footer

---

### Word Count Check

Count every word in `type(scope): description` as one unit. Aim for 8–15 words; hard stop at 20.

✅ `fix(auth): resolve undefined payload in login API response` → 9 words

❌ `fix(auth): resolve the issue where the API was returning an undefined payload in the login response flow` → 18 words (still ok) but risks verbosity


---

## Reference 4 — TypeScript standards

_Source: `docs/rules/typescript-standards.md`. Included in full for standalone review._

## TypeScript Standards

Universal TypeScript rules for every `.ts` and `.tsx` file in the codebase — frontend and backend. These rules are non-negotiable and apply regardless of framework, file type, or context.

---

### Absolute Rules — Never Break These

#### 1. No `any`

`any` disables TypeScript's entire type system for that value. It is never acceptable.

```ts
// ❌ Never
function process(data: any) { ... }
const result: any = fetchData();
let value: any;

// ✅ Use the correct specific type
function process(data: UserProfile[]) { ... }
const result: ApiResponse<User> = fetchData();
let value: string;

// ✅ If the type is genuinely unknown at write-time, use a generic
function process<T extends { id: string }>(items: T[]) {
  return items.map(item => item.id);
}
```

If you find yourself reaching for `any` because the type is "too hard" — that is a signal to define the right interface or generic, not to use `any`.

---

#### 2. No `unknown` in normal code

`unknown` is for the edges of the system: catching thrown errors, parsing external JSON, or wrapping third-party library values where types are genuinely not known. It is not a substitute for `any` in regular code.

```ts
// ❌ Not acceptable as a normal variable type
let userId: unknown;
function getUser(id: unknown): unknown { ... }

// ✅ Legitimate use — error catch blocks
catch (error: unknown) {
  const message = error instanceof Error ? error.message : 'Unknown error';
}

// ✅ Legitimate use — parsing external/untrusted data at system boundary
const rawData: unknown = JSON.parse(body);
if (isUserProfile(rawData)) {
  // now TypeScript knows rawData is UserProfile
}
```

---

#### 3. No Type Casting (`as`)

Type casting with `as` bypasses the type checker and lies to the compiler. It hides bugs instead of fixing them.

```ts
// ❌ Never
const name = (user as any).name;
const id = response.data as string;
const element = document.getElementById('app') as HTMLDivElement;

// ✅ Use type guards instead
function isUser(value: unknown): value is User {
  return typeof value === 'object' && value !== null && 'id' in value;
}

// ✅ For DOM elements, use the correct query method that returns a typed result
const canvas = document.querySelector<HTMLCanvasElement>('#canvas');
if (!canvas) throw new Error('Canvas not found');
```

The only permitted use of `as const` is for literal type narrowing on static data:
```ts
const DIRECTION = 'north' as const; // ✅ narrowing literal, not casting
```

---

#### 4. No Inline Types

Never define a type inline on a variable declaration, object, or function parameter. All types belong in the `TYPE DEFINITIONS` section of the file or in a dedicated `.types.ts` file.

```ts
// ❌ Never — inline type on variable
const user: { name: string; age: number } = { name: 'Alex', age: 30 };

// ❌ Never — inline type in function parameter
function createDog(dog: { name: string; breed: string; age: number }) { ... }

// ❌ Never — inline type in function return
function getConfig(): { timeout: number; retries: number } { ... }

// ✅ Define the interface in the TYPE DEFINITIONS section
interface UserProfile {
  name: string;
  age: number;
}

interface DogInput {
  name: string;
  breed: string;
  age: number;
}

interface AppConfig {
  timeout: number;
  retries: number;
}

const user: UserProfile = { name: 'Alex', age: 30 };
function createDog(dog: DogInput) { ... }
function getConfig(): AppConfig { ... }
```

---

#### 5. No Boxed Primitive Types

Never use `Number`, `String`, `Boolean`, `Object`, `Symbol` as types. These are JavaScript object wrappers, not primitives.

```ts
// ❌ Never
const name: String = 'Alex';
const count: Number = 5;
const flag: Boolean = true;

// ✅ Always lowercase primitives
const name: string = 'Alex';
const count: number = 5;
const flag: boolean = true;
```

---

### Type Declaration Rules

#### `interface` vs `type` — When to Use Each

| Use `interface` when... | Use `type` when... |
|------------------------|-------------------|
| Defining object shapes (entities, props, configs) | Defining union types |
| The shape may be extended or implemented by a class | Defining tuple types |
| Working with public APIs that others consume | Using utility types (`Partial<>`, `Pick<>`, `Omit<>`) |
| Defining service contracts / class contracts | Defining function type signatures |
| Better compiler error messages are needed | Creating intersection types |

```ts
// ✅ interface — object shape / entity
interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// ✅ interface — component props
interface ButtonProps {
  label: string;
  variant?: 'primary' | 'secondary';
  onClick: () => void;
}

// ✅ type — union
type LoadingState = 'idle' | 'loading' | 'success' | 'error';

// ✅ type — utility type composition
type PartialUserProfile = Partial<UserProfile>;
type UserPreview = Pick<UserProfile, 'id' | 'name'>;
type UserWithoutEmail = Omit<UserProfile, 'email'>;

// ✅ type — discriminated union (always type, never interface)
type ApiState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; message: string };
```

---

#### Type Declaration Location

Types belong in the `TYPE DEFINITIONS` section of the file that uses them — unless the type is used across multiple files.

**Decision order:**
1. **Single file use** → declare in the `TYPE DEFINITIONS` section of that file
2. **Multiple files in the same feature** → declare in `[feature].types.ts` in the same folder
3. **Used across multiple features** → declare in `src/types/` (frontend) or `src/types/` (backend)
4. **Used globally across frontend + backend** → declare in a shared types package

```ts
// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// ✅ Declare all file-local types here, before the first function or component

interface PaginationState {
  page: number;
  limit: number;
  total: number;
}

type SortOrder = 'asc' | 'desc';

interface ListingFilters {
  search?: string;
  category?: string;
  sortOrder?: SortOrder;
}
```

---

#### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Interface | PascalCase | `UserProfile`, `ButtonProps` |
| Type alias | PascalCase | `LoadingState`, `SortOrder` |
| Enum | PascalCase, values SCREAMING_SNAKE | `UserRole.BUSINESS_OWNER` |
| Generic parameter | Single capital or descriptive | `T`, `TData`, `TError` |
| Discriminated union discriminant | `status`, `type`, or `kind` | `{ status: 'loading' }` |

For this codebase, store-related interfaces use the `I` prefix (e.g. `IGetMyDogThunkPayload`). This convention applies **only to store/thunk types** — do not use the `I` prefix for component props, entity interfaces, service types, or DTO types.

---

### Function Typing Rules

#### Always type function parameters and return values explicitly

TypeScript can often infer return types, but explicit return types serve as a contract and catch mistakes early.

```ts
// ❌ Missing parameter types and return type
function getUser(id) {
  return prisma.user.findFirst({ where: { id } });
}

// ✅ Explicit parameters, explicit return type
async function getUser(id: string): Promise<SafeUser | null> {
  return prisma.user.findFirst({ where: { id } });
}
```

#### Use generics instead of `any` for flexible functions

```ts
// ❌ Losing type information
function first(arr: any[]): any {
  return arr[0];
}

// ✅ Generic preserves type safety
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// ✅ Constrained generic — only accept objects with an id field
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}
```

#### Optional vs nullable parameters

```ts
// optional — parameter may be omitted by caller
function search(query?: string): void { ... }

// nullable — parameter must be passed but may be null
function updateName(name: string | null): void { ... }

// Both — parameter may be omitted or passed as null
function setLabel(label?: string | null): void { ... }
```

---

### Nullability Rules

Always enable `strictNullChecks`. Never use non-null assertion (`!`) except in test files or when the value's presence has already been checked explicitly nearby.

```ts
// ❌ Unsafe — hides potential null
const name = user!.name;

// ✅ Safe — narrow before use
if (!user) throw new Error('User is required');
const name = user.name;

// ✅ Safe — optional chaining
const name = user?.name ?? 'Anonymous';
```

Use the nullish coalescing operator (`??`) instead of `||` when providing defaults for nullable values — `||` incorrectly treats `0`, `false`, and `''` as falsy:

```ts
// ❌ Incorrect — treats 0 and '' as nullish
const page = filters.page || 1;  // breaks when page = 0

// ✅ Correct — only replaces null and undefined
const page = filters.page ?? 1;
```

---

### Utility Types

Use TypeScript's built-in utility types instead of duplicating or hand-writing partial copies of existing interfaces.

| Utility | Purpose | Example |
|---------|---------|---------|
| `Partial<T>` | All fields optional | Update DTOs |
| `Required<T>` | All fields required | Ensuring fully populated objects |
| `Readonly<T>` | All fields readonly | Immutable config, constants |
| `Pick<T, K>` | Subset of fields | Response projections |
| `Omit<T, K>` | All fields except K | Removing internal fields before sending |
| `Record<K, V>` | Key-value map | Cache objects, lookup maps |
| `ReturnType<T>` | Extract return type of a function | Inferring thunk return types |
| `Parameters<T>` | Extract parameter types | Forwarding function arguments |

```ts
// ✅ Use Omit instead of rewriting an interface manually
interface CreateListingPayload extends Omit<ApiListing, 'id' | 'createdAt' | 'updatedAt'> {
  proofDocument: File;
}

// ✅ Use Record for cache/lookup maps
const userCache: Record<string, UserProfile> = {};

// ✅ Use Partial for update payloads
type UpdateUserPayload = Partial<Omit<UserProfile, 'id'>>;
```

---

### Enum Rules

Use string enums — never numeric enums. String enums are readable in logs, API responses, and debuggers.

```ts
// ❌ Numeric enum — opaque and meaningless at runtime
enum UserRole {
  Admin,      // 0
  User,       // 1
}

// ✅ String enum — self-documenting
export enum UserRole {
  ADMIN = 'ADMIN',
  BUSINESS_OWNER = 'BUSINESS_OWNER',
  USER = 'USER',
}

// ✅ String literal union — use when enum is local to one file
type VerificationStatus = 'PENDING' | 'VERIFIED' | 'REJECTED' | 'UNVERIFIED';
```

Use `export enum` only once — in `utils/constants/enums.ts` (backend) or the equivalent constants file. Never redefine the same enum in multiple files.

---

### Type Guard Rules

Use type guards when narrowing `unknown` values or discriminated unions. Never use `as` to skip the check.

```ts
// ✅ Type predicate guard
function isApiError(value: unknown): value is ApiError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'message' in value
  );
}

// ✅ Discriminated union narrowing — exhaustive check
function handleState(state: ApiState<User>) {
  switch (state.status) {
    case 'loading': return showSpinner();
    case 'success': return renderUser(state.data);
    case 'error': return showError(state.message);
    case 'idle': return null;
    default:
      // TypeScript will error here if a case is unhandled
      const _exhaustive: never = state;
      return _exhaustive;
  }
}
```

---

### `readonly` and Immutability

Mark properties that should not be mutated after creation as `readonly`. This is especially important for entity IDs and config objects.

```ts
interface UserProfile {
  readonly id: string;      // ✅ IDs should never change
  name: string;             // mutable — can be updated
  readonly createdAt: Date; // ✅ timestamps should never change
}

// ✅ Readonly array — prevents accidental mutation
function processItems(items: readonly string[]): void { ... }
```

---

### tsconfig Requirements

Every project must have these compiler options enabled:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "strictFunctionTypes": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

`strict: true` enables a group of checks. The additional flags above go beyond strict for further safety.

---

### Quick Reference — What to Do When Stuck

| Situation | Solution |
|-----------|---------|
| Type is genuinely unknown (JSON parse, error catch) | Use `unknown` + type guard |
| Need a flexible function that works on multiple types | Use generics `<T>` |
| Need a partial version of an existing interface | Use `Partial<MyInterface>` |
| Need to remove fields from an interface | Use `Omit<MyInterface, 'field'>` |
| Need only specific fields | Use `Pick<MyInterface, 'field1' \| 'field2'>` |
| Tempted to use `as` | Write a type guard function instead |
| Tempted to use `any` | Define the correct interface or generic |
| Type used in multiple files | Move to `[feature].types.ts` or `src/types/` |
| Inline object type getting complex | Extract to a named interface in TYPE DEFINITIONS |

---

### Common Violations to Watch For

```ts
// ❌ 1. any in function parameter
const handle = (e: any) => { ... }
// ✅ const handle = (e: React.ChangeEvent<HTMLInputElement>) => { ... }

// ❌ 2. Casting instead of typing
const data = response as { users: User[] };
// ✅ Define ApiResponse<T> interface and type the response properly

// ❌ 3. Inline object type
const config: { timeout: number; retries: number } = { timeout: 5000, retries: 3 };
// ✅ interface AppConfig { timeout: number; retries: number }
//    const config: AppConfig = { ... }

// ❌ 4. Boxed primitive
const name: String = 'hello';
// ✅ const name: string = 'hello'

// ❌ 5. Non-null assertion hiding a real null
const user = getUser()!;
// ✅ const user = getUser(); if (!user) throw new Error(...)

// ❌ 6. || for default values on numbers
const limit = filters.limit || 10;
// ✅ const limit = filters.limit ?? 10

// ❌ 7. Duplicating an interface instead of extending
interface UpdateUserPayload { name?: string; email?: string; role?: string; }
// ✅ type UpdateUserPayload = Partial<Omit<UserProfile, 'id' | 'createdAt'>>
```


---

## Reference 5 — Backend folder structure

_Source: `docs/rules/backend-folder-structure.md`. Included in full for standalone review._

## Backend Folder Structure

Standardized folder structure for a **Node.js + Express + Prisma + TypeScript** backend. Use this as the single source of truth when creating, moving, or reviewing any backend file.

> Tech stack: Express, Prisma ORM, BullMQ (queues), Redis, Cloudinary, Swagger. Adapt service names but keep the structural pattern identical.

---

### Canonical Structure

```
src/
├── config/                         # Third-party and infrastructure configs
│   ├── prisma.ts                   # Prisma client singleton
│   ├── multer.ts                   # File upload config
│   └── [service].ts                # Any other service config (e.g. cloudinary.ts)
│
├── middleware/                     # Express middleware only
│   ├── auth.ts                     # JWT / session auth guard
│   ├── errorHandler.ts             # Global error handler
│   ├── validateDto.ts              # DTO validation middleware
│   └── [name].ts                   # Any additional middleware
│
├── modules/                        # All feature modules live here
│   ├── auth/
│   │   ├── dto/
│   │   │   └── auth.dto.ts
│   │   ├── types/
│   │   │   └── auth.types.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.routes.ts
│   │   └── auth.service.ts
│   ├── admin/
│   │   ├── dto/
│   │   │   └── admin.dto.ts
│   │   ├── admin.controller.ts
│   │   ├── admin.routes.ts
│   │   └── admin.service.ts
│   ├── mail/                       # Internal-only module (no routes/controller)
│   │   ├── templates/
│   │   │   ├── welcome-email.ts
│   │   │   ├── claim-rejection.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   └── mail.types.ts
│   │   ├── mail.service.ts
│   │   └── index.ts
│   └── [feature]/                  # Every new feature follows the same pattern
│       ├── dto/
│       │   └── [feature].dto.ts
│       ├── types/                  # Only if module has complex local types
│       │   └── [feature].types.ts
│       ├── [feature].controller.ts
│       ├── [feature].routes.ts
│       └── [feature].service.ts
│
├── services/                       # Shared infrastructure & external services
│   ├── cloudinary/
│   │   ├── cloudinary.service.ts
│   │   └── index.ts
│   ├── redis/
│   │   ├── redis.config.ts
│   │   ├── redis.connection.ts
│   │   ├── redis.types.ts
│   │   └── index.ts
│   ├── cron/
│   │   ├── config/
│   │   │   ├── schedules.config.ts
│   │   │   └── index.ts
│   │   ├── schedulers/
│   │   │   ├── cron.scheduler.ts
│   │   │   └── index.ts
│   │   ├── types/
│   │   │   ├── cron.types.ts
│   │   │   └── index.ts
│   │   └── index.ts
│   ├── queue/
│   │   └── bull/
│   │       ├── jobs/
│   │       │   └── [name].jobs.ts
│   │       ├── processors/
│   │       │   └── [name].processor.ts
│   │       ├── queues/
│   │       │   └── [name].queue.ts
│   │       ├── workers/
│   │       │   ├── [name].worker.ts
│   │       │   └── index.ts
│   │       ├── types/
│   │       │   └── [name].types.ts
│   │       ├── register.ts
│   │       └── index.ts
│   ├── pagination/
│   │   └── index.ts
│   ├── rate-limit/
│   │   └── index.ts
│   └── swagger/
│       ├── base/
│       │   ├── info.ts
│       │   ├── security.ts
│       │   ├── servers.ts
│       │   └── tags.ts
│       ├── components/
│       │   ├── parameters/
│       │   ├── requestBodies/
│       │   ├── responses/
│       │   ├── schemas/
│       │   └── index.ts
│       ├── modules/
│       │   └── [feature]/
│       │       └── paths.ts        # One paths.ts per module
│       └── index.ts
│
├── resources/                      # Static assets bundled with the app
│   └── images/
│       └── logo.png
│
├── scripts/
│   └── seed.ts                     # Entry point only — delegates to utils/seed/
│
├── types/                          # Global TypeScript declaration files
│   ├── express.d.ts                # Extend Express Request/Response types
│   └── [lib].d.ts                  # Declarations for libs missing types
│
├── utils/                          # Pure utilities — NO loose files at root
│   ├── constants/                  # App-wide constant values
│   │   ├── enums.ts
│   │   ├── routes.ts
│   │   ├── pagination.ts
│   │   ├── rateLimit.ts
│   │   ├── notifications.ts
│   │   ├── cron.ts
│   │   └── storage.ts
│   ├── helpers/                    # Pure utility functions
│   │   ├── response.ts             # Standardized API response builder
│   │   ├── logger.ts               # Logger setup
│   │   ├── date.ts                 # Date formatting/parsing helpers
│   │   ├── cookie.ts               # Cookie helpers
│   │   ├── badgeUtils.ts           # Badge logic helpers
│   │   ├── csvGenerator.ts         # CSV export helper
│   │   ├── recaptcha.ts            # reCAPTCHA verification
│   │   └── index.ts                # Re-exports all helpers
│   └── seed/                       # Seed data files (not scripts)
│       ├── dev/                    # Development seed data
│       │   ├── users/
│       │   │   └── users.seed.ts
│       │   ├── listings/
│       │   │   └── listings.seed.ts
│       │   ├── dogs/
│       │   │   └── dogs.seed.ts
│       │   └── clear.seed.ts
│       └── master/                 # Master / production seed data
│           ├── categories/
│           │   └── categories.seed.ts
│           ├── facilities/
│           │   └── facilities.seed.ts
│           ├── plans/
│           │   └── plans.seed.ts
│           └── clear.seed.ts
│
└── server.ts                       # App entry point
```

---

### Root-Level Files

```
prisma/
├── schema.prisma                   # Managed by Prisma — do not restructure
└── migrations/                     # Auto-generated by Prisma — do not edit manually

.cursor/rules/                      # Agentic IDE rules (Cursor, Windsurf, etc.)
docs/                               # Project documentation
.env.example
tsconfig.json
package.json
```

**Agentic IDE / CLI rules** (`.cursor/rules/`, `.github/copilot-instructions.md`, etc.) are managed per-tool. Each AI editor stores its rules differently — create the appropriate rules file for whichever tool you use. The file content follows the same principle: one rule file per concern (e.g. `coding-guidelines`, `listing-workflow`).

**Prisma** manages its own folder. Never manually create or edit files inside `prisma/migrations/`. Run `npx prisma migrate dev` to generate migrations.

**`docs/`** should mirror the backend's own domain structure:
```
docs/
├── brand/          ← brand guidelines, email templates
├── db/             ← schema documentation, ERD notes
├── development/    ← module-specific dev guides
└── rbac/           ← role-based access control policies
```

---

### Module Rules

Every API-facing feature lives in `src/modules/[feature]/` with this structure:

| File | Responsibility |
|------|---------------|
| `[feature].routes.ts` | Route definitions + middleware assignment |
| `[feature].controller.ts` | Request/response handling — no business logic |
| `[feature].service.ts` | All business logic, DB calls via Prisma |
| `dto/[feature].dto.ts` | Input validation schemas (class-validator / zod) |
| `types/[feature].types.ts` | Local TypeScript types (only if needed) |

**Internal-only modules** (no HTTP routes) omit `controller` and `routes`. Example: `mail` module has only `mail.service.ts`, `templates/`, `types/`, and `index.ts`. The service is imported directly by other modules.

**Optional sub-folders** inside a module (add only when needed):

```
modules/[feature]/
├── dto/
├── types/
├── templates/          ← e.g. mail module: email HTML/text templates
├── helpers/            ← feature-specific helper functions
└── [feature].test.ts   ← unit tests co-located with module
```

**Naming convention:** all module folders and files are **kebab-case**.
- Folder: `lost-found/`, `check-ins/`, `saved-spots/`
- Files: `lost-found.controller.ts`, `lost-found.service.ts`

---

### Config Rules

`src/config/` holds only initialization/configuration of external tools and connections.

| File | What goes here |
|------|---------------|
| `prisma.ts` | Prisma client singleton export |
| `multer.ts` | Multer storage engine + file filter |
| `[service].ts` | Any third-party SDK init (Stripe, SendGrid, etc.) |

**Rules:**
- No business logic in config files — only setup and export
- Each config file exports exactly one configured instance
- Import config files only from `services/` or `modules/` — never from `utils/`

---

### Services Rules

`src/services/` holds shared infrastructure that is not a feature module. Each service lives in its own named folder and defines its own internal structure based on its complexity.

| Service | When to create it |
|---------|------------------|
| `cloudinary/` | File/image storage |
| `redis/` | Caching, pub/sub, rate-limit backing |
| `cron/` | Scheduled jobs |
| `queue/bull/` | Background job processing with BullMQ |
| `pagination/` | Reusable pagination utility |
| `rate-limit/` | Express rate limiter setup |
| `swagger/` | API documentation generation |

**There is no single required internal structure** for services — each folder is organized by its own domain needs. The only rule is: every service folder must have an `index.ts` that exports its public API. Internal files are not imported directly from outside the service folder.

**Queue structure (BullMQ pattern):**
```
queue/bull/
├── jobs/           ← job payload definitions and creators
├── processors/     ← job processing logic
├── queues/         ← queue instantiation
├── workers/        ← worker setup
├── types/          ← queue-specific types
├── register.ts     ← registers all workers/processors on startup
└── index.ts        ← public exports
```

**Swagger structure:**
```
swagger/
├── base/           ← OpenAPI document metadata (info, servers, security, tags)
├── components/     ← Reusable schemas, responses, parameters, requestBodies
├── modules/        ← One folder per feature module, each with paths.ts
└── index.ts        ← Assembles and exports the full OpenAPI document
```
Add a new `swagger/modules/[feature]/paths.ts` every time a new module is created.

---

### Utils Rules

**Hard rule: no loose files directly inside `utils/`. Every file must be inside a subfolder.**

| Subfolder | What belongs there |
|-----------|-------------------|
| `utils/constants/` | App-wide constant values, enums, route strings, limits |
| `utils/helpers/` | Pure stateless functions — formatting, parsing, building responses |
| `utils/seed/` | Seed data organized by environment (`dev/`, `master/`) |

**Constants vs Helpers:**
- `constants/` = values that never change at runtime (enums, string maps, number limits)
- `helpers/` = functions that transform or compute something (response builder, date formatter)
- If a helper grows beyond one concern, extract it to its own subfolder: `utils/geo/`, `utils/media/`, etc.

**Seed architecture:**
- `src/scripts/seed.ts` is the **entry point only** — it imports and runs seed functions
- All seed data and logic lives in `utils/seed/dev/` or `utils/seed/master/`
- `dev/` seeds are for local development (fake users, listings, dogs)
- `master/` seeds are for production master data (categories, plans, facilities)
- Each entity gets its own folder: `utils/seed/dev/users/users.seed.ts`
- `clear.seed.ts` lives at the root of each environment folder to handle teardown

---

### Types Rules

`src/types/` contains only TypeScript **declaration files** (`.d.ts`).

- `express.d.ts` — extends `Express.Request` with custom properties (e.g. `req.user`)
- `[lib].d.ts` — type declarations for third-party libs that ship without types

**Do not put runtime code here.** Module-specific types belong in `modules/[feature]/types/`. Shared runtime types belong in `utils/constants/enums.ts` or the relevant module.

---

### Adding a New Feature — Checklist

```
1. Create src/modules/[feature]/
   □ dto/[feature].dto.ts          — input validation
   □ [feature].controller.ts       — req/res only, calls service
   □ [feature].routes.ts           — routes + middleware
   □ [feature].service.ts          — business logic + Prisma calls
   □ types/[feature].types.ts      — only if local types are needed

2. Register routes
   □ Import routes in server.ts (or central router file)
   □ Mount at correct path: app.use("/api/[feature]", featureRoutes)

3. Add Swagger docs
   □ Create src/services/swagger/modules/[feature]/paths.ts
   □ Import paths in src/services/swagger/index.ts

4. Add any constants
   □ Route strings → utils/constants/routes.ts
   □ Enums → utils/constants/enums.ts

5. If feature needs background jobs
   □ Add queue: services/queue/bull/queues/[feature].queue.ts
   □ Add job: services/queue/bull/jobs/[feature].jobs.ts
   □ Add processor: services/queue/bull/processors/[feature].processor.ts
   □ Add worker: services/queue/bull/workers/[feature].worker.ts
   □ Register worker in services/queue/bull/register.ts
```

---

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Module folders | kebab-case | `lost-found/`, `check-ins/` |
| Module files | `[feature].[type].ts` | `auth.controller.ts` |
| DTO files | `[feature].dto.ts` | `admin.dto.ts` |
| Type files | `[feature].types.ts` | `mail.types.ts` |
| Service files | `[name].service.ts` | `cloudinary.service.ts` |
| Constant files | descriptive noun | `enums.ts`, `routes.ts` |
| Helper files | descriptive noun | `response.ts`, `date.ts` |
| Seed files | `[entity].seed.ts` | `users.seed.ts` |

---

### What Does NOT Belong in Each Folder

| Folder | Do NOT put here |
|--------|----------------|
| `config/` | Business logic, route handlers |
| `middleware/` | Business logic — only request/response pipeline logic |
| `modules/` | Loose files — every feature must be in its own subfolder |
| `modules/[feature]/` | Database schema changes — those are Prisma migrations |
| `services/` | Feature-specific business logic — that goes in modules |
| `utils/constants/` | Functions — those go in `helpers/` |
| `utils/helpers/` | Constant values — those go in `constants/` |
| `utils/seed/` | Live application logic — seed files are data only |
| `types/` | Runtime code — declaration files only |
| `scripts/` | Seed data — entry point only, data lives in `utils/seed/` |


---

## Reference 6 — Frontend folder structure

_Source: `docs/rules/frontend-folder-structure.md`. Included in full for standalone review._

## Frontend Folder Structure

Standardized folder structure for **Next.js** (App Router or Pages Router) and **React** (Vite/CRA) projects. Follow this as the single source of truth when creating, moving, or reviewing files.

---

### Canonical Structure

```
src/
├── app/                        # Next.js App Router ONLY
│   ├── (auth)/                 # Route group — no URL segment
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Shared layout for this group
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── api/                    # API route handlers
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   ├── layout.tsx              # Root layout
│   ├── not-found.tsx
│   └── page.tsx                # Home /
│
├── pages/                      # Next.js Pages Router ONLY (not both)
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth].ts
│   ├── _app.tsx
│   ├── _document.tsx
│   └── index.tsx
│
├── components/
│   ├── ui/                     # Headless/base design system (shadcn, radix, etc.)
│   │   ├── button.tsx
│   │   ├── modal.tsx
│   │   └── input.tsx
│   ├── layout/                 # App-wide layout pieces
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── common/                 # Shared across features, not layout
│   │   ├── Avatar.tsx
│   │   └── LoadingSpinner.tsx
│   └── [feature]/              # Feature-scoped components
│       ├── dashboard/
│       ├── auth/
│       ├── admin/
│       └── business/
│
├── hooks/                      # Custom React hooks only
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   └── use-debounce.ts
│
├── context/                    # React context providers
│   ├── ThemeProvider.tsx
│   └── AuthProvider.tsx
│
├── store/                      # Global state (Redux, Zustand, Jotai, etc.)
│   ├── [feature]/
│   │   ├── auth.slice.ts
│   │   ├── auth.thunk.ts
│   │   └── auth.types.ts
│   ├── rootReducer.ts
│   ├── store.ts
│   └── types.ts
│
├── api/                        # API call functions (not Next.js route handlers)
│   ├── auth.api.ts
│   ├── business.api.ts
│   └── categories.api.ts
│
├── utils/                      # Pure utility functions — NO loose files
│   ├── api/                    # Axios instance, interceptors, base config
│   │   ├── axiosInstance.ts
│   │   └── apiHelpers.ts
│   ├── schema/                 # Zod / Yup validation schemas
│   │   ├── auth.schema.ts
│   │   └── admin.schema.ts
│   ├── mocks/                  # Mock data for dev/testing
│   │   ├── mockParksData.ts
│   │   └── mockSpotsData.ts
│   ├── geo/                    # Geocoding, reverse geocoding, maps
│   │   ├── geocode.ts
│   │   └── reverseGeocode.ts
│   ├── media/                  # Image, file, upload utilities
│   │   └── imageCompression.ts
│   ├── address/                # Address parsing, sanitization
│   │   └── addressSanitizer.ts
│   ├── security/               # Rate limiting, CSRF, auth tokens
│   │   └── rateLimit.ts
│   ├── cookies/                # Cookie read/write helpers
│   │   └── cookies.ts
│   └── helpers/                # Anything uncategorized goes here
│       ├── helper.ts
│       ├── badgeUtils.ts
│       ├── planUtils.ts
│       ├── routes.ts
│       ├── socialLinksUtils.ts
│       ├── subscriptionPlanKey.ts
│       ├── transformers.ts
│       └── env-validation.ts
│
├── types/                      # Global TypeScript types and declarations
│   ├── next-auth.d.ts
│   └── global.d.ts
│
├── styles/                     # Global styles only
│   └── globals.css
│
└── middleware.ts               # Next.js middleware (root of src/)
```

---

### Routing Rules

#### Next.js — App Router (`src/app/`)
- Every route = a folder with `page.tsx` inside
- Use **route groups** `(group-name)/` to share layouts without adding a URL segment
- `layout.tsx` wraps all children in that folder
- `loading.tsx`, `error.tsx`, `not-found.tsx` are co-located with the route they handle
- API handlers live in `app/api/[route]/route.ts` and export named functions: `GET`, `POST`, etc.
- **Do not mix** App Router and Pages Router in the same project

#### Next.js — Pages Router (`src/pages/`)
- Each file = a route. `pages/about.tsx` → `/about`
- Dynamic routes: `pages/post/[id].tsx`
- API routes: `pages/api/[handler].ts` — export a default function
- `_app.tsx` wraps all pages; `_document.tsx` customizes the HTML shell

#### React (Vite / CRA) — No `app/` or `pages/`
- Routing handled by `react-router-dom` or similar
- Route definitions live in `src/router/index.tsx` or `src/App.tsx`
- No file-based routing — pages are just components in `src/components/[feature]/` or a dedicated `src/pages/` folder (convention only, not framework-enforced)

---

### Component Rules

| Folder | What goes here |
|--------|---------------|
| `components/ui/` | Primitive, design-system-level components. No business logic. |
| `components/layout/` | Navbar, Sidebar, Footer, shell wrappers used app-wide. |
| `components/common/` | Reusable components shared across features but not layout. |
| `components/[feature]/` | Components used only within that feature (admin, auth, dashboard…). |

- One component per file
- File name = component name in PascalCase: `UserCard.tsx`
- Co-locate feature-specific sub-components inside the feature folder, not in `common/`

---

### Utils Rules

**Hard rule: no loose files directly inside `utils/`. Every file must be inside a subfolder.**

| Subfolder | What belongs there |
|-----------|-------------------|
| `utils/api/` | Axios/fetch instance, interceptors, base URL config |
| `utils/schema/` | All Zod, Yup, or Joi validation schemas |
| `utils/mocks/` | Static mock data for development or testing |
| `utils/geo/` | Geocoding, map helpers, coordinate utilities |
| `utils/media/` | Image compression, file readers, upload helpers |
| `utils/address/` | Address sanitization, formatting, parsing |
| `utils/security/` | Rate limiting, token handling, CSRF |
| `utils/cookies/` | Cookie get/set/remove helpers |
| `utils/helpers/` | Catch-all for anything that doesn't fit above |

If you add a new utility and it doesn't clearly belong to an existing folder, place it in `helpers/`. If 2+ files share the same concern, create a new named subfolder.

---

### Store Rules

- One folder per feature slice: `store/auth/`, `store/cart/`
- Each slice folder always has three files:
  - `[feature].slice.ts` — state + reducers
  - `[feature].thunk.ts` — async actions
  - `[feature].types.ts` — TypeScript types for that slice
- `store/store.ts` — configures and exports the store
- `store/rootReducer.ts` — combines all slices
- `store/types.ts` — global `RootState` and `AppDispatch` types

---

### Hooks & Context Rules

- `hooks/` — only custom React hooks. File names must start with `use-` (kebab-case): `use-auth.ts`
- `context/` — only React context files. Name as `[Name]Provider.tsx`
- Hooks that are tightly coupled to a single feature can live co-located inside `components/[feature]/hooks/` but prefer `src/hooks/` for anything reused

---

### Adding a New File — Decision Tree

```
Is it a route/page?
  → Next.js App Router: src/app/[route]/page.tsx
  → Next.js Pages Router: src/pages/[route].tsx
  → React: src/components/[feature]/[Name]Page.tsx

Is it a UI component?
  → Used app-wide with no business logic? → components/ui/
  → Layout shell (nav, sidebar)? → components/layout/
  → Shared across features? → components/common/
  → Feature-specific? → components/[feature]/

Is it a hook? → hooks/use-[name].ts
Is it a context? → context/[Name]Provider.tsx
Is it a store slice? → store/[feature]/[feature].slice|thunk|types.ts
Is it an API call function? → api/[feature].api.ts
Is it a validation schema? → utils/schema/[feature].schema.ts
Is it a utility function?
  → Find the right utils subfolder (see table above)
  → Nothing fits? → utils/helpers/[name].ts
Is it a global type? → types/[name].d.ts
```

---

### Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfileCard.tsx` |
| Hooks | kebab-case, `use-` prefix | `use-auth.ts` |
| Utilities | camelCase | `imageCompression.ts` |
| Store files | `[feature].[type].ts` | `auth.slice.ts` |
| API files | `[feature].api.ts` | `business.api.ts` |
| Schemas | `[feature].schema.ts` | `auth.schema.ts` |
| Types/declarations | camelCase or `[name].d.ts` | `next-auth.d.ts` |
| Route folders (Next) | lowercase, kebab | `user-profile/` |

---

### What Does NOT Belong in Each Folder

| Folder | Do NOT put here |
|--------|----------------|
| `components/ui/` | Business logic, API calls, store connections |
| `hooks/` | Non-hook utility functions |
| `utils/` | Loose files at root level |
| `api/` | Next.js route handlers (those go in `app/api/`) |
| `store/` | API call logic (put that in `api/` or thunks) |
| `types/` | Runtime code — declaration files only |
| `styles/` | Component-scoped CSS (co-locate with component or use CSS modules) |


---

## Reference 7 — API module design

_Source: `docs/rules/api-module-design.md`. Included in full for standalone review._

## API Module Design

Standardized pattern for designing a complete backend API module in **Express + TypeScript + Prisma + Zod**. Every module follows the same 5-file architecture. Use this as the reference when creating or reviewing any module.

> Stack: Express, Prisma ORM, Zod (validation), class-based controllers and services.

---

### Module File Map

```
src/modules/[feature]/
├── dto/
│   └── [feature].dto.ts        ← Zod schemas + inferred TypeScript types
├── types/
│   └── [feature].types.ts      ← Internal TypeScript interfaces (not Zod)
├── [feature].routes.ts         ← Route definitions + middleware chain
├── [feature].controller.ts     ← Request parsing, validation, response sending
└── [feature].service.ts        ← Business logic, Prisma calls, external services
```

Each file has exactly one responsibility. Nothing bleeds across boundaries.

---

### 1. Routes (`[feature].routes.ts`)

Routes wire together: HTTP method + path + middleware chain + controller method.

#### Rules
- Route paths are **never hardcoded strings** — always imported from `utils/constants/routes.ts`
- Every route has a 3-line JSDoc comment: `@route`, `@desc`, `@access`
- Each middleware is on its own line — never chain them on one line
- Controller is always last in the chain
- File exports a single `Router` instance as default

#### Structure

```ts
import { Router } from 'express';
import { featureController } from './feature.controller.js';
import { CreateFeatureDto } from './dto/feature.dto.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validateDto } from '../../middleware/validateDto.js';
import { ROUTES } from '../../utils/constants/routes.js';
import { USER_ROLE } from '../../utils/constants/enums.js';
import { upload } from '../../config/multer.js'; // only if file uploads needed

const router = Router();

/**
 * @route   POST /api/feature
 * @desc    Create a new feature item
 * @access  Protected (Business Owner)
 */
router.post(
  ROUTES.FEATURE.CREATE,
  authenticate,
  requireRole(USER_ROLE.BUSINESS_OWNER),
  validateDto(CreateFeatureDto),
  featureController.createFeature
);

export default router;
```

#### Middleware Order (always this sequence)
1. `authenticate` — verify JWT / session
2. `requireRole(...)` — RBAC check
3. `upload.single()` / `upload.array()` / `upload.fields()` — file upload (if needed)
4. `validateDto(DtoSchema)` — body validation (skip if validation is done in controller)
5. Controller method — always last

#### File Upload in Routes

```ts
// Single file
upload.single('profilePicture')

// Multiple files, same field
upload.array('photos', 5)

// Multiple fields, each with a file
upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
])
```

---

### 2. Controller (`[feature].controller.ts`)

Controllers handle the HTTP layer only: parse input, validate, call service, send response.

#### Rules
- Class-based: `export class FeatureController { ... }`
- Export a singleton at the bottom: `export const featureController = new FeatureController()`
- All methods are **async arrow functions** assigned to the class — this ensures correct `this` binding when passed to routes
- Every method signature: `(req: Request, res: Response, next: NextFunction): Promise<void>`
- All errors are forwarded with `next(error)` — never `res.status(500).json(...)` directly
- No business logic — controller only parses, validates, and delegates to the service
- Validation errors are collected into an `errors[]` array and returned all at once with `sendBadRequest`
- Use `sendSuccess`, `sendCreated`, `sendBadRequest` from `utils/helpers/response.ts` for all responses
- Use `logger` only for significant state changes (create, update, delete). Avoid info-level logs for GET requests

#### Structure

```ts
import type { Request, Response, NextFunction } from 'express';
import { FeatureService } from './feature.service.js';
import { CreateFeatureDto, FeatureQueryDto } from './dto/feature.dto.js';
import type { CreateFeatureDtoType } from './dto/feature.dto.js';
import type { SafeFeature, PaginatedFeaturesResponse } from './types/feature.types.js';
import { sendSuccess, sendCreated, sendBadRequest } from '../../utils/helpers/response.js';
import { createLogger } from '../../utils/helpers/logger.js';

const logger = createLogger('FeatureController');

export class FeatureController {
  private featureService: FeatureService;

  constructor() {
    this.featureService = new FeatureService();
  }

  /**
   * Create a feature item
   * POST /api/feature
   */
  createFeature = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body with Zod
      const dtoResult = CreateFeatureDto.safeParse(req.body);
      if (!dtoResult.success) {
        const errors = dtoResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendBadRequest(res, 'Validation failed', errors);
        return;
      }

      const dto: CreateFeatureDtoType = dtoResult.data;
      const ownerId = req.user!.id;

      const feature = await this.featureService.createFeature(ownerId, dto);

      logger.info(`Feature created: ${feature.id} by user: ${ownerId}`);
      sendCreated<{ feature: SafeFeature }>(res, 'Feature created successfully', { feature });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all features with filters
   * GET /api/feature
   */
  getAllFeatures = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query params with Zod
      const queryResult = FeatureQueryDto.safeParse(req.query);
      if (!queryResult.success) {
        const errors = queryResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendBadRequest(res, 'Invalid query parameters', errors);
        return;
      }

      const result = await this.featureService.getAllFeatures(queryResult.data);

      sendSuccess<PaginatedFeaturesResponse>(res, 'Features retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const featureController = new FeatureController();
```

#### Validation Pattern

**Body validation** — always use `safeParse`, never `parse` (which throws):
```ts
const dtoResult = CreateFeatureDto.safeParse(req.body);
if (!dtoResult.success) {
  const errors = dtoResult.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  sendBadRequest(res, 'Validation failed', errors);
  return; // Always return after sending error
}
```

**Manual validation** (path params, file checks) — collect all errors first, send once:
```ts
const errors: Array<{ field: string; message: string }> = [];

if (!profileId) errors.push({ field: 'profileId', message: 'Profile ID is required' });
if (!req.user) errors.push({ field: '', message: 'Authentication required' });
if (photoCount > 5) errors.push({ field: 'photos', message: 'Maximum 5 photos allowed' });

if (errors.length > 0) {
  sendBadRequest(res, 'Validation failed', errors);
  return;
}
```

**JSON string fields** (from multipart/form-data) — always wrap in try/catch:
```ts
if (tags !== undefined) {
  try {
    dto.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (!Array.isArray(dto.tags)) {
      errors.push({ field: 'tags', message: 'tags must be an array' });
    }
  } catch {
    errors.push({ field: 'tags', message: 'Invalid tags format' });
  }
}
```

#### Logging Rules

```ts
// ✅ Log on significant mutations
logger.info(`Feature created: ${feature.id} by user: ${ownerId}`);
logger.info(`Feature updated: ${featureId}`);

// ❌ Do NOT log on GET requests
logger.debug(`Fetching features for user: ${ownerId}`); // Avoid in production

// ✅ Always log errors (handled in service, or in catch blocks)
logger.error(`Failed to process feature: ${featureId}`, error);
```

Logger should only log:
- `info` — successful create / update / delete (controller level, brief)
- `error` — failures (service level, with context)
- `warn` — recoverable issues (e.g. failed to delete old Cloudinary asset before re-upload)
- `debug` — development only, verbose fetch logs (these are acceptable in service but not controller)

---

### 3. Service (`[feature].service.ts`)

Services contain all business logic, database calls (Prisma), and external service calls (Cloudinary, etc.).

#### Rules
- Class-based: `export class FeatureService { ... }`
- Export a singleton: `export const featureService = new FeatureService()`
- **Private methods** for: data transformation (`toSafeFeature`), error creation (`createError`), ownership verification (`verifyOwnership`), internal utilities
- **Public methods** for: all operations called by the controller
- Never throw raw `Error` objects — always throw through `this.createError(statusCode, message)`
- The global `errorHandler` middleware reads `statusCode` from thrown errors — this is how HTTP status codes flow to the client
- Only update fields that are explicitly provided in the DTO (check `!== undefined`, not `!= null`)
- When updating Prisma JSON fields: use `Prisma.JsonNull` for `null`, not JS `null`
- For Cloudinary: always delete the old asset **before** uploading a new one

#### Structure

```ts
import prisma from '../../config/prisma.js';
import type { CreateFeatureDtoType } from './dto/feature.dto.js';
import type { SafeFeature } from './types/feature.types.js';
import { createLogger } from '../../utils/helpers/logger.js';

const logger = createLogger('FeatureService');

export class FeatureService {

  // ==========================================
  // Private Helpers
  // ==========================================

  private toSafeFeature(record: PrismaFeature): SafeFeature {
    // Strip internal fields, cast JSON fields to known types
    return { id: record.id, name: record.name, ... };
  }

  private createError(statusCode: number, message: string) {
    return { statusCode, message };
  }

  private async verifyOwnership(featureId: string, ownerId: string): Promise<PrismaFeature> {
    const record = await prisma.feature.findFirst({
      where: { id: featureId, ownerId, isDeleted: false },
    });
    if (!record) throw this.createError(404, 'Not found or access denied');
    return record;
  }

  // ==========================================
  // Public Methods
  // ==========================================

  async createFeature(ownerId: string, dto: CreateFeatureDtoType): Promise<SafeFeature> {
    const record = await prisma.feature.create({ data: { ownerId, ...dto } });
    return this.toSafeFeature(record);
  }

  async updateFeatureById(featureId: string, dto: Partial<UpdateFeatureDtoType>, userId: string): Promise<SafeFeature> {
    const existing = await this.verifyOwnership(featureId, userId);

    const updateData: Record<string, unknown> = {};
    // Only include fields that are explicitly provided
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    const updated = await prisma.feature.update({ where: { id: featureId }, data: updateData });
    return this.toSafeFeature(updated);
  }
}

export const featureService = new FeatureService();
```

#### Prisma Patterns

**Soft delete** — always filter `isDeleted: false`:
```ts
await prisma.feature.findFirst({ where: { id, isDeleted: false } });
```

**Partial update** — only set fields that are provided:
```ts
if (dto.name !== undefined) updateData.name = dto.name;
if (dto.description !== undefined) updateData.description = dto.description ?? null;
```

**JSON fields** — cast correctly for Prisma:
```ts
import { Prisma } from '../../generated/prisma/client.js';

// Setting to null
data: { photos: Prisma.JsonNull }

// Setting to value
data: { photos: dto.photos as Prisma.InputJsonValue }

// Conditional
data: { photos: dto.photos ? (dto.photos as Prisma.InputJsonValue) : Prisma.JsonNull }
```

**Pagination**:
```ts
const page = filters.page || 1;
const limit = filters.limit || 10;
const skip = (page - 1) * limit;

const [total, records] = await Promise.all([
  prisma.feature.count({ where }),
  prisma.feature.findMany({ where, skip, take: limit, orderBy }),
]);

return {
  items: records.map(this.toSafeFeature),
  pagination: {
    page, limit, total,
    totalPages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
  },
};
```

---

### 4. DTO (`dto/[feature].dto.ts`)

DTOs are Zod schemas that validate incoming request data. They also export inferred TypeScript types.

#### Rules
- Use **Zod** exclusively — no class-validator, no manual checks
- All schemas use `.safeParse()` in the controller — never `parse()` which throws uncaught errors
- Helper functions (`isValidUrl`, `isValidEmail`) defined at top of file, before schemas
- Query DTOs use `.transform()` to convert string params to typed values (numbers, booleans)
- Always export inferred types at the bottom: `export type CreateFeatureDtoType = z.infer<typeof CreateFeatureDto>`
- Schema names are PascalCase and match their export type: `CreateFeatureDto` → `CreateFeatureDtoType`

#### Structure

```ts
import { z } from 'zod';

// ============================================
// Helper validation functions
// ============================================
const isValidUrl = (url: string): boolean => {
  try { new URL(url); return true; } catch { return false; }
};

// ============================================
// Create Feature DTO
// ============================================
export const CreateFeatureDto = z.object({
  name: z
    .string({ message: 'Name is required' })
    .min(1, 'Name cannot be empty')
    .max(150, 'Name cannot exceed 150 characters')
    .trim(),
  description: z.string().max(2000).optional(),
  websiteUrl: z
    .string()
    .refine((val) => !val || isValidUrl(val), { message: 'Website URL must be a valid URL' })
    .optional(),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).optional(),
});

// ============================================
// Query DTO (for GET with filters/pagination)
// ============================================
export const FeatureQueryDto = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().positive().max(100)),
});

// ============================================
// Type Exports
// ============================================
export type CreateFeatureDtoType = z.infer<typeof CreateFeatureDto>;
export type FeatureQueryDtoType = z.infer<typeof FeatureQueryDto>;
```

---

### 5. Types (`types/[feature].types.ts`)

Internal TypeScript interfaces for the module — not Zod, not Prisma types.

#### Rules
- Use for: safe/public-facing entity shapes (`SafeFeature`), error interfaces, response envelopes, filter/query types
- Do **not** duplicate Prisma-generated types — import them from `../../generated/prisma/client.js` directly when needed
- Do **not** put Zod schemas here — those belong in `dto/`
- Types used in only one file can stay in that file; move to `types/` when shared across controller + service

#### Structure

```ts
// ============================================
// Entity Types
// ============================================
export interface SafeFeature {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Response Types
// ============================================
export interface PaginatedFeaturesResponse {
  features: SafeFeature[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================
// Filter Types
// ============================================
export interface FeatureQueryFilters {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

---

### 6. Registering in `server.ts`

After creating a module, register it in `server.ts`:

```ts
// 1. Import the router
import featureRoutes from './modules/feature/feature.routes.js';

// 2. Mount at the route constant base path
app.use(ROUTES.FEATURE.BASE, featureRoutes);
```

Add the base route to `utils/constants/routes.ts`:
```ts
export const ROUTES = {
  FEATURE: {
    BASE: '/api/feature',
    CREATE: '/',
    GET_ALL: '/',
    GET_BY_ID: '/:featureId',
    UPDATE: '/:featureId',
    DELETE: '/:featureId',
  },
};
```

---

### Adding a New Module — Checklist

```
1. Create src/modules/[feature]/
   □ dto/[feature].dto.ts         Zod schemas + type exports
   □ types/[feature].types.ts     SafeEntity, PaginatedResponse, QueryFilters
   □ [feature].routes.ts          Routes using ROUTES constants, JSDoc per route
   □ [feature].controller.ts      Class, arrow function methods, safeParse, next(error)
   □ [feature].service.ts         Class, private helpers, public methods, Prisma calls

2. Register routes in server.ts
   □ Import router
   □ Mount with app.use(ROUTES.[FEATURE].BASE, featureRoutes)

3. Add route constants
   □ Add ROUTES.[FEATURE] block to utils/constants/routes.ts

4. Add Swagger docs
   □ Create services/swagger/modules/[feature]/paths.ts
   □ Register in services/swagger/index.ts

5. Add any new enums
   □ Add to utils/constants/enums.ts
```

---

### Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Hardcoded route strings in routes file | Always use `ROUTES.FEATURE.METHOD` constants |
| `parse()` instead of `safeParse()` in controller | Always `safeParse()` — `parse()` throws uncaught errors |
| Business logic in controller | Controller parses + validates only; logic goes in service |
| Direct `prisma` calls in controller | Only service touches Prisma |
| Throwing `new Error(...)` in service | Always `throw this.createError(statusCode, message)` |
| Setting JSON fields to `null` directly in Prisma | Use `Prisma.JsonNull` for null JSON fields |
| `logger.info()` on every GET request | Log only mutations (create/update/delete) and errors |
| Missing `return` after `sendBadRequest` | Always `return` after any response to prevent double-send |
| Updating all fields regardless of DTO | Only update fields where `dto.field !== undefined` |
| Methods as regular class methods (not arrow functions) | Use arrow functions to preserve `this` binding in route handlers |


---

## Reference 8 — API and store integration

_Source: `docs/rules/api-store-integration.md`. Included in full for standalone review._

## API & Store Integration

Standardized pattern for **Redux Toolkit + Axios** in a Next.js / React project. Use this as the single reference when creating or modifying anything in `src/api/`, `src/store/`, or `src/utils/api/`.

> This pattern is **Redux Toolkit + Axios only**. RTK Query and SWR are out of scope.

---

### Layer Overview

```
Component / Hook
    ↓  dispatch(someThunk(payload))       — typed with useAppDispatch
    ↓  useAppSelector(state => state.x)   — typed with useAppSelector
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  store/[feature]/                                       │
│  ├── [feature].slice.ts    ← state shape, reducers      │
│  ├── [feature].thunk.ts    ← async logic, error wrap    │
│  └── [feature].types.ts    ← all TS types for feature   │
└─────────────────────────────────────────────────────────┘
                │
                ▼  calls service method
┌─────────────────────────────────────────────────────────┐
│  api/[feature].api.ts      ← typed axios service object │
└─────────────────────────────────────────────────────────┘
                │
                ▼  uses
┌─────────────────────────────────────────────────────────┐
│  utils/api/axiosInstance.ts  ← one instance, auth       │
│                                interceptors              │
└─────────────────────────────────────────────────────────┘
                │
                ▼
          Backend API
```

Each layer has one job. Nothing bleeds into the next.

---

#### Concrete Example — `auth` feature

```
src/
├── api/
│   └── auth.api.ts                  → exports authService { login, register, ... }
│
├── store/
│   └── auth/
│       ├── auth.slice.ts            → createSlice, initialState, reducers, extraReducers
│       ├── auth.thunk.ts            → loginThunk, registerThunk, logoutThunk, ...
│       └── auth.types.ts            → ILoginThunkPayload, ILoginThunkResponse,
│                                        ILoginThunkResponseData, AuthSliceInterface, ...
│
└── utils/
    └── api/
        └── axiosInstance.ts         → single axios instance (shared by ALL api files)
```

How the `auth` flow executes end-to-end:

```
LoginForm component
  → dispatch(loginThunk({ email, password }))
      → auth.thunk.ts: loginThunk
          → authService.login({ email, password })    [auth.api.ts]
              → axiosInstance.post<ILoginThunkResponse>("/api/auth/login", data)
                  → Backend returns { success, message, data: { user, token } }
              ← response.data typed as ILoginThunkResponse
          ← thunk returns response.data on success
          ← thunk calls rejectWithValue(ApiErrorData) on failure
      → auth.slice.ts extraReducers:
          pending  → loginLoading: true
          fulfilled → loginLoading: false, user: action.payload.data.user
          rejected  → loginLoading: false
  ← component reads state.auth.loginLoading, state.auth.user via useAppSelector
```

---

#### Dynamic Naming Pattern — Any Feature

Replace `[feature]` with your actual feature name (camelCase, lowercase). The structure is always identical:

```
store/
└── [feature]/
    ├── [feature].slice.ts
    ├── [feature].thunk.ts
    └── [feature].types.ts

api/
└── [feature].api.ts
```

Real examples across the codebase:

| Feature | Slice | Thunk | Types | API Service |
|---------|-------|-------|-------|-------------|
| `auth` | `auth.slice.ts` | `auth.thunk.ts` | `auth.types.ts` | `auth.api.ts` |
| `business` | `business.slice.ts` | `business.thunk.ts` | `business.types.ts` | `business.api.ts` |
| `categories` | `categories.slice.ts` | `categories.thunk.ts` | `categories.types.ts` | `categories.api.ts` |
| `dogProfile` | `dogProfile.slice.ts` | `dogProfile.thunk.ts` | `dogProfile.types.ts` | `dogProfile.api.ts` |
| `facilities` | `facilities.slice.ts` | `facilities.thunk.ts` | `facilities.types.ts` | `facilities.api.ts` |

Multi-word features use **camelCase** for the folder and file prefix — `dogProfile`, `lostFound`, `userProfile`, `verificationStatus`. Never kebab-case, never PascalCase.

---

#### What Lives Where — Quick Reference

```
src/
├── utils/api/
│   └── axiosInstance.ts     ONE file. Never duplicated. Auth interceptors live here.
│
├── api/
│   ├── auth.api.ts           One service object per feature. No logic. No error handling.
│   ├── business.api.ts
│   ├── categories.api.ts
│   └── facilities.api.ts
│
├── store/
│   ├── auth/
│   │   ├── auth.slice.ts
│   │   ├── auth.thunk.ts
│   │   └── auth.types.ts
│   ├── business/
│   │   ├── business.slice.ts
│   │   ├── business.thunk.ts
│   │   └── business.types.ts
│   ├── [feature]/            ← add new features here, same 3-file pattern always
│   │   ├── [feature].slice.ts
│   │   ├── [feature].thunk.ts
│   │   └── [feature].types.ts
│   ├── rootReducer.ts        Combines all slices. Configures redux-persist.
│   ├── store.ts              Configures store. Exports useAppDispatch, useAppSelector.
│   └── types.ts              Global shared types only (ApiError, Pagination, etc.)
```

Each layer has one job and imports only from the layer directly below it:
- **Component** imports from `store/` (hooks + actions)
- **Thunk** imports from `api/`
- **API service** imports from `utils/api/axiosInstance`
- **Slice** imports from its own `.thunk.ts` and `.types.ts`
- **Types** import from nowhere (or from `store/types.ts` for shared types)

---

### File-by-File Reference

#### 1. `utils/api/axiosInstance.ts`

The single axios instance for the entire app. Created once, used everywhere.

**Responsibilities:**
- Set `baseURL` from `process.env.NEXT_PUBLIC_API_URL`
- Set `withCredentials: true` for cookie-based auth
- **Request interceptor** — attach `Authorization: Bearer <token>` from NextAuth session
- **Response interceptor** — on 401, sign out and redirect to `/auth/login` unless the request was itself an auth endpoint or the user is already on an auth page

**Rules:**
- Only one axios instance exists in the whole codebase — never call `axios.create()` elsewhere
- Auth endpoints list (`AUTH_ENDPOINTS`) must be kept up to date to avoid redirect loops
- `verifyCaptcha` is a one-off server-side utility that may live here or move to `utils/security/`
- Never import `axiosInstance` from anywhere except `api/*.api.ts` files

---

#### 2. `api/[feature].api.ts`

One file per feature. Exports a single `const [feature]Service = { ... }` object. No default export.

**Structure:**
```ts
// IMPORTS — types from store/[feature]/[feature].types, axiosInstance, ROUTES
// TYPE DEFINITIONS (empty section — keep for consistency)
// CONSTANTS (empty section — keep for consistency)
// [FEATURE] API SERVICE
export const featureService = {
  methodName: (data?: IMethodThunkPayload) =>
    axiosInstance.get<IMethodThunkResponse>(ROUTES.FEATURE.ENDPOINT, { params }),
};
```

**Rules:**
- Always pass the response type as a generic to axios: `axiosInstance.get<IMethodThunkResponse>(...)`
- Build `params` objects explicitly — do not spread payload directly into params
- Only include a param if the value is not `undefined` (guard with `if (data?.field !== undefined)`)
- URL path params use `.replace(":id", value)` from the ROUTES constant
- JSDoc every method with `@param` and what it does
- No business logic, no error handling — that belongs in the thunk

**Example:**
```ts
export const businessService = {
  getMyListings: (data?: IGetMyListingsThunkPayload) => {
    const params: Record<string, string | boolean | number> = {};
    if (data?.search !== undefined) params.search = data.search;
    if (data?.page !== undefined) params.page = data.page;
    return axiosInstance.get<IGetMyListingsThunkResponse>(ROUTES.BUSINESS.MY_LISTINGS, { params });
  },

  getListingById: (data: IGetListingByIdThunkPayload) => {
    const url = ROUTES.BUSINESS.LISTING_BY_ID.replace(":listingId", data.listingId);
    return axiosInstance.get<IGetListingByIdThunkResponse>(url);
  },
};
```

---

#### 3. `store/[feature]/[feature].types.ts`

All TypeScript types for one feature slice. The most important file to get right.

##### Section order (top to bottom):

```
1. IMPORTS
2. COMMON TYPES        ← enums, primitive union types, reusable interfaces
3. [ENTITY] INTERFACE  ← e.g. ApiListing, BusinessProfile, ListingClaim
4. [THUNK NAME] TYPES  ← one section per thunk, 3–4 interfaces each
   ...repeat per thunk...
5. [FEATURE] SLICE INTERFACE
```

##### Interface naming convention

Every interface uses `I` as a prefix. Name everything after the thunk it belongs to:

| Interface | Purpose |
|-----------|---------|
| `IGetMyDogThunkPayload` | What you send to the API (query params or body) |
| `IGetMyDogThunkResponse` | Top-level API response `{ success, message, data }` |
| `IGetMyDogThunkResponseData` | The `data` field inside the response |

If `data` contains a list + pagination, the response data interface holds both:
```ts
export interface IGetMyDogsThunkResponseData {
  dogs: IDog[];
  pagination: IPaginationData;
}
```

If the entity is reused across multiple thunks, define it once in **COMMON TYPES** / entity section, not inside a thunk section.

##### Rules:
- `I` prefix on every interface — no exceptions
- Primitive union types and enums go at the very top before any interfaces
- Reusable entities (e.g. `ApiListing`, `BusinessProfile`) go in the entity section — never duplicated per-thunk
- Shared structures like `IPaginationData`, `IPhoto`, `IOpeningHours` belong in the entity section of the most relevant slice, or in `store/types.ts` if used globally
- Thunk type sections must be labeled with comments: `// --- GET MY DOG THUNK TYPES ---`
- The slice interface (`[Feature]SliceInterface`) is always the last thing before thunk type sections

---

#### 4. `store/[feature]/[feature].thunk.ts`

One `createAsyncThunk` per API call. No business logic outside of thunks.

**Structure per thunk:**
```ts
// ============================================================================
// GET MY DOG THUNK
// ============================================================================

export const getMyDogThunk = createAsyncThunk<
  IGetMyDogThunkResponse,       // fulfilled return type
  IGetMyDogThunkPayload,        // argument type
  { rejectValue: ApiErrorData } // reject type (always this)
>(
  "featureName/actionName",     // must match: "sliceName/camelCaseAction"
  async (data, { rejectWithValue }) => {
    try {
      const response = await featureService.getMyDog(data);
      return response.data;
    } catch (error: any) {
      const errorMessage = getErrorMessage(error, "Fallback error message");
      if (error?.response?.data) {
        return rejectWithValue({ data: error.response.data });
      }
      return rejectWithValue({ data: { success: false, message: errorMessage } });
    }
  }
);
```

**Rules:**
- Always use `rejectWithValue` with `ApiErrorData` shape — never throw
- Always call `getErrorMessage(error, "fallback")` for the fallback message
- Import service from `@/api/[feature].api` — never call axiosInstance directly
- The action string `"feature/actionName"` must be unique across the entire store
- For `void` payload (no args): use `async (_, { rejectWithValue })`
- Thunks that take both an ID and a body: use a single object arg `{ id: string; data: IPayload }`

---

#### 5. `store/[feature]/[feature].slice.ts`

Manages state. Uses `extraReducers` for async thunk cases and `reducers` for sync state updates.

##### Initial state pattern

Define initial values as named constants at the top — reuse them in reset reducers:
```ts
const initialFilters: DogFilters = { search: undefined, breed: undefined };
const initialPagination: PaginationData = { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false };

const initialState: DogSliceInterface = {
  // GET MY DOGS
  getMyDogsLoading: false,
  getMyDogs: [],
  getMyDogsPagination: null,
  getMyDogsFilters: initialFilters,
  getMyDogsSort: "NEWEST",
  getMyDogsCurrentPage: initialPagination.page,
  getMyDogsLimit: initialPagination.limit,
  // For operations with no data to hold, only add loading:
  // CREATE DOG
  createDogLoading: false,
};
```

##### State field naming by operation type

| Operation | State fields to add |
|-----------|-------------------|
| GET list (paginated) | `[name]Loading`, `[name]` (array), `[name]Pagination`, `[name]Filters`, `[name]Sort`, `[name]CurrentPage`, `[name]Limit` |
| GET list (paginated + cached) | All above + `[name]Cache` |
| GET single item | `[name]Loading`, `[name]` (nullable entity) |
| GET simple (no pagination) | `[name]Loading`, `[name]` (array or null) |
| CREATE / UPDATE / DELETE | `[name]Loading` only — no data state unless you need to hold the result |

**Only add caching when the list has filters + sort + pagination and is expensive to refetch.** Do not add cache by default.

##### Cache pattern (when needed)

```ts
// In slice utility functions:
const generateCacheKey = (filters: DogFilters, sort: string, page: number): string =>
  JSON.stringify({ ...filters, sort, page });

// In extraReducers fulfilled case:
const cacheKey = generateCacheKey(state.getMyDogsFilters, state.getMyDogsSort, state.getMyDogsCurrentPage);
state.getMyDogsCache = {
  ...state.getMyDogsCache,
  [cacheKey]: { dogs, pagination, timestamp: Date.now() },
};
```

##### Sync reducers (in `reducers: {}`)

Add sync reducers for: setting filters, resetting filters, changing page, changing sort, clearing cache. Always reset to page 1 when filters or sort change.

```ts
setDogsFilters: (state, action: PayloadAction<Partial<DogFilters>>) => {
  state.getMyDogsFilters = { ...state.getMyDogsFilters, ...action.payload };
  state.getMyDogsCurrentPage = 1; // Always reset page
},
resetDogsFilters: (state) => {
  state.getMyDogsFilters = initialFilters;
  state.getMyDogsCurrentPage = 1;
},
```

##### extraReducers pattern

Always handle all three cases: `pending`, `fulfilled`, `rejected`.

```ts
.addCase(getMyDogsThunk.pending, (state) => ({ ...state, getMyDogsLoading: true }))
.addCase(getMyDogsThunk.fulfilled, (state, action) => {
  const { dogs, pagination } = action.payload.data;
  return { ...state, getMyDogsLoading: false, getMyDogs: dogs, getMyDogsPagination: pagination };
})
.addCase(getMyDogsThunk.rejected, (state) => ({ ...state, getMyDogsLoading: false }))
```

Use spread-and-return (`return { ...state, ... }`) consistently — do not mix with direct mutation.

---

#### 6. `store/rootReducer.ts`

Combines all slices and configures `redux-persist`.

**Rules:**
- Only add a slice to `rootReducer` when it has been fully implemented (slice + thunk + types)
- `whitelist` in `persistConfig` should only include slices that truly need persistence (e.g. `auth`) — do not persist large data slices
- Export both `persistreducer` (for the store) and `rootReducer` (for type inference)

---

#### 7. `store/store.ts`

Configures the Redux store. Exports typed hooks.

**Rules:**
- `serializableCheck: false` is required for redux-persist
- Always export `useAppDispatch` and `useAppSelector` from here — never use raw `useDispatch`/`useSelector` in components
- `RootState` must use `typeof rootReducer` (non-persisted) for correct type inference

---

#### 8. `store/types.ts`

Global types shared across multiple slices. Examples: `ApiError`, `ApiErrorData`, `Pagination`, shared entity interfaces.

**Rules:**
- Only put a type here if it is genuinely used in 2+ slices
- Feature-specific types stay in `store/[feature]/[feature].types.ts`
- `ApiErrorData` shape must always be `{ data: { success: boolean; message: string } }`

---

### Adding a New Feature — Checklist

```
1. Create store/[feature]/[feature].types.ts
   □ Primitive union types and enums at top
   □ Reusable entity interfaces (IMyEntity)
   □ One section per thunk: Payload, Response, ResponseData
   □ SliceInterface at the bottom of entities, before thunk types

2. Create api/[feature].api.ts
   □ One service object with typed axios methods
   □ All methods JSDoc'd
   □ Params built explicitly (no direct payload spread)

3. Create store/[feature]/[feature].thunk.ts
   □ One thunk per API call
   □ All use rejectWithValue + getErrorMessage
   □ Import from api/[feature].api — never axiosInstance directly

4. Create store/[feature]/[feature].slice.ts
   □ Named initial value constants at top
   □ State fields follow naming table above
   □ Sync reducers for filters/sort/page/cache
   □ extraReducers for all three cases of each thunk
   □ Named exports for all sync actions + default export for reducer

5. Register in store/rootReducer.ts
   □ Import the reducer
   □ Add to combineReducers
   □ Add to whitelist only if persistence is needed
```

---

### Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Calling `axios.create()` in an api file | Always import from `utils/api/axiosInstance` |
| Spreading payload directly into params | Build `params` object with explicit guards |
| Using `useDispatch` / `useSelector` directly | Always use `useAppDispatch` / `useAppSelector` |
| Interface without `I` prefix | `IDog`, `IGetMyDogThunkPayload`, etc. |
| Thunk response type not passed to axios | `axiosInstance.get<IMyThunkResponse>(url)` |
| Throwing in a thunk catch block | Always `return rejectWithValue(...)` |
| Adding cache to every slice | Cache only when list has filters + sort + pagination |
| Persisting every slice | Only persist what needs to survive page refresh (typically `auth` only) |
| Loose types in `store/types.ts` | Feature types go in feature types file; only global shared types here |
| Duplicating entity interface per thunk | Define entity once, reference in response data interfaces |


---

## Reference 9 — Document review and proposal workflow

_Source: `docs/rules/doc-review.md`. Included in full for standalone review._

## Doc Review & Proposal Skill

A manually-invoked skill for reviewing a specification, testing, bug, or feature document against the current codebase, surfacing what's unclear or missing, and producing a written proposal before any implementation starts. Project-agnostic: it carries no assumptions about any specific stack, folder layout, or rule set. It is not a coding-standards document, and it does not replace one.

---

### 0. Purpose & How This Document Is Used

This skill is handed a document (or a scoped portion of one) and produces one of two outcomes:

1. A batch of clarifying questions, if the document isn't clear enough to propose a fix without guessing, or
2. A written proposal, saved to disk, describing what was found and how it should be addressed, once it is clear enough.

It never writes implementation code itself. It stops at "here's the problem, here's the proposed fix, waiting on your approval." Once approved, it hands off to implementation, at which point it defers entirely to whatever standards already exist in that project (see Section 10). This document governs the review-and-propose process only, nothing else.

It works on any kind of documentation: a feature spec, a test plan, a bug report, product notes, an audit doc like "here's what's wrong with X." The lens is the same regardless of label: what does this say should be true, what is actually true in the codebase today, and is the gap between the two well-defined enough to act on.

---

### 1. When This Skill Runs

**Manual invocation only. Never auto-applied.**

This skill runs only when one of the following happens:
- The user names it directly ("use doc-review on this," "run doc-review against section 3").
- The user explicitly asks for this kind of review ("check this doc and tell me what's wrong and how you'd fix it," "review this spec and propose a fix," in a way that clearly maps to this workflow).

If a specification or testing document simply appears in a conversation, in an upload, or in the codebase, that is not by itself a trigger. Read it if it's relevant to whatever was actually asked, but do not launch into the clarify-propose-document flow below unless invoked. When in doubt about whether this skill was invoked, ask.

---

### 2. Determining Scope

The user controls scope explicitly. Never infer a narrower or wider scope than what was actually given.

| What the user says | What's in scope |
|---|---|
| "Section 2" / "the second section" | The document's own section boundaries (its headers), as authored |
| "Line 1 to 160" / "lines 40-90" | Exactly that line range, nothing before or after it |
| A named heading ("the auth flow part") | The content under that heading only |
| No range or section given | The entire document |
| "Everything except section 4" | Everything but the named exclusion |

Rules:
- If the user references a scope from an earlier message in the same session ("now do the next section"), treat it as continuing from where the last reviewed scope ended, only if that's unambiguous from the doc's own structure. If it isn't obvious where "next" starts, ask.
- Never silently expand scope because something outside it looked relevant. If something outside the given scope seems important to flag, say so explicitly as an aside, but don't fold it into the findings for this pass.
- Never silently shrink scope because part of it looked out of date or irrelevant. If a scoped section turns out to have nothing actionable in it, say that plainly instead of skipping it.

---

### 3. Workflow Overview

Six phases, always in this order. Do not skip ahead to Phase 4 while still below the clarity bar in Phase 2, and do not start Phase 7 without an explicit approval from Phase 6.

1. **Context gathering** — read the scoped document, then freely explore whatever else is needed.
2. **Clarity assessment** — for everything found, do you actually know enough to propose a specific fix?
3. **Clarifying questions** — if not, stop and ask. Repeat until you do.
4. **Write the proposal** — once clear, describe the problem and the fix for each item.
5. **Save the proposal** — as a markdown file, in a predictable location, so it can be revisited later.
6. **Wait for approval** — nothing gets implemented until the user says go.

Phase 7 (planning and implementation) is described here for completeness but is a separate concern from the review-and-propose flow this document governs; see Section 10.

---

### 4. Phase 1: Context Gathering

Read the document (full or scoped, per Section 2) first. Then, before forming any judgment about clarity, explore whatever else in the codebase bears on it. This is not optional and not limited to files the user pointed at.

Things worth checking, as relevant to what the document is about:
- The actual implementation the document is describing, testing, or reporting a bug against.
- Any existing specification, design, or planning docs that this document references or that reference it.
- Existing tests covering the same area.
- Other rule/standards files present in the project (whatever they're called, wherever they live), since a proposal that contradicts an existing project convention is not a good proposal.
- Prior review files this same skill has produced for this project (see Section 8's folder structure), in case this is a continuation of earlier work rather than a fresh pass.
- Output from other agents or skills active in this project, if any exists and is relevant.

The goal of this phase is to make sure that anything unclear by the end of it is unclear because the information genuinely isn't available anywhere in the project, not because it wasn't looked for.

---

### 5. Phase 2: Clarity Assessment

For every distinct item found in the scoped document (a requirement, a described behavior, a reported bug, a test expectation), you need to be able to state three things without inventing unstated details:

1. **What is this saying should be true?** (the requirement, expectation, or intended behavior)
2. **What is actually true today?** (verified against the codebase, not assumed)
3. **What would closing that gap require?** (specific enough that someone could start work from it)

If any of the three is fuzzy, guessed, or filled in with an assumption you made up to make the item feel resolvable, that item is below the clarity bar. Roughly: you should be at 80-90% confidence that your understanding of the item matches what the document's author actually meant and what the fix actually needs to be. Below that, it goes to Phase 3, not Phase 4.

Common reasons an item lands below the bar:
- The document uses a term or concept that isn't defined anywhere in it or in the codebase.
- Two parts of the document (or the document and the codebase) contradict each other.
- An edge case, error state, or permission boundary is implied but never actually specified.
- The document references a file, component, endpoint, or schema that doesn't exist, and it's not obvious whether that means "build it" or "it was renamed" or "this is stale."
- Acceptance criteria are vague enough that two reasonable people could implement it differently and both claim to have satisfied it.
- The document is describing a bug, but reproduction steps, expected vs. actual behavior, or scope of impact aren't stated clearly enough to know if there's really a bug and where.

This applies identically whether the document is a feature spec, a test document, or a bug report. The type of document changes what "true" and "should be true" refer to, not whether you need to know both sides before proposing anything.

---

### 6. Phase 3: Asking Clarifying Questions

If any item is below the clarity bar, stop. Do not write a partial proposal, do not propose the items you're confident about while silently skipping the unclear ones, and do not guess and flag the guess as an assumption instead of asking. Below the bar means the whole pass waits.

Rules for the questions themselves:
- Only ask what genuinely couldn't be resolved by further exploration in Phase 1. If the codebase already answers it, don't ask, go check.
- Batch everything into one message, grouped by topic if there are several unrelated threads of confusion. Never dribble questions out one at a time across multiple turns when they could have been asked together.
- There's no ceiling on how many questions to ask. One is fine if that's all that's needed. Fifteen is fine if the document genuinely needs it. What matters is that the batch is complete, not that it's short.
- Be specific. "What should happen here?" is a worse question than "Section 2 says failed uploads should be retried, but doesn't say how many times or whether the user is notified after the final failure. Which of those apply?"
- After the user answers, re-run the clarity assessment. If the answers introduce new ambiguity, ask again. Only move to Phase 4 once every item in scope clears the bar.

Example of the shape a questions batch should take:

```
Before I propose anything, a few things I couldn't resolve from the doc or the codebase:

Section 2 (retry behavior)
1. Spec says "retry on failure" but doesn't give a retry count or backoff. Does an
   existing retry pattern elsewhere in the codebase apply here, or is this new?
2. After the final retry fails, is the user notified, silently logged, or something else?

Section 4 (permissions)
3. "Only the owner can archive" — does "owner" mean the record's creator, or anyone
   with the Owner role? The codebase has both concepts and they're not the same set.
```

---

### 7. Phase 4: Writing the Proposal

Once every item in the current scope clears the clarity bar, write the proposal. For each item, cover:

- **What it is** — a short label for the item (used as a heading).
- **Type** — feature gap, bug, missing test coverage, ambiguity that got resolved, spec/implementation mismatch, or whatever actually fits. Don't force a category that doesn't apply.
- **Current state** — what exists today, stated plainly.
- **Gap** — what the document expects that isn't currently true.
- **Proposed fix** — specific enough to hand to an implementer without further discussion. Not a full implementation plan (that's Section 10, and it's internal), just a clear statement of the approach.
- **Touches** — the files, modules, or areas this is expected to affect, as best known from Phase 1's exploration.

Keep each item tight. One paragraph of reasoning is usually enough; this is a proposal to review and approve, not a design document.

If the scoped pass turned up multiple distinct items, all of them go into the same proposal (see Section 8), each as its own numbered entry.

---

### 8. Phase 5: Saving the Proposal as Documentation

Every proposal gets saved as a markdown file, so it can be revisited without re-deriving it from chat history. This happens automatically as part of producing the proposal, it isn't something the user needs to separately ask for.

#### 8.1 Finding or creating the docs directory

In order of preference:
1. If the document being reviewed already lives inside an existing docs tree (for example, it was found at `dev/docs/specs/...` or `docs/specs/...`), use that tree's root as the base, don't create a second one elsewhere.
2. Otherwise, look for a top-level directory using a common convention: `docs/`, `documentation/`, `Documentation/`, `dev/docs/`.
3. If none of those exist, create `docs/` at the repository root.

#### 8.2 Folder structure

```
<docs-root>/
  doc-review/
    2026-09/
      23/
        14-32-viewings-observations-review.md
        16-05-auth-flow-review.md
      24/
        09-10-payments-followup-review.md
```

- `doc-review/` — a single folder for everything this skill produces, created once per project.
- `YYYY-MM/` — month folder.
- `DD/` — day folder inside the month folder.
- One file per review session (see 8.3), not per item found within that session.

#### 8.3 File naming

`HH-mm-<short-slug>.md`, using 24-hour local time and a short kebab-case slug describing what was reviewed (derived from the source document's name or topic, not a generic word like "review"). The timestamp prefix keeps files sorted chronologically within a day when there are several passes.

#### 8.4 One file per iteration, not per issue

If a single scoped pass turns up five items, all five go into one file as five numbered entries. A new file is only created for a new invocation of this skill (a new scope, a new document, or a follow-up pass after changes), not for each individual finding.

#### 8.5 File template

```markdown
# Doc Review: <source document name> (<scope reviewed>)

**Date:** <YYYY-MM-DD HH:mm>
**Source:** <path to the document reviewed>
**Scope:** <e.g. "Section 1, lines 1-160" or "full document">
**Status:** Awaiting approval

---

## Clarifying Questions & Answers

<Only included if a Phase 3 round happened for this pass. Otherwise omit this
section entirely rather than leaving it empty.>

**Q1.** <question>
**A1.** <answer>

---

## Findings

### 1. <short title>

- **Type:** <feature gap / bug / missing test coverage / mismatch / etc.>
- **Current state:** <what exists today>
- **Gap:** <what the doc expects that isn't true today>
- **Proposed fix:** <specific, actionable>
- **Touches:** <files/modules/areas>

### 2. <short title>

- **Type:** ...
- **Current state:** ...
- **Gap:** ...
- **Proposed fix:** ...
- **Touches:** ...

---

## Approval

- [ ] Item 1 approved
- [ ] Item 2 approved

<Update this section in place once the user responds. If only some items are
approved, note that here rather than treating the whole file as resolved.>
```

---

### 9. Phase 6: Waiting for Approval

Nothing in the proposal gets implemented until the user explicitly approves it. "Looks good" or a direct "go ahead" counts; silence, or the user moving on to another topic, does not.

If the user approves only some items, update the file's approval checklist to reflect exactly which ones, and only proceed to Section 10 for those. Items not approved stay open in the file for a later pass.

If the user asks for changes to the proposal itself before approving, treat that as a return to Phase 4: revise the relevant entries, update the same file (don't create a new one for a revision of the same session), and present it again.

---

### 10. Phase 7: Handoff to Implementation

Once an item is approved, build a step-by-step implementation plan. This plan is internal: it does not get written to a file or shown to the user as a deliverable. Once the plan is clear, start implementing directly.

During implementation:
- Follow whatever standards, rules, or conventions files already exist in that specific project (naming varies by project: `project-rules.md`, `typescript-standards.md`, `CONTRIBUTING.md`, a `.cursor/rules/` directory, or whatever else is present). Those are provided separately and take precedence over anything not explicitly covered here.
- Where no project-specific rule covers something, follow general industry best practice for the language and framework in use.
- Actively avoid known anti-patterns for the stack in question, don't just avoid violating an explicit rule.
- Never cite this document as the reason for an implementation choice. This skill's authority ends at "the proposal is approved." It has no opinion on code style, architecture, or patterns, and should not be treated as if it does.

---

### 11. Multiple Findings & Parallel Work

Because a single scoped pass can turn up several unrelated items, and because those items are often handed to separate agents to work in parallel, each entry in the Findings section (Section 8.5) must be self-contained:

- A reader should be able to take just that one numbered entry, plus the codebase itself, and act on it without needing to read the other entries in the same file.
- Don't reference "see item 2" or otherwise create cross-dependencies between entries unless the items are genuinely dependent on each other, in which case say so explicitly ("depends on item 2 being resolved first") rather than leaving it implicit.
- The approval checklist (Section 8.5) being per-item, not per-file, is what makes partial approval and parallel dispatch possible. Keep it that way even when every item ends up approved at once.

---

### 12. Anti-Patterns to Avoid

```
❌ Applying this skill's workflow just because a spec/test doc is present in context
✅ Only run this flow when explicitly invoked (Section 1)

❌ Proposing a fix for the items you're confident about while silently skipping the
   unclear ones in the same pass
✅ The whole pass waits until every item in scope clears the clarity bar (Section 6)

❌ Asking one clarifying question, waiting for an answer, then asking the next
✅ Batch every open question into a single message (Section 6)

❌ Filling a gap with a reasonable-sounding guess and labeling it an "assumption"
   instead of asking
✅ If it's not stated and can't be verified in the codebase, it's a question, not
   an assumption (Section 5)

❌ Creating a separate markdown file for each finding in the same review pass
✅ One file per pass, every finding as a numbered entry inside it (Section 8.4)

❌ Writing and sharing a full implementation plan as a deliverable for the user
✅ The plan is internal; only the proposal and its approval are user-facing (Section 10)

❌ Justifying an implementation decision by citing this skill
✅ Implementation follows the project's own rules and general best practice, this
   skill governs the review-and-propose phase only (Section 10)

❌ Treating "section 2" as "everything up to where I think section 2 probably ends"
✅ Scope follows the document's own structure or the exact range given (Section 2)
```

---

### 13. Quick Reference

| Situation | What to do |
|---|---|
| Skill wasn't explicitly invoked | Don't run the workflow, even if a spec/test doc is in view |
| No scope given | Review the entire document |
| An item's fix requires an assumption not stated anywhere | Ask, don't guess |
| Multiple unrelated things are unclear | Batch all questions into one message, grouped by topic |
| Every item in scope is clear | Move to writing the proposal |
| Proposal is ready | Find/create the docs directory, save under `doc-review/YYYY-MM/DD/` |
| Five items found in one pass | One file, five numbered entries |
| User approves some items, not others | Update the same file's checklist per item, only implement the approved ones |
| Approved item is ready to build | Plan internally, then implement, no plan doc for the user |
| Deciding how to implement something | Defer to the project's own rules files and general best practice, never to this skill |
| Starting a second pass on the same document later | Check `doc-review/` first, don't duplicate a prior review |

---

### 14. Non-Goals

This skill does not:
- Auto-trigger on any document type, ever.
- Limit itself to "issues" or bugs; it applies equally to feature specs, test specs, and general documentation review.
- Produce or maintain a user-facing implementation plan.
- Set or enforce coding standards. It reads them, it doesn't author them.
- Implement anything without an explicit approval step.
- Assume a specific docs folder convention beyond the discovery order in Section 8.1; it adapts to whatever the project already has.


---

## Reference 10 — Y2K Chrome design system

_Source: `docs/design-guidelines/y2k-chrome/y2k-chrome-design-system.md`. Included in full for standalone review._

## Y2K Chrome - Complete Design System
> Version 1.0 - Theme 24 in the catalog - slug `y2k-chrome`

---

### Table of Contents

1. [System Overview](#1-system-overview)
2. [CSS Custom Properties - Master Token Sheet](#2-css-custom-properties--master-token-sheet)
3. [Color Palette](#3-color-palette)
4. [Typography System](#4-typography-system)
5. [Spacing System](#5-spacing-system)
6. [Border Radius System](#6-border-radius-system)
7. [Shadow & Elevation System](#7-shadow--elevation-system)
8. [Component Specifications](#8-component-specifications)
9. [Layout & Grid System](#9-layout--grid-system)
10. [Animation & Transition Tokens](#10-animation--transition-tokens)
11. [Z-Index System](#11-z-index-system)
12. [Breakpoints](#12-breakpoints)
13. [Icon System](#13-icon-system)
14. [State Definitions](#14-state-definitions)

---

### 1. System Overview

**Design Language:** Y2K Chrome
**Mode:** Light
**Typefaces:** Unbounded + Work Sans
**Personality:** Turn-of-the-millennium chrome: silver gradients, bubblegum pink and cyber blue accents, pill shapes and glossy bubbles.
**Best Suited For:** Music and fashion launches, nostalgic tech, playful e-commerce, fan and community sites

**Core Principles:**
- Chrome gradients on actions, flat silver on panels.
- Pills everywhere: buttons, inputs and badges round fully.
- Pink and blue are accents; the base stays cool silver.
- Unbounded headlines, Work Sans for everything else.

---

### 2. CSS Custom Properties - Master Token Sheet

All tokens are scoped under `[data-ds="y2k-chrome"]`. Nothing is defined at `:root`. The same sheet ships as `tokens.css` in this system's folder.

```css
/*
 * Y2K Chrome - scoped design-system tokens (Theme 24 in catalog).
 * Iridescent metal and bubble UI. Unbounded + Work Sans.
 */

[data-ds="y2k-chrome"] {
  --ds-color-bg-base: #e9e7f5;
  --ds-color-bg-surface: #f4f3fb;
  --ds-color-bg-sunken: #dcdaf0;
  --ds-color-bg-secondary: #dcdaf0;
  --ds-color-bg-overlay: rgba(35,35,51,0.45);

  --ds-color-primary: #8f7bff;
  --ds-color-primary-hover: #7d68f5;
  --ds-color-primary-active: #6b54e8;
  --ds-color-primary-fg: #232333;

  --ds-color-text-primary: #232333;
  --ds-color-text-secondary: #3f3f55;
  --ds-color-text-tertiary: #54546b;
  --ds-color-text-muted: #5c5c78;
  --ds-color-text-disabled: #9c9cb8;
  --ds-color-text-inverse: #f4f3fb;

  --ds-color-border-light: #c9c9ee;
  --ds-color-border-medium: #b8b8e4;
  --ds-color-border-strong: #8f7bff;

  --ds-color-success: #1b7441;
  --ds-color-success-bg: #d7f2e0;
  --ds-color-warning: #8a5700;
  --ds-color-warning-bg: #fff0cc;
  --ds-color-error: #c0262d;
  --ds-color-error-bg: #fde3e4;
  --ds-color-info: #4a3fd1;
  --ds-color-info-bg: #e3e1fb;

  --ds-font-display: "Unbounded", system-ui, sans-serif;
  --ds-font-body: "Work Sans", system-ui, sans-serif;
  --ds-font-label: "Work Sans", system-ui, sans-serif;
  --ds-label-transform: none;
  --ds-label-tracking: 0.01em;
  --ds-label-weight: 600;
  --ds-heading-tracking: 0;
  --ds-heading-weight: 600;

  --ds-radius-badge: 999px;
  --ds-radius-sm: 10px;
  --ds-radius-md: 9999px;
  --ds-radius-lg: 24px;
  --ds-radius-xl: 28px;
  --ds-radius-full: 9999px;

  --ds-border-width: 1px;

  --ds-shadow-card: 0 18px 40px rgba(120,120,190,0.25);
  --ds-shadow-dropdown: 0 12px 28px rgba(120,120,190,0.28);
  --ds-shadow-modal: 0 24px 56px rgba(120,120,190,0.3);
  --ds-shadow-focus: 0 0 0 3px #b8c0ff;
  --ds-shadow-btn-hover: 0 8px 20px rgba(150,150,220,0.45);

  --ds-btn-text-transform: none;
  --ds-btn-letter-spacing: 0.01em;
  --ds-btn-font-weight: 700;
  --ds-btn-active-transform: scale(0.98);
  --ds-btn-secondary-bg: #232333;
  --ds-btn-secondary-text: #ffc6ff;
  --ds-btn-secondary-border: #232333;
  --ds-btn-secondary-hover-bg: #3a3a52;
  --ds-btn-outline-text: #232333;
  --ds-btn-outline-border: #b8c0ff;
  --ds-btn-outline-hover-bg: rgba(255,255,255,0.6);
  --ds-btn-outline-hover-text: #232333;

  --ds-table-header-bg: #dcdaf0;
  --ds-table-header-text: #232333;
  --ds-table-header-border-bottom: 1px solid #b8b8e4;
  --ds-table-container-radius: 24px;
  --ds-table-container-border: 1px solid rgba(255,255,255,0.9);

  --ds-focus-ring: 0 0 0 3px #b8c0ff;

  --ds-ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --ds-duration-fast: 120ms;
  --ds-duration-base: 180ms;
  --ds-duration-slow: 280ms;
}

/* Translucent chrome with an inner highlight; gradients run pink-lilac-blue, never neon. */
[data-ds="y2k-chrome"] .ds-btn-primary { background: linear-gradient(120deg, #b8c0ff, #ffc6ff); border: 1px solid rgba(255,255,255,0.9); color: #232333; }
[data-ds="y2k-chrome"] .ds-card, [data-ds="y2k-chrome"] .ds-modal { background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55)); border: 1px solid rgba(255,255,255,0.9); box-shadow: var(--ds-shadow-card), inset 0 1px 0 #ffffff; }
[data-ds="y2k-chrome"] .ds-bento-card { border-radius: 24px; }
[data-ds="y2k-chrome"] .ds-bento-scope { background: linear-gradient(150deg, #e9e7f5 0%, #d7e4f5 45%, #f6e3f0 100%); }
[data-ds="y2k-chrome"] .ds-bento-title { background: linear-gradient(100deg, #7b8cff, #d67bd8, #7b8cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
```

---

### 3. Color Palette

#### 3.1 Core Colors

|Role|Token|Value|Usage|
|---|---|---|---|
|bg-base|`--ds-color-bg-base`|`#e9e7f5`|Page base|
|bg-surface|`--ds-color-bg-surface`|`#f4f3fb`|Cards and panels|
|bg-sunken|`--ds-color-bg-sunken`|`#dcdaf0`|Inputs, wells|
|primary|`--ds-color-primary`|`#8f7bff`|Chrome action gradient base|
|secondary-bg|`--ds-btn-secondary-bg`|`#232333`|Bubblegum secondary|
|text-primary|`--ds-color-text-primary`|`#232333`|Body text|
|text-secondary|`--ds-color-text-secondary`|`#3f3f55`|Supporting text|

#### 3.2 Semantic Colors

|State|Token|Ink|Background|
|---|---|---|---|
|success|`--ds-color-success`|`#1b7441`|`#d7f2e0`|
|warning|`--ds-color-warning`|`#8a5700`|`#fff0cc`|
|error|`--ds-color-error`|`#c0262d`|`#fde3e4`|
|info|`--ds-color-info`|`#4a3fd1`|`#e3e1fb`|

#### 3.3 Contrast Checks

- Body text `#23242e` on `#f4f5fb` base: 13.5:1.
- Chrome button text `#23242e` on the silver gradient: above 8:1 across the gradient.
- Pink `#ff6ec7` and blue `#5b8cff` appear on fills and badges with dark or white foregrounds, never as body text.

---

### 4. Typography System

#### 4.1 Font Families

|Role|Family|Usage|
|---|---|---|
|Display|Unbounded|Headings, hero titles|
|Body|Work Sans|Body copy, form fields|
|Label|Work Sans|Buttons, badges, labels|

#### 4.2 Type Scale


| Token | Size | Weight | Tracking | Use |
|---|---|---|---|---|
| Display | 48-64px | 400 | 0 | Hero title |
| H1 | 36px | 400 | 0 | Page title |
| H2 | 28px | 400 | 0 | Section title |
| H3 | 20px | 400 | 0 | Card title |
| Body | 16px | 400 | 0 | Paragraphs |
| Label | 13px | 700 | 0.01em | Buttons, badges |

Lilita One ships in a single weight (400). Its drawn strokes are already heavy - never synthesise a bolder weight.

#### 4.3 Google Fonts Import Block

Fonts load through the shared `DESIGN_SYSTEM_FONTS_URL` in `app/design-systems/fonts.ts`. Never `@import` a remote font URL from CSS; the production bundler drops it.

---

### 5. Spacing System


Base unit: 4px. Use only these steps.

| Token | Value |
|---|---|
| space-1 | 4px |
| space-2 | 8px |
| space-3 | 12px |
| space-4 | 16px |
| space-6 | 24px |
| space-8 | 32px |
| space-12 | 48px |
| space-16 | 64px |

Component padding: card 22px, button 11px 22px (md), input 11px 14px, badge 3px 12px.

---

---

### 6. Border Radius System

|Token|Value|
|---|---|
|badge|`999px`|
|sm|`10px`|
|md|`9999px`|
|lg|`24px`|
|xl|`28px`|
|full|`9999px`|

Full pills for controls and badges; cards get 24px bubbles. The scoped `.ds-bento-card` override pins bento corners to 16px so the pill radius cannot clip content.

---

### 7. Shadow & Elevation System

|Token|Value|
|---|---|
|card|`0 18px 40px rgba(120,120,190,0.25)`|
|dropdown|`0 12px 28px rgba(120,120,190,0.28)`|
|modal|`0 24px 56px rgba(120,120,190,0.3)`|
|focus|`0 0 0 3px #b8c0ff`|
|btn-hover|`0 8px 20px rgba(150,150,220,0.45)`|

---

### 8. Component Specifications

#### 8.1 Buttons

Silver-to-white chrome gradient with a cool border; hover brightens, active presses flat. Secondary is bubblegum pink.

#### 8.2 Form Inputs

Pill fields on the sunken tint; focus ring is cyber blue at 40% alpha.

#### 8.3 Labels

Work Sans 600, sentence case, cool grey.

#### 8.4 Card / Surface

Glossy white bubble at 24px radius with a soft blue-grey shadow.

#### 8.5 Badge

Pink or blue pill, uppercase, white or dark text by fill.

#### 8.6 Checkbox, Radio and Switch

Round checkboxes and radios; the check dot is chrome gradient.

#### 8.7 Table

Header row on the sunken silver tint; pill-radius container.

#### 8.8 Dropdown Panel

24px bubble panel with the soft card shadow.

---

### 9. Layout & Grid System


| Container | Max width |
|---|---|
| Narrow (forms, articles) | 640px |
| Default | 1040px |
| Wide (dashboards) | 1280px |

12-column grid, 24px gutters on desktop, 16px on mobile.

---

---

### 10. Animation & Transition Tokens


| Token | Value |
|---|---|
| Easing | `cubic-bezier(0.4, 0, 0.2, 1)` |
| Fast | 0ms |
| Base | 120ms |
| Slow | 200ms |

Animate colour, transform, opacity and shadow only. Never animate layout properties.

---

---

### 11. Z-Index System


| Layer | Value |
|---|---|
| Base | 0 |
| Sticky header | 10 |
| Dropdown | 20 |
| Modal backdrop | 40 |
| Modal | 50 |
| Toast | 60 |

---

---

### 12. Breakpoints


| Name | Min width |
|---|---|
| sm | 640px |
| md | 768px |
| lg | 1024px |
| xl | 1280px |

Page padding: 16px below md, 24px at md, 32px at lg and up.

---

---

### 13. Icon System

Icons use 2px strokes with round caps, matching the pill geometry. Sizes follow the shared scale: 16px inline, 20px in buttons, 24px standalone.

---

### 14. State Definitions

- Hover uses the `--ds-color-primary-hover` and `--ds-shadow-btn-hover` tokens.
- Active applies `--ds-btn-active-transform` and the `--ds-color-primary-active` tone.
- Focus always renders `--ds-focus-ring`; never remove it without a visible replacement.
- Disabled drops to 50% opacity with `not-allowed` cursor and no shadow.


---

## Reference 11 — Y2K Chrome construction instructions

_Source: `docs/design-guidelines/y2k-chrome/y2k-chrome-instructions.md`. Included in full for standalone review._

## Y2K Chrome - Construction Instructions & AI Prompting Guide
> Version 1.0 - Theme 24 in the catalog - slug `y2k-chrome`

---

### Table of Contents

1. [Design Philosophy & Core Rules](#1-design-philosophy--core-rules)
2. [Font Law](#2-font-law)
3. [Color Application Rules](#3-color-application-rules)
4. [Border Radius Decision Framework](#4-border-radius-decision-framework)
5. [Shadow & Elevation Rules](#5-shadow--elevation-rules)
6. [Component Construction Guides](#6-component-construction-guides)
7. [Interactive States](#7-interactive-states)
8. [Layout Rules](#8-layout-rules)
9. [Anti-Patterns](#9-anti-patterns)
10. [AI Prompting Guide](#10-ai-prompting-guide)
11. [Pre-Ship Checklist](#11-pre-ship-checklist)

---

### 1. Design Philosophy & Core Rules

Turn-of-the-millennium chrome: silver gradients, bubblegum pink and cyber blue accents, pill shapes and glossy bubbles.

#### The Rules
1. Chrome gradients on actions, flat silver on panels.
2. Pills everywhere: buttons, inputs and badges round fully.
3. Pink and blue are accents; the base stays cool silver.
4. Unbounded headlines, Work Sans for everything else.
5. Bento and table containers pin their own radius, never inherit the pill.

---

### 2. Font Law

Use only Unbounded and Work Sans. Fallback stacks end in `system-ui, sans-serif`.

- Display and headings: Unbounded, per the type scale in the design-system doc.
- Body: Work Sans.
- Labels, buttons and badges: Work Sans.
- Never mix in a font from another system. If a glyph is missing, fall back, do not swap families.

---

### 3. Color Application Rules

|Use|Token|Value|
|---|---|---|
|Page base|`--ds-color-bg-base`|`#e9e7f5`|
|Cards and panels|`--ds-color-bg-surface`|`#f4f3fb`|
|Inputs, wells|`--ds-color-bg-sunken`|`#dcdaf0`|
|Chrome action gradient base|`--ds-color-primary`|`#8f7bff`|
|Bubblegum secondary|`--ds-btn-secondary-bg`|`#232333`|
|Body text|`--ds-color-text-primary`|`#232333`|
|Supporting text|`--ds-color-text-secondary`|`#3f3f55`|

- Body text `#23242e` on `#f4f5fb` base: 13.5:1.
- Chrome button text `#23242e` on the silver gradient: above 8:1 across the gradient.
- Pink `#ff6ec7` and blue `#5b8cff` appear on fills and badges with dark or white foregrounds, never as body text.
- Never type a raw hex or font name in a component. Read the token.

---

### 4. Border Radius Decision Framework

- `--ds-radius-badge` = `999px`
- `--ds-radius-sm` = `10px`
- `--ds-radius-md` = `9999px`
- `--ds-radius-lg` = `24px`
- `--ds-radius-xl` = `28px`
- `--ds-radius-full` = `9999px`

Full pills for controls and badges; cards get 24px bubbles. The scoped `.ds-bento-card` override pins bento corners to 16px so the pill radius cannot clip content.

---

### 5. Shadow & Elevation Rules

- `--ds-shadow-card` = `0 18px 40px rgba(120,120,190,0.25)`
- `--ds-shadow-dropdown` = `0 12px 28px rgba(120,120,190,0.28)`
- `--ds-shadow-modal` = `0 24px 56px rgba(120,120,190,0.3)`
- `--ds-shadow-focus` = `0 0 0 3px #b8c0ff`
- `--ds-shadow-btn-hover` = `0 8px 20px rgba(150,150,220,0.45)`

---

### 6. Component Construction Guides

- **Buttons:** Silver-to-white chrome gradient with a cool border; hover brightens, active presses flat. Secondary is bubblegum pink.
- **Inputs:** Pill fields on the sunken tint; focus ring is cyber blue at 40% alpha.
- **Cards:** Glossy white bubble at 24px radius with a soft blue-grey shadow.
- **Badges:** Pink or blue pill, uppercase, white or dark text by fill.
- **Tables:** Header row on the sunken silver tint; pill-radius container.

---

### 7. Interactive States

- Hover: `--ds-color-primary-hover` fill plus `--ds-shadow-btn-hover`.
- Active: `--ds-btn-active-transform` with the active tone.
- Focus: always `--ds-focus-ring`, visible on every interactive element.
- Disabled: 50% opacity, no shadow, `not-allowed` cursor.

---

### 8. Layout Rules


- Max content width 1040px, 24px gutters.
- Stack to one column below 768px.
- Keep one primary action per section and align it to the same edge as the heading.

---

---

### 9. Anti-Patterns

- Gradients on panels. Chrome belongs to actions only.
- Square buttons. Everything interactive is a pill.
- Pink or blue body text on silver. Accents stay on fills.
- Letting the pill radius reach cards that hold dense content.
- Heavy ink borders. Y2K is borderless gloss.
- Serif or monospace fonts. This is Unbounded and Work Sans only.

---

### 10. AI Prompting Guide

Ask for the system by name and slug, then state the surfaces you need. The tokens do the rest.

> Build a product page in the Y2K Chrome system: cool silver base, chrome-gradient primary pill button, bubblegum pink secondary, Unbounded hero heading, glossy 24px cards, cyber blue focus rings.

Always reference tokens (`--ds-*`) in generated code, never raw values. Keep overrides scoped under `[data-ds="y2k-chrome"]`.

---

### 11. Pre-Ship Checklist

- [ ] Every colour, font, radius and shadow reads from a `--ds-*` token.
- [ ] Overrides are scoped under `[data-ds="y2k-chrome"]` only.
- [ ] Fonts load via `DESIGN_SYSTEM_FONTS_URL`, not a CSS `@import`.
- [ ] Text contrast passes 4.5:1 (checked in section 3.3 of the design-system doc).
- [ ] Focus rings visible on every interactive element.
- [ ] Chrome gradients on actions, flat silver on panels.
- [ ] Pills everywhere: buttons, inputs and badges round fully.
- [ ] Cards, tables and bento containers render without clipped corners.
- [ ] Build, lint, typecheck and `verify:seo` pass.


---

## Reference 12 — Y2K Chrome master CSS tokens

_Source: `docs/design-guidelines/y2k-chrome/tokens.css`. Use these exact scoped tokens for the design system._

```css
/*
 * Y2K Chrome - scoped design-system tokens (Theme 24 in catalog).
 * Iridescent metal and bubble UI. Unbounded + Work Sans.
 */

[data-ds="y2k-chrome"] {
  --ds-color-bg-base: #e9e7f5;
  --ds-color-bg-surface: #f4f3fb;
  --ds-color-bg-sunken: #dcdaf0;
  --ds-color-bg-secondary: #dcdaf0;
  --ds-color-bg-overlay: rgba(35,35,51,0.45);

  --ds-color-primary: #8f7bff;
  --ds-color-primary-hover: #7d68f5;
  --ds-color-primary-active: #6b54e8;
  --ds-color-primary-fg: #232333;

  --ds-color-text-primary: #232333;
  --ds-color-text-secondary: #3f3f55;
  --ds-color-text-tertiary: #54546b;
  --ds-color-text-muted: #5c5c78;
  --ds-color-text-disabled: #9c9cb8;
  --ds-color-text-inverse: #f4f3fb;

  --ds-color-border-light: #c9c9ee;
  --ds-color-border-medium: #b8b8e4;
  --ds-color-border-strong: #8f7bff;

  --ds-color-success: #1b7441;
  --ds-color-success-bg: #d7f2e0;
  --ds-color-warning: #8a5700;
  --ds-color-warning-bg: #fff0cc;
  --ds-color-error: #c0262d;
  --ds-color-error-bg: #fde3e4;
  --ds-color-info: #4a3fd1;
  --ds-color-info-bg: #e3e1fb;

  --ds-font-display: "Unbounded", system-ui, sans-serif;
  --ds-font-body: "Work Sans", system-ui, sans-serif;
  --ds-font-label: "Work Sans", system-ui, sans-serif;
  --ds-label-transform: none;
  --ds-label-tracking: 0.01em;
  --ds-label-weight: 600;
  --ds-heading-tracking: 0;
  --ds-heading-weight: 600;

  --ds-radius-badge: 999px;
  --ds-radius-sm: 10px;
  --ds-radius-md: 9999px;
  --ds-radius-lg: 24px;
  --ds-radius-xl: 28px;
  --ds-radius-full: 9999px;

  --ds-border-width: 1px;

  --ds-shadow-card: 0 18px 40px rgba(120,120,190,0.25);
  --ds-shadow-dropdown: 0 12px 28px rgba(120,120,190,0.28);
  --ds-shadow-modal: 0 24px 56px rgba(120,120,190,0.3);
  --ds-shadow-focus: 0 0 0 3px #b8c0ff;
  --ds-shadow-btn-hover: 0 8px 20px rgba(150,150,220,0.45);

  --ds-btn-text-transform: none;
  --ds-btn-letter-spacing: 0.01em;
  --ds-btn-font-weight: 700;
  --ds-btn-active-transform: scale(0.98);
  --ds-btn-secondary-bg: #232333;
  --ds-btn-secondary-text: #ffc6ff;
  --ds-btn-secondary-border: #232333;
  --ds-btn-secondary-hover-bg: #3a3a52;
  --ds-btn-outline-text: #232333;
  --ds-btn-outline-border: #b8c0ff;
  --ds-btn-outline-hover-bg: rgba(255,255,255,0.6);
  --ds-btn-outline-hover-text: #232333;

  --ds-table-header-bg: #dcdaf0;
  --ds-table-header-text: #232333;
  --ds-table-header-border-bottom: 1px solid #b8b8e4;
  --ds-table-container-radius: 24px;
  --ds-table-container-border: 1px solid rgba(255,255,255,0.9);

  --ds-focus-ring: 0 0 0 3px #b8c0ff;

  --ds-ease-standard: cubic-bezier(0.16, 1, 0.3, 1);
  --ds-duration-fast: 120ms;
  --ds-duration-base: 180ms;
  --ds-duration-slow: 280ms;
}

/* Translucent chrome with an inner highlight; gradients run pink-lilac-blue, never neon. */
[data-ds="y2k-chrome"] .ds-btn-primary { background: linear-gradient(120deg, #b8c0ff, #ffc6ff); border: 1px solid rgba(255,255,255,0.9); color: #232333; }
[data-ds="y2k-chrome"] .ds-card, [data-ds="y2k-chrome"] .ds-modal { background: linear-gradient(160deg, rgba(255,255,255,0.85), rgba(255,255,255,0.55)); border: 1px solid rgba(255,255,255,0.9); box-shadow: var(--ds-shadow-card), inset 0 1px 0 #ffffff; }
[data-ds="y2k-chrome"] .ds-bento-card { border-radius: 24px; }
[data-ds="y2k-chrome"] .ds-bento-scope { background: linear-gradient(150deg, #e9e7f5 0%, #d7e4f5 45%, #f6e3f0 100%); }
[data-ds="y2k-chrome"] .ds-bento-title { background: linear-gradient(100deg, #7b8cff, #d67bd8, #7b8cff); -webkit-background-clip: text; background-clip: text; color: transparent; }
```
