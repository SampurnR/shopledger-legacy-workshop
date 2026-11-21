# Historical pre-CP5 local verification — Ticket 1

This records the earlier local-only checkpoint. Update: all seven PNG images now
exist and have been inspected. GitHub authentication as PrabhasMahanti123 is
verified and the authorized public fork has been created. Upstream issue #1 is
confirmed. The PR targets SampurnR/shopledger-legacy-workshop:main, not fork main.
See evidence/README.md for image provenance and cp5-evidence.md for final verified
publication details once created. Statements below describe the earlier snapshot.

Local CP1–CP4 implementation is complete. Screenshots and CP5 remain pending.

## Result

- Final `node --test`: exit 0, 23 passing entries (22 assertion tests and
  one discovered fixture module), 0 failures. Raw log: final-test-output.txt.
- Temporary-app HTTP verification: 7/8 mismatches before, 0/8 after; new SAVE10
  order succeeds (201) and its invoice matches. No temporary server left running.
- Only production change: lib/invoice.js, 21 added / 32 removed lines.
- Tracked data/db.json unchanged versus HEAD and starting SHA256.
- Existing package-lock.json unchanged, untracked, not staged or committed.
- git diff --check clean. Nothing staged, committed or pushed.

## Complete diff summary including new untracked files

Modified:
- lib/invoice.js — use customer-billed pricing for invoice totals and rows.

Added:
- AGENTS.md — actual stack/map/commands and the four working rules.
- test/fixtures/invoice-orders.js — explicit in-memory fixtures.
- test/invoice-characterization.test.js — original baseline and intentional updates.
- test/invoice-correctness.test.js — regression, rendering, boundaries, reconciliation.
- docs/architecture.svg — one architecture diagram.
- docs/cp1-explanation.md
- docs/cp2-evidence.md
- docs/cp3-evidence.md
- docs/cp3-test-output.txt
- docs/cp3-full-test-output.txt
- docs/cp4-evidence.md
- docs/cp4-failing-test-output.txt
- docs/cp4-passing-test-output.txt
- docs/final-test-output.txt
- docs/reproduce-ticket1.cjs — repeatable temporary-project HTTP reproduction.
- docs/evidence/cp4-before-http.json
- docs/evidence/cp4-after-http.json
- docs/evidence/cp4-before-invoice-1002.html
- docs/evidence/cp4-after-invoice-1002.html
- docs/evidence/README.md — honest manual capture checklist.
- docs/final-local-summary.md — this report.

Pre-existing untracked PDF and package-lock.json are not implementation changes.
No routes, frontend, config.js, package.json, other lib modules or tracked data
were modified. No dependencies installed.

## Current git status

```text
 M lib/invoice.js
?? AGENTS.md
?? "Day One on a Legacy Codebase.pdf"
?? docs/
?? package-lock.json
?? test/
```

Current branch: main. Intended workshop branch: fix/invoice-gst-reconciliation.
No branch or commit created; work remains reviewable in the working tree.

## GitHub handoff

The locally configured origin is the workshop source:
https://github.com/SampurnR/shopledger-legacy-workshop.git
This is not evidence of a user-owned fork. Needed before CP5:
the user's fork URL and actual issue number. GitHub CLI is not on PATH.
GitHub authentication and fork visibility have not been checked; an authenticated
connector, CLI or browser session will be needed for the eventual external step.
No GitHub API/page was contacted. Do not use a guessed issue number.

Push, repository publication and PR creation require the user's explicit approval.
No external action was attempted.

## Evidence limitations

Browser local-file URL policy blocked automatic screenshot capture. No fabricated
PNGs were created. See evidence/README.md for the precise manual capture screens.
The root AGENTS.md also needs a PDF/document export for the form.
The saved before/after invoice HTML files are actual HTTP responses, not live
server links. Temporary server URLs in JSON logs were valid only during each run.
Historical invoices still recalculate using current coupon/tax configuration;
snapshotting that policy remains outside Ticket 1.
