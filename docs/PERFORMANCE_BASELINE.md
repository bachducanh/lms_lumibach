# Performance Baseline — Phase 0.5

> **Mục tiêu:** Đo p50/p95 latency + identify bottleneck thực tế của hệ thống Next.js hiện tại TRƯỚC khi migrate sang NestJS. Có baseline để so sánh sau mỗi phase migration.
>
> **Ngày tạo:** 2026-05-12
> **Phase:** 0.5 (Performance Baseline)
> **Liên kết:** [MIGRATION_PLAN.md](MIGRATION_PLAN.md) §3 Performance targets

---

## 1. Performance budgets (đã định nghĩa ở PROJECT_CONTEXT §15)

Bất kỳ thay đổi nào sau migration KHÔNG được vượt budget này:

| Metric                   | Target  | Đo bằng                                        |
| ------------------------ | ------- | ---------------------------------------------- |
| First Contentful Paint   | < 1.5s  | Lighthouse, Core Web Vitals                    |
| Time to Interactive      | < 3s    | Lighthouse                                     |
| Largest Contentful Paint | < 2.5s  | Lighthouse, Core Web Vitals                    |
| API response p95         | < 500ms | Next.js logs / NestJS middleware sau migration |
| Code execution p95       | < 5s    | BullMQ job duration                            |
| DB query p95             | < 100ms | Prisma slow query log                          |

---

## 2. Index audit — Prisma schema

Đã audit `packages/db/prisma/schema.prisma`. Dưới đây là index THIẾU có khả năng cao gây slow query:

### 2.1 HIGH impact (fix sớm — query rất thường)

| Model            | Index đề xuất                          | Lý do                                                                                                |
| ---------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `Submission`     | `@@index([assignmentId, status])`      | Teacher xem "submissions của assignment X status SUBMITTED/GRADED" — query mỗi lần vào trang grading |
| `Submission`     | `@@index([studentId, status])`         | Student xem submissions của mình theo status                                                         |
| `CodeSubmission` | `@@index([status])`                    | Worker pickup pending submissions, monitoring dashboard                                              |
| `CodeSubmission` | `@@index([studentId, codeExerciseId])` | Get latest attempt của student cho exercise                                                          |
| `QuizAttempt`    | `@@index([quizId, studentId])`         | Check "student này đã làm quiz chưa" + lấy attempts                                                  |
| `QuizAttempt`    | `@@index([status])`                    | Filter IN_PROGRESS/SUBMITTED/GRADED                                                                  |
| `Assignment`     | `@@index([courseId, status])`          | Query thường "assignment của course X status PUBLISHED"                                              |
| `Assignment`     | `@@index([courseId, dueDate])`         | Calendar/upcoming view                                                                               |
| `Quiz`           | `@@index([courseId, status])`          | Tương tự Assignment                                                                                  |
| `CodeExercise`   | `@@index([courseId, status])`          | Tương tự Assignment                                                                                  |

### 2.2 MEDIUM impact

| Model            | Index đề xuất               | Lý do                                    |
| ---------------- | --------------------------- | ---------------------------------------- |
| `ModuleItem`     | `@@index([lessonId])`       | FK lookup — Postgres không auto-index FK |
| `ModuleItem`     | `@@index([assignmentId])`   | FK lookup                                |
| `ModuleItem`     | `@@index([quizId])`         | FK lookup                                |
| `ModuleItem`     | `@@index([codeExerciseId])` | FK lookup                                |
| `Submission`     | `@@index([gradedAt])`       | Gradebook sort recent grades             |
| `CodeSubmission` | `@@index([submittedAt])`    | Recent submissions view                  |
| `QuizAttempt`    | `@@index([submittedAt])`    | Recent attempts view                     |

### 2.3 LOW impact (matter ở scale lớn)

| Model        | Index đề xuất                        | Lý do                            |
| ------------ | ------------------------------------ | -------------------------------- |
| `Answer`     | `@@index([questionId])`              | Cross-attempt question analytics |
| `Submission` | `@@index([assignmentId, deletedAt])` | Soft delete pair                 |

### 2.4 Plan áp dụng

- **Fix CHỈ HIGH impact ở Phase 0.5** (1 migration `add_missing_indexes`) — đã đo baseline trước, sau khi áp dụng đo lại để verify
- MEDIUM/LOW áp dụng dần khi monitor thấy slow query

---

## 3. Methodology — Cách đo

### 3.1 PostgreSQL slow query log

**Setup (chạy 1 lần):**

```sql
-- Connect tới docker-postgres-1 bằng psql:
docker exec -it docker-postgres-1 psql -U lumibach -d lumibach

-- Bật log query > 100ms:
ALTER SYSTEM SET log_min_duration_statement = '100ms';
ALTER SYSTEM SET log_statement = 'none';      -- chỉ log slow, không log all
ALTER SYSTEM SET log_duration = off;
SELECT pg_reload_conf();

-- Verify:
SHOW log_min_duration_statement;   -- should be '100ms'
```

**Xem slow queries:**

```bash
docker logs docker-postgres-1 --tail 200 | grep "duration:"
```

### 3.2 EXPLAIN ANALYZE cho query nghi vấn

```sql
-- Mẫu: gradebook query
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT s.*, a.title, a."maxScore"
FROM "Submission" s
JOIN "Assignment" a ON s."assignmentId" = a.id
WHERE a."courseId" = 'cmolXXXXX' AND s.status = 'GRADED'
ORDER BY s."gradedAt" DESC LIMIT 50;

-- Kiểm tra: Seq Scan = không có index, Index Scan = có index
-- Execution Time: tổng thời gian (ms)
```

