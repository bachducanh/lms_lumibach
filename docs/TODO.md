# TODO - LMS_LumiBach

> Task list chi tiết theo tuần. Tick `[x]` khi hoàn thành. Cập nhật trạng thái mỗi cuối tuần.

**Phiên bản**: 1.1
**Ngày bắt đầu**: [Điền ngày bắt đầu]
**Hiện tại đang ở**: Tuần 19

---

## Trạng thái tổng quan

| Tháng | Mục tiêu chính | Tiến độ |
|-------|----------------|---------|
| Tháng 1 | Foundation: Setup + Auth + User | ✅ Xong (Tuần 1-4) |
| Tháng 2 | Course + Content | ✅ Xong (Tuần 5-8) |
| Tháng 3 | Assignment + Quiz | ✅ Xong (Tuần 9-12) |
| Tháng 4 | Code Execution | ✅ Xong (Tuần 13-16) |
| Tháng 5 | Polish + Beta Test | 🟡 Đang làm (Tuần 19/20) |
| Tháng 6 | Mở rộng dần | ⬜ Chưa bắt đầu |

Trạng thái: ⬜ Chưa | 🟡 Đang làm | ✅ Xong | ❌ Bị chặn

---

## THÁNG 1: FOUNDATION

### Tuần 1: Setup môi trường và project

**Mục tiêu**: Có Next.js project chạy được trên local với full stack.

**Setup máy tính**
- [ ] Cài Node.js 20 LTS
- [ ] Cài pnpm: `npm install -g pnpm`
- [ ] Cài Docker Desktop
- [ ] Cài Git và config user
- [ ] Cài VS Code và các extension cần thiết
- [ ] Tạo SSH key, add vào GitHub

**Tạo project**
- [ ] `pnpm create next-app@latest lumibach --typescript --tailwind --app --src-dir`
- [ ] Init Git repo, tạo private repo trên GitHub
- [ ] Push code đầu tiên
- [ ] Setup ESLint + Prettier với config strict
- [ ] Setup Husky + lint-staged cho pre-commit hooks
- [ ] Tạo file `.env.example` và `.env.local`

**Setup Docker Compose cho dev**
- [ ] Tạo `docker-compose.yml` với PostgreSQL 16, Redis 7
- [ ] Test chạy containers: `docker compose up -d`
- [ ] Verify connect được tới PostgreSQL và Redis

**Setup Prisma**
- [ ] `pnpm add -D prisma`
- [ ] `pnpm add @prisma/client`
- [ ] `npx prisma init`
- [ ] Config DATABASE_URL trong .env
- [ ] Tạo schema cơ bản với User model
- [ ] Run migration đầu tiên: `npx prisma migrate dev --name init`
- [ ] Tạo seed script cơ bản

**Setup shadcn/ui**
- [ ] `pnpm dlx shadcn-ui@latest init`
- [ ] Cài một vài component cơ bản: button, input, form, card
- [ ] Test render một component

**Tài liệu**
- [ ] Tạo README.md với hướng dẫn setup
- [ ] Tạo CHANGELOG.md
- [ ] Save PROJECT_CONTEXT.md vào docs/
- [ ] Save DATABASE_SCHEMA.md vào docs/

**Milestone tuần 1**: ✅ Có project Next.js chạy được, kết nối DB thành công, push lên GitHub.

---

### Tuần 2: Database Schema và NextAuth

**Mục tiêu**: Hoàn thiện database schema, setup authentication cơ bản.

**Database Schema đầy đủ**
- [ ] Code Prisma schema theo DATABASE_SCHEMA.md
- [ ] Bắt đầu với: User, Session, PasswordReset, VerificationToken, AuditLog
- [ ] Run migration
- [ ] Verify schema trên Prisma Studio: `npx prisma studio`

**NextAuth Setup**
- [ ] `pnpm add next-auth@beta @auth/prisma-adapter`
- [ ] Config NextAuth với Prisma adapter
- [ ] Setup credentials provider (email/password)
- [ ] Tạo middleware.ts cho route protection
- [ ] Tạo lib/auth.ts với helper functions
- [ ] Test session hoạt động

