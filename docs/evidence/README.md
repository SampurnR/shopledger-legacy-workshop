# Checkpoint image evidence

All seven images in final/ are real full-page screenshots rendered with the
installed Playwright and Chrome in an isolated headless browser. An ephemeral
HTTP server bound to 127.0.0.1 served only selected evidence pages and the SVG.
Both browser and server were stopped. The renderer lives in the OS temporary
directory and is not committed. No dependencies were added or tracked data changed.

| PNG in final/ | Bytes | Actual evidence source and what it proves |
| --- | ---: | --- |
| cp1-explanation.png | 487556 | ../cp1-explanation.md: folder, read-only, module map/order flow, I am sure / I suspect. |
| cp2-architecture.png | 111124 | ../architecture.svg: complete UI, server, all routers/modules, config, data and order flow. |
| cp3-tests.png | 71736 | ../cp3-test-output.txt and documented command: original CURRENT BEHAVIOUR tests, filenames, nine passes. |
| cp4-before.png | 54339 | cp4-before-invoice-1002.html: actual HTTP response, GST 183.60, total 1083.24 and warning against 963.90. |
| cp4-failing-test.png | 196629 | ../cp4-failing-test-output.txt: actual summary and exact #1002/#1004 failure excerpts, with documented command. |
| cp4-after.png | 147174 | cp4-after-invoice-1002.html plus ../cp4-passing-test-output.txt: actual corrected invoice, GST 45.90, total 963.90, no warning and full passing output. |
| cp4-review.png | 341709 | Earlier ../final-local-summary.md plus ../cp4-evidence.md: actual manual review, changed files, passing tests and protected data/lockfile. |

Each PNG was opened, visually inspected, successfully decoded and checked under
10 MB. CP1/CP3/review are browser-rendered source evidence, not captures of the
Codex or terminal UI. The failure image contains clearly labelled unchanged
excerpts, not the entire verbose log. The after image combines real saved invoice
HTML and test output. No mock application screens or invented output were used.

cp4-review.png records the historical pre-publication snapshot, when screenshots
and CP5 were pending. All images now exist; final publication details will be
recorded separately in ../cp5-evidence.md after verification.
Original test logs and HTTP responses remain available.
Customer/shop details in invoices are synthetic fixtures from the public workshop
repository. No personal email, password, token or private credential was added.
