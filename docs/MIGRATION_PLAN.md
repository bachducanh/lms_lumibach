# Kế hoạch Migrate Backend Next.js → NestJS

> **Tài liệu sống.** Tham chiếu với [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) (xương sống dự án). Cập nhật khi có quyết định mới.

**Ngày tạo kế hoạch:** 2026-05-11
**Người thực hiện:** Solo dev (giáo viên Tin học)
**Ước lượng tổng:** 4-6 tháng (làm bán thời gian, song song với giảng dạy)
**Trạng thái:** Phase 0 + Phase 0.5 docs + **Phase 1 (Sessions 1A→1F) hoàn thành** (2026-05-12, branch `feat/phase-0-monorepo`). NestJS API alive at `/api/v1/*`, auth bridge với NextAuth cookie verified end-to-end. Sẵn sàng Phase 2 (Testing Foundation).

---

## 1. Lý do migrate

1. Hiệu năng backend Next.js (Server Actions + Route Handlers) không tối ưu được như mong muốn.
2. Khó scale BE độc lập với FE.
3. Khó test BE: Server Actions gắn chặt với React component context.
4. Khó tách FE/BE để deploy lên server vật lý độc lập.
5. Cần REST API cho mobile app (Android — nhiều học sinh dùng smartphone giá rẻ).
6. Code organization: 21 file server actions ở `src/actions/` rải rác, khó refactor và phân quyền.

> **Lưu ý quan trọng về kỳ vọng hiệu năng:** Migrate kiến trúc KHÔNG tự động làm app nhanh hơn. Cải thiện hiệu năng đến từ: (1) cache layer Redis, (2) DB indexing tốt, (3) batch endpoints giảm số HTTP call, (4) MinIO proxy. Plan này bao gồm cả 4 yếu tố đó. Phase 0.5 đo baseline để xác định bottleneck thực trước khi migrate.

## 2. Mục tiêu kiến trúc

```
LMS_LumiBach/
├── apps/
│   ├── web/                # Next.js (FE) — server components fetch BE qua HTTP
│   └── api/                # NestJS (BE) — REST API + OpenAPI/Swagger + WebSocket
├── packages/
│   ├── db/                 # Prisma schema + generated client (shared)
│   ├── types/              # Zod schemas + DTOs + enums (SINGLE SOURCE)
│   └── config/             # ESLint, TS, Prettier configs share
├── docker/
│   ├── nginx/              # Reverse proxy config
│   ├── judge0/
│   └── postgres/
├── docs/
├── docker-compose.yml      # Dev: postgres + redis + minio + judge0 + api + web
├── docker-compose.prod.yml # Production
└── pnpm-workspace.yaml
```

**Stack BE (NestJS):**

- NestJS 10+ (latest stable)
- Prisma 5 (share qua `packages/db`)
- `@nestjs/passport` + `@nestjs/jwt` + bcrypt cost 12
- `nestjs-zod` — DTO + validation, share Zod schema với FE
- `@nestjs/swagger` — auto OpenAPI docs
- `@nestjs/bullmq` + `@nestjs/schedule` — background jobs + cron
- `@nestjs/throttler` — rate limit
- `@nestjs/cache-manager` + `cache-manager-redis-yet` — Redis cache layer
- `@nestjs/websockets` + `@nestjs/platform-socket.io` — real-time
- `nestjs-pino` — structured logging (đồng bộ với PROJECT_CONTEXT)
- `@sentry/node` — error tracking
- Vitest + Supertest — test

**Stack FE (giữ Next.js, refactor BE-related code):**

- Next.js 16 — App Router, Server Components fetch BE qua HTTP
- HTTP client tự viết bằng `fetch` + interceptor 401/refresh (đơn giản, không cần axios)
- Import Zod schema từ `packages/types` → dùng cho `react-hook-form` resolver + type
- Bỏ NextAuth ở Phase 7 (giai đoạn middle vẫn dùng để tránh đụng auth sớm)
- Bỏ toàn bộ `src/actions/` sau khi migrate xong

---

## 3. Performance targets (từ PROJECT_CONTEXT.md §15)

Bất kỳ refactor nào không đạt budget này = regression, không merge.

| Metric                   | Target  | Cách đo                     |
| ------------------------ | ------- | --------------------------- |
| First Contentful Paint   | < 1.5s  | Lighthouse, WebPageTest     |
| Time to Interactive      | < 3s    | Lighthouse                  |
| Largest Contentful Paint | < 2.5s  | Lighthouse, Core Web Vitals |
| API response p95         | < 500ms | NestJS Logger middleware    |
| Code execution p95       | < 5s    | BullMQ job duration         |
| DB query p95             | < 100ms | Prisma middleware logging   |

**Phase 0.5 sẽ đo baseline hiện tại** cho từng endpoint, lưu lại để so sánh sau mỗi phase.

---

## 4. Nguyên tắc xuyên suốt