**UI cơ bản**
- [ ] Layout chung với Header và Sidebar
- [ ] Component Logo, Avatar, UserMenu
- [ ] Theme provider (light/dark mode)
- [ ] Toast notification setup (sonner hoặc shadcn toast)

**Milestone tuần 2**: ✅ Database có đầy đủ schema cho auth, NextAuth cấu hình xong.

---

### Tuần 3: Authentication UI và Logic

**Mục tiêu**: Đăng ký, đăng nhập, đổi mật khẩu hoạt động.

**Đăng ký**
- [ ] Trang `/register` với form (email, password, fullName)
- [ ] Validation Zod cho register schema
- [ ] Server action register
- [ ] Hash password với bcrypt
- [ ] Gửi email xác thực
- [ ] Trang `/verify-email` xử lý token
- [ ] Test flow hoàn chỉnh

**Đăng nhập**
- [ ] Trang `/login` với form
- [ ] Server action login với rate limiting
- [ ] Redirect về dashboard sau khi login
- [ ] Remember me checkbox
- [ ] Error messages tiếng Việt rõ ràng

**Quên mật khẩu**
- [ ] Trang `/forgot-password`
- [ ] Server action gửi email reset link
- [ ] Trang `/reset-password?token=xxx`
- [ ] Server action reset với token validation
- [ ] Token expires sau 1 giờ

**Đổi mật khẩu (sau khi đăng nhập)**
- [ ] Trang `/settings/password`
- [ ] Form với current password + new password
- [ ] Validate current password
- [ ] Update password hash

**Đăng xuất**
- [ ] Button logout trong UserMenu
- [ ] Clear session
- [ ] Redirect về login

**Milestone tuần 3**: ✅ User có thể đăng ký, login, logout, đổi mật khẩu, quên mật khẩu.

---

### Tuần 4: User Management và Phân quyền

**Mục tiêu**: Admin tạo được user, phân quyền 4 vai trò hoạt động.

**Permission system**
- [ ] Tạo `lib/permissions.ts` với helper functions
- [ ] Define permissions theo ma trận trong PROJECT_CONTEXT.md
- [ ] Middleware kiểm tra role
- [ ] Helper `requireRole`, `requirePermission`

**Admin User Management**
- [ ] Trang `/admin/users` - list users với filter, search, pagination
- [ ] Tạo user mới (Admin, Teacher, TA, Student)
- [ ] Edit user (role, status, info)
- [ ] Soft delete user
- [ ] Reset password cho user khác (Admin)

**Import từ Excel**
- [ ] UI upload file Excel
- [ ] Parse Excel với sheetjs (đã có sẵn trong artifacts)
- [ ] Preview data trước khi import
- [ ] Validation từng row
- [ ] Bulk insert với transaction
- [ ] Báo cáo kết quả: thành công bao nhiêu, lỗi bao nhiêu
- [ ] Generate password tự động và export ra file

**Profile cá nhân**
- [ ] Trang `/profile` xem thông tin
- [ ] Edit profile (firstName, lastName, phone, avatar)
- [ ] Upload avatar lên MinIO (setup MinIO ở tuần này)
- [ ] Trang `/settings` với các options

**Setup MinIO**
- [ ] Thêm MinIO vào docker-compose
- [ ] Config MinIO client trong `lib/storage.ts`
- [ ] Tạo bucket cho avatars, files
- [ ] Test upload và download

**Audit Log**
- [ ] Helper function `auditLog(action, resource, ...)`
- [ ] Log mọi action quan trọng (login, create user, change role)
- [ ] Trang `/admin/audit-logs` xem logs

**Milestone tuần 4**: ✅ 4 vai trò user hoạt động, Admin quản lý user được, import Excel chạy.

---

## THÁNG 2: COURSE + CONTENT

### Tuần 5: Course CRUD

