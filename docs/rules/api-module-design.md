# API Module Design

Standardized pattern for designing a complete backend API module in **Express + TypeScript + Prisma + Zod**. Every module follows the same 5-file architecture. Use this as the reference when creating or reviewing any module.

> Stack: Express, Prisma ORM, Zod (validation), class-based controllers and services.

---

## Module File Map

```
src/modules/[feature]/
├── dto/
│   └── [feature].dto.ts        ← Zod schemas + inferred TypeScript types
├── types/
│   └── [feature].types.ts      ← Internal TypeScript interfaces (not Zod)
├── [feature].routes.ts         ← Route definitions + middleware chain
├── [feature].controller.ts     ← Request parsing, validation, response sending
└── [feature].service.ts        ← Business logic, Prisma calls, external services
```

Each file has exactly one responsibility. Nothing bleeds across boundaries.

---

## 1. Routes (`[feature].routes.ts`)

Routes wire together: HTTP method + path + middleware chain + controller method.

### Rules
- Route paths are **never hardcoded strings** — always imported from `utils/constants/routes.ts`
- Every route has a 3-line JSDoc comment: `@route`, `@desc`, `@access`
- Each middleware is on its own line — never chain them on one line
- Controller is always last in the chain
- File exports a single `Router` instance as default

### Structure

```ts
import { Router } from 'express';
import { featureController } from './feature.controller.js';
import { CreateFeatureDto } from './dto/feature.dto.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { validateDto } from '../../middleware/validateDto.js';
import { ROUTES } from '../../utils/constants/routes.js';
import { USER_ROLE } from '../../utils/constants/enums.js';
import { upload } from '../../config/multer.js'; // only if file uploads needed

const router = Router();

/**
 * @route   POST /api/feature
 * @desc    Create a new feature item
 * @access  Protected (Business Owner)
 */
router.post(
  ROUTES.FEATURE.CREATE,
  authenticate,
  requireRole(USER_ROLE.BUSINESS_OWNER),
  validateDto(CreateFeatureDto),
  featureController.createFeature
);

export default router;
```

### Middleware Order (always this sequence)
1. `authenticate` — verify JWT / session
2. `requireRole(...)` — RBAC check
3. `upload.single()` / `upload.array()` / `upload.fields()` — file upload (if needed)
4. `validateDto(DtoSchema)` — body validation (skip if validation is done in controller)
5. Controller method — always last

### File Upload in Routes

```ts
// Single file
upload.single('profilePicture')

// Multiple files, same field
upload.array('photos', 5)

// Multiple fields, each with a file
upload.fields([
  { name: 'profilePicture', maxCount: 1 },
  { name: 'logo', maxCount: 1 },
  { name: 'photos', maxCount: 5 },
])
```

---

## 2. Controller (`[feature].controller.ts`)

Controllers handle the HTTP layer only: parse input, validate, call service, send response.

### Rules
- Class-based: `export class FeatureController { ... }`
- Export a singleton at the bottom: `export const featureController = new FeatureController()`
- All methods are **async arrow functions** assigned to the class — this ensures correct `this` binding when passed to routes
- Every method signature: `(req: Request, res: Response, next: NextFunction): Promise<void>`
- All errors are forwarded with `next(error)` — never `res.status(500).json(...)` directly
- No business logic — controller only parses, validates, and delegates to the service
- Validation errors are collected into an `errors[]` array and returned all at once with `sendBadRequest`
- Use `sendSuccess`, `sendCreated`, `sendBadRequest` from `utils/helpers/response.ts` for all responses
- Use `logger` only for significant state changes (create, update, delete). Avoid info-level logs for GET requests

### Structure