> **Lưu ý thuật ngữ:** Khi plan ghi "HTTP call" / "gọi qua HTTP" là chỉ chung cho REST API request (đối lập với Server Action in-process). Về giao thức cụ thể:
>
> - **Local dev:** `http://localhost:4000` — không TLS
> - **Production:** `https://` bắt buộc — TLS terminate ở Nginx (Let's Encrypt + Certbot, đồng bộ với PROJECT_CONTEXT). BE NestJS bên trong vẫn lắng nghe HTTP, Nginx phía trước lo TLS.
> - **Cookie auth** ở Phase 7: `HttpOnly: true`, `Secure: true`, `SameSite: strict`, expires 7 ngày (theo §13 PROJECT_CONTEXT).

1. **Không break FE đang chạy.** Mỗi PR phải giữ Next.js (đang thay thế Moodle) chạy được.
2. **Migrate auth CUỐI cùng (Phase 7).** Giai đoạn middle: BE NestJS verify NextAuth JWT bằng cách share `AUTH_SECRET`. Không động vào auth UX.
3. **Strangler Fig Pattern.** Mỗi module sau khi có BE endpoint → FE thay server action bằng HTTP call → xóa server action cũ. Không để code chết.
4. **Prisma single source of truth.** Chỉ `packages/db` import `@prisma/client`. Migration ownership: `packages/db/prisma/migrations/`, chỉ chạy từ root qua `pnpm db:migrate`.
5. **Zod single source of truth.** Schema sống trong `packages/types/<module>/*.schema.ts`. FE import cho `react-hook-form` resolver + type. BE import qua `nestjs-zod` để validate request body. OpenAPI chỉ để DOC, KHÔNG generate type (tránh trùng nguồn).
6. **REST response shape thống nhất:**
   ```ts
   { success: true, data: T, meta?: { pagination, ... } }
   { success: false, error: { code: string, message: string, details?: unknown } }
   ```
   Trùng với `ActionResult<T>` đang dùng → migration ít breaking cho FE.
7. **API versioning từ Phase 1:** `app.enableVersioning({ type: VersioningType.URI })`. Tất cả endpoint bắt đầu `/api/v1/...`. Khi mobile launch → có sẵn cơ chế bump version mà không break web.
8. **Mỗi module = 1 PR + ít nhất 1 e2e test cho golden path.** Vitest + Supertest. Target coverage: 70% logic code (§15 PROJECT_CONTEXT).
9. **Cache-aside cho mọi endpoint read-heavy** (course list, lesson content, gradebook). Invalidate khi mutation. Pattern chuẩn:
   ```ts
   @CacheKey('courses:list:teacher:${userId}')
   @CacheTTL(300)
   ```
10. **Mỗi phase = 1 feature branch + commit thường xuyên** để dễ rollback.
11. **Performance budget gate trong CI**: mỗi PR chạy Lighthouse CI, fail nếu vượt budget.

---

## 5. Roadmap 11 Phase

### Phase 0 — Foundation (Monorepo + CI/CD) — 1 tuần

**Mục tiêu:** Chuyển repo hiện tại sang pnpm workspace mà KHÔNG đổi logic. Setup CI/CD pipeline.

**Monorepo refactor:**

- [ ] Tạo `pnpm-workspace.yaml` với `apps/*` và `packages/*`
- [ ] Di chuyển toàn bộ code Next.js hiện tại vào `apps/web/`:
  - `src/` → `apps/web/src/`
  - `next.config.ts`, `tsconfig.json`, `.eslintrc`, `postcss.config.mjs`, `components.json` → `apps/web/`
  - `public/` → `apps/web/public/`
- [ ] Tạo `packages/db/`:
  - Di chuyển `prisma/` từ root → `packages/db/prisma/`
  - `packages/db/src/index.ts` export `PrismaClient` singleton
  - Script `pnpm --filter @lumibach/db db:generate`, `db:migrate`, `db:studio`
- [ ] Tạo `packages/types/` (rỗng, fill dần ở các phase sau)
- [ ] Tạo `packages/config/` chia sẻ `tsconfig.base.json`, `eslint.base.mjs`, `prettier.config.mjs`
- [ ] Setup Turborepo (`turbo.json`) cho cache + parallel build
- [ ] Cập nhật scripts root `package.json`:
  - `pnpm dev` → chạy đồng thời tất cả apps qua turbo
  - `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:studio`
  - `pnpm test`, `pnpm type-check`, `pnpm lint` — chạy toàn workspace

**CI/CD setup:**

- [ ] `.github/workflows/test.yml` — chạy mỗi PR:
  - `pnpm install --frozen-lockfile`
  - `pnpm type-check`
  - `pnpm lint`
  - `pnpm test`
  - Lighthouse CI cho `apps/web` (perf budget gate)
- [ ] `.github/workflows/deploy.yml` — SSH deploy khi merge main (skeleton, hoàn thiện Phase 8)
- [ ] Husky pre-commit: `lint-staged` + `pnpm type-check` (đã có sẵn, update path)

**Verify:**

- [ ] `pnpm dev` chạy được, app vẫn hoạt động như cũ
- [ ] `pnpm db:studio` mở được
- [ ] Tất cả test cũ (nếu có) vẫn pass
- [ ] CI green trên PR

**Acceptance:** Toàn bộ feature hiện tại dùng được không đổi behavior. Dev workflow tương đương trước. CI pipeline xanh.

**Rủi ro:** Prisma DLL lock trên Windows (xem memory `project_status`). **Mitigation:** Dừng tất cả dev server trước khi regenerate Prisma. Document trong `apps/web/README.md`.

---

### Phase 0.5 — Performance Baseline (đo trước khi migrate) — 2-3 ngày

**Mục tiêu:** Có số đo cụ thể của hệ thống hiện tại để biết bottleneck ở đâu và để so sánh sau migrate.

- [ ] Bật slow query log PostgreSQL (`log_min_duration_statement = 100ms`)
- [ ] Chạy `EXPLAIN ANALYZE` cho các query nghi vấn (gradebook, course list, attempts)
- [ ] Đo p50/p95 latency của 10 endpoint quan trọng nhất bằng Next.js logs hoặc curl loop
- [ ] Lighthouse audit các page chính: `/`, `/courses/[slug]`, `/courses/[slug]/gradebook`, `/quizzes/[id]/take`
- [ ] Audit `prisma/schema.prisma`: kiểm tra index trên FK + field thường query (`email`, `slug`, `status`, `userId`)
- [ ] Identify top 3-5 bottleneck thực tế
- [ ] Document trong `docs/PERFORMANCE_BASELINE.md` (file mới)

**Output:** Bảng số liệu baseline. Sau mỗi phase chạy lại để verify cải thiện.

**Lưu ý:** Nếu bottleneck là **DB indexing** hoặc **N+1 query** → fix ngay ở Phase này, không cần đợi migrate xong. Có thể giải quyết 80% pain mà chưa cần NestJS.

---

### Phase 1 — NestJS Skeleton + Auth Bridge + Foundations — 1.5 tuần

**Mục tiêu:** BE NestJS chạy được, verify NextAuth JWT (auth bridge), có infrastructure đầy đủ cho các phase sau.

**Skeleton:**

- [ ] `cd apps && npx @nestjs/cli new api --package-manager pnpm`
- [ ] Cài deps: `@nestjs/config`, `@nestjs/jwt`, `@nestjs/passport`, `passport-jwt`, `nestjs-zod`, `nestjs-pino`, `@nestjs/swagger`, `@nestjs/throttler`, `@nestjs/cache-manager`, `cache-manager-redis-yet`, `@sentry/node`, `@lumibach/db`, `@lumibach/types`
- [ ] Setup config:
  - `ConfigModule` global với schema validation Zod
  - `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` → mọi route `/api/v1/...`
  - Global `ZodValidationPipe` (nestjs-zod)
  - Global `ResponseInterceptor` chuẩn shape `{ success, data, meta }`
  - Global `HttpExceptionFilter` chuẩn shape `{ success: false, error }` + convert Prisma error → HTTP code đúng (P2002 → 409, P2025 → 404, ...)
  - `ThrottlerModule` global: 100 req/min/user (theo §13 PROJECT_CONTEXT). Login + code submission có throttle riêng.
  - CORS: whitelist origin của `apps/web` (KHÔNG wildcard)

**Logging + Error tracking:**

- [ ] `nestjs-pino` global, structured JSON logs, log to file + stdout
- [ ] Pino redact: `password`, `token`, `secret`, `cookie` → không log PII (theo §13)
- [ ] Sentry init trong `main.ts`, capture exceptions
- [ ] Logger middleware đo response time cho mọi request → cảnh báo khi vượt p95 budget

**Auth bridge (không động UX):**

- [ ] `AuthModule` với `JwtStrategy`:
  - Đọc cookie `authjs.session-token` (kiểm tra version NextAuth v5 beta hiện tại)
  - Verify với `AUTH_SECRET` chung
  - Parse payload, fetch user từ DB qua Prisma → gắn `req.user`
- [ ] Decorator: `@CurrentUser()`, `@Public()`, `@Roles(Role.TEACHER, Role.ADMIN)`
- [ ] Global `JwtAuthGuard` (default require auth, dùng `@Public()` cho exception)
- [ ] `RolesGuard` — check role
- [ ] `OwnershipGuard` factory — check ownership (vd: teacher chỉ sửa course của mình). Hỗ trợ:
  - `@CourseOwnership('courseId')` — param name của courseId trong URL/body
  - `@CourseTeacherOrTA('courseId')` — pass cho cả TA được assign
  - Sau này dễ map sang RBAC matrix §10 của PROJECT_CONTEXT

**Cache layer:**

- [ ] `CacheModule` register với Redis (`cache-manager-redis-yet`)
- [ ] Helper `CacheKeyService` để generate cache key consistent (`'courses:list:teacher:${userId}'`)
- [ ] Helper `CacheInvalidationService` để invalidate theo pattern khi mutation

**Endpoints test:**

- [ ] `GET /api/v1/health` (public) → `{ success: true, data: { status: 'ok' } }`
- [ ] `GET /api/v1/me` (auth) → user info từ DB
- [ ] Swagger UI ở `/api/docs`

**Docker:**

- [ ] Update `docker-compose.yml` thêm service `api` (port 4000) và `redis` (nếu chưa có)
- [ ] BE service depend_on: postgres, redis, minio, judge0

**FE wire-up:**

- [ ] `apps/web/src/lib/api-client.ts` — fetch wrapper:
  - Base URL từ env `NEXT_PUBLIC_API_URL`
  - `credentials: 'include'` để gửi cookie NextAuth
  - Interceptor 401 → redirect login
  - Type-safe response qua Zod schema (parse response trước khi return)
- [ ] Server Component test: trong 1 page random gọi `GET /api/v1/me` xem có nhận user đúng không

**Acceptance:**

- Login bằng NextAuth ở web → từ Server Component hoặc Client gọi `GET /api/v1/me` của BE → nhận user object đúng
- Swagger hiển thị 2 endpoint
- Logs có structured JSON ra stdout + file
- Sentry nhận được test error

**Rủi ro:** NextAuth v5 beta có thể đổi cookie name (`__Secure-authjs.session-token` ở production, `authjs.session-token` ở dev) hoặc payload structure giữa các version. **Mitigation:** đọc kỹ docs v5.0.0-beta.31, test cả 2 môi trường dev/prod.

---

### Phase 2 — Testing Foundation — 3-4 ngày

**Mục tiêu:** Có thể viết test e2e/unit/integration cho mọi module BE từ Phase 3.

- [ ] Setup Vitest cho `apps/api`:
  - `vitest.config.ts`: alias paths, env load `.env.test`
- [ ] Tạo `apps/api/test/setup.ts`:
  - Container Postgres test riêng (docker-compose.test.yml port 5433)
  - `beforeAll`: run migration
  - `beforeEach`: truncate tables (giữ schema)
  - Helper factory: `createTestUser({ role })`, `createTestCourse({ teacherId })`, `createTestEnrollment(...)`
- [ ] Supertest wrapper với fake JWT:
  - Helper `signTestToken(userId)` sign bằng `AUTH_SECRET` cho test
  - Helper `testRequest(app)` set cookie auto
- [ ] Viết test mẫu cho `GET /api/v1/me`:
  - ✅ Pass: user thật, token đúng
  - ❌ 401: không có token
  - ❌ 401: token expired
  - ❌ 401: token sai signature
- [ ] CI: `.github/workflows/test.yml` thêm step:
  - Start postgres test container
  - `pnpm --filter @lumibach/api test`
- [ ] Setup Playwright cho `apps/web` (e2e cross-app sau khi có BE module đầu tiên):
  - Smoke test: login → dashboard load đúng
  - 1 critical flow per phase

**Acceptance:** `pnpm test` ở root pass tất cả. CI xanh.

---

### Phase 3 — Migrate Low-Risk Modules — 1.5-2 tuần

**Mục tiêu:** Thực hành workflow Strangler Fig với module ít rủi ro, ít business logic phức tạp.

Migrate theo thứ tự (mỗi module ~3 ngày):

| Thứ tự | Module        | Endpoints chính                                            | Cache?              |
| ------ | ------------- | ---------------------------------------------------------- | ------------------- |
| 1      | activity      | `GET /activities` (user-scoped)                            | TTL 60s             |
| 2      | analytics     | `GET /analytics/*` (admin/teacher)                         | TTL 300s            |
| 3      | notifications | `GET /notifications`, `POST /:id/read`, `PUT /preferences` | invalidate on write |
| 4      | forum         | `GET/POST/PATCH/DELETE /forum/threads`, `/posts`           | invalidate on write |

**Workflow chuẩn cho mỗi module:**

1. Đọc file `apps/web/src/actions/<module>.ts` để hiểu logic + permission check hiện tại
2. Tạo Zod schema trong `packages/types/src/<module>/*.schema.ts`
3. Tạo `apps/api/src/modules/<module>/`:
   - `<module>.module.ts`
   - `<module>.controller.ts` — REST endpoints với Swagger annotations
   - `<module>.service.ts` — copy logic từ server action, dùng Prisma từ `@lumibach/db`
   - `<module>.controller.spec.ts` — e2e test ít nhất 1 golden path + 1 negative path
4. Add cache decorator + invalidation logic
5. FE refactor:
   - Thay `import { createX } from '@/actions/<module>'` bằng `apiClient.post('/api/v1/<module>')`
   - Update Server Component `await fetch(...)` thay vì `await db.X.findMany(...)`
6. Xóa file `src/actions/<module>.ts` cũ
7. Manual test trên dev: feature vẫn hoạt động
8. Performance check: so sánh latency với baseline
9. Commit + merge

**Acceptance:** 4 module chạy 100% qua BE. FE không còn server action cho 4 module này. Latency không tệ hơn baseline.

---

### Phase 4 — Migrate Core Domain — 2-2.5 tuần

Migrate theo bounded context:

| Thứ tự | Module           | Lưu ý đặc biệt                                                               |
| ------ | ---------------- | ---------------------------------------------------------------------------- |
| 5      | users + students | Admin user management, profile, Excel import (chuyển xuống BE: stream parse) |
| 6      | courses          | CRUD + thumbnail upload qua MinIO (multer + stream) + course clone           |
| 7      | modules          | Course modules CRUD + reorder                                                |
| 8      | lessons          | TipTap content (sanitize HTML với `isomorphic-dompurify` ở BE)               |
| 9      | enrollments      | Manual + bulk + enrollment code + TA assignment                              |
| 10     | attachments      | Lesson attachments upload + signed URL từ MinIO                              |

**Lưu ý kỹ thuật:**

- **File upload**: dùng `@nestjs/platform-express` + `FileInterceptor`, stream lên MinIO. Whitelist extension + MIME type thật (theo §13). Max 50MB.
- **Excel import**: chuyển xuống BE để FE không phải parse file lớn. Endpoint `POST /api/v1/users/import` upload xlsx → BE parse với `xlsx` package → bulk insert.
- **HTML sanitize**: TipTap output có thể chứa XSS payload. BE phải `DOMPurify.sanitize()` trước khi save DB.
- **Course clone**: transaction phức tạp, viết test kỹ.

**Cache strategy:**

- Course list per teacher/student: TTL 300s, invalidate khi CRUD course
- Lesson content: TTL 600s, invalidate khi edit lesson
- Enrollment list per course: TTL 60s

**Acceptance:** Toàn bộ flow course/module/lesson/enrollment chạy qua BE. Học sinh xem được lesson, giáo viên sửa được course như trước. Latency p95 < 500ms (target).

---

### Phase 5 — Migrate Assessment Modules — 2-3 tuần (phức tạp nhất)

| Thứ tự | Module                              | Lưu ý                                                 |
| ------ | ----------------------------------- | ----------------------------------------------------- |
| 11     | assignments                         | CRUD + submission (file/text) + late policy           |
| 12     | rubrics + rubric grading            | Logic chấm điểm có trọng số                           |
| 13     | quizzes + questions (Question Bank) | Reuse questions across quizzes                        |
| 14     | attempts                            | Auto-grade + manual grade (essay) + auto-fail timeout |
| 15     | gradebook + CSV export              | Tính trung bình + weighting                           |

**Rủi ro cao:** Logic chấm điểm phức tạp. Bắt buộc test e2e cho:

- Auto-grade quiz đúng cho từng loại câu hỏi (multiple choice, true/false, multiple answer, code)
- Rubric grading: tổng điểm = sum(criteria \* weight)
- Gradebook: trung bình theo weighting policy đúng
- Late submission: penalty áp đúng

**Cache strategy:**

- Question bank list per teacher: TTL 300s
- Gradebook per course: TTL 30s (đọc nhiều, cập nhật khi chấm xong)
- Quiz attempt list: KHÔNG cache (real-time)

**WebSocket prep:** Khi học sinh đang làm quiz có time limit, FE cần biết time remaining server-side authoritative → setup WebSocket cho quiz timer ở đây hoặc Phase 6.5.

**Acceptance:** Học sinh làm bài và nhận điểm chính xác như trước migrate. Test 5 scenario chấm điểm cụ thể đều pass.

---

### Phase 6 — Code Execution + Background Jobs — 1.5 tuần

| Thứ tự | Module          | Lưu ý                                                                    |
| ------ | --------------- | ------------------------------------------------------------------------ |
| 16     | code-exercises  | Python, C++, Web exercises CRUD                                          |
| 17     | sandbox         | Code playground không lưu submission                                     |
| 18     | scratch         | Scratch project save/load (file lớn, lưu MinIO)                          |
| 19     | judge0 service  | Wrap Judge0 API, retry, timeout                                          |
| 20     | Background jobs | Migrate `src/workers/code-execution.ts` và `src/workers/email.worker.ts` |
| 21     | Cron jobs       | `@nestjs/schedule` thay external `/api/cron/due-soon`                    |

**Background jobs architecture:**

- Producer ở `apps/api` qua `@nestjs/bullmq` `@InjectQueue('code-execution')`
- Consumer:
  - **Option A (đơn giản):** Worker trong cùng `apps/api` process (`@Processor('code-execution')`)
  - **Option B (recommend):** Tách thành `apps/worker` process riêng, có thể scale độc lập, không block API request

**→ Quyết định: Option B.** Tạo `apps/worker` chỉ load các `Processor`, không expose HTTP. Share `packages/db` và `packages/types`.

**Lưu ý kỹ thuật:**

- Judge0 networking: BE container call Judge0 qua Docker network name `lumibach-judge0`, KHÔNG `localhost`
- Judge0 resource limits đã cấu hình ở `judge0.conf` (theo §13)
- Code submission rate limit: 10/min/user (`@Throttle({ default: { limit: 10, ttl: 60000 } })`)
- Scratch project file lớn → upload trực tiếp MinIO, BE chỉ lưu URL

**Acceptance:** Học sinh submit code → kết quả về đúng. Email notification gửi đúng. Cron `due-soon` chạy đúng 9h sáng mỗi ngày.

---

### Phase 6.5 — WebSocket Real-time Gateway — 4-5 ngày

**Mục tiêu:** Real-time cho notification + code execution result + quiz timer. NestJS làm điều này tốt hơn Next.js nhiều — đây là điểm ăn điểm của migrate này.

- [ ] `NotificationGateway` (`@WebSocketGateway`):
  - User connect → join room `user:${userId}`
  - Worker emit event `notification.created` → push tới room
  - FE: `apps/web/src/hooks/useNotifications.ts` connect Socket.IO, replace polling hiện tại
- [ ] `CodeExecutionGateway`:
  - Học sinh submit code → join room `submission:${submissionId}`
  - Worker complete Judge0 → emit `submission.complete` với result
  - FE: thay polling bằng WebSocket listener
- [ ] `QuizGateway` (optional, nếu quiz có time limit nghiêm ngặt):
  - Server-authoritative timer
  - Auto-submit khi hết giờ qua WebSocket
- [ ] Authentication WebSocket: handshake validate JWT cookie giống REST
- [ ] CORS WebSocket: cùng whitelist với REST

**Acceptance:** Học sinh submit code KHÔNG cần refresh, kết quả hiện ngay khi Judge0 xong. Notification bell update tức thời.

---

### Phase 7 — Auth Migration (cuối cùng, rủi ro cao) — 1.5 tuần

**Bây giờ mới động vào auth.** BE đã production-ready, mọi module đã chạy qua BE.

**Backend:**

- [ ] `POST /api/v1/auth/register` (email + password, bcrypt cost 12)
- [ ] `POST /api/v1/auth/login` → trả access token (15 phút, in-memory ở FE) + set refresh token (7 ngày, httpOnly cookie `Secure: true, SameSite: strict`)
- [ ] `POST /api/v1/auth/refresh` → đổi access token mới
- [ ] `POST /api/v1/auth/logout` → revoke refresh token (lưu blacklist Redis)
- [ ] `POST /api/v1/auth/forgot-password` → tạo token + gửi email qua BullMQ
- [ ] `POST /api/v1/auth/reset-password` → verify token + đổi password
- [ ] `POST /api/v1/auth/verify-email` → confirm email
- [ ] Rate limit chuyên biệt: login 5/15p/IP (theo §13)
- [ ] Bảng `RefreshToken { id, userId, hashedToken, expiresAt, revokedAt }` trong Prisma

**Frontend:**

- [ ] `AuthContext` mới, lưu access token trong memory (KHÔNG localStorage để tránh XSS)
- [ ] Route handler `apps/web/src/app/api/auth/[...path]/route.ts` làm proxy: forward request + cookie tới BE (giữ refresh token trong httpOnly cookie domain `apps/web`)
- [ ] Middleware `apps/web/src/middleware.ts`: check access token → tự refresh nếu expired → redirect login nếu refresh fail
- [ ] Update tất cả Server Components đang dùng `auth()` của NextAuth → dùng `getServerSession()` mới (đọc cookie + verify với BE)
- [ ] **Xóa NextAuth khỏi `apps/web`**: bỏ deps `next-auth`, xóa `src/lib/auth.ts`, xóa `app/api/auth/[...nextauth]/route.ts`

**Migration data:**

- [ ] Script `scripts/migrate-sessions.ts`: tạo refresh token cho user đang active, không bắt re-login (tùy chọn — hoặc invalidate hết, bắt user re-login 1 lần)

**Mobile-ready:**

- [ ] Endpoint `POST /api/v1/auth/login` chấp nhận thêm `clientType: 'mobile'` → trả refresh token JSON thay vì cookie
- [ ] Document trong Swagger

**Acceptance:** User đang login không bị bật ra (hoặc bị bật ra đúng 1 lần với thông báo). Login/logout/forgot/reset/register hoạt động. Mobile có thể login qua REST.

**Rủi ro cao:** Hỏng auth = sập toàn bộ app. **Mitigation:** Deploy Phase 7 ngoài giờ học (cuối tuần), thông báo trước, có rollback plan (giữ Phase 6 branch deploy được trong 1 lệnh).

---

### Phase 8 — Cleanup + Production Deploy — 1.5 tuần

**Cleanup:**

- [ ] Xóa toàn bộ `apps/web/src/actions/` (audit grep `'use server'`)
- [ ] Audit grep `import.*@prisma/client` trong `apps/web` — chỉ được phép trong route handler proxy auth, không nơi khác
- [ ] Convert `<form action={...}>` còn lại → submit qua HTTP client
- [ ] Update [docs/PROJECT_CONTEXT.md](PROJECT_CONTEXT.md): cập nhật stack, kiến trúc, cấu trúc thư mục cho phù hợp kiến trúc mới
- [ ] Update [docs/DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) nếu có thay đổi (RefreshToken model mới)
- [ ] Update [docs/DEPLOYMENT.md](DEPLOYMENT.md) cho kiến trúc tách
- [ ] Update [docs/PHYSICAL_SERVER_SETUP.md](PHYSICAL_SERVER_SETUP.md)
- [ ] Thêm QĐ-008 vào §12 PROJECT_CONTEXT: migrate sang NestJS

**Hardening BE:**

- [ ] Helmet middleware
- [ ] CSP headers strict
- [ ] Rate limit per endpoint cụ thể (`@Throttle()` cho login, register, code submit)
- [ ] Input sanitization HTML (DOMPurify ở server cho TipTap content)
- [ ] CORS whitelist chính xác (production domain)
- [ ] SQL injection: Prisma đã safe mặc định
- [ ] Audit log: middleware log mọi mutation của Admin/Teacher (theo §13)

**Observability:**

- [ ] Sentry config production DSN
- [ ] Pino log to file với logrotate (giữ 30 ngày theo §14)
- [ ] Uptime Kuma monitor `/api/v1/health` và `/` mỗi 5 phút (theo §14)
- [ ] Alert thresholds (§14): CPU > 80%, RAM > 90%, error rate > 5%, p95 > 3s
- [ ] (Phase 2 PROJECT_CONTEXT) Grafana + Prometheus + Loki — chưa cần ngay

**Dockerfiles + Compose:**

- [ ] `apps/api/Dockerfile` (multi-stage, base node:20-alpine)
- [ ] `apps/web/Dockerfile` (Next.js standalone output)
- [ ] `apps/worker/Dockerfile`
- [ ] `docker-compose.prod.yml`: nginx + web + api + worker + postgres + redis + minio + judge0
- [ ] `docker/nginx/nginx.conf`:
  - SSL termination với Let's Encrypt (Certbot auto-renew theo §14)
  - `lumibach.example.com` → web container (port 3000 nội bộ)
  - `lumibach.example.com/api` → api container (port 4000 nội bộ)
  - `lumibach.example.com/files` → MinIO container (port 9000) — **MinIO proxy** để cùng domain, giảm DNS lookup cho học sinh 4G
  - `lumibach.example.com/ws` → api WebSocket (proxy upgrade headers)
  - HTTP → HTTPS redirect 301
  - HSTS header
  - Rate limit cấp Nginx (cộng thêm tầng phía trước throttler của Nest)
  - gzip + brotli compression
- [ ] Static asset caching Nginx cho `_next/static/*` (immutable, 1 năm)

**CI/CD:**

- [ ] `.github/workflows/deploy.yml`:
  - Trigger: push to `main`
  - Build images, push lên GHCR hoặc build trực tiếp trên server
  - SSH server → `docker compose pull && docker compose up -d --remove-orphans` → run `pnpm db:migrate:deploy`
  - Smoke test: `curl /api/v1/health`, fail thì auto-rollback (giữ 3 phiên bản gần nhất theo §14)

**Performance verification:**

- [ ] So sánh với Phase 0.5 baseline cho 10 endpoint chính
- [ ] Đảm bảo đạt performance budget §15 PROJECT_CONTEXT
- [ ] Test load: 100 user đồng thời (theo §3 PROJECT_CONTEXT)

**Backup:**

- [ ] Script `backup.sh` đã có (theo §14) → verify chạy đúng cho kiến trúc mới
- [ ] Backup config files mới (nginx.conf, docker-compose.prod.yml) lên Backblaze B2

**Acceptance:** Deploy thành công trên server vật lý. Toàn bộ user flow hoạt động. Performance đạt budget. Backup + monitoring chạy.

---

## 6. Danh sách module cần migrate (21 server actions hiện tại)

Hiện tại `apps/web/src/actions/` có (sau Phase 0):

| Module        | Phase | Độ phức tạp | Cache TTL khuyến nghị            |
| ------------- | ----- | ----------- | -------------------------------- |
| activity      | 3     | Thấp        | 60s                              |
| analytics     | 3     | Thấp        | 300s                             |
| notifications | 3     | Trung       | invalidate on write              |
| forum         | 3     | Thấp        | invalidate on write              |
| users         | 4     | Trung       | 60s profile, no cache list admin |
| students      | 4     | Thấp        | 300s                             |
| courses       | 4     | Trung       | 300s                             |
| modules       | 4     | Thấp        | 600s                             |
| lessons       | 4     | Trung       | 600s                             |
| enrollments   | 4     | Trung       | 60s                              |
| attachments   | 4     | Trung       | no cache (signed URL)            |
| assignments   | 5     | Cao         | 60s                              |
| rubric        | 5     | Cao         | 600s                             |
| quizzes       | 5     | Cao         | 300s                             |
| questions     | 5     | Trung       | 300s                             |
| attempts      | 5     | Cao         | no cache                         |
| gradebook     | 5     | Cao         | 30s                              |
| code          | 6     | Cao         | no cache                         |
| exercises     | 6     | Trung       | 300s                             |
| sandbox       | 6     | Trung       | no cache                         |
| scratch       | 6     | Trung       | no cache                         |
| auth          | 7     | Cao (cuối)  | —                                |

## 7. Câu hỏi mở (quyết định trước Phase liên quan)

- [ ] **Trước Phase 0:** Dùng Turborepo? → **Recommend: có**
- [ ] **Trước Phase 5:** Quiz timer dùng client-side hay server WebSocket? → **Recommend: server WebSocket** (chống cheat thay đổi giờ máy)
- [ ] **Trước Phase 6:** Worker tách process (`apps/worker`) hay gộp `apps/api`? → **Recommend: tách**
- [ ] **Trước Phase 7:** Refresh token storage: cookie-only (web) + JSON (mobile) → **Đã quyết: dual mode qua `clientType`**
- [ ] **Trước Phase 8:** Build image trên CI hay trên server? → Server vật lý có CPU thừa → **Recommend: build trực tiếp trên server qua docker compose build** (đỡ setup registry)

## 8. Rủi ro lớn và mitigation

| Rủi ro                               | Khả năng | Tác động | Mitigation                                                |
| ------------------------------------ | -------- | -------- | --------------------------------------------------------- |
| Auth migration phá session hàng loạt | Trung    | Cao      | Phase 7 cuối, deploy ngoài giờ, rollback plan             |
| Prisma DLL lock Windows              | Cao      | Thấp     | Workflow: dừng dev server trước generate                  |
| NextAuth v5 beta đổi cookie spec     | Trung    | Trung    | Test cả dev + prod env trước Phase 1 merge                |
| Latency tăng vì thêm HTTP hop        | Cao      | Trung    | Cache layer + batch endpoints + same Docker network       |
| Logic chấm điểm bug khi migrate      | Trung    | Cao      | Phase 5 test e2e 5 scenario, song song với code cũ 1 tuần |
| Developer fatigue (4-6 tháng)        | Cao      | Trung    | Mỗi tuần ship 1 module, demo-able, không kéo dài phase    |
| Mất dữ liệu khi migrate DB           | Thấp     | Cực cao  | Backup trước mọi migration, test restore (§14)            |
| Judge0 networking thay đổi           | Trung    | Trung    | Phase 6 test integration kỹ với docker network            |

## 9. Bảng theo dõi tiến độ

| Phase                             | Status  | Ngày bắt đầu | Ngày kết thúc | Performance check  | Note |
| --------------------------------- | ------- | ------------ | ------------- | ------------------ | ---- |
| 0 — Foundation + CI/CD            | ⬜ Chưa |              |               | —                  |      |
| 0.5 — Performance baseline        | ⬜      |              |               | Baseline number    |      |
| 1 — NestJS skeleton + Auth bridge | ⬜      |              |               | API p95 < 500ms    |      |
| 2 — Testing foundation            | ⬜      |              |               | —                  |      |
| 3 — Low-risk modules              | ⬜      |              |               | So sánh baseline   |      |
| 4 — Core domain                   | ⬜      |              |               | So sánh baseline   |      |
| 5 — Assessment                    | ⬜      |              |               | So sánh baseline   |      |
| 6 — Code execution + jobs         | ⬜      |              |               | Code exec p95 < 5s |      |
| 6.5 — WebSocket gateway           | ⬜      |              |               | —                  |      |
| 7 — Auth migration                | ⬜      |              |               | —                  |      |
| 8 — Production deploy             | ⬜      |              |               | Full budget §15    |      |

---

## 10. Liên kết tài liệu

- [PROJECT_CONTEXT.md](PROJECT_CONTEXT.md) — xương sống dự án (stack, RBAC, performance budgets)
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — schema reference
- [DEPLOYMENT.md](DEPLOYMENT.md) — deployment guide (cập nhật ở Phase 8)
- [PHYSICAL_SERVER_SETUP.md](PHYSICAL_SERVER_SETUP.md) — server vật lý setup
- `docs/PERFORMANCE_BASELINE.md` — sẽ tạo ở Phase 0.5

---

**Phương châm:** Moodle vẫn là backup → không vội, làm chậm mà chắc. Mỗi phase phải để FE hiện tại chạy được như cũ. Migrate kiến trúc + tối ưu hiệu năng đi cùng nhau, không tách rời.