**Mục tiêu**: Tạo, sửa, xóa khóa học.

**Course CRUD**
- [ ] Schema Course đã có trong tuần 2, verify lại
- [ ] Trang `/courses` - list course (filter theo role: Admin xem all, Teacher xem own, Student xem enrolled)
- [ ] Trang `/courses/new` - tạo course mới
- [ ] Trang `/courses/[slug]` - chi tiết course
- [ ] Trang `/courses/[slug]/edit` - sửa course
- [ ] Soft delete course
- [ ] Duplicate course (clone)

**Course settings**
- [ ] Tab settings trong course detail
- [ ] Cấu hình: name, description, dates, status
- [ ] Upload thumbnail
- [ ] Generate enrollment code

**Permissions**
- [ ] Teacher chỉ edit course của mình
- [ ] Admin edit mọi course
- [ ] TA và Student không edit được

**Milestone tuần 5**: ✅ Course CRUD hoàn chỉnh với đúng phân quyền.

---

### Tuần 6: Enrollment và TA Assignment

**Mục tiêu**: Học sinh đăng ký vào lớp, giáo viên gán TA.

**Enrollment**
- [ ] Trang `/courses/[slug]/people` - list members
- [ ] Manual enroll: chọn user từ list để thêm vào course
- [ ] Bulk enroll: paste danh sách email
- [ ] Học sinh tự enroll bằng enrollment code
- [ ] Unenroll user khỏi course
- [ ] Filter theo role trong course (Teacher, TA, Student)

**TA Assignment**
- [ ] Teacher có thể assign TA từ tab People
- [ ] Mỗi TA có thể được assign nhiều course
- [ ] Mỗi course có thể có nhiều TA
- [ ] UI hiển thị rõ TA đang phụ trách lớp này
- [ ] Permissions của TA trong course

**Course Dashboard**
- [ ] Dashboard cho từng vai trò khi vào course
- [ ] Student: thấy modules, assignments sắp tới hạn, điểm
- [ ] Teacher: thấy stats lớp, recent submissions
- [ ] TA: tương tự Teacher nhưng hide settings

**Milestone tuần 6**: ✅ Đăng ký học sinh và phân công TA hoạt động.

---

### Tuần 7: Module và Lesson

**Mục tiêu**: Cấu trúc khóa học theo chương, đăng được bài giảng.

**Module CRUD**
- [ ] Schema Module, ModuleItem, Lesson migration
- [ ] Trang `/courses/[slug]/modules` - quản lý modules
- [ ] Tạo module mới
- [ ] Sửa module (name, description, dates)
- [ ] Xóa module
- [ ] Drag & drop reorder modules (dùng dnd-kit)
- [ ] Publish/Unpublish module

**Lesson với TipTap Editor**
- [ ] Cài TipTap: `pnpm add @tiptap/react @tiptap/pm @tiptap/starter-kit`
- [ ] Tạo component RichTextEditor wrapper
- [ ] Extensions: heading, bold, italic, lists, code block, image, link
- [ ] Toolbar đẹp với shadcn buttons
- [ ] Auto-save draft
- [ ] Preview mode

**Tạo và sửa Lesson**
- [ ] Trang tạo lesson mới
- [ ] Editor để soạn nội dung
- [ ] Estimated time field
- [ ] Save và preview
- [ ] Edit lesson hiện có

**Milestone tuần 7**: ✅ Tạo được khóa học có module và bài giảng với rich text.

---

### Tuần 8: File Upload và Module Items

**Mục tiêu**: Upload file, embed video, đánh dấu hoàn thành.

**File Upload**
- [ ] Component FileUploader (drag & drop)
- [ ] Validate extension và size
- [ ] Upload lên MinIO với progress bar
- [ ] Lưu metadata vào File table
- [ ] Component FilePreview cho các loại file
- [ ] Download file với signed URL

**Lesson Attachments**
- [ ] Đính kèm files vào lesson
- [ ] List files đã đính kèm
- [ ] Remove file khỏi lesson