```ts
import type { Request, Response, NextFunction } from 'express';
import { FeatureService } from './feature.service.js';
import { CreateFeatureDto, FeatureQueryDto } from './dto/feature.dto.js';
import type { CreateFeatureDtoType } from './dto/feature.dto.js';
import type { SafeFeature, PaginatedFeaturesResponse } from './types/feature.types.js';
import { sendSuccess, sendCreated, sendBadRequest } from '../../utils/helpers/response.js';
import { createLogger } from '../../utils/helpers/logger.js';

const logger = createLogger('FeatureController');

export class FeatureController {
  private featureService: FeatureService;

  constructor() {
    this.featureService = new FeatureService();
  }

  /**
   * Create a feature item
   * POST /api/feature
   */
  createFeature = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body with Zod
      const dtoResult = CreateFeatureDto.safeParse(req.body);
      if (!dtoResult.success) {
        const errors = dtoResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendBadRequest(res, 'Validation failed', errors);
        return;
      }

      const dto: CreateFeatureDtoType = dtoResult.data;
      const ownerId = req.user!.id;

      const feature = await this.featureService.createFeature(ownerId, dto);

      logger.info(`Feature created: ${feature.id} by user: ${ownerId}`);
      sendCreated<{ feature: SafeFeature }>(res, 'Feature created successfully', { feature });
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get all features with filters
   * GET /api/feature
   */
  getAllFeatures = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate query params with Zod
      const queryResult = FeatureQueryDto.safeParse(req.query);
      if (!queryResult.success) {
        const errors = queryResult.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        }));
        sendBadRequest(res, 'Invalid query parameters', errors);
        return;
      }

      const result = await this.featureService.getAllFeatures(queryResult.data);

      sendSuccess<PaginatedFeaturesResponse>(res, 'Features retrieved successfully', result);
    } catch (error) {
      next(error);
    }
  };
}

export const featureController = new FeatureController();
```

### Validation Pattern

**Body validation** — always use `safeParse`, never `parse` (which throws):
```ts
const dtoResult = CreateFeatureDto.safeParse(req.body);
if (!dtoResult.success) {
  const errors = dtoResult.error.issues.map((issue) => ({
    field: issue.path.join('.'),
    message: issue.message,
  }));
  sendBadRequest(res, 'Validation failed', errors);
  return; // Always return after sending error
}
```

**Manual validation** (path params, file checks) — collect all errors first, send once:
```ts
const errors: Array<{ field: string; message: string }> = [];

if (!profileId) errors.push({ field: 'profileId', message: 'Profile ID is required' });
if (!req.user) errors.push({ field: '', message: 'Authentication required' });
if (photoCount > 5) errors.push({ field: 'photos', message: 'Maximum 5 photos allowed' });

if (errors.length > 0) {
  sendBadRequest(res, 'Validation failed', errors);
  return;
}
```

**JSON string fields** (from multipart/form-data) — always wrap in try/catch:
```ts
if (tags !== undefined) {
  try {
    dto.tags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    if (!Array.isArray(dto.tags)) {
      errors.push({ field: 'tags', message: 'tags must be an array' });
    }
  } catch {
    errors.push({ field: 'tags', message: 'Invalid tags format' });
  }
}
```

### Logging Rules

```ts
// ✅ Log on significant mutations
logger.info(`Feature created: ${feature.id} by user: ${ownerId}`);
logger.info(`Feature updated: ${featureId}`);

// ❌ Do NOT log on GET requests
logger.debug(`Fetching features for user: ${ownerId}`); // Avoid in production

// ✅ Always log errors (handled in service, or in catch blocks)
logger.error(`Failed to process feature: ${featureId}`, error);
```

Logger should only log:
- `info` — successful create / update / delete (controller level, brief)
- `error` — failures (service level, with context)
- `warn` — recoverable issues (e.g. failed to delete old Cloudinary asset before re-upload)
- `debug` — development only, verbose fetch logs (these are acceptable in service but not controller)

---

## 3. Service (`[feature].service.ts`)

Services contain all business logic, database calls (Prisma), and external service calls (Cloudinary, etc.).

### Rules
- Class-based: `export class FeatureService { ... }`
- Export a singleton: `export const featureService = new FeatureService()`
- **Private methods** for: data transformation (`toSafeFeature`), error creation (`createError`), ownership verification (`verifyOwnership`), internal utilities
- **Public methods** for: all operations called by the controller
- Never throw raw `Error` objects — always throw through `this.createError(statusCode, message)`
- The global `errorHandler` middleware reads `statusCode` from thrown errors — this is how HTTP status codes flow to the client
- Only update fields that are explicitly provided in the DTO (check `!== undefined`, not `!= null`)
- When updating Prisma JSON fields: use `Prisma.JsonNull` for `null`, not JS `null`
- For Cloudinary: always delete the old asset **before** uploading a new one

### Structure

