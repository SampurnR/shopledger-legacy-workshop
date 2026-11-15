# Workshop submission: Ticket 2

Public fork: https://github.com/Ibrahim99575/shopledger-legacy-workshop

Fixed branch: https://github.com/Ibrahim99575/shopledger-legacy-workshop/tree/fix/inventory-stock-restoration

Pull request: https://github.com/SampurnR/shopledger-legacy-workshop/pull/8

The PR targets the original workshop repository's `main` branch and remains open
and unmerged. The fork's `main` remains the workshop baseline; the completed fix
is on `fix/inventory-stock-restoration`.

## Checkpoint 1 Codex Screenshot: upload an image

File: `docs/evidence/cp1-read-only-output.png`.

This image is a browser rendering of the recorded Codex explanation. It shows the
folder name, read-only mode, module map, checkout flow, confirmed risks, and
separate `I am sure` / `I suspect` sections. It is not a capture of the Codex app
interface. If the organizer specifically requires the Codex interface, capture
the CP1 explanation in the conversation or open `docs/01-read-only-analysis.md`
in Codex and capture its explanation instead. Do not mislabel the exported image.

## Checkpoint 2 Codex Output: paste this

```text
Created and verified one architecture diagram of ShopLedger, including the browser UI, server.js, all four routers in routes/, all ten modules in lib/, config.js, data/db.json, and the order-placement flow. Labels refer only to existing components. The editable diagram is saved in docs/architecture.svg, with a PNG export for viewing.

Diagram: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/architecture.svg
Screenshot: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/evidence/cp2-architecture.png
```

## AGENTS.md file: upload a PDF or document

Upload **`output/pdf/AGENTS.pdf`**. This two-page PDF contains the actual repository
`AGENTS.md` instructions: stack, module map, commands, characterization tests first,
ticket scope, no real database access in tests, and no new dependencies.

Keep the original `AGENTS.md` in the repository. The PDF is supplied because the
form accepts PDF/document uploads rather than Markdown.

## Checkpoint 3 Codex Output: paste this

```text
Selected Ticket 2: last sellable-unit sales and cancellation stock restoration.

Before changing application behavior, added 21 characterization tests using node:test and node:assert/strict. Files: test/inventory.characterization.test.js and test/orders.cancellation.test.js. Four tests explicitly named CURRENT BEHAVIOUR captured the existing bugs. All fixtures were created in memory; tests never read or wrote data/db.json, and no dependencies were added.

Command: node --test
Baseline result: 21 passed, 0 failed.
Tests-first commit: 162dc3f.

Output: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/evidence/cp3-characterization.txt
Screenshot: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/evidence/cp3-characterization.png
```

## Checkpoint 4 Codex Output: paste this

```text
Reproduced Ticket 2 through the running app in temporary project copies. Before the fix, buying the last ghee jar returned HTTP 409 and cancelling pending order #1007 changed its status without restoring physical stock.

Added regression tests before the fix: node --test reported 22 passed and 6 failed (commit 84b4966). Then changed only lib/inventory.js: reject quantities greater than sellable stock rather than equal to it; restore cancelled units using order-line id; add quantities back to physical stock without changing wholesale reservations. Updated the four characterization tests that had recorded those bugs.

After the fix, node --test passed all 28 tests. Browser verification confirmed last-unit ghee and chilli sales succeed, the three reserved chilli packets remain protected, and cancelling #1007 restores ghee from 1 to 3 and sunflower oil from 22 to 24 while preserving four reserved oil bottles. The original data/db.json stayed byte-for-byte unchanged. Manual diff, caller, and boundary-case review found no blocking findings; it is documented as a manual review, not an automated /review run.

Red/green and app evidence: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/evidence/cp4-red-green-and-app.png
Full reproduction and review: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/04-fix-and-review.md
```

## Checkpoint 5 Codex Output: paste this

```text
Committed the tests-first history, Ticket 2 fix, documentation, and submission evidence on fix/inventory-stock-restoration and pushed it to my public fork.

PR: https://github.com/SampurnR/shopledger-legacy-workshop/pull/8
Title: Fix last-unit sales and restore stock on order cancellation
Base: SampurnR/shopledger-legacy-workshop:main
Head: Ibrahim99575:fix/inventory-stock-restoration
The PR body starts with Fixes #2 and describes the tests added first, cause, fix, test result, and manual review. The PR is open and unmerged. Posted the requested @codex review comment. The bot requested Codex/GitHub account setup rather than reviewing the code, so the documented manual review is supplied using the workshop's allowed fallback.

Review request: https://github.com/SampurnR/shopledger-legacy-workshop/pull/8#issuecomment-6890382731
Fork: https://github.com/Ibrahim99575/shopledger-legacy-workshop
PR screenshot: https://github.com/Ibrahim99575/shopledger-legacy-workshop/blob/fix/inventory-stock-restoration/docs/evidence/cp5-pull-request.png
```

## Github Repo Link (Make sure it is Public): paste this

```text
https://github.com/Ibrahim99575/shopledger-legacy-workshop
```

The repository is public. The fix is on the linked branch and in PR #8; it is
deliberately not merged into main.

## Feedback: optional draft to review or leave blank

```text
The checkpoints provided a clear way to understand unfamiliar code, capture existing behavior, and verify a small fix before opening a pull request. Showing a failing regression followed by passing tests and browser evidence made the result easier to review.
```

## Evidence file map

| Checkpoint | File |
| --- | --- |
| CP1 | `docs/evidence/cp1-read-only-output.png` (exported explanation; see qualification above) |
| CP2 | `docs/evidence/cp2-architecture.png` and `docs/architecture.svg` |
| CP3 | `docs/evidence/cp3-characterization.png` |
| CP4 | `docs/evidence/cp4-red-green-and-app.png`, plus individual full-resolution app screenshots |
| CP5 | `docs/evidence/cp5-pull-request.png` |
| AGENTS upload | `output/pdf/AGENTS.pdf` |

All upload images and the PDF are below the form's 10 MB per-file limit. Source
instructions, test files, raw logs, and review details are included in the repository.
No tokens or personal email addresses appear in the supplied checkpoint images.