**Embed Video YouTube**
- [ ] TipTap extension cho YouTube embed
- [ ] Parse URL YouTube → embed iframe
- [ ] Responsive video

**Module Items khác**
- [ ] Add file as ModuleItem (riêng biệt với lesson attachment)
- [ ] Add external URL as ModuleItem
- [ ] Drag & drop reorder items trong module

**Completion Tracking**
- [ ] Mark as complete cho lesson (manual)
- [ ] Auto track view duration
- [ ] Progress bar trong course (% completed)
- [ ] Schema ModuleItemCompletion

**Milestone tuần 8**: ✅ Khóa học có đầy đủ content (lesson, file, video), tracking tiến độ.

---

## THÁNG 3: ASSIGNMENT + QUIZ

### Tuần 9: Assignment cơ bản

**Mục tiêu**: Tạo và nộp bài tập file/text.

**Assignment Schema**
- [ ] Migration cho Assignment, Submission, SubmissionFile
- [ ] Migration cho Rubric (optional ở tuần này, có thể để tuần sau)

**Tạo Assignment**
- [ ] Trang `/courses/[slug]/assignments/new`
- [ ] Form: title, description, instructions (TipTap), type, maxScore, weight
- [ ] Date settings: availableFrom, dueDate, lateDeadline
- [ ] Submission types (FILE, TEXT)
- [ ] Late policy
- [ ] Add to module
- [ ] Save as draft / Publish

**List Assignments**
- [ ] Trang `/courses/[slug]/assignments`
- [ ] Sort theo dueDate, type, status
- [ ] Filter theo upcoming, past, ungraded
- [ ] Card hiển thị thông tin chính

**Submit Assignment (Student)**
- [ ] Trang `/assignments/[id]` chi tiết
- [ ] Form submit (text editor + file upload)
- [ ] Save draft tự động
- [ ] Submit final
- [ ] Hiển thị submission history nếu được nộp lại

**Late submission**
- [ ] Logic check late
- [ ] UI cảnh báo khi sắp/đã trễ
- [ ] Apply late penalty

**Milestone tuần 9**: ✅ Giáo viên giao và học sinh nộp bài (text/file).

---

### Tuần 10: Chấm bài và Rubric

**Mục tiêu**: Giáo viên/TA chấm bài, có rubric.

**Chấm bài đơn giản**
- [ ] Trang `/assignments/[id]/submissions` (Teacher/TA)
- [ ] List submissions với filter
- [ ] Stats: nộp/chưa nộp, đã chấm/chưa chấm
- [ ] Trang chấm từng submission
- [ ] Nhập điểm và feedback
- [ ] Save và next

**SpeedGrader-like UI**
- [ ] Sidebar list học sinh
- [ ] Main area: submission content
- [ ] Right panel: chấm điểm + feedback
- [ ] Keyboard shortcuts (next/prev)
- [ ] Progress indicator

**Rubric**
- [ ] Schema Rubric, RubricCriterion
- [ ] Tạo rubric từ template
- [ ] Custom rubric với criteria + levels
- [ ] Apply rubric vào assignment
- [ ] Chấm theo rubric (click level cho mỗi criterion)
- [ ] Auto tính tổng điểm

**Phản hồi cho học sinh**
- [ ] Inline comments cho text submission
- [ ] File annotation (Phase 2 - skip nếu tốn thời gian)
- [ ] Học sinh xem feedback sau khi chấm

**Permission**
- [ ] TA chấm được nhưng không override final grade
- [ ] Teacher có thể override
- [ ] Audit log mọi grade change

**Milestone tuần 10**: ✅ Chấm bài hoàn chỉnh với rubric, học sinh xem điểm và feedback.

---

### Tuần 11: Quiz Engine - Phần 1

**Mục tiêu**: Tạo quiz với câu hỏi trắc nghiệm và tự luận.

**Schema Quiz**
- [ ] Migration: Quiz, Question, QuizQuestion, QuizAttempt, Answer

