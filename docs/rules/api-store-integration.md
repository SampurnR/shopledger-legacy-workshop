# API & Store Integration

Standardized pattern for **Redux Toolkit + Axios** in a Next.js / React project. Use this as the single reference when creating or modifying anything in `src/api/`, `src/store/`, or `src/utils/api/`.

> This pattern is **Redux Toolkit + Axios only**. RTK Query and SWR are out of scope.

---

## Layer Overview

```
Component / Hook
    ↓  dispatch(someThunk(payload))       — typed with useAppDispatch
    ↓  useAppSelector(state => state.x)   — typed with useAppSelector
                │
                ▼
┌─────────────────────────────────────────────────────────┐
│  store/[feature]/                                       │
│  ├── [feature].slice.ts    ← state shape, reducers      │
│  ├── [feature].thunk.ts    ← async logic, error wrap    │
│  └── [feature].types.ts    ← all TS types for feature   │
└─────────────────────────────────────────────────────────┘
                │
                ▼  calls service method
┌─────────────────────────────────────────────────────────┐
│  api/[feature].api.ts      ← typed axios service object │
└─────────────────────────────────────────────────────────┘
                │
                ▼  uses
┌─────────────────────────────────────────────────────────┐
│  utils/api/axiosInstance.ts  ← one instance, auth       │
│                                interceptors              │
└─────────────────────────────────────────────────────────┘
                │
                ▼
          Backend API
```

Each layer has one job. Nothing bleeds into the next.

---

### Concrete Example — `auth` feature

```
src/
├── api/
│   └── auth.api.ts                  → exports authService { login, register, ... }
│
├── store/
│   └── auth/
│       ├── auth.slice.ts            → createSlice, initialState, reducers, extraReducers
│       ├── auth.thunk.ts            → loginThunk, registerThunk, logoutThunk, ...
│       └── auth.types.ts            → ILoginThunkPayload, ILoginThunkResponse,
│                                        ILoginThunkResponseData, AuthSliceInterface, ...
│
└── utils/
    └── api/
        └── axiosInstance.ts         → single axios instance (shared by ALL api files)
```

How the `auth` flow executes end-to-end:

```
LoginForm component
  → dispatch(loginThunk({ email, password }))
      → auth.thunk.ts: loginThunk
          → authService.login({ email, password })    [auth.api.ts]
              → axiosInstance.post<ILoginThunkResponse>("/api/auth/login", data)
                  → Backend returns { success, message, data: { user, token } }
              ← response.data typed as ILoginThunkResponse
          ← thunk returns response.data on success
          ← thunk calls rejectWithValue(ApiErrorData) on failure
      → auth.slice.ts extraReducers:
          pending  → loginLoading: true
          fulfilled → loginLoading: false, user: action.payload.data.user
          rejected  → loginLoading: false
  ← component reads state.auth.loginLoading, state.auth.user via useAppSelector
```

---

### Dynamic Naming Pattern — Any Feature

Replace `[feature]` with your actual feature name (camelCase, lowercase). The structure is always identical:

```
store/
└── [feature]/
    ├── [feature].slice.ts
    ├── [feature].thunk.ts
    └── [feature].types.ts

api/
└── [feature].api.ts
```

Real examples across the codebase:

| Feature | Slice | Thunk | Types | API Service |
|---------|-------|-------|-------|-------------|
| `auth` | `auth.slice.ts` | `auth.thunk.ts` | `auth.types.ts` | `auth.api.ts` |
| `business` | `business.slice.ts` | `business.thunk.ts` | `business.types.ts` | `business.api.ts` |
| `categories` | `categories.slice.ts` | `categories.thunk.ts` | `categories.types.ts` | `categories.api.ts` |
| `dogProfile` | `dogProfile.slice.ts` | `dogProfile.thunk.ts` | `dogProfile.types.ts` | `dogProfile.api.ts` |
| `facilities` | `facilities.slice.ts` | `facilities.thunk.ts` | `facilities.types.ts` | `facilities.api.ts` |

Multi-word features use **camelCase** for the folder and file prefix — `dogProfile`, `lostFound`, `userProfile`, `verificationStatus`. Never kebab-case, never PascalCase.

---

### What Lives Where — Quick Reference

