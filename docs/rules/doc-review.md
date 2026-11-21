# Doc Review & Proposal Skill

A manually-invoked skill for reviewing a specification, testing, bug, or feature document against the current codebase, surfacing what's unclear or missing, and producing a written proposal before any implementation starts. Project-agnostic: it carries no assumptions about any specific stack, folder layout, or rule set. It is not a coding-standards document, and it does not replace one.

---

## 0. Purpose & How This Document Is Used

This skill is handed a document (or a scoped portion of one) and produces one of two outcomes:

1. A batch of clarifying questions, if the document isn't clear enough to propose a fix without guessing, or
2. A written proposal, saved to disk, describing what was found and how it should be addressed, once it is clear enough.

It never writes implementation code itself. It stops at "here's the problem, here's the proposed fix, waiting on your approval." Once approved, it hands off to implementation, at which point it defers entirely to whatever standards already exist in that project (see Section 10). This document governs the review-and-propose process only, nothing else.

It works on any kind of documentation: a feature spec, a test plan, a bug report, product notes, an audit doc like "here's what's wrong with X." The lens is the same regardless of label: what does this say should be true, what is actually true in the codebase today, and is the gap between the two well-defined enough to act on.

---

## 1. When This Skill Runs

**Manual invocation only. Never auto-applied.**

This skill runs only when one of the following happens:
- The user names it directly ("use doc-review on this," "run doc-review against section 3").
- The user explicitly asks for this kind of review ("check this doc and tell me what's wrong and how you'd fix it," "review this spec and propose a fix," in a way that clearly maps to this workflow).

If a specification or testing document simply appears in a conversation, in an upload, or in the codebase, that is not by itself a trigger. Read it if it's relevant to whatever was actually asked, but do not launch into the clarify-propose-document flow below unless invoked. When in doubt about whether this skill was invoked, ask.

---

## 2. Determining Scope

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

## 3. Workflow Overview

Six phases, always in this order. Do not skip ahead to Phase 4 while still below the clarity bar in Phase 2, and do not start Phase 7 without an explicit approval from Phase 6.

1. **Context gathering** — read the scoped document, then freely explore whatever else is needed.
2. **Clarity assessment** — for everything found, do you actually know enough to propose a specific fix?
3. **Clarifying questions** — if not, stop and ask. Repeat until you do.
4. **Write the proposal** — once clear, describe the problem and the fix for each item.
5. **Save the proposal** — as a markdown file, in a predictable location, so it can be revisited later.
6. **Wait for approval** — nothing gets implemented until the user says go.

Phase 7 (planning and implementation) is described here for completeness but is a separate concern from the review-and-propose flow this document governs; see Section 10.

---

## 4. Phase 1: Context Gathering

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

## 5. Phase 2: Clarity Assessment

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

## 6. Phase 3: Asking Clarifying Questions

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

## 7. Phase 4: Writing the Proposal

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

## 8. Phase 5: Saving the Proposal as Documentation

Every proposal gets saved as a markdown file, so it can be revisited without re-deriving it from chat history. This happens automatically as part of producing the proposal, it isn't something the user needs to separately ask for.

### 8.1 Finding or creating the docs directory

In order of preference:
1. If the document being reviewed already lives inside an existing docs tree (for example, it was found at `dev/docs/specs/...` or `docs/specs/...`), use that tree's root as the base, don't create a second one elsewhere.
2. Otherwise, look for a top-level directory using a common convention: `docs/`, `documentation/`, `Documentation/`, `dev/docs/`.
3. If none of those exist, create `docs/` at the repository root.

### 8.2 Folder structure

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

### 8.3 File naming

`HH-mm-<short-slug>.md`, using 24-hour local time and a short kebab-case slug describing what was reviewed (derived from the source document's name or topic, not a generic word like "review"). The timestamp prefix keeps files sorted chronologically within a day when there are several passes.

### 8.4 One file per iteration, not per issue

If a single scoped pass turns up five items, all five go into one file as five numbered entries. A new file is only created for a new invocation of this skill (a new scope, a new document, or a follow-up pass after changes), not for each individual finding.

### 8.5 File template

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

## 9. Phase 6: Waiting for Approval

Nothing in the proposal gets implemented until the user explicitly approves it. "Looks good" or a direct "go ahead" counts; silence, or the user moving on to another topic, does not.

If the user approves only some items, update the file's approval checklist to reflect exactly which ones, and only proceed to Section 10 for those. Items not approved stay open in the file for a later pass.

If the user asks for changes to the proposal itself before approving, treat that as a return to Phase 4: revise the relevant entries, update the same file (don't create a new one for a revision of the same session), and present it again.

---

## 10. Phase 7: Handoff to Implementation

Once an item is approved, build a step-by-step implementation plan. This plan is internal: it does not get written to a file or shown to the user as a deliverable. Once the plan is clear, start implementing directly.

During implementation:
- Follow whatever standards, rules, or conventions files already exist in that specific project (naming varies by project: `project-rules.md`, `typescript-standards.md`, `CONTRIBUTING.md`, a `.cursor/rules/` directory, or whatever else is present). Those are provided separately and take precedence over anything not explicitly covered here.
- Where no project-specific rule covers something, follow general industry best practice for the language and framework in use.
- Actively avoid known anti-patterns for the stack in question, don't just avoid violating an explicit rule.
- Never cite this document as the reason for an implementation choice. This skill's authority ends at "the proposal is approved." It has no opinion on code style, architecture, or patterns, and should not be treated as if it does.

---

## 11. Multiple Findings & Parallel Work

Because a single scoped pass can turn up several unrelated items, and because those items are often handed to separate agents to work in parallel, each entry in the Findings section (Section 8.5) must be self-contained:

- A reader should be able to take just that one numbered entry, plus the codebase itself, and act on it without needing to read the other entries in the same file.
- Don't reference "see item 2" or otherwise create cross-dependencies between entries unless the items are genuinely dependent on each other, in which case say so explicitly ("depends on item 2 being resolved first") rather than leaving it implicit.
- The approval checklist (Section 8.5) being per-item, not per-file, is what makes partial approval and parallel dispatch possible. Keep it that way even when every item ends up approved at once.

---

## 12. Anti-Patterns to Avoid

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

## 13. Quick Reference

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

## 14. Non-Goals

This skill does not:
- Auto-trigger on any document type, ever.
- Limit itself to "issues" or bugs; it applies equally to feature specs, test specs, and general documentation review.
- Produce or maintain a user-facing implementation plan.
- Set or enforce coding standards. It reads them, it doesn't author them.
- Implement anything without an explicit approval step.
- Assume a specific docs folder convention beyond the discovery order in Section 8.1; it adapts to whatever the project already has.
