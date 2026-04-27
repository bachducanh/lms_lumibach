# DATABASE SCHEMA - LMS_LumiBach

> **Tài liệu này chứa Prisma schema hoàn chỉnh và giải thích chi tiết.** Cập nhật mỗi khi có thay đổi schema. Schema thực tế trong file `prisma/schema.prisma`, file này là tài liệu giải thích.

**Phiên bản**: 1.0
**Ngày cập nhật cuối**: [Điền ngày]

---

## Mục lục

1. [Nguyên tắc thiết kế](#1-nguyên-tắc-thiết-kế)
2. [Sơ đồ ERD tổng quan](#2-sơ-đồ-erd-tổng-quan)
3. [Module Authentication & User](#3-module-authentication--user)
4. [Module Course](#4-module-course)
5. [Module Content](#5-module-content)
6. [Module Assignment](#6-module-assignment)
7. [Module Quiz](#7-module-quiz)
8. [Module Code Execution](#8-module-code-execution)
9. [Module Gradebook](#9-module-gradebook)
10. [Module Discussion (Phase 2)](#10-module-discussion-phase-2)
11. [Module Notification](#11-module-notification)
12. [Module Audit Log](#12-module-audit-log)
13. [Indexes và Performance](#13-indexes-và-performance)
14. [Schema đầy đủ](#14-schema-đầy-đủ)

---

## 1. Nguyên tắc thiết kế

### Quy ước đặt tên

- **Model**: PascalCase, số ít (`User`, `Course`)
- **Field**: camelCase (`firstName`, `createdAt`)
- **Khóa chính**: luôn là `id` kiểu String với `cuid()`
- **Khóa ngoại**: `<modelName>Id` (`userId`, `courseId`)
- **Bảng quan hệ many-to-many**: tạo model trung gian rõ ràng (vd: `Enrollment` thay vì implicit)

### Timestamps

Mọi model quan trọng đều có:
- `createdAt`: thời điểm tạo
- `updatedAt`: thời điểm cập nhật cuối
- `deletedAt`: soft delete (cho dữ liệu quan trọng)

### Soft Delete

Áp dụng soft delete cho: User, Course, Assignment, Submission, Grade, Question - những entity mà nếu xóa cứng có thể mất dữ liệu lịch sử quan trọng.

KHÔNG soft delete: Notification, AuditLog, Session - những entity tạm thời.

### Cascade behavior

- **Restrict** (mặc định): Không cho xóa nếu còn record con
- **SetNull**: Set khóa ngoại thành null khi parent bị xóa (dùng cho relation tùy chọn)
- **Cascade**: Chỉ dùng khi chắc chắn xóa parent thì xóa luôn con (vd: User → Session)

---

## 2. Sơ đồ ERD tổng quan

```
┌─────────┐
│  User   │ (Admin/Teacher/TA/Student)
└────┬────┘
     │
     ├─── owns ───────────► Course
     │                         │
     ├─── enrolled in ────────┤
     │                         │
     ├─── assists in ─────────┤
     │                         │
     │                         ├─► Module
     │                         │     └─► ModuleItem
     │                         │           ├─► Lesson
     │                         │           ├─► Assignment
     │                         │           ├─► Quiz
     │                         │           └─► Discussion
     │                         │
     │   ┌─── submits ─────────┤
     ├──►│
     │   └─► Submission
     │         └─► CodeSubmission
     │               └─► TestCaseResult
     │
     ├─── attempts ──► QuizAttempt
     │                    └─► Answer
     │
     └─── receives ──► Grade
                          └─► GradeItem
```

---

## 3. Module Authentication & User

### Model: User

Model trung tâm của hệ thống. Lưu thông tin của tất cả vai trò.

**Fields chính:**

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  username      String?  @unique
  passwordHash  String   // bcrypt với cost 12
  
  // Thông tin cá nhân
  firstName     String
  lastName      String
  fullName      String?  // tên đầy đủ kiểu Việt Nam: "Nguyễn Văn A"
  avatar        String?  // URL ảnh đại diện trên MinIO
  phone         String?
  dateOfBirth   DateTime?
  
  // Vai trò và trạng thái
  role          UserRole @default(STUDENT)
  status        UserStatus @default(ACTIVE)
  emailVerified DateTime?
  
  // Metadata
  lastLoginAt   DateTime?
  loginCount    Int      @default(0)
  preferences   Json?    // theme, language, notifications
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  
  // Relations - một User có nhiều...
  ownedCourses        Course[]          @relation("CourseOwner")
  enrollments         Enrollment[]
  taAssignments       TeachingAssistant[]
  submissions         Submission[]
  quizAttempts        QuizAttempt[]
  grades              Grade[]
  notifications       Notification[]
  auditLogs           AuditLog[]
  sessions            Session[]
  passwordResets      PasswordReset[]
  
  @@index([email])
  @@index([role])
  @@index([status])
  @@index([deletedAt])
}

enum UserRole {
  ADMIN     // Quản trị viên
  TEACHER   // Giáo viên
  TA        // Trợ giảng (Teaching Assistant)
  STUDENT   // Học sinh
}

enum UserStatus {
  ACTIVE      // Đang hoạt động
  INACTIVE    // Tạm khóa
  SUSPENDED   // Bị đình chỉ
  PENDING     // Chờ xác thực email
}
```

**Giải thích:**

- `email` là duy nhất, dùng làm định danh chính. `username` tùy chọn cho người muốn dùng tên đăng nhập riêng.
- `fullName` lưu tên kiểu Việt Nam đầy đủ vì cách viết tên ở Việt Nam khác với phương Tây (họ trước, tên sau).
- `passwordHash` lưu bcrypt hash, KHÔNG bao giờ trả về API.
- `preferences` là JSON linh hoạt cho settings không cần index.
- `role` enum giúp type-safe khi check quyền.

### Model: Session

Lưu session đăng nhập. NextAuth dùng model này.

```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId])
  @@index([expires])
}
```

### Model: PasswordReset

Token reset mật khẩu, expires sau 1 giờ.

```prisma
model PasswordReset {
  id        String   @id @default(cuid())
  userId    String
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  
  createdAt DateTime @default(now())
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([token])
  @@index([userId])
}
```

### Model: VerificationToken

Token xác thực email khi đăng ký mới.

```prisma
model VerificationToken {
  identifier String   // thường là email
  token      String   @unique
  expires    DateTime
  
  @@unique([identifier, token])
  @@index([token])
}
```

---

## 4. Module Course

### Model: Course

Khóa học - đơn vị quản lý học tập chính.

```prisma
model Course {
  id            String   @id @default(cuid())
  
  // Thông tin cơ bản
  name          String   // "Tin học 10 - Năm học 2025-2026"
  shortName     String?  // "Tin10-2526" - tên ngắn cho sổ điểm
  slug          String   @unique // URL-friendly: "tin-hoc-10-2025-2026"
  description   String?  @db.Text
  thumbnail     String?  // URL ảnh bìa
  
  // Phân loại
  subject       String?  // "Tin học", "Lập trình Python"
  gradeLevel    String?  // "Lớp 10", "Trung cấp", "Nâng cao"
  
  // Cấu hình
  status        CourseStatus @default(DRAFT)
  isPublic      Boolean  @default(false) // có hiển thị trong directory không
  enrollmentCode String? @unique // mã mời học sinh tự đăng ký
  
  startDate     DateTime?
  endDate       DateTime?
  
  // Settings (JSON cho linh hoạt)
  settings      Json?    // grading scheme, late policy, notification config
  
  // Owner
  ownerId       String
  owner         User     @relation("CourseOwner", fields: [ownerId], references: [id], onDelete: Restrict)
  
  // Timestamps
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  publishedAt   DateTime?
  archivedAt    DateTime?
  deletedAt     DateTime?
  
  // Relations
  modules       Module[]
  enrollments   Enrollment[]
  teachingAssistants TeachingAssistant[]
  assignments   Assignment[]
  quizzes       Quiz[]
  discussions   Discussion[]
  gradingSchemes GradingScheme[]
  
  @@index([ownerId])
  @@index([slug])
  @@index([status])
  @@index([deletedAt])
}

enum CourseStatus {
  DRAFT       // Đang soạn, chưa public
  PUBLISHED   // Đã xuất bản, học sinh có thể truy cập
  ARCHIVED    // Đã kết thúc, read-only
}
```

**Giải thích:**

- `slug` dùng cho URL đẹp: `/courses/tin-hoc-10-2025-2026`
- `enrollmentCode` để học sinh tự đăng ký bằng mã (giống Google Classroom)
- `settings` JSON chứa cấu hình linh hoạt không cần index
- `ownerId` dùng `Restrict` - không cho xóa user nếu còn course

### Model: Enrollment

Bảng trung gian giữa User và Course - học sinh đăng ký vào khóa học.

```prisma
model Enrollment {
  id        String   @id @default(cuid())
  userId    String
  courseId  String
  
  status    EnrollmentStatus @default(ACTIVE)
  enrolledAt DateTime @default(now())
  completedAt DateTime?
  
  // Tiến độ
  progress  Float    @default(0) // 0-100%
  lastAccessAt DateTime?
  
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course    Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  
  @@unique([userId, courseId]) // mỗi user chỉ enroll 1 lần per course
  @@index([userId])
  @@index([courseId])
  @@index([status])
}

enum EnrollmentStatus {
  ACTIVE      // Đang học
  COMPLETED   // Đã hoàn thành
  DROPPED     // Đã bỏ học
  SUSPENDED   // Bị đình chỉ trong lớp này
}
```

### Model: TeachingAssistant

Phân công TA cho khóa học - một TA có thể hỗ trợ nhiều lớp, một lớp có nhiều TA.

```prisma
model TeachingAssistant {
  id          String   @id @default(cuid())
  userId      String
  courseId    String
  
  assignedAt  DateTime @default(now())
  assignedBy  String   // ID của Teacher đã assign TA này
  
  // Permissions tùy chỉnh (override default TA permissions)
  permissions Json?    // có thể override default nếu cần
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  
  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
}
```

---

## 5. Module Content

### Model: Module (Chương/Phần)

Cấu trúc khóa học theo Module → ModuleItem giống Canvas.

```prisma
model Module {
  id          String   @id @default(cuid())
  courseId    String
  
  name        String   // "Chương 1: Giới thiệu Python"
  description String?  @db.Text
  position    Int      // thứ tự sắp xếp
  
  // Điều kiện mở module (Phase 2)
  unlockAt    DateTime?
  prerequisiteModuleId String? // module nào cần hoàn thành trước
  
  isPublished Boolean  @default(false)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  course      Course      @relation(fields: [courseId], references: [id], onDelete: Cascade)
  items       ModuleItem[]
  
  @@index([courseId])
  @@index([position])
}
```

### Model: ModuleItem

Item trong module - có thể là lesson, assignment, quiz, etc.

```prisma
model ModuleItem {
  id          String   @id @default(cuid())
  moduleId    String
  
  type        ModuleItemType
  position    Int
  title       String
  
  // Polymorphic reference - chỉ 1 trong các field sau có giá trị
  lessonId      String?
  assignmentId  String?
  quizId        String?
  fileId        String?
  externalUrl   String?
  
  isPublished Boolean  @default(false)
  
  // Tracking completion
  requireCompletion Boolean @default(false)
  completionType    CompletionType @default(VIEW)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  module      Module      @relation(fields: [moduleId], references: [id], onDelete: Cascade)
  lesson      Lesson?     @relation(fields: [lessonId], references: [id], onDelete: SetNull)
  assignment  Assignment? @relation(fields: [assignmentId], references: [id], onDelete: SetNull)
  quiz        Quiz?       @relation(fields: [quizId], references: [id], onDelete: SetNull)
  file        File?       @relation(fields: [fileId], references: [id], onDelete: SetNull)
  
  completions ModuleItemCompletion[]
  
  @@index([moduleId])
  @@index([type])
}

enum ModuleItemType {
  LESSON
  ASSIGNMENT
  QUIZ
  DISCUSSION
  FILE
  EXTERNAL_URL
}

enum CompletionType {
  VIEW           // Chỉ cần xem
  SUBMIT         // Phải nộp bài
  MIN_SCORE      // Phải đạt điểm tối thiểu
  CONTRIBUTE     // Phải post (cho discussion)
}
```

### Model: Lesson

Bài giảng dạng văn bản với rich text.

```prisma
model Lesson {
  id          String   @id @default(cuid())
  
  title       String
  content     String   @db.Text // HTML từ TipTap editor
  
  // Metadata
  estimatedMinutes Int? // ước tính thời gian học
  
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  moduleItems ModuleItem[]
  attachments LessonAttachment[]
}

model LessonAttachment {
  id        String   @id @default(cuid())
  lessonId  String
  fileId    String
  
  lesson    Lesson   @relation(fields: [lessonId], references: [id], onDelete: Cascade)
  file      File     @relation(fields: [fileId], references: [id], onDelete: Cascade)
  
  @@unique([lessonId, fileId])
}
```

### Model: File

File upload chung - được dùng bởi nhiều module.

```prisma
model File {
  id          String   @id @default(cuid())
  
  // Thông tin file
  filename    String   // tên hiển thị
  originalName String  // tên gốc khi upload
  mimeType    String
  size        Int      // bytes
  
  // Storage
  storageKey  String   @unique // key trên MinIO
  url         String?  // URL public nếu có
  
  // Owner
  uploadedBy  String
  
  createdAt   DateTime @default(now())
  
  lessonAttachments LessonAttachment[]
  moduleItems       ModuleItem[]
  submissionFiles   SubmissionFile[]
  
  @@index([uploadedBy])
}
```

### Model: ModuleItemCompletion

Track việc hoàn thành module item của từng user.

```prisma
model ModuleItemCompletion {
  id            String   @id @default(cuid())
  userId        String
  moduleItemId  String
  
  completedAt   DateTime @default(now())
  score         Float?   // điểm nếu là assignment/quiz
  
  moduleItem    ModuleItem @relation(fields: [moduleItemId], references: [id], onDelete: Cascade)
  
  @@unique([userId, moduleItemId])
  @@index([userId])
  @@index([moduleItemId])
}
```

---

## 6. Module Assignment

### Model: Assignment

Bài tập - bao gồm cả bài tập thường và bài tập lập trình.

```prisma
model Assignment {
  id            String   @id @default(cuid())
  courseId      String
  
  // Thông tin cơ bản
  title         String
  description   String   @db.Text
  instructions  String?  @db.Text // hướng dẫn chi tiết
  
  // Loại bài tập
  type          AssignmentType
  
  // Điểm và trọng số
  maxScore      Float    @default(10)
  weight        Float    @default(1) // trọng số trong gradebook
  
  // Submission settings
  submissionTypes Json   // ["FILE", "TEXT", "CODE"] - các loại submission cho phép
  allowedFileTypes Json? // [".pdf", ".docx"]
  maxFileSize   Int?     // bytes
  maxAttempts   Int      @default(1) // số lần nộp tối đa, 0 = không giới hạn
  
  // Time
  availableFrom DateTime?
  dueDate       DateTime?
  lateDeadline  DateTime? // sau ngày này không nhận late
  
  // Late policy
  allowLate     Boolean  @default(false)
  latePenalty   Float?   // % trừ cho mỗi ngày trễ
  
  // Code-specific (chỉ áp dụng nếu type = CODE)
  language      ProgrammingLanguage?
  starterCode   String?  @db.Text
  solutionCode  String?  @db.Text
  
  // Grading
  rubricId      String?
  gradingType   GradingType @default(POINTS)
  
  // Status
  isPublished   Boolean  @default(false)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  
  course        Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  rubric        Rubric?  @relation(fields: [rubricId], references: [id], onDelete: SetNull)
  
  submissions   Submission[]
  testCases     TestCase[]
  moduleItems   ModuleItem[]
  
  @@index([courseId])
  @@index([dueDate])
  @@index([deletedAt])
}

enum AssignmentType {
  TEXT          // Bài tập tự luận
  FILE          // Nộp file
  CODE          // Bài tập lập trình
  WEB           // HTML/CSS/JS
  MIXED         // Kết hợp
}

enum GradingType {
  POINTS        // Điểm số (0-10, 0-100)
  PERCENTAGE    // Phần trăm
  PASS_FAIL     // Đạt/Không đạt
  LETTER        // A, B, C, D, F
  RUBRIC        // Theo rubric
}

enum ProgrammingLanguage {
  PYTHON
  CPP
  JAVASCRIPT
  HTML_CSS_JS
  SCRATCH
}
```

### Model: Submission

Bài nộp của học sinh.

```prisma
model Submission {
  id            String   @id @default(cuid())
  assignmentId  String
  userId        String
  
  // Nội dung nộp
  textContent   String?  @db.Text
  
  // Trạng thái
  status        SubmissionStatus @default(DRAFT)
  attemptNumber Int      @default(1)
  
  // Time
  submittedAt   DateTime?
  isLate        Boolean  @default(false)
  
  // Grading
  score         Float?
  feedback      String?  @db.Text
  gradedAt      DateTime?
  gradedBy      String?  // ID của user đã chấm (Teacher hoặc TA)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  
  assignment    Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  files         SubmissionFile[]
  codeSubmission CodeSubmission?
  rubricScores  RubricScore[]
  
  @@unique([assignmentId, userId, attemptNumber])
  @@index([assignmentId])
  @@index([userId])
  @@index([status])
  @@index([deletedAt])
}

enum SubmissionStatus {
  DRAFT       // Đang soạn, chưa nộp
  SUBMITTED   // Đã nộp, chờ chấm
  GRADING     // Đang chấm tự động
  GRADED      // Đã chấm xong
  RETURNED    // Đã trả lại để sửa
}
```

### Model: SubmissionFile

File đính kèm bài nộp.

```prisma
model SubmissionFile {
  id            String   @id @default(cuid())
  submissionId  String
  fileId        String
  
  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  file          File      @relation(fields: [fileId], references: [id], onDelete: Cascade)
  
  @@unique([submissionId, fileId])
}
```

### Model: Rubric & RubricCriterion

Rubric chấm bài chi tiết.

```prisma
model Rubric {
  id          String   @id @default(cuid())
  
  name        String
  description String?
  
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  criteria    RubricCriterion[]
  assignments Assignment[]
  scores      RubricScore[]
}

model RubricCriterion {
  id          String   @id @default(cuid())
  rubricId    String
  
  name        String   // "Tính chính xác"
  description String?
  maxPoints   Float
  position    Int
  
  // Levels (Excellent, Good, Fair, Poor)
  levels      Json     // [{ name: "Excellent", points: 10, description: "..." }, ...]
  
  rubric      Rubric   @relation(fields: [rubricId], references: [id], onDelete: Cascade)
  scores      RubricCriterionScore[]
  
  @@index([rubricId])
}

model RubricScore {
  id            String   @id @default(cuid())
  submissionId  String
  rubricId      String
  
  totalScore    Float
  
  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  rubric        Rubric    @relation(fields: [rubricId], references: [id])
  criterionScores RubricCriterionScore[]
  
  @@unique([submissionId, rubricId])
}

model RubricCriterionScore {
  id              String   @id @default(cuid())
  rubricScoreId   String
  criterionId     String
  
  points          Float
  comment         String?
  
  rubricScore     RubricScore     @relation(fields: [rubricScoreId], references: [id], onDelete: Cascade)
  criterion       RubricCriterion @relation(fields: [criterionId], references: [id])
}
```

---

## 7. Module Quiz

### Model: Quiz

Đề thi/quiz với nhiều dạng câu hỏi.

```prisma
model Quiz {
  id            String   @id @default(cuid())
  courseId      String
  
  // Thông tin cơ bản
  title         String
  description   String?  @db.Text
  instructions  String?  @db.Text
  
  // Settings
  type          QuizType @default(GRADED)
  shuffleQuestions Boolean @default(false)
  shuffleAnswers Boolean @default(false)
  showOneAtATime Boolean @default(false)
  allowBacktrack Boolean @default(true)
  
  // Time
  timeLimit     Int?     // phút, null = không giới hạn
  availableFrom DateTime?
  availableUntil DateTime?
  
  // Attempts
  maxAttempts   Int      @default(1) // 0 = không giới hạn
  
  // Show results
  showResultsTo QuizResultsVisibility @default(IMMEDIATELY)
  showCorrectAnswers Boolean @default(false)
  
  // Grading
  maxScore      Float
  weight        Float    @default(1)
  passingScore  Float?
  
  // Status
  isPublished   Boolean  @default(false)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  
  course        Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  questions     QuizQuestion[]
  attempts      QuizAttempt[]
  moduleItems   ModuleItem[]
  
  @@index([courseId])
  @@index([deletedAt])
}

enum QuizType {
  GRADED        // Tính điểm vào sổ
  PRACTICE      // Luyện tập, không tính điểm
  SURVEY        // Khảo sát, không có đáp án đúng/sai
}

enum QuizResultsVisibility {
  IMMEDIATELY   // Hiện ngay sau khi nộp
  AFTER_DUE     // Sau khi hết hạn
  MANUAL        // Giáo viên chọn thời điểm
  NEVER         // Không bao giờ hiện
}
```

### Model: Question (Ngân hàng câu hỏi)

Câu hỏi độc lập, có thể tái sử dụng giữa các quiz.

```prisma
model Question {
  id            String   @id @default(cuid())
  
  // Loại câu hỏi
  type          QuestionType
  
  // Nội dung
  text          String   @db.Text // câu hỏi (HTML)
  explanation   String?  @db.Text // giải thích đáp án
  
  // Điểm
  points        Float    @default(1)
  
  // Phân loại
  difficulty    QuestionDifficulty?
  tags          String[] // ["python", "vòng lặp", "khó"]
  
  // Question-specific data (JSON cho linh hoạt)
  data          Json     // structure khác nhau theo type
  
  // Owner
  createdBy     String
  
  // Visibility
  isPublic      Boolean  @default(false) // có thể dùng bởi user khác?
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  deletedAt     DateTime?
  
  options       QuestionOption[]
  quizQuestions QuizQuestion[]
  answers       Answer[]
  
  @@index([type])
  @@index([createdBy])
  @@index([deletedAt])
}

enum QuestionType {
  // Cơ bản
  MULTIPLE_CHOICE_SINGLE   // Trắc nghiệm 1 đáp án
  MULTIPLE_CHOICE_MULTIPLE // Trắc nghiệm nhiều đáp án
  TRUE_FALSE               // Đúng/Sai
  SHORT_ANSWER             // Trả lời ngắn (text matching)
  ESSAY                    // Tự luận (cần chấm thủ công)
  FILL_IN_BLANK            // Điền khuyết
  MATCHING                 // Ghép đôi
  ORDERING                 // Sắp xếp thứ tự
  
  // Câu hỏi code (đặc thù LumiBach)
  CODE_WRITING             // Viết code đáp ứng test cases
  CODE_FILL_IN_BLANK       // Điền vào chỗ trống trong code
  CODE_PARSONS             // Sắp xếp dòng code (Parsons puzzle)
  CODE_DEBUG               // Tìm và sửa lỗi code
  CODE_OUTPUT_PREDICTION   // Dự đoán output của code
  CODE_MULTIPLE_CHOICE     // Trắc nghiệm có code snippet
}

enum QuestionDifficulty {
  EASY
  MEDIUM
  HARD
  EXPERT
}
```

**Cấu trúc `data` JSON theo type:**

Ví dụ MULTIPLE_CHOICE_SINGLE:
```json
{
  "options": [
    { "id": "a", "text": "Python" },
    { "id": "b", "text": "Java" },
    { "id": "c", "text": "C++" }
  ],
  "correctAnswerId": "a"
}
```

Ví dụ CODE_WRITING:
```json
{
  "language": "PYTHON",
  "starterCode": "def sum(a, b):\n    # TODO: implement\n    pass",
  "testCases": [
    { "input": "1 2", "expectedOutput": "3", "isHidden": false },
    { "input": "5 10", "expectedOutput": "15", "isHidden": true }
  ],
  "timeLimit": 5,
  "memoryLimit": 256
}
```

Ví dụ CODE_PARSONS:
```json
{
  "language": "PYTHON",
  "lines": [
    { "id": "1", "code": "def fibonacci(n):", "indent": 0 },
    { "id": "2", "code": "if n <= 1:", "indent": 1 },
    { "id": "3", "code": "return n", "indent": 2 },
    { "id": "4", "code": "return fibonacci(n-1) + fibonacci(n-2)", "indent": 1 }
  ],
  "correctOrder": ["1", "2", "3", "4"]
}
```

### Model: QuizQuestion (Bảng trung gian)

Một câu hỏi trong quiz cụ thể (cho phép custom điểm/thứ tự).

```prisma
model QuizQuestion {
  id          String   @id @default(cuid())
  quizId      String
  questionId  String
  
  position    Int
  points      Float?   // override points của Question nếu cần
  
  quiz        Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  question    Question @relation(fields: [questionId], references: [id], onDelete: Restrict)
  
  @@unique([quizId, questionId])
  @@index([quizId])
}
```

### Model: QuizAttempt

Lần làm quiz của học sinh.

```prisma
model QuizAttempt {
  id            String   @id @default(cuid())
  quizId        String
  userId        String
  
  attemptNumber Int
  
  // Time
  startedAt     DateTime @default(now())
  submittedAt   DateTime?
  timeSpent     Int?     // giây
  
  // Score
  score         Float?
  maxScore      Float
  percentage    Float?
  
  // Status
  status        QuizAttemptStatus @default(IN_PROGRESS)
  
  // Manual grading (cho essay questions)
  needsGrading  Boolean  @default(false)
  gradedAt      DateTime?
  gradedBy      String?
  
  quiz          Quiz     @relation(fields: [quizId], references: [id], onDelete: Cascade)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  answers       Answer[]
  
  @@unique([quizId, userId, attemptNumber])
  @@index([quizId])
  @@index([userId])
  @@index([status])
}

enum QuizAttemptStatus {
  IN_PROGRESS   // Đang làm
  SUBMITTED     // Đã nộp, chờ chấm (nếu có essay)
  GRADED        // Đã chấm xong
  EXPIRED       // Hết thời gian
  ABANDONED     // Bỏ giữa chừng
}
```

### Model: Answer

Câu trả lời của học sinh cho một câu hỏi trong attempt.

```prisma
model Answer {
  id            String   @id @default(cuid())
  attemptId     String
  questionId    String
  
  // Answer data (JSON tùy theo question type)
  answerData    Json     // { selectedOptions: ["a"] } or { code: "..." } or { text: "..." }
  
  // Auto-graded
  isCorrect     Boolean?
  pointsEarned  Float?
  
  // Manual grading
  feedback      String?  @db.Text
  gradedAt      DateTime?
  gradedBy      String?
  
  // Time
  answeredAt    DateTime @default(now())
  
  attempt       QuizAttempt @relation(fields: [attemptId], references: [id], onDelete: Cascade)
  question      Question    @relation(fields: [questionId], references: [id])
  
  @@unique([attemptId, questionId])
  @@index([attemptId])
  @@index([questionId])
}
```

### Model: QuestionOption (cho câu hỏi có options)

Tách riêng để dễ index và query, nhưng cũng có thể giữ trong `data` JSON tùy chiến lược.

```prisma
model QuestionOption {
  id          String   @id @default(cuid())
  questionId  String
  
  text        String
  isCorrect   Boolean  @default(false)
  position    Int
  feedback    String?  // hiện sau khi học sinh chọn option này
  
  question    Question @relation(fields: [questionId], references: [id], onDelete: Cascade)
  
  @@index([questionId])
}
```

---

## 8. Module Code Execution

### Model: TestCase

Test case cho bài tập code.

```prisma
model TestCase {
  id            String   @id @default(cuid())
  assignmentId  String
  
  name          String?  // "Test 1: Basic case"
  
  // Input/Output
  input         String   @db.Text
  expectedOutput String  @db.Text
  
  // Settings
  isHidden      Boolean  @default(false) // ẩn với học sinh
  isSample      Boolean  @default(false) // hiện làm ví dụ
  
  // Scoring
  points        Float    @default(1)
  
  // Constraints
  timeLimit     Int?     // ms, override default
  memoryLimit   Int?     // MB, override default
  
  position      Int      @default(0)
  
  createdAt     DateTime @default(now())
  
  assignment    Assignment @relation(fields: [assignmentId], references: [id], onDelete: Cascade)
  results       TestCaseResult[]
  
  @@index([assignmentId])
}
```

### Model: CodeSubmission

Submission cho bài tập code - 1-1 với Submission.

```prisma
model CodeSubmission {
  id            String   @id @default(cuid())
  submissionId  String   @unique
  
  // Code
  language      ProgrammingLanguage
  sourceCode    String   @db.Text
  
  // Execution result
  status        CodeExecutionStatus @default(PENDING)
  
  // Aggregated results
  testsPassed   Int      @default(0)
  testsTotal    Int      @default(0)
  
  // Compilation
  compileError  String?  @db.Text
  
  // Runtime stats
  executionTime Float?   // seconds
  memoryUsed    Int?     // KB
  
  // Judge0 metadata
  judge0Token   String?  // token để query result
  
  createdAt     DateTime @default(now())
  completedAt   DateTime?
  
  submission    Submission @relation(fields: [submissionId], references: [id], onDelete: Cascade)
  testResults   TestCaseResult[]
  
  @@index([status])
}

enum CodeExecutionStatus {
  PENDING       // Chờ chạy
  COMPILING     // Đang compile
  RUNNING       // Đang chạy
  COMPLETED     // Xong
  FAILED        // Lỗi compile/runtime
  TIMEOUT       // Quá thời gian
  MEMORY_EXCEEDED // Vượt RAM
  ERROR         // Lỗi hệ thống
}
```

### Model: TestCaseResult

Kết quả chạy từng test case.

```prisma
model TestCaseResult {
  id                String   @id @default(cuid())
  codeSubmissionId  String
  testCaseId        String
  
  // Result
  passed            Boolean
  actualOutput      String?  @db.Text
  errorMessage      String?  @db.Text
  
  // Stats
  executionTime     Float?   // seconds
  memoryUsed        Int?     // KB
  
  // Status
  status            String   // detailed status từ Judge0
  
  createdAt         DateTime @default(now())
  
  codeSubmission    CodeSubmission @relation(fields: [codeSubmissionId], references: [id], onDelete: Cascade)
  testCase          TestCase       @relation(fields: [testCaseId], references: [id])
  
  @@unique([codeSubmissionId, testCaseId])
  @@index([codeSubmissionId])
}
```

---

## 9. Module Gradebook

### Model: GradingScheme

Cấu hình tính điểm cho khóa học.

```prisma
model GradingScheme {
  id          String   @id @default(cuid())
  courseId    String
  
  name        String   // "Sổ điểm chính thức"
  isDefault   Boolean  @default(false)
  
  // Cấu hình
  config      Json     // weighting, drop lowest, etc.
  
  // Letter grading scale (nếu dùng)
  scale       Json?    // [{ letter: "A", min: 8.5 }, ...]
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  groups      GradeGroup[]
  
  @@index([courseId])
}

model GradeGroup {
  id              String   @id @default(cuid())
  gradingSchemeId String
  
  name            String   // "Bài tập về nhà", "Kiểm tra giữa kỳ"
  weight          Float    // % trọng số
  dropLowest      Int      @default(0) // bỏ N điểm thấp nhất
  position        Int
  
  gradingScheme   GradingScheme @relation(fields: [gradingSchemeId], references: [id], onDelete: Cascade)
  
  @@index([gradingSchemeId])
}
```

### Model: Grade

Điểm tổng hợp của học sinh trong một khóa học.

```prisma
model Grade {
  id          String   @id @default(cuid())
  userId      String
  courseId    String
  
  // Tổng kết
  finalScore  Float?
  finalLetter String?  // "A", "B+", etc.
  
  // Breakdown
  breakdown   Json?    // chi tiết điểm theo group/assignment
  
  // Override (giáo viên có thể override điểm cuối)
  overriddenScore  Float?
  overrideReason   String?
  overriddenBy     String?
  overriddenAt     DateTime?
  
  // Metadata
  isPublished Boolean  @default(false)
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@unique([userId, courseId])
  @@index([userId])
  @@index([courseId])
}
```

---

## 10. Module Discussion (Phase 2)

### Model: Discussion

Diễn đàn theo khóa học hoặc theo lesson.

```prisma
model Discussion {
  id          String   @id @default(cuid())
  courseId    String
  
  // Context (có thể attach vào lesson cụ thể)
  contextType DiscussionContext @default(COURSE)
  contextId   String?  // lessonId nếu contextType = LESSON
  
  title       String
  description String?  @db.Text
  
  // Settings
  isPinned    Boolean  @default(false)
  isLocked    Boolean  @default(false)
  
  // Metadata
  postCount   Int      @default(0)
  lastPostAt  DateTime?
  
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  course      Course   @relation(fields: [courseId], references: [id], onDelete: Cascade)
  posts       DiscussionPost[]
  
  @@index([courseId])
  @@index([contextType, contextId])
}

enum DiscussionContext {
  COURSE
  LESSON
  ASSIGNMENT
}

model DiscussionPost {
  id            String   @id @default(cuid())
  discussionId  String
  
  // Reply structure
  parentPostId  String?  // nếu là reply
  
  authorId      String
  content       String   @db.Text
  
  // Reactions
  likeCount     Int      @default(0)
  
  // Status
  isEdited      Boolean  @default(false)
  isDeleted     Boolean  @default(false)
  
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  
  discussion    Discussion       @relation(fields: [discussionId], references: [id], onDelete: Cascade)
  parentPost    DiscussionPost?  @relation("PostReplies", fields: [parentPostId], references: [id])
  replies       DiscussionPost[] @relation("PostReplies")
  
  @@index([discussionId])
  @@index([authorId])
  @@index([parentPostId])
}
```

---

## 11. Module Notification

### Model: Notification

Thông báo cho user.

```prisma
model Notification {
  id          String   @id @default(cuid())
  userId      String
  
  type        NotificationType
  title       String
  content     String   @db.Text
  
  // Link tới resource liên quan
  link        String?
  
  // Metadata
  data        Json?    // payload tùy type
  
  // Status
  isRead      Boolean  @default(false)
  readAt      DateTime?
  
  // Channels - track gửi qua đâu
  sentViaEmail Boolean @default(false)
  sentInApp   Boolean  @default(true)
  
  createdAt   DateTime @default(now())
  
  user        User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  @@index([userId, isRead])
  @@index([type])
  @@index([createdAt])
}

enum NotificationType {
  // Assignment
  ASSIGNMENT_NEW           // Có bài tập mới
  ASSIGNMENT_DUE_SOON      // Sắp đến hạn
  ASSIGNMENT_OVERDUE       // Đã quá hạn
  ASSIGNMENT_GRADED        // Đã có điểm
  
  // Quiz
  QUIZ_NEW
  QUIZ_DUE_SOON
  QUIZ_GRADED
  
  // Course
  COURSE_ANNOUNCEMENT      // Thông báo từ giáo viên
  COURSE_ENROLLED          // Đã được thêm vào lớp
  COURSE_REMOVED
  
  // Submission
  SUBMISSION_RETURNED      // Bài bị trả về sửa
  SUBMISSION_FEEDBACK      // Có feedback mới
  
  // Discussion (Phase 2)
  DISCUSSION_REPLY
  DISCUSSION_MENTION
  
  // System
  SYSTEM_MAINTENANCE
  SYSTEM_UPDATE
}
```

### Model: NotificationPreference

Cấu hình nhận thông báo của user.

```prisma
model NotificationPreference {
  id          String   @id @default(cuid())
  userId      String   @unique
  
  // Per-type preferences
  preferences Json     // { ASSIGNMENT_NEW: { email: true, inApp: true }, ... }
  
  // Quiet hours
  quietHoursStart String? // "22:00"
  quietHoursEnd   String? // "06:00"
  
  updatedAt   DateTime @updatedAt
}
```

---

## 12. Module Audit Log

### Model: AuditLog

Log mọi action quan trọng cho mục đích audit và debug.

```prisma
model AuditLog {
  id          String   @id @default(cuid())
  
  // Who
  userId      String?
  userRole    String?
  ipAddress   String?
  userAgent   String?
  
  // What
  action      String   // "USER_LOGIN", "COURSE_CREATED", "GRADE_OVERRIDDEN"
  resource    String?  // "User", "Course"
  resourceId  String?
  
  // Details
  changes     Json?    // before/after state
  metadata    Json?
  
  // When
  createdAt   DateTime @default(now())
  
  user        User?    @relation(fields: [userId], references: [id], onDelete: SetNull)
  
  @@index([userId])
  @@index([action])
  @@index([resource, resourceId])
  @@index([createdAt])
}
```

---

## 13. Indexes và Performance

### Strategy

**Index mọi khóa ngoại** (Prisma không tự động index khóa ngoại như PostgreSQL).

**Composite index** cho query thường:
- `Enrollment(userId, courseId)` - query "user X có trong lớp Y không"
- `Submission(assignmentId, userId, attemptNumber)` - query "submission lần N của user trong assignment"
- `Notification(userId, isRead)` - query unread notifications
- `Answer(attemptId, questionId)` - query answer của user cho câu hỏi

**Soft delete index**: `deletedAt` ở mọi model có soft delete để query `WHERE deletedAt IS NULL` nhanh.

**Search index** (Phase 2): Dùng PostgreSQL full-text search hoặc Meilisearch cho:
- Course name + description
- Lesson title + content
- Question text
- Discussion title + posts

### Query patterns thường gặp

**Lấy danh sách lớp của student:**
```typescript
prisma.enrollment.findMany({
  where: { userId, status: 'ACTIVE' },
  include: { course: true }
})
```

**Lấy bài tập sắp tới hạn:**
```typescript
prisma.assignment.findMany({
  where: {
    course: { enrollments: { some: { userId } } },
    dueDate: { gte: new Date(), lte: addDays(new Date(), 7) }
  }
})
```

**Tính điểm tổng kết:**
```typescript
// Aggregate query - cần optimize bằng materialized view nếu chậm
prisma.submission.aggregate({
  where: { assignment: { courseId }, userId },
  _avg: { score: true }
})
```

---

## 14. Schema đầy đủ

> File này chứa các phần riêng lẻ. File `prisma/schema.prisma` thực tế sẽ ghép tất cả lại. Khi tạo file Prisma, bắt đầu với block sau:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ... (paste tất cả models từ các phần trên)
```

### Migration strategy

**MVP - Tháng 1:**
- User, Session, PasswordReset, VerificationToken
- AuditLog

**Tháng 2:**
- Course, Enrollment, TeachingAssistant
- Module, ModuleItem, Lesson, File, ModuleItemCompletion

**Tháng 3:**
- Assignment, Submission, SubmissionFile
- Quiz, Question, QuizQuestion, QuizAttempt, Answer, QuestionOption
- Rubric, RubricCriterion, RubricScore, RubricCriterionScore

**Tháng 4:**
- TestCase, CodeSubmission, TestCaseResult

**Tháng 5:**
- GradingScheme, GradeGroup, Grade
- Notification, NotificationPreference

**Phase 2:**
- Discussion, DiscussionPost
- Calendar Event (chưa thiết kế)
- Search indexes

### Lưu ý quan trọng

**KHÔNG migrate hết một lúc**: Tạo migration theo tuần, mỗi migration chỉ có thay đổi cần cho tuần đó.

**Test migration trên dev trước**: Luôn dùng `prisma migrate dev` trên local trước khi `prisma migrate deploy` trên production.

**Backup trước migrate production**: Tự động dump database trước mọi migration.

**Naming migration rõ ràng**: `add_user_role`, `add_assignment_late_policy` thay vì `update_1`, `update_2`.

---

## Changelog

| Ngày | Phiên bản | Thay đổi |
|------|-----------|----------|
| [Ngày] | 1.0 | Schema lần đầu cho LMS_LumiBach |