```
src/
├── utils/api/
│   └── axiosInstance.ts     ONE file. Never duplicated. Auth interceptors live here.
│
├── api/
│   ├── auth.api.ts           One service object per feature. No logic. No error handling.
│   ├── business.api.ts
│   ├── categories.api.ts
│   └── facilities.api.ts
│
├── store/
│   ├── auth/
│   │   ├── auth.slice.ts
│   │   ├── auth.thunk.ts
│   │   └── auth.types.ts
│   ├── business/
│   │   ├── business.slice.ts
│   │   ├── business.thunk.ts
│   │   └── business.types.ts
│   ├── [feature]/            ← add new features here, same 3-file pattern always
│   │   ├── [feature].slice.ts
│   │   ├── [feature].thunk.ts
│   │   └── [feature].types.ts
│   ├── rootReducer.ts        Combines all slices. Configures redux-persist.
│   ├── store.ts              Configures store. Exports useAppDispatch, useAppSelector.
│   └── types.ts              Global shared types only (ApiError, Pagination, etc.)
```

Each layer has one job and imports only from the layer directly below it:
- **Component** imports from `store/` (hooks + actions)
- **Thunk** imports from `api/`
- **API service** imports from `utils/api/axiosInstance`
- **Slice** imports from its own `.thunk.ts` and `.types.ts`
- **Types** import from nowhere (or from `store/types.ts` for shared types)

---

## File-by-File Reference

### 1. `utils/api/axiosInstance.ts`

The single axios instance for the entire app. Created once, used everywhere.

**Responsibilities:**
- Set `baseURL` from `process.env.NEXT_PUBLIC_API_URL`
- Set `withCredentials: true` for cookie-based auth
- **Request interceptor** — attach `Authorization: Bearer <token>` from NextAuth session
- **Response interceptor** — on 401, sign out and redirect to `/auth/login` unless the request was itself an auth endpoint or the user is already on an auth page

**Rules:**
- Only one axios instance exists in the whole codebase — never call `axios.create()` elsewhere
- Auth endpoints list (`AUTH_ENDPOINTS`) must be kept up to date to avoid redirect loops
- `verifyCaptcha` is a one-off server-side utility that may live here or move to `utils/security/`
- Never import `axiosInstance` from anywhere except `api/*.api.ts` files

---

### 2. `api/[feature].api.ts`

One file per feature. Exports a single `const [feature]Service = { ... }` object. No default export.

**Structure:**
```ts
// IMPORTS — types from store/[feature]/[feature].types, axiosInstance, ROUTES
// TYPE DEFINITIONS (empty section — keep for consistency)
// CONSTANTS (empty section — keep for consistency)
// [FEATURE] API SERVICE
export const featureService = {
  methodName: (data?: IMethodThunkPayload) =>
    axiosInstance.get<IMethodThunkResponse>(ROUTES.FEATURE.ENDPOINT, { params }),
};
```

**Rules:**
- Always pass the response type as a generic to axios: `axiosInstance.get<IMethodThunkResponse>(...)`
- Build `params` objects explicitly — do not spread payload directly into params
- Only include a param if the value is not `undefined` (guard with `if (data?.field !== undefined)`)
- URL path params use `.replace(":id", value)` from the ROUTES constant
- JSDoc every method with `@param` and what it does
- No business logic, no error handling — that belongs in the thunk

**Example:**
```ts
export const businessService = {
  getMyListings: (data?: IGetMyListingsThunkPayload) => {
    const params: Record<string, string | boolean | number> = {};
    if (data?.search !== undefined) params.search = data.search;
    if (data?.page !== undefined) params.page = data.page;
    return axiosInstance.get<IGetMyListingsThunkResponse>(ROUTES.BUSINESS.MY_LISTINGS, { params });
  },

  getListingById: (data: IGetListingByIdThunkPayload) => {
    const url = ROUTES.BUSINESS.LISTING_BY_ID.replace(":listingId", data.listingId);
    return axiosInstance.get<IGetListingByIdThunkResponse>(url);
  },
};
```

---

### 3. `store/[feature]/[feature].types.ts`

All TypeScript types for one feature slice. The most important file to get right.

#### Section order (top to bottom):

```
1. IMPORTS
2. COMMON TYPES        ← enums, primitive union types, reusable interfaces
3. [ENTITY] INTERFACE  ← e.g. ApiListing, BusinessProfile, ListingClaim
4. [THUNK NAME] TYPES  ← one section per thunk, 3–4 interfaces each
   ...repeat per thunk...
5. [FEATURE] SLICE INTERFACE
```

#### Interface naming convention

Every interface uses `I` as a prefix. Name everything after the thunk it belongs to:

