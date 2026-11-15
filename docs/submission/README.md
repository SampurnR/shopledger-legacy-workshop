# Ticket 3 final submission

## Links

- Public repository: https://github.com/harshawardhanchitnis/shopledger-legacy-workshop
- Fixed code: https://github.com/harshawardhanchitnis/shopledger-legacy-workshop/tree/fix/order-history-khata
- Pull request: https://github.com/SampurnR/shopledger-legacy-workshop/pull/93
- Official form: https://docs.google.com/forms/d/e/1FAIpQLSe-9xHCHxxNhPG-zA2ePKyc4JSeHlBHJqxwYffznZLi0lO9Dw/viewform

## Fill the form

1. Sign in to Google and complete its email checkbox.
2. Enter your name, phone number and the email used to register on GfG. Participant contact details are intentionally not stored in this public repository.
3. Paste CP1-output.txt into Checkpoint 1 Codex Output.
4. Upload ../evidence/cp1-explanation.jpg into Checkpoint 1 Codex Screenshot (one image, max 10 MB).
5. Paste CP2-output.txt into Checkpoint 2 Codex Output.
6. Upload AGENTS.pdf into the AGENTS.md file field (one PDF/document, max 10 MB). The actual Markdown source remains at repository root.
7. Paste CP3-output.txt, CP4-output.txt and CP5-output.txt into their respective checkpoint fields.
8. Enter the public repository URL above in Github Repo Link. CP5 also provides the exact fixed branch and PR.
9. Feedback is optional. Review and submit, then retain the emailed response copy.

The CP2-CP5 text responses include public links to their screenshots/evidence because the form has no dedicated upload fields for those screenshots. Organisers must confirm if they expect another delivery method. The supplied sources did not state a closing date/time; confirm the cutoff with the form owner. The form has not been submitted on your behalf.

## Evidence provenance

App screenshots and the PR screenshot are direct browser captures. cp1-explanation.jpg is a browser capture of the saved Codex explanation, clearly labelled as a rendered copy, not the desktop chat interface. cp3-characterization.jpg and cp4-tests-red-green.jpg render authentic saved Node output; they are not fabricated terminal images. Raw logs and the separate commits preserve the execution sequence. If organisers require the native Codex chat interface, capture this conversation in addition to these files.

## Files

- CP1-output.txt through CP5-output.txt: ready-to-paste responses.
- AGENTS.pdf: form-compatible upload; same content as AGENTS.md.
- ../architecture.svg: editable architecture picture.
- ../evidence/: checkpoint screenshots, original app captures, raw logs and API observations.
- ../review.md: manual review and the five old-behavior test updates.

Run `node --test` in the repository to reproduce the final 47-test result without dependencies or database access. To inspect the original passing tests use commit 23c8691 in a separate checkout; ed0238d intentionally contains failing regressions. Do not restore those versions into your final working tree.
