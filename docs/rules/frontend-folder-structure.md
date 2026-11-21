# Frontend Folder Structure

Standardized folder structure for **Next.js** (App Router or Pages Router) and **React** (Vite/CRA) projects. Follow this as the single source of truth when creating, moving, or reviewing files.

---

## Canonical Structure

```
src/
├── app/                        # Next.js App Router ONLY
│   ├── (auth)/                 # Route group — no URL segment
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── register/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          # Shared layout for this group
│   │   └── dashboard/
│   │       └── page.tsx
│   ├── api/                    # API route handlers
│   │   └── auth/
│   │       └── [...nextauth]/
│   │           └── route.ts
│   ├── layout.tsx              # Root layout
│   ├── not-found.tsx
│   └── page.tsx                # Home /
│
├── pages/                      # Next.js Pages Router ONLY (not both)
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth].ts
│   ├── _app.tsx
│   ├── _document.tsx
│   └── index.tsx
│
├── components/
│   ├── ui/                     # Headless/base design system (shadcn, radix, etc.)
│   │   ├── button.tsx
│   │   ├── modal.tsx
│   │   └── input.tsx
│   ├── layout/                 # App-wide layout pieces
│   │   ├── Navbar.tsx
│   │   ├── Sidebar.tsx
│   │   └── Footer.tsx
│   ├── common/                 # Shared across features, not layout
│   │   ├── Avatar.tsx
│   │   └── LoadingSpinner.tsx
│   └── [feature]/              # Feature-scoped components
│       ├── dashboard/
│       ├── auth/
│       ├── admin/
│       └── business/
│
├── hooks/                      # Custom React hooks only
│   ├── use-mobile.ts
│   ├── use-toast.ts
│   └── use-debounce.ts
│
├── context/                    # React context providers
│   ├── ThemeProvider.tsx
│   └── AuthProvider.tsx
│
├── store/                      # Global state (Redux, Zustand, Jotai, etc.)
│   ├── [feature]/
│   │   ├── auth.slice.ts
│   │   ├── auth.thunk.ts
│   │   └── auth.types.ts
│   ├── rootReducer.ts
│   ├── store.ts
│   └── types.ts
│
├── api/                        # API call functions (not Next.js route handlers)
│   ├── auth.api.ts
│   ├── business.api.ts
│   └── categories.api.ts
│
├── utils/                      # Pure utility functions — NO loose files
│   ├── api/                    # Axios instance, interceptors, base config
│   │   ├── axiosInstance.ts
│   │   └── apiHelpers.ts
│   ├── schema/                 # Zod / Yup validation schemas
│   │   ├── auth.schema.ts
│   │   └── admin.schema.ts
│   ├── mocks/                  # Mock data for dev/testing
│   │   ├── mockParksData.ts
│   │   └── mockSpotsData.ts
│   ├── geo/                    # Geocoding, reverse geocoding, maps
│   │   ├── geocode.ts
│   │   └── reverseGeocode.ts
│   ├── media/                  # Image, file, upload utilities
│   │   └── imageCompression.ts
│   ├── address/                # Address parsing, sanitization
│   │   └── addressSanitizer.ts
│   ├── security/               # Rate limiting, CSRF, auth tokens
│   │   └── rateLimit.ts
│   ├── cookies/                # Cookie read/write helpers
│   │   └── cookies.ts
│   └── helpers/                # Anything uncategorized goes here
│       ├── helper.ts
│       ├── badgeUtils.ts
│       ├── planUtils.ts
│       ├── routes.ts
│       ├── socialLinksUtils.ts
│       ├── subscriptionPlanKey.ts
│       ├── transformers.ts
│       └── env-validation.ts
│
├── types/                      # Global TypeScript types and declarations
│   ├── next-auth.d.ts
│   └── global.d.ts
│
├── styles/                     # Global styles only
│   └── globals.css
│
└── middleware.ts               # Next.js middleware (root of src/)
```

---

## Routing Rules

### Next.js — App Router (`src/app/`)
- Every route = a folder with `page.tsx` inside
- Use **route groups** `(group-name)/` to share layouts without adding a URL segment
- `layout.tsx` wraps all children in that folder
- `loading.tsx`, `error.tsx`, `not-found.tsx` are co-located with the route they handle
- API handlers live in `app/api/[route]/route.ts` and export named functions: `GET`, `POST`, etc.
- **Do not mix** App Router and Pages Router in the same project

### Next.js — Pages Router (`src/pages/`)
- Each file = a route. `pages/about.tsx` → `/about`
- Dynamic routes: `pages/post/[id].tsx`
- API routes: `pages/api/[handler].ts` — export a default function
- `_app.tsx` wraps all pages; `_document.tsx` customizes the HTML shell