**Question Bank**
- [ ] Trang `/question-bank` quản lý câu hỏi
- [ ] Tạo question: MULTIPLE_CHOICE_SINGLE, MULTIPLE_CHOICE_MULTIPLE, TRUE_FALSE, ESSAY
- [ ] Edit question
- [ ] Tag và filter
- [ ] Reuse câu hỏi giữa các quiz

**Tạo Quiz**
- [ ] Trang `/courses/[slug]/quizzes/new`
- [ ] Settings: title, description, time limit, attempts
- [ ] Add questions từ question bank hoặc tạo mới
- [ ] Reorder questions
- [ ] Custom point per question
- [ ] Save draft / Publish

**UI cho từng loại question**
- [ ] Component cho MULTIPLE_CHOICE_SINGLE
- [ ] Component cho MULTIPLE_CHOICE_MULTIPLE  
- [ ] Component cho TRUE_FALSE
- [ ] Component cho ESSAY (TipTap editor)

**Milestone tuần 11**: ✅ Tạo được quiz với 4 loại câu hỏi cơ bản.

---

### Tuần 12: Quiz Engine - Phần 2

**Mục tiêu**: Học sinh làm quiz, tự động chấm.

**Take Quiz**
- [ ] Trang `/quizzes/[id]/start` - giới thiệu trước khi bắt đầu
- [ ] Trang `/quizzes/[id]/attempts/[attemptId]` - làm quiz
- [ ] Timer countdown
- [ ] Auto-submit khi hết giờ
- [ ] Save answer mỗi khi chuyển câu
- [ ] Navigation giữa các câu (nếu allow backtrack)
- [ ] Show one at a time mode
- [ ] Submit quiz

**Auto Grading**
- [ ] Logic chấm cho MULTIPLE_CHOICE_SINGLE/MULTIPLE
- [ ] Logic chấm cho TRUE_FALSE
- [ ] Mark essay là "needs grading"
- [ ] Calculate total score
- [ ] Lưu vào QuizAttempt

**Manual Grading (cho essay)**
- [ ] Trang chấm essay questions
- [ ] List attempts cần chấm
- [ ] Chấm và feedback
- [ ] Update final score

**View Results**
- [ ] Học sinh xem kết quả sau khi nộp
- [ ] Hiện đáp án đúng (nếu setting cho phép)
- [ ] Time limit cho việc xem lại

**Anti-cheating cơ bản**
- [ ] Detect tab switch (Phase 2)
- [ ] Random question order
- [ ] Random answer order
- [ ] Disable copy-paste (limit, không tuyệt đối)

**Milestone tuần 12**: ✅ Quiz engine hoàn chỉnh với auto-grade và manual grade.

---

## THÁNG 4: CODE EXECUTION (PHẦN KHÓ NHẤT)

### Tuần 13: Setup Judge0

**Mục tiêu**: Judge0 chạy được, test thủ công với Python.

**Cài Judge0**
- [ ] Đọc kỹ documentation Judge0
- [ ] Setup Docker Compose cho Judge0
- [ ] Config với resource limits đúng
- [ ] Network isolation cho sandbox
- [ ] Test API qua curl/Bruno
- [ ] Submit sample Python code, verify chạy đúng

**Bảo mật Judge0**
- [ ] Disable internet trong sandbox
- [ ] Set resource limits (CPU, RAM, time)
- [ ] Test các attack: fork bomb, infinite loop, large output
- [ ] Authentication token cho API

**Judge0 Client**
- [ ] Tạo `lib/judge0.ts`
- [ ] Functions: submitCode, getResult, listLanguages
- [ ] Error handling cho mọi case
- [ ] Type safety với TypeScript

**Milestone tuần 13**: ✅ Judge0 chạy ổn định, gửi được code Python và nhận kết quả.

---

### Tuần 14: Monaco Editor và Code UI

**Mục tiêu**: Code editor đẹp tích hợp vào app.

