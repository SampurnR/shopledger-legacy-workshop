# CP5 — Verified upstream pull request

Verified on 21 November 2026 using both GitHub's authenticated REST API and the
actual public PR page. No merge action was performed.

- PR URL: https://github.com/SampurnR/shopledger-legacy-workshop/pull/312
- PR number: 312
- Title: Fix invoice GST reconciliation with checkout pricing
- Upstream base repository: https://github.com/SampurnR/shopledger-legacy-workshop
- Target branch: main
- Public fork: https://github.com/PrabhasMahanti123/shopledger-legacy-workshop
- Source branch: fix/invoice-gst-reconciliation
- Full head label: PrabhasMahanti123:fix/invoice-gst-reconciliation
- Pushed branch URL: https://github.com/PrabhasMahanti123/shopledger-legacy-workshop/tree/fix/invoice-gst-reconciliation
- Issue: https://github.com/SampurnR/shopledger-legacy-workshop/issues/1
- Exact first description line: `Fixes #1`
- State verified: open
- merged verified: false
- Implementation commit: 891abb485eb5beaf0f6148fd50df6b112d0e3369
- Commit message: Fix invoice GST reconciliation with checkout pricing

The description uses the required sections, in order: Tests added or updated,
Root cause, Minimal fix, Test result, Data safety, Evidence. The API confirms the
base and head repositories/branches; the public page confirms title, open state,
source/target, issue reference and body. The fork was created under authenticated
PrabhasMahanti123 with private=false and parent SampurnR/shopledger-legacy-workshop.
Source main, fork main and initial local HEAD matched
68c85a9e1cb97c470b4bfd9d1a3f99488cec8639 before the implementation commit.

## Tests and safety

`node --test` passed before committing: 23 entries, 0 failures, no skipped or
cancelled entries (22 assertion tests plus the discovered fixture module).
Actual full post-fix output: cp4-passing-test-output.txt and final-test-output.txt.
Original characterization and failing-before-fix outputs are retained.

Only lib/invoice.js changes in production. Unit tests use in-memory objects.
Temporary-project HTTP reproduction verified seven mismatches before, zero after,
and a successfully placed new SAVE10 order with a matching invoice.
data/db.json is unchanged against the upstream base and original hash:
378042ACAEF84300A04A1B6EA043A3E279ED0969D76DC1F9DEFFD91D095CEB49.
package-lock.json remains untracked and was not committed; its original hash is:
5EDCFA05E7C1312A22A9F9CF16F4DCDAF31602584D063338A1F7F1237308F08F.

Staged diff checks passed. A credential/email scan of all added text files passed.
No new dependencies, credentials, server logs, renderer scripts or workshop PDF
were included. Required historical test/HTTP outputs are evidence, not server logs.
The failure log's blank-line trailing spaces were normalized for Git whitespace
checks; assertion content and results were unchanged. Screenshots preserve the
original rendered output.

## Generated PNG evidence

All are in docs/evidence/final/, valid PNGs, opened and visually inspected, each
under 10 MB. README.md in docs/evidence records precise source provenance.

| Image | Bytes |
| --- | ---: |
| cp1-explanation.png | 487556 |
| cp2-architecture.png | 111124 |
| cp3-tests.png | 71736 |
| cp4-before.png | 54339 |
| cp4-failing-test.png | 196629 |
| cp4-after.png | 147174 |
| cp4-review.png | 341709 |

Generated using installed Playwright + Chrome over an isolated loopback HTTP
server. CP1/CP3/review are clearly identified rendered actual documents/output,
not screenshots of the Codex/terminal interface. Invoice images use actual
pre/post HTTP responses; the after image also includes actual passing tests.
The review image is a historical pre-publication snapshot.
Browser/server were stopped and temporary renderer sources were not committed.

## Changed files

Implementation commit and initial PR API verified these 29 changed files:

- AGENTS.md
- docs/architecture.svg
- docs/cp1-explanation.md
- docs/cp2-evidence.md
- docs/cp3-evidence.md
- docs/cp3-full-test-output.txt
- docs/cp3-test-output.txt
- docs/cp4-evidence.md
- docs/cp4-failing-test-output.txt
- docs/cp4-passing-test-output.txt
- docs/evidence/README.md
- docs/evidence/cp4-after-http.json
- docs/evidence/cp4-after-invoice-1002.html
- docs/evidence/cp4-before-http.json
- docs/evidence/cp4-before-invoice-1002.html
- docs/evidence/final/cp1-explanation.png
- docs/evidence/final/cp2-architecture.png
- docs/evidence/final/cp3-tests.png
- docs/evidence/final/cp4-after.png
- docs/evidence/final/cp4-before.png
- docs/evidence/final/cp4-failing-test.png
- docs/evidence/final/cp4-review.png
- docs/final-local-summary.md
- docs/final-test-output.txt
- docs/reproduce-ticket1.cjs
- lib/invoice.js
- test/fixtures/invoice-orders.js
- test/invoice-characterization.test.js
- test/invoice-correctness.test.js

This CP5 report is added in an evidence-only follow-up commit on the same branch.
The final PR includes this report as a thirtieth file. The implementation commit
above remains the code/test/evidence baseline; the final head SHA can be verified
from the pushed branch. No other production file changes.

## Remaining limitations

The existing npm test script remains a placeholder; use node --test.
Historical invoice policies still use current config as documented in CP4.
Ticket 2 and Ticket 3 are intentionally untouched.
The PR remains open for review and must not be merged as part of this workshop.
