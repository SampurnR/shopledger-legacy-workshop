# Test-Driven Development Standards

## 0. Purpose & How This Document Is Used

This document is handed to the implementing agent alongside `plan.md` and the feature's specification file, once planning is finished and implementation is about to start. It is the binding rule set for **how tests are designed, written, structured, and reviewed** across this full-stack TypeScript codebase (React/Next.js frontend, NestJS/Node backend, PostgreSQL + MongoDB via Prisma, Redis/BullMQ for queues/jobs).

Binding principle: **no requirement is implementation-complete until its test cases are enumerated, traceable to the spec, written, and passing.** Tests are not an afterthought bolted on to "hit coverage" — they are derived from the spec before the implementation code exists, and they are what proves the implementation satisfies the spec.

This document assumes the agent already has:
- `plan.md` — what is being built and why
- The specification file — functional requirements, acceptance criteria, config/schema shape
- `typescript-standards.md`, `backend-folder-structure.md`, `api-module-design.md`, `api-store-integration.md`, `comment-standards.md` — existing project conventions this document extends, not replaces

---

## 1. Philosophy

### 1.1 What "test-driven" means here

Classic TDD is the red–green–refactor loop: write a failing test for a tiny unit of behavior, write the minimum code to pass it, refactor, repeat. That loop is real and used here for pure logic — validators, parsers, reducers, prompt builders — where there is no I/O and the unit is small enough to hold in your head.

For anything with a database, an external API, or a UI, literal line-by-line red-green-refactor is impractical and not how this project works. Instead this project follows **spec-driven test generation**: the spec is decomposed into requirement IDs, each requirement is decomposed into 2–5 enumerated test cases (see Section 2), and those cases are written as failing tests before the implementation of that unit, then implemented to green. The loop moves at the level of "one requirement" rather than "one line," but the discipline is the same — tests before code, always.

### 1.2 Why this order matters

Writing the test first forces the interface and the expected behavior to be decided before implementation details creep in and start dictating the design. It also produces a naturally traceable test suite: every test exists because of a specific line in the spec, not because someone tried to think of something to test after the fact. When a requirement changes, its test cases change with it, and the mapping is visible in the code, not just in someone's memory.

### 1.3 A requirement is not done until

- The test-case enumeration for its unit(s) exists and cites the requirement ID
- Every enumerated case has real test code
- All of it passes
- Nothing in the default test run touches a real external service
- Comment standards (Section 6) are followed

---

## 2. Test Case Enumeration — the 2–5 Rule, Formalized

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

### 2.1 Where the enumeration lives

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

## 3. Test Structure: AAA and Naming

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

## 4. Test Doubles — Which One, When

