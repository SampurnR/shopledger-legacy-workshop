# Commit Message Generator

Generate conventional commit messages that are concise, structured, and consistent.

---

## Format

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

## Types

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

## Examples

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

## Scope Guidelines

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

## What NOT to include (unless asked)

- `Co-authored-by`
- `Signed-off-by`
- `--author` flag
- Commit body / extended description
- Issue/ticket references
- Breaking change footer

---

## Word Count Check

Count every word in `type(scope): description` as one unit. Aim for 8–15 words; hard stop at 20.

✅ `fix(auth): resolve undefined payload in login API response` → 9 words  
❌ `fix(auth): resolve the issue where the API was returning an undefined payload in the login response flow` → 18 words (still ok) but risks verbosity