| Interface | Purpose |
|-----------|---------|
| `IGetMyDogThunkPayload` | What you send to the API (query params or body) |
| `IGetMyDogThunkResponse` | Top-level API response `{ success, message, data }` |
| `IGetMyDogThunkResponseData` | The `data` field inside the response |

If `data` contains a list + pagination, the response data interface holds both:
```ts
export interface IGetMyDogsThunkResponseData {
  dogs: IDog[];
  pagination: IPaginationData;
}
```

If the entity is reused across multiple thunks, define it once in **COMMON TYPES** / entity section, not inside a thunk section.

#### Rules:
- `I` prefix on every interface — no exceptions
- Primitive union types and enums go at the very top before any interfaces
- Reusable entities (e.g. `ApiListing`, `BusinessProfile`) go in the entity section — never duplicated per-thunk
- Shared structures like `IPaginationData`, `IPhoto`, `IOpeningHours` belong in the entity section of the most relevant slice, or in `store/types.ts` if used globally
- Thunk type sections must be labeled with comments: `// --- GET MY DOG THUNK TYPES ---`
- The slice interface (`[Feature]SliceInterface`) is always the last thing before thunk type sections

---

### 4. `store/[feature]/[feature].thunk.ts`

One `createAsyncThunk` per API call. No business logic outside of thunks.

**Structure per thunk:**
```ts
// ============================================================================
// GET MY DOG THUNK
// ============================================================================

export const getMyDogThunk = createAsyncThunk<
  IGetMyDogThunkResponse,       // fulfilled return type
  IGetMyDogThunkPayload,        // argument type
  { rejectValue: ApiErrorData } // reject type (always this)
>(
  "featureName/actionName",     // must match: "sliceName/camelCaseAction"
  async (data, { rejectWithValue }) => {
    try {
      const response = await featureService.getMyDog(data);
      return response.data;
    } catch (error: any) {
      const errorMessage = getErrorMessage(error, "Fallback error message");
      if (error?.response?.data) {
        return rejectWithValue({ data: error.response.data });
      }
      return rejectWithValue({ data: { success: false, message: errorMessage } });
    }
  }
);
```

**Rules:**
- Always use `rejectWithValue` with `ApiErrorData` shape — never throw
- Always call `getErrorMessage(error, "fallback")` for the fallback message
- Import service from `@/api/[feature].api` — never call axiosInstance directly
- The action string `"feature/actionName"` must be unique across the entire store
- For `void` payload (no args): use `async (_, { rejectWithValue })`
- Thunks that take both an ID and a body: use a single object arg `{ id: string; data: IPayload }`

---

### 5. `store/[feature]/[feature].slice.ts`

Manages state. Uses `extraReducers` for async thunk cases and `reducers` for sync state updates.

#### Initial state pattern

Define initial values as named constants at the top — reuse them in reset reducers:
```ts
const initialFilters: DogFilters = { search: undefined, breed: undefined };
const initialPagination: PaginationData = { page: 1, limit: 10, total: 0, totalPages: 0, hasMore: false };

const initialState: DogSliceInterface = {
  // GET MY DOGS
  getMyDogsLoading: false,
  getMyDogs: [],
  getMyDogsPagination: null,
  getMyDogsFilters: initialFilters,
  getMyDogsSort: "NEWEST",
  getMyDogsCurrentPage: initialPagination.page,
  getMyDogsLimit: initialPagination.limit,
  // For operations with no data to hold, only add loading:
  // CREATE DOG
  createDogLoading: false,
};
```

#### State field naming by operation type

| Operation | State fields to add |
|-----------|-------------------|
| GET list (paginated) | `[name]Loading`, `[name]` (array), `[name]Pagination`, `[name]Filters`, `[name]Sort`, `[name]CurrentPage`, `[name]Limit` |
| GET list (paginated + cached) | All above + `[name]Cache` |
| GET single item | `[name]Loading`, `[name]` (nullable entity) |
| GET simple (no pagination) | `[name]Loading`, `[name]` (array or null) |
| CREATE / UPDATE / DELETE | `[name]Loading` only — no data state unless you need to hold the result |

**Only add caching when the list has filters + sort + pagination and is expensive to refetch.** Do not add cache by default.

#### Cache pattern (when needed)

```ts
// In slice utility functions:
const generateCacheKey = (filters: DogFilters, sort: string, page: number): string =>
  JSON.stringify({ ...filters, sort, page });

// In extraReducers fulfilled case:
const cacheKey = generateCacheKey(state.getMyDogsFilters, state.getMyDogsSort, state.getMyDogsCurrentPage);
state.getMyDogsCache = {
  ...state.getMyDogsCache,
  [cacheKey]: { dogs, pagination, timestamp: Date.now() },
};
```