Five kinds exist; this project uses four of them deliberately (dummies are avoided — TypeScript's type system generally makes "objects that exist only to satisfy a signature" unnecessary).

| Double | What it does | Verification style | Use when |
|---|---|---|---|
| **Stub** | Returns a canned answer, doesn't care how it's called | State — check the result | Default choice. Feeding a known input to the unit under test. |
| **Fake** | A real, working, lightweight implementation (in-memory DB, in-memory queue) | State | The dependency's *behavior* matters for the test, not just its return value (e.g. testing a repository against fake-but-real query semantics). |
| **Spy** | A stub that also records how it was called | Behavior (light) | Confirming a side-effecting call happened (e.g. "was the email service invoked exactly once") without over-specifying the whole interaction. |
| **Mock** | Pre-programmed with expectations; fails the test if they're not met | Behavior (strict) | Verifying an interaction contract — e.g. "the retry handler must call the provider client with exponential backoff." Use sparingly; mocks couple tests to implementation and make refactors break tests that should have stayed green. |

Default to stubs. Reach for a mock only when the *interaction itself* is the thing being specified, not the result. Never mock the unit under test's own internals — only its collaborators.

---

## 5. The Testing Shape For This Project

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

## 6. Comment Standards Applied to Tests

Use the existing four formats from `comment-standards.md`, applied specifically to test code:

- **Tag-prefixed one-liners** `// [TAG] ...` for inline test notes — e.g. `// [EDGE] empty conversation history`, `// [FLAKY-RISK] uses real Date, see Section 10`
- **Q/A one-liners** `// Q: ... A: ...` for non-obvious assertions — e.g. `// Q: why 3 retries? A: matches provider's documented backoff window`
- **Section-banner** (`// ====`) with a purpose line, required at the top of every test file, stating which module is under test
- **JSDoc blocks** (`@param`/`@returns`/`@throws`) on every test helper, fixture builder, or custom matcher

Every top-level `describe()` opens with the enumeration checklist shown in Section 2.1 — this is a mandatory addition specific to test files, on top of the four general-purpose formats.

---

## 7. Layer-by-Layer: Frontend (React / Next.js)

### 7.1 What belongs at the unit level
Custom hooks with real logic (not thin wrappers over a single API call), pure display-formatting functions, reducers, form-validation logic. Use `@testing-library/react-hooks` patterns or `renderHook` for hooks in isolation.

### 7.2 What belongs at the integration level
Components rendered with their real children, real context providers, and real routing, with only network calls mocked (MSW). This is the majority of frontend test volume. Test the component the way a user encounters it, not the way it's implemented internally.

### 7.3 Rules specific to component tests
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

## 8. Layer-by-Layer: Backend (NestJS / Node)

### 8.1 Unit tests
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

### 8.2 Integration tests
Spin up the real Nest module (controllers + services + real Prisma client) against either a **Testcontainers**-provisioned Postgres instance or an isolated test database/schema, and use Supertest to drive requests through the actual HTTP layer, including guards, pipes, and interceptors. Only the AI/LLM provider client and other genuinely external services are mocked here — the database is real, because a unit test that mocks Prisma cannot catch a bad query, a missing index assumption, or a constraint violation, and those are exactly the defects that show up in production for CRUD-shaped code.

Decision rule for DB testing:
- **Testcontainers** (real Postgres/Mongo in Docker) — default for integration tests. Slower per-run than mocks but catches real query/constraint defects and matches production behavior exactly.
- **Mocked Prisma client** — acceptable only at the unit-test level, for services where the DB call is incidental to the logic actually being tested.
- Each test gets a clean database state — either a transaction that's rolled back after the test, or truncate/reseed in a `beforeEach`. Tests must never depend on data left behind by another test.

### 8.3 Guards, pipes, interceptors, middleware
Each gets its own unit tests independent of any controller — e.g. an `AuthGuard` is tested by calling `canActivate` directly with constructed `ExecutionContext` fixtures for the valid-token, missing-token, expired-token, and wrong-scope cases, not only indirectly through a controller integration test.

---

## 9. AI / LLM-Specific Testing (the part most teams get wrong)

LLM-backed code fails in ways ordinary code doesn't: the same input can validly produce different output every run, the provider can silently change behavior on their end without any change in this repo, and a "wrong" output is often not a crash but a plausible-sounding bad answer. Standard unit-test equality assertions don't work here. This project uses a **three-layer model** for anything that touches the AI provider:

### 9.1 Layer 1 — Unit tests (always mocked, always in the default run)
Test everything *around* the model call, never the model call itself:
- Prompt/message formatting — given inputs, does the constructed prompt have the exact expected structure
- Token counting and truncation logic
- Response parsing — given a fixed provider response payload, is it parsed into the expected shape
- Retry/backoff logic — driven with fake timers (Section 10), never real waits
- Error mapping — provider error codes map to the correct internal error types

The AI client is always a stub or a fake here. No network call ever happens in this layer.

### 9.2 Layer 2 — Integration tests (recorded fixtures, always in the default run)
Test the full request → provider-call → response → persistence cycle against **recorded fixture responses**, not the live provider. Maintain a fixture set per endpoint/use case covering: valid success, empty/null response, malformed/unexpected schema, streaming with a premature termination, timeout, rate-limit (429), and provider error (5xx). These fixtures are checked into the repo and replayed deterministically — the equivalent of VCR-style cassette testing. This layer proves the plumbing works for every failure mode the provider can produce, without needing the provider to actually produce it on demand.

### 9.3 Layer 3 — Evals (live calls, never in the default test run)
A separate, explicitly-invoked suite that calls the real provider against a curated golden dataset, used to catch quality regressions from a prompt change or a provider-side model update. This layer is **not** part of `npm test` and never blocks a normal CI run on every commit — it runs on a schedule or when prompt/model config changes, because it's slow, costs money, and is inherently non-deterministic. Structure eval assertions in three tiers:
- **Deterministic** — exact-match or schema checks (JSON validity, required fields present, response within a length bound). Cheapest, run these first.
- **Rubric-based** — LLM-as-judge scoring against an explicit written rubric, for qualities like tone or relevance that can't be checked with a plain assertion. The judge model's own reliability should be spot-checked against a small human-labeled set before it's trusted as a gate.
- **Composite** — combining multiple metrics into one pass/fail where a single metric would be too noisy alone.

**Hard rule:** no live call to the AI provider is permitted in any test that runs as part of the default `npm test` / CI-on-every-commit pipeline. If a test needs the real model to be meaningful, it belongs in the eval suite, not in unit or integration.

### 9.4 Streaming-specific cases
Any chat/streaming endpoint needs explicit tests for: a complete stream consumed normally, a stream that terminates mid-message, a stream that emits a malformed chunk, a client that disconnects mid-stream (does the server clean up correctly), and a stream that never starts (provider hang) — the last one is verified with fake timers driving the timeout, never a real wait.

### 9.5 Contract validation on AI output
Any structured output expected from the model (function-calling arguments, JSON responses) must be validated against a zod schema at the boundary, and that validation must have its own contract-test cases: valid shape, missing required field, extra unexpected field, wrong type for a field. This is the layer most teams skip, and it's where a silent provider-side format drift turns into a production incident instead of a caught test failure.

---

## 10. Flaky Test Prevention

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

## 11. Test Data Management

- Use factory/builder functions for fixtures (`buildConversationFixture({ overrides })`) rather than copy-pasted literal objects scattered across test files — a factory means a schema change requires one edit, not forty.
- Use a fake-data library (e.g. `@faker-js/faker`) for fields whose exact value doesn't matter, and hardcode only the fields the test actually asserts on — this keeps the reader's attention on what's relevant to the case.
- Factories live alongside the standards docs' existing folder conventions — co-located under a `test-utils` or `fixtures` module per feature, not duplicated per test file.
- Every factory function gets a JSDoc block per the comment standards, since factories are shared test infrastructure, not disposable test-local code.

---

## 12. File & Naming Conventions

- Test files are co-located with the source file they test: `subject.ts` → `subject.test.ts`. Placement within the folder tree otherwise follows `backend-folder-structure.md` — this document governs test *content*, not module layout.
- `describe()` blocks mirror the exact module/class/function name, matching the enumeration comment above them.
- Test names read as a sentence: `it('should <expected behavior> when <condition>')`.
- Fixture and helper files: `*.fixture.ts`, `*.factory.ts`, `*.mock.ts` — the suffix states what the file is for at a glance.
- E2E specs live in their own top-level test directory (not co-located), since they don't map to a single source file.

---

## 13. CI/CD Integration

Pipeline order, fail-fast at every stage:

1. **Static analysis** — `tsc --noEmit` and ESLint. Fails in seconds; no point running anything else if this fails.
2. **Unit tests** — fast, run on every commit, every PR.
3. **Integration tests** — run on every PR; Testcontainers-backed DB tests run here, isolated per CI job so parallel jobs don't collide on the same database.
4. **Contract tests** — run on every PR alongside integration.
5. **E2E tests** — run on every PR against a deployed preview/staging build, or at minimum before merge to the main branch; kept thin deliberately so this stage doesn't become the bottleneck.
6. **Evals** (AI-specific) — run on a schedule (e.g. nightly) and additionally whenever a prompt or model-config file changes, never on every commit.

A PR cannot merge with a red test at any of stages 1–5. Stage 6 failures are surfaced but don't block merge by default — a quality regression is investigated with the urgency of the metric drop, not treated as a merge-blocking hard gate, given its inherent noise.

---

## 14. Coverage Philosophy

Line/branch coverage percentage is a measurement of how much code executed during tests, not a measurement of whether the code was actually verified — a test with no assertions can produce 100% coverage of the code it calls. Chasing a coverage number produces tests that execute code without checking it means anything.

What this project checks instead:
- **Requirement-to-test traceability** (Section 2) — every acceptance criterion in the spec has a corresponding enumerated case with real test code. This is checked by review, not by a coverage tool.
- Coverage percentage is still collected and watched as a *signal*, not a *target* — a module sitting at 20% coverage while its spec has ten acceptance criteria is a red flag worth investigating, but a module at 100% coverage is not automatically considered "well tested."
- For especially critical logic (auth, payment-adjacent, prompt-injection defenses), consider mutation testing (e.g. Stryker) periodically — it verifies tests actually fail when the code is deliberately broken, which line coverage cannot tell you.

---

## 15. Workflow / Order of Operations Per Feature

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

## 16. Definition of Done (per requirement)

- [ ] Case enumeration exists, is checked into the test file, and cites the spec requirement ID
- [ ] Every enumerated case has corresponding test code
- [ ] All tests pass locally and in CI
- [ ] No real external-service calls occur in the default test run (verified — not assumed)
- [ ] AAA structure and naming conventions followed
- [ ] Comment standards followed (section banner, enumeration checklist, tags where relevant)
- [ ] No flakiness-prone pattern introduced (real timers, unseeded randomness, shared mutable state) per Section 10
- [ ] For AI-touching units: mocked unit tests + fixture-based integration tests both present; eval dataset updated if new prompt behavior was introduced

---

## 17. Code Review Checklist For Tests

A reviewer (human or agent) checks a test PR against these questions, not just against "do tests exist":

- Does the enumeration comment match the spec requirement, and does every checkbox have a corresponding test?
- Would this test actually fail if the implementation had a bug in the behavior it claims to verify? (Mentally break the implementation and confirm the test would catch it.)
- Are assertions specific, or would the test pass on a wrong-but-similarly-shaped result?
- Is anything touching a real network, real clock, or real random source that shouldn't be?
- Is a mock being used where a stub would do — is the test coupled to *how* the code calls its dependency when it should only care *what* the code returns?
- For frontend tests: is anything queried by test ID or class name that could instead be queried by role, label, or visible text?
- For DB-touching integration tests: is cleanup between tests guaranteed, or could this test pass/fail depending on execution order?

---

## 18. Anti-Patterns — What Not To Do

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

## 19. Tooling Reference

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

## 20. Appendix: Reference Test File Skeletons

### 20.1 Unit test (pure logic)

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

### 20.2 Integration test (NestJS + real DB via Testcontainers, AI provider mocked)

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

### 20.3 Contract test (AI structured output)

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