**Cài Monaco**
- [ ] `pnpm add @monaco-editor/react`
- [ ] Component CodeEditor wrapper
- [ ] Configure theme (light/dark)
- [ ] Configure cho Python ban đầu
- [ ] Syntax highlighting hoạt động
- [ ] Autocomplete cơ bản

**Code Editor Component**
- [ ] Resizable layout
- [ ] Toolbar: language selector, theme, font size
- [ ] Run button, Submit button
- [ ] Output panel
- [ ] Test cases panel (visible/hidden)

**HTML/CSS/JS Editor (CodePen-like)**
- [ ] 3-pane layout: HTML | CSS | JS
- [ ] Live preview iframe
- [ ] Sandbox iframe với CSP
- [ ] Console output
- [ ] Auto-refresh on change

**Milestone tuần 14**: ✅ Editor đẹp, Python và HTML/CSS/JS hoạt động.

---

### Tuần 15: Code Submission Flow

**Mục tiêu**: Học sinh code Python và chấm tự động.

**Schema**
- [ ] Migration: TestCase, CodeSubmission, TestCaseResult

**Tạo Assignment Code**
- [ ] Type CODE trong assignment
- [ ] Editor cho starter code, solution code
- [ ] Tạo test cases (input, expectedOutput, hidden)
- [ ] Configure time/memory limit
- [ ] Sample test cases (visible)

**Submit Code Flow**
- [ ] Student xem starter code
- [ ] Code trong Monaco
- [ ] Run code (test với sample inputs)
- [ ] Submit final
- [ ] Server action lưu submission, status PENDING

**Background Worker với BullMQ**
- [ ] Setup BullMQ với Redis
- [ ] Queue "code-execution"
- [ ] Worker process: gửi code tới Judge0, lưu kết quả
- [ ] Polling Judge0 result
- [ ] Update submission status

**Hiển thị kết quả**
- [ ] Polling từ client (hoặc WebSocket nếu có thời gian)
- [ ] Show result từng test case (passed/failed)
- [ ] Show output, expected output, diff
- [ ] Show runtime stats
- [ ] Calculate score dựa trên test cases passed

**Edge cases**
- [ ] Compile error
- [ ] Runtime error
- [ ] Timeout
- [ ] Memory exceeded
- [ ] Output too long

**Milestone tuần 15**: ✅ Học sinh nộp code Python, chấm tự động, hiển thị kết quả.

---

### Tuần 16: HTML/CSS/JS và Polish Code

**Mục tiêu**: HTML/CSS/JS submission, polish toàn bộ code module.

**HTML/CSS/JS Submission**
- [ ] Submission type WEB
- [ ] Save HTML + CSS + JS
- [ ] Render trong sandbox iframe
- [ ] Giáo viên xem render khi chấm
- [ ] Auto-grade với DOM checking (Phase 2 nếu khó)
- [ ] Manual grade cho HTML/CSS/JS

**Code Question trong Quiz**
- [ ] Question type CODE_WRITING
- [ ] Tích hợp Monaco trong quiz
- [ ] Test cases per question
- [ ] Auto-grade khi nộp quiz

**Improvements**
- [ ] Lưu code draft tự động
- [ ] History các lần submit
- [ ] Compare submissions
- [ ] Hint system (gợi ý sau N lần fail)

**Performance**
- [ ] Test với 30 học sinh nộp cùng lúc
- [ ] Optimize Judge0 worker pool
- [ ] Queue priority

**Milestone tuần 16**: ✅ Module code hoàn chỉnh: Python + HTML/CSS/JS, chấm tự động ổn định.

---

## THÁNG 5: HOÀN THIỆN MVP + BETA TEST

### Tuần 17: Gradebook

**Mục tiêu**: Tổng hợp điểm tự động, export Excel.

**Gradebook Schema**
- [ ] Migration: GradingScheme, GradeGroup, Grade

**Setup Grading Scheme**
- [ ] Default scheme cho mỗi course
- [ ] Custom scheme với groups (Bài tập, Kiểm tra, Cuối kỳ)
- [ ] Weight per group
- [ ] Drop lowest N

