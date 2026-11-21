# AGENTS.md — Project Rules for Codex

This repo's binding agent rules live in `docs/rules/`. Read and follow every file there before planning or changing code. Where a rule file conflicts with a habit or a default, the rule file wins.

## Rule files (all under `docs/rules/`)

| File | Covers |
| --- | --- |
| `typescript-standards.md` | Universal TypeScript rules for every `.ts` / `.tsx` file. Non-negotiable. |
| `backend-folder-structure.md` | Canonical Node.js + Express + Prisma + TypeScript backend layout. |
| `frontend-folder-structure.md` | Canonical Next.js / React folder structure. |
| `api-module-design.md` | 5-file architecture for every backend API module (Express + Prisma + Zod). |
| `api-store-integration.md` | Redux Toolkit + Axios pattern for API and store layers. |
| `test-standards.md` | TDD standards: tests derive from the spec before implementation exists. |
| `comments.md` | The only permitted comment formats. |
| `commit.md` | Conventional commit message format. |
| `doc-review.md` | Doc review and proposal flow before implementation starts. |

## Working agreements

1. Before writing code, open the rule files that cover the area you are touching and follow them exactly.
2. No requirement is done until its tests exist, trace to the spec, and pass (see `docs/rules/test-standards.md`).
3. Commit messages follow `docs/rules/commit.md`.
4. Design guidelines live in `docs/design-guidelines/`; follow anything added there for UI work.
