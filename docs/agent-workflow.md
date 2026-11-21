# Design agents around evidence

An agent needs a goal, a bounded set of tools, clear write permissions, an output
contract and a stop condition. Giving it a senior-sounding title is insufficient.
This submission uses those ideas as sequential roles in one Codex session.
Separate subagents were not run; the review is a self-review, not an independent
approval. The same role contracts can support separate agents in a future task.

## The handoff contracts

| Role | May change | Must produce | Gate before handoff |
| --- | --- | --- | --- |
| Explorer | Nothing during CP1 | Module map, execution trace, facts/hypotheses | Confirm correct project and inspect actual code |
| Architecture author | Diagram under `docs/` | Existing components and real order flow | No imaginary services or modules |
| Test author | Fixtures and tests | Passing baseline; then failing correct-behaviour assertions | Original database inaccessible to tests |
| Developer | `lib/invoice.js` for this ticket | Shared-calculator adapter and readable invoice breakdown | Red tests must exist before the fix |
| QA | Tests and evidence | Golden amounts, endpoint results, cart matrix, data hash | All tests pass; publish limitations |
| Reviewer | Review notes, then release metadata | Diff review, risk boundaries, reproduction steps | Review code and evidence; leave PR unmerged |

## Why this approach is useful

**Characterization is a snapshot, not a correctness certificate.** A passing
baseline can describe a broken invoice. That is why bad behaviour was explicitly
named `CURRENT BEHAVIOUR` in commit `c9b2b3b`.

**A test needs an independent answer.** Checking invoice totals against checkout
alone could let a shared bug pass unnoticed. The eight recorded ledger amounts
and hand-calculated tax/coupon examples are golden assertions. The 336-case
matrix adds broad parity checks without claiming those checks prove tax law.

**The safest new calculator is often no new calculator.** Checkout already
contained the intended HSN, coupon and rounding rules. The invoice now adapts
that output rather than duplicating the arithmetic again.

**Evidence is a product deliverable.** Raw command logs, chronological commits
and unchanged database hashes make claims auditable. A designed report can make
evidence readable, but it must not be labelled an actual UI screenshot.

**Use capability boundaries.** The HTTP tests replace `store.read`/`store.write`
with in-memory functions. The original methods are guarded to throw if reached.
Browser demos use disposable copies instead of trusting a reminder not to click.

## Prompts you can reuse

Explorer: "Read-only. Trace the selected operation from browser to persistence.
Separate confirmed facts from hypotheses; identify the production edit boundary."

Test author: "Record current behaviour with built-in tests and independent
fixtures. Mark known bugs CURRENT BEHAVIOUR. Show the passing baseline. Then add
the correct-behaviour regression and show that it fails before editing source."

Developer: "Make the smallest change inside the approved module. Reuse existing
rules. Preserve consumers and explain any intentional test expectation updates."

QA: "Exercise actual HTTP routes with an in-memory store. Include wrong input,
missing records, rounding and coupon boundaries. Verify data integrity. Clearly
state what browser/manual checks have not been performed."

Reviewer: "Read the actual diff and the test oracles. Check that warnings are
still functional, tests cannot touch real data, and the PR does not overclaim."

## Presenting this to a judge

The workshop does not supply a detailed scoring rubric in the provided deck.
These are presentation choices, not official judging criteria:

1. Demonstrate the user-visible failure with a specific order.
2. Show passing characterization tests and the later red regression commit.
3. Explain the duplicated calculation and the small shared-engine fix.
4. Show balanced invoices and unchanged stored charges.
5. Explain tests, edge cases, limitations and the unmerged PR in plain language.

A concise demo is more persuasive when every claim can be traced to evidence.