**Gradebook UI**
- [ ] Trang `/courses/[slug]/gradebook`
- [ ] Bảng tổng hợp: rows = students, cols = assignments
- [ ] Click cell để xem chi tiết submission
- [ ] Override grade với reason
- [ ] Tính final grade tự động

**Student View**
- [ ] Trang `/courses/[slug]/grades` cho student
- [ ] Hiện điểm các assignment + final
- [ ] Hiện feedback
- [ ] So với class average (optional)

**Export**
- [ ] Export Excel với sheetjs
- [ ] Format theo yêu cầu Việt Nam (cột STT, họ tên, MSHS)
- [ ] Export grade book đầy đủ

**Milestone tuần 17**: ✅ Gradebook hoạt động, export Excel được.

---

### Tuần 18: Notification System ✅ HOÀN THÀNH

**Mục tiêu**: Thông báo in-app và email.

**In-app Notification**
- [x] Schema Notification
- [x] Helper function `createNotification`
- [x] Bell icon trong header với badge count
- [x] Dropdown list notifications
- [x] Mark as read
- [x] Mark all as read
- [x] Trang `/notifications` xem all

**Email Notification**
- [x] Setup SMTP (Google Workspace hoặc dịch vụ Việt)
- [x] Email templates (HTML đẹp)
- [x] Send email cho events quan trọng:
  - Assignment due soon
  - New grade
  - Course announcement
- [x] Queue email với BullMQ

**Triggers**
- [x] Cron job check assignment due soon (chạy 1h/lần)
- [x] Trigger khi grade được publish
- [x] Trigger khi enroll vào course mới

**Notification Preferences**
- [x] Trang `/settings/notifications`
- [x] Toggle on/off cho từng loại
- [x] Toggle email vs in-app

**Milestone tuần 18**: ✅ Notification hoạt động cho events quan trọng.

---

### Tuần 19: Polish UI/UX ← ĐANG LÀM

**Mục tiêu**: App đẹp, smooth, accessible.

**Mobile Responsive**
- [x] Sidebar collapse trên mobile (SidebarContext + hamburger button)
- [x] Mobile overlay backdrop khi sidebar mở
- [x] Padding responsive: p-4 md:p-6 cho main content
- [x] Tables responsive — overflow-x-auto cho GradebookTable, UserTable, AttemptsTable
- [x] Submissions page — stacked layout trên mobile (list → chọn học sinh → detail)
- [x] Admin users page header — flex-wrap cho mobile
- [ ] Code editor usable trên mobile (zoom, scroll)

**Loading States**
- [x] Skeleton screens cho dashboard, courses, course detail, quizzes
- [x] loading.tsx cho assignments, gradebook, people, admin/users, notifications, profile
- [ ] Spinner cho actions ngắn
- [ ] Progress bar cho upload, code execution

**Error States**
- [x] error.tsx cho dashboard, courses, course detail (tiếng Việt, retry button)
- [x] error.tsx cho assignments, quizzes, gradebook, people, admin, notifications

**Accessibility**
- [x] aria-label cho sidebar và hamburger button
- [ ] ARIA labels đầy đủ
- [ ] Keyboard navigation
- [ ] Focus management trong modals
- [ ] Color contrast đạt WCAG AA

**Performance**
- [x] TipTap lazy load với next/dynamic (LessonEditor, AssignmentForm)
- [x] Monaco đã tự lazy load qua @monaco-editor/react
- [ ] Image optimization với next/image
- [ ] Database query optimization (đo bằng Prisma logging)

**Tiếng Việt**
- [x] Date format kiểu Việt: DD/MM/YYYY (dùng Intl.DateTimeFormat vi-VN và date-fns vi locale)
- [ ] Verify toàn bộ text còn lại là tiếng Việt

**Milestone tuần 19**: ✅ Mobile responsive, loading/error states hoàn chỉnh cho tất cả routes.

---