#### Sync reducers (in `reducers: {}`)

Add sync reducers for: setting filters, resetting filters, changing page, changing sort, clearing cache. Always reset to page 1 when filters or sort change.

```ts
setDogsFilters: (state, action: PayloadAction<Partial<DogFilters>>) => {
  state.getMyDogsFilters = { ...state.getMyDogsFilters, ...action.payload };
  state.getMyDogsCurrentPage = 1; // Always reset page
},
resetDogsFilters: (state) => {
  state.getMyDogsFilters = initialFilters;
  state.getMyDogsCurrentPage = 1;
},
```

#### extraReducers pattern

Always handle all three cases: `pending`, `fulfilled`, `rejected`.

```ts
.addCase(getMyDogsThunk.pending, (state) => ({ ...state, getMyDogsLoading: true }))
.addCase(getMyDogsThunk.fulfilled, (state, action) => {
  const { dogs, pagination } = action.payload.data;
  return { ...state, getMyDogsLoading: false, getMyDogs: dogs, getMyDogsPagination: pagination };
})
.addCase(getMyDogsThunk.rejected, (state) => ({ ...state, getMyDogsLoading: false }))
```

Use spread-and-return (`return { ...state, ... }`) consistently — do not mix with direct mutation.

---

### 6. `store/rootReducer.ts`

Combines all slices and configures `redux-persist`.

**Rules:**
- Only add a slice to `rootReducer` when it has been fully implemented (slice + thunk + types)
- `whitelist` in `persistConfig` should only include slices that truly need persistence (e.g. `auth`) — do not persist large data slices
- Export both `persistreducer` (for the store) and `rootReducer` (for type inference)

---

### 7. `store/store.ts`

Configures the Redux store. Exports typed hooks.

**Rules:**
- `serializableCheck: false` is required for redux-persist
- Always export `useAppDispatch` and `useAppSelector` from here — never use raw `useDispatch`/`useSelector` in components
- `RootState` must use `typeof rootReducer` (non-persisted) for correct type inference

---

### 8. `store/types.ts`

Global types shared across multiple slices. Examples: `ApiError`, `ApiErrorData`, `Pagination`, shared entity interfaces.

**Rules:**
- Only put a type here if it is genuinely used in 2+ slices
- Feature-specific types stay in `store/[feature]/[feature].types.ts`
- `ApiErrorData` shape must always be `{ data: { success: boolean; message: string } }`

---

## Adding a New Feature — Checklist

```
1. Create store/[feature]/[feature].types.ts
   □ Primitive union types and enums at top
   □ Reusable entity interfaces (IMyEntity)
   □ One section per thunk: Payload, Response, ResponseData
   □ SliceInterface at the bottom of entities, before thunk types

2. Create api/[feature].api.ts
   □ One service object with typed axios methods
   □ All methods JSDoc'd
   □ Params built explicitly (no direct payload spread)

3. Create store/[feature]/[feature].thunk.ts
   □ One thunk per API call
   □ All use rejectWithValue + getErrorMessage
   □ Import from api/[feature].api — never axiosInstance directly

4. Create store/[feature]/[feature].slice.ts
   □ Named initial value constants at top
   □ State fields follow naming table above
   □ Sync reducers for filters/sort/page/cache
   □ extraReducers for all three cases of each thunk
   □ Named exports for all sync actions + default export for reducer

5. Register in store/rootReducer.ts
   □ Import the reducer
   □ Add to combineReducers
   □ Add to whitelist only if persistence is needed
```

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Calling `axios.create()` in an api file | Always import from `utils/api/axiosInstance` |
| Spreading payload directly into params | Build `params` object with explicit guards |
| Using `useDispatch` / `useSelector` directly | Always use `useAppDispatch` / `useAppSelector` |
| Interface without `I` prefix | `IDog`, `IGetMyDogThunkPayload`, etc. |
| Thunk response type not passed to axios | `axiosInstance.get<IMyThunkResponse>(url)` |
| Throwing in a thunk catch block | Always `return rejectWithValue(...)` |
| Adding cache to every slice | Cache only when list has filters + sort + pagination |
| Persisting every slice | Only persist what needs to survive page refresh (typically `auth` only) |
| Loose types in `store/types.ts` | Feature types go in feature types file; only global shared types here |
| Duplicating entity interface per thunk | Define entity once, reference in response data interfaces |