```ts
import prisma from '../../config/prisma.js';
import type { CreateFeatureDtoType } from './dto/feature.dto.js';
import type { SafeFeature } from './types/feature.types.js';
import { createLogger } from '../../utils/helpers/logger.js';

const logger = createLogger('FeatureService');

export class FeatureService {

  // ==========================================
  // Private Helpers
  // ==========================================

  private toSafeFeature(record: PrismaFeature): SafeFeature {
    // Strip internal fields, cast JSON fields to known types
    return { id: record.id, name: record.name, ... };
  }

  private createError(statusCode: number, message: string) {
    return { statusCode, message };
  }

  private async verifyOwnership(featureId: string, ownerId: string): Promise<PrismaFeature> {
    const record = await prisma.feature.findFirst({
      where: { id: featureId, ownerId, isDeleted: false },
    });
    if (!record) throw this.createError(404, 'Not found or access denied');
    return record;
  }

  // ==========================================
  // Public Methods
  // ==========================================

  async createFeature(ownerId: string, dto: CreateFeatureDtoType): Promise<SafeFeature> {
    const record = await prisma.feature.create({ data: { ownerId, ...dto } });
    return this.toSafeFeature(record);
  }

  async updateFeatureById(featureId: string, dto: Partial<UpdateFeatureDtoType>, userId: string): Promise<SafeFeature> {
    const existing = await this.verifyOwnership(featureId, userId);

    const updateData: Record<string, unknown> = {};
    // Only include fields that are explicitly provided
    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.description !== undefined) updateData.description = dto.description;

    const updated = await prisma.feature.update({ where: { id: featureId }, data: updateData });
    return this.toSafeFeature(updated);
  }
}

export const featureService = new FeatureService();
```

### Prisma Patterns

**Soft delete** — always filter `isDeleted: false`:
```ts
await prisma.feature.findFirst({ where: { id, isDeleted: false } });
```

**Partial update** — only set fields that are provided:
```ts
if (dto.name !== undefined) updateData.name = dto.name;
if (dto.description !== undefined) updateData.description = dto.description ?? null;
```

**JSON fields** — cast correctly for Prisma:
```ts
import { Prisma } from '../../generated/prisma/client.js';

// Setting to null
data: { photos: Prisma.JsonNull }

// Setting to value
data: { photos: dto.photos as Prisma.InputJsonValue }

// Conditional
data: { photos: dto.photos ? (dto.photos as Prisma.InputJsonValue) : Prisma.JsonNull }
```

**Pagination**:
```ts
const page = filters.page || 1;
const limit = filters.limit || 10;
const skip = (page - 1) * limit;

const [total, records] = await Promise.all([
  prisma.feature.count({ where }),
  prisma.feature.findMany({ where, skip, take: limit, orderBy }),
]);

return {
  items: records.map(this.toSafeFeature),
  pagination: {
    page, limit, total,
    totalPages: Math.ceil(total / limit),
    hasMore: page < Math.ceil(total / limit),
  },
};
```

---

## 4. DTO (`dto/[feature].dto.ts`)

DTOs are Zod schemas that validate incoming request data. They also export inferred TypeScript types.

### Rules
- Use **Zod** exclusively — no class-validator, no manual checks
- All schemas use `.safeParse()` in the controller — never `parse()` which throws uncaught errors
- Helper functions (`isValidUrl`, `isValidEmail`) defined at top of file, before schemas
- Query DTOs use `.transform()` to convert string params to typed values (numbers, booleans)
- Always export inferred types at the bottom: `export type CreateFeatureDtoType = z.infer<typeof CreateFeatureDto>`
- Schema names are PascalCase and match their export type: `CreateFeatureDto` → `CreateFeatureDtoType`

### Structure