### Tuần 20: Beta Test

**Mục tiêu**: Test thật với 5-10 học sinh, fix bugs nghiêm trọng.

**Pre-launch checklist**
- [ ] Backup automation hoạt động
- [ ] Monitoring (Uptime Kuma) setup
- [ ] Sentry error tracking setup
- [ ] Performance baseline đo được
- [ ] Security audit cơ bản

**Beta with 1 lớp dạy thêm**
- [ ] Chọn 5-10 học sinh tin cậy
- [ ] Tạo tài khoản
- [ ] Onboarding session 30 phút
- [ ] Cho làm 1 tuần
- [ ] Daily check-in với feedback
- [ ] Track bugs và issues

**Bug Fixing**
- [ ] Triage bugs theo P0/P1/P2/P3
- [ ] Fix P0 và P1 ngay
- [ ] Document P2/P3 cho phase sau
- [ ] Verify fix với học sinh

**User Feedback**
- [ ] Form feedback trong app
- [ ] Khảo sát cuối tuần
- [ ] So sánh với Moodle theo các tiêu chí

**Milestone tuần 20**: ✅ MVP ổn định cho 1 lớp pilot, có user feedback thực tế.

---

## THÁNG 6: MỞ RỘNG DẦN

### Tuần 21-24: Scale up từng bước

**Tuần 21**: Mở thêm 1 lớp (10-15 học sinh nữa)
- [ ] Setup tài khoản
- [ ] Onboarding
- [ ] Theo dõi performance server
- [ ] Optimize nếu cần

**Tuần 22**: Mở 2 lớp (30-50 học sinh)
- [ ] Stress test
- [ ] Optimize database queries chậm
- [ ] Caching strategy với Redis
- [ ] CDN cho static files (nếu cần)

**Tuần 23**: Document vận hành
- [ ] OPERATIONS.md với daily/weekly/monthly tasks
- [ ] Runbook cho common issues
- [ ] Backup và restore procedure
- [ ] Disaster recovery plan

**Tuần 24**: Migration tool đầu tiên
- [ ] Script export users từ Moodle
- [ ] Script import vào LumiBach
- [ ] Migrate 1 lớp thật
- [ ] Verify data integrity

**Milestone tháng 6**: ✅ 50 học sinh dùng ổn định 1 tháng, sẵn sàng cho Phase 2.

---

## PHASE 2 (Tháng 7-9) - Backlog

- [ ] C++ và JavaScript trong code execution
- [ ] Câu hỏi code nâng cao: Parsons, Fill-in-blank, Debug
- [ ] Discussion forum
- [ ] Calendar view với deadline
- [ ] Search toàn hệ thống
- [ ] PWA cho mobile
- [ ] Plagiarism detection
- [ ] Mở rộng lên 200-300 học sinh

## PHASE 3 (Tháng 10-12) - Backlog

- [x] Scratch Blocks (Scratch thật, module item type SCRATCH; **Phase B xong: self-host scratch-gui ở /public/scratch-gui/, postMessage 1-click submit hoạt động**; xem docs/SCRATCH_GUI.md)
- [x] Analytics dashboard chi tiết (admin: /admin/analytics; giáo viên: /courses/[slug]/analytics)
- [ ] AI tutor với Claude API
- [ ] Migration tool hoàn chỉnh
- [ ] Migrate hết các lớp từ Moodle
- [ ] 600 học sinh đầy đủ
- [ ] Tắt Moodle

---

## Quy ước cập nhật file này

- [ ] Mỗi thứ Hai, review tuần trước, plan tuần này
- [ ] Tick `[x]` khi hoàn thành task
- [ ] Add note nếu task bị blocked
- [ ] Move task sang tuần sau nếu không xong
- [ ] Update milestone status mỗi cuối tuần
- [ ] Add tasks mới vào nếu phát sinh

---

## Ghi chú và Insights

> Dùng phần này để ghi insights, learnings, blockers gặp phải trong quá trình làm.

### Tuần [X]
- [Note]