### React (Vite / CRA) — No `app/` or `pages/`
- Routing handled by `react-router-dom` or similar
- Route definitions live in `src/router/index.tsx` or `src/App.tsx`
- No file-based routing — pages are just components in `src/components/[feature]/` or a dedicated `src/pages/` folder (convention only, not framework-enforced)

---

## Component Rules

| Folder | What goes here |
|--------|---------------|
| `components/ui/` | Primitive, design-system-level components. No business logic. |
| `components/layout/` | Navbar, Sidebar, Footer, shell wrappers used app-wide. |
| `components/common/` | Reusable components shared across features but not layout. |
| `components/[feature]/` | Components used only within that feature (admin, auth, dashboard…). |

- One component per file
- File name = component name in PascalCase: `UserCard.tsx`
- Co-locate feature-specific sub-components inside the feature folder, not in `common/`

---

## Utils Rules

**Hard rule: no loose files directly inside `utils/`. Every file must be inside a subfolder.**

| Subfolder | What belongs there |
|-----------|-------------------|
| `utils/api/` | Axios/fetch instance, interceptors, base URL config |
| `utils/schema/` | All Zod, Yup, or Joi validation schemas |
| `utils/mocks/` | Static mock data for development or testing |
| `utils/geo/` | Geocoding, map helpers, coordinate utilities |
| `utils/media/` | Image compression, file readers, upload helpers |
| `utils/address/` | Address sanitization, formatting, parsing |
| `utils/security/` | Rate limiting, token handling, CSRF |
| `utils/cookies/` | Cookie get/set/remove helpers |
| `utils/helpers/` | Catch-all for anything that doesn't fit above |

If you add a new utility and it doesn't clearly belong to an existing folder, place it in `helpers/`. If 2+ files share the same concern, create a new named subfolder.

---

## Store Rules

- One folder per feature slice: `store/auth/`, `store/cart/`
- Each slice folder always has three files:
  - `[feature].slice.ts` — state + reducers
  - `[feature].thunk.ts` — async actions
  - `[feature].types.ts` — TypeScript types for that slice
- `store/store.ts` — configures and exports the store
- `store/rootReducer.ts` — combines all slices
- `store/types.ts` — global `RootState` and `AppDispatch` types

---

## Hooks & Context Rules

- `hooks/` — only custom React hooks. File names must start with `use-` (kebab-case): `use-auth.ts`
- `context/` — only React context files. Name as `[Name]Provider.tsx`
- Hooks that are tightly coupled to a single feature can live co-located inside `components/[feature]/hooks/` but prefer `src/hooks/` for anything reused

---

## Adding a New File — Decision Tree

```
Is it a route/page?
  → Next.js App Router: src/app/[route]/page.tsx
  → Next.js Pages Router: src/pages/[route].tsx
  → React: src/components/[feature]/[Name]Page.tsx

Is it a UI component?
  → Used app-wide with no business logic? → components/ui/
  → Layout shell (nav, sidebar)? → components/layout/
  → Shared across features? → components/common/
  → Feature-specific? → components/[feature]/

Is it a hook? → hooks/use-[name].ts
Is it a context? → context/[Name]Provider.tsx
Is it a store slice? → store/[feature]/[feature].slice|thunk|types.ts
Is it an API call function? → api/[feature].api.ts
Is it a validation schema? → utils/schema/[feature].schema.ts
Is it a utility function?
  → Find the right utils subfolder (see table above)
  → Nothing fits? → utils/helpers/[name].ts
Is it a global type? → types/[name].d.ts
```

---

## Naming Conventions

| Item | Convention | Example |
|------|-----------|---------|
| Components | PascalCase | `UserProfileCard.tsx` |
| Hooks | kebab-case, `use-` prefix | `use-auth.ts` |
| Utilities | camelCase | `imageCompression.ts` |
| Store files | `[feature].[type].ts` | `auth.slice.ts` |
| API files | `[feature].api.ts` | `business.api.ts` |
| Schemas | `[feature].schema.ts` | `auth.schema.ts` |
| Types/declarations | camelCase or `[name].d.ts` | `next-auth.d.ts` |
| Route folders (Next) | lowercase, kebab | `user-profile/` |

---

## What Does NOT Belong in Each Folder

| Folder | Do NOT put here |
|--------|----------------|
| `components/ui/` | Business logic, API calls, store connections |
| `hooks/` | Non-hook utility functions |
| `utils/` | Loose files at root level |
| `api/` | Next.js route handlers (those go in `app/api/`) |
| `store/` | API call logic (put that in `api/` or thunks) |
| `types/` | Runtime code — declaration files only |
| `styles/` | Component-scoped CSS (co-locate with component or use CSS modules) |