### 3.3 Endpoint latency từ Next.js dev log

Next.js dev đã log latency mỗi request:

```
GET /api/auth/session 200 in 84ms (next.js: 5ms, proxy.ts: 11ms, application-code: 78ms)
```

**Capture:** chạy `pnpm web:dev > dev.log 2>&1`, dùng app như bình thường, sau đó parse:

```bash
grep -E "GET|POST|PATCH" dev.log | awk '{ for(i=1;i<=NF;i++) if($i ~ /^in$/) print $1, $2, $(i+1) }'
```

### 3.4 Lighthouse audit cho FE

```bash
# Cài Lighthouse CI (1 lần):
npm install -g @lhci/cli

# Audit một page (cần dev hoặc prod server đang chạy):
lhci collect --url=http://localhost:3000/courses --numberOfRuns=3
lhci collect --url=http://localhost:3000/courses/your-slug/gradebook --numberOfRuns=3
```

Pages quan trọng cần audit:

- `/` — login redirect
- `/dashboard` — landing sau login
- `/courses` — course list
- `/courses/[slug]` — course detail (data heavy)
- `/courses/[slug]/gradebook` — gradebook (JOIN nhiều)
- `/courses/[slug]/lessons/[id]` — TipTap rich text load
- `/courses/[slug]/quizzes/[id]/take` — quiz taker (real-time)

---

## 4. Bảng metrics — điền sau khi đo

> **Cách dùng:** chạy app ~1 tuần với traffic thực tế (giáo viên + học sinh dùng). Sau đó điền vào bảng. Compare với target budgets §1.

### 4.1 API endpoint latency (p50 / p95)

| Endpoint                            | Method | Baseline p50 | Baseline p95 | Target p95 | Status |
| ----------------------------------- | ------ | ------------ | ------------ | ---------- | ------ |
| `/api/auth/session`                 | GET    | _TBD_        | _TBD_        | < 100ms    | ⏳     |
| `/dashboard`                        | GET    | _TBD_        | _TBD_        | < 500ms    | ⏳     |
| `/courses`                          | GET    | _TBD_        | _TBD_        | < 500ms    | ⏳     |
| `/courses/[slug]`                   | GET    | _TBD_        | _TBD_        | < 500ms    | ⏳     |
| `/courses/[slug]/gradebook`         | GET    | _TBD_        | _TBD_        | < 800ms    | ⏳     |
| `/courses/[slug]/quizzes/[id]/take` | GET    | _TBD_        | _TBD_        | < 500ms    | ⏳     |
| Server Action: `gradeQuizAttempt`   | POST   | _TBD_        | _TBD_        | < 1000ms   | ⏳     |
| Server Action: `submitCode`         | POST   | _TBD_        | _TBD_        | < 500ms    | ⏳     |
| `/api/upload/lesson-file`           | POST   | _TBD_        | _TBD_        | < 2000ms   | ⏳     |

### 4.2 DB slow queries (>100ms)

Sau khi bật slow query log + dùng app 1 tuần, kéo top 5-10 query chậm:

| #   | Query (rút gọn) | Avg ms | Count | Index miss? | Fix   |
| --- | --------------- | ------ | ----- | ----------- | ----- |
| 1   | _TBD_           | _TBD_  | _TBD_ | _TBD_       | _TBD_ |

### 4.3 Lighthouse scores

| Page                        | FCP   | TTI   | LCP   | Performance | A11y  | SEO   |
| --------------------------- | ----- | ----- | ----- | ----------- | ----- | ----- |
| `/dashboard`                | _TBD_ | _TBD_ | _TBD_ | _TBD_       | _TBD_ | _TBD_ |
| `/courses/[slug]`           | _TBD_ | _TBD_ | _TBD_ | _TBD_       | _TBD_ | _TBD_ |
| `/courses/[slug]/gradebook` | _TBD_ | _TBD_ | _TBD_ | _TBD_       | _TBD_ | _TBD_ |

### 4.4 Code execution latency

| Language        | Test cases | p50   | p95   | Target p95 |
| --------------- | ---------- | ----- | ----- | ---------- |
| Python          | 5          | _TBD_ | _TBD_ | < 5s       |
| C++             | 5          | _TBD_ | _TBD_ | < 5s       |
| Web (no judge0) | —          | _TBD_ | _TBD_ | < 200ms    |

---

## 5. Top bottleneck — identified

> Fill sau khi có data §4. Mỗi bottleneck cần: root cause + fix proposal + estimated impact.

1. _TBD_
2. _TBD_
3. _TBD_

---

## 6. Action items rút ra

### Action ngay (Phase 0.5)

- [ ] Apply HIGH-impact indexes (§2.1) — 1 migration
- [ ] Enable slow query log (§3.1)
- [ ] Capture 1 tuần dữ liệu thực tế

### Action sau (Phase tương ứng)

- [ ] MEDIUM indexes (§2.2) — Phase 3 khi migrate module liên quan
- [ ] Re-architect query nếu slow query không fix được bằng index — vào plan của Phase migrate module đó
- [ ] Lighthouse fix < target → Phase 8 (production deploy hardening)

---

## 7. Re-measurement schedule

Đo lại metrics §4 sau mỗi phase migrate quan trọng:

- Sau Phase 1 (NestJS skeleton) — verify baseline không degrade
- Sau Phase 3 (low-risk modules migrated) — first compare BE vs Server Action
- Sau Phase 5 (assessment migrated) — heavy query path
- Sau Phase 8 (production deploy) — final

Lưu lịch sử trong bảng riêng:

```
| Date | Phase | Endpoint | p50 | p95 | vs baseline |
```