```ts
import { z } from 'zod';

// ============================================
// Helper validation functions
// ============================================
const isValidUrl = (url: string): boolean => {
  try { new URL(url); return true; } catch { return false; }
};

// ============================================
// Create Feature DTO
// ============================================
export const CreateFeatureDto = z.object({
  name: z
    .string({ message: 'Name is required' })
    .min(1, 'Name cannot be empty')
    .max(150, 'Name cannot exceed 150 characters')
    .trim(),
  description: z.string().max(2000).optional(),
  websiteUrl: z
    .string()
    .refine((val) => !val || isValidUrl(val), { message: 'Website URL must be a valid URL' })
    .optional(),
  tags: z.array(z.string().min(1, 'Tag cannot be empty')).optional(),
});

// ============================================
// Query DTO (for GET with filters/pagination)
// ============================================
export const FeatureQueryDto = z.object({
  search: z.string().optional(),
  sortBy: z.enum(['name', 'createdAt']).optional().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
  page: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 1))
    .pipe(z.number().int().positive()),
  limit: z
    .string()
    .optional()
    .transform((val) => (val ? parseInt(val, 10) : 10))
    .pipe(z.number().int().positive().max(100)),
});

// ============================================
// Type Exports
// ============================================
export type CreateFeatureDtoType = z.infer<typeof CreateFeatureDto>;
export type FeatureQueryDtoType = z.infer<typeof FeatureQueryDto>;
```

---

## 5. Types (`types/[feature].types.ts`)

Internal TypeScript interfaces for the module — not Zod, not Prisma types.

### Rules
- Use for: safe/public-facing entity shapes (`SafeFeature`), error interfaces, response envelopes, filter/query types
- Do **not** duplicate Prisma-generated types — import them from `../../generated/prisma/client.js` directly when needed
- Do **not** put Zod schemas here — those belong in `dto/`
- Types used in only one file can stay in that file; move to `types/` when shared across controller + service

### Structure

```ts
// ============================================
// Entity Types
// ============================================
export interface SafeFeature {
  id: string;
  ownerId: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ============================================
// Response Types
// ============================================
export interface PaginatedFeaturesResponse {
  features: SafeFeature[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ============================================
// Filter Types
// ============================================
export interface FeatureQueryFilters {
  search?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}
```

---

## 6. Registering in `server.ts`

After creating a module, register it in `server.ts`:

```ts
// 1. Import the router
import featureRoutes from './modules/feature/feature.routes.js';

// 2. Mount at the route constant base path
app.use(ROUTES.FEATURE.BASE, featureRoutes);
```

Add the base route to `utils/constants/routes.ts`:
```ts
export const ROUTES = {
  FEATURE: {
    BASE: '/api/feature',
    CREATE: '/',
    GET_ALL: '/',
    GET_BY_ID: '/:featureId',
    UPDATE: '/:featureId',
    DELETE: '/:featureId',
  },
};
```

---

## Adding a New Module — Checklist

```
1. Create src/modules/[feature]/
   □ dto/[feature].dto.ts         Zod schemas + type exports
   □ types/[feature].types.ts     SafeEntity, PaginatedResponse, QueryFilters
   □ [feature].routes.ts          Routes using ROUTES constants, JSDoc per route
   □ [feature].controller.ts      Class, arrow function methods, safeParse, next(error)
   □ [feature].service.ts         Class, private helpers, public methods, Prisma calls

2. Register routes in server.ts
   □ Import router
   □ Mount with app.use(ROUTES.[FEATURE].BASE, featureRoutes)

3. Add route constants
   □ Add ROUTES.[FEATURE] block to utils/constants/routes.ts

4. Add Swagger docs
   □ Create services/swagger/modules/[feature]/paths.ts
   □ Register in services/swagger/index.ts

5. Add any new enums
   □ Add to utils/constants/enums.ts
```

---

## Common Mistakes to Avoid

| Mistake | Correct approach |
|---------|-----------------|
| Hardcoded route strings in routes file | Always use `ROUTES.FEATURE.METHOD` constants |
| `parse()` instead of `safeParse()` in controller | Always `safeParse()` — `parse()` throws uncaught errors |
| Business logic in controller | Controller parses + validates only; logic goes in service |
| Direct `prisma` calls in controller | Only service touches Prisma |
| Throwing `new Error(...)` in service | Always `throw this.createError(statusCode, message)` |
| Setting JSON fields to `null` directly in Prisma | Use `Prisma.JsonNull` for null JSON fields |
| `logger.info()` on every GET request | Log only mutations (create/update/delete) and errors |
| Missing `return` after `sendBadRequest` | Always `return` after any response to prevent double-send |
| Updating all fields regardless of DTO | Only update fields where `dto.field !== undefined` |
| Methods as regular class methods (not arrow functions) | Use arrow functions to preserve `this` binding in route handlers |
