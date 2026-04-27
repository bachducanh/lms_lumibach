# PROJECT CONTEXT - LMS_LumiBach

> **File này là tài liệu sống của dự án.** Paste toàn bộ nội dung vào đầu mỗi cuộc hội thoại với Claude để duy trì ngữ cảnh nhất quán. Cập nhật file này mỗi khi có thay đổi quan trọng về kiến trúc, schema, tiến độ, hoặc quyết định kỹ thuật.

**Phiên bản tài liệu**: 1.0
**Ngày cập nhật cuối**: [Điền ngày bạn bắt đầu dự án]
**Người maintain**: [Tên bạn] (solo developer)
**Repository**: [Link GitHub khi có]

---

## Mục lục

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Bối cảnh và lợi thế đặc biệt](#2-bối-cảnh-và-lợi-thế-đặc-biệt)
3. [Đối tượng người dùng](#3-đối-tượng-người-dùng)
4. [Phạm vi và mục tiêu](#4-phạm-vi-và-mục-tiêu)
5. [Stack công nghệ](#5-stack-công-nghệ)
6. [Kiến trúc tổng thể](#6-kiến-trúc-tổng-thể)
7. [Cấu trúc thư mục](#7-cấu-trúc-thư-mục)
8. [Coding convention](#8-coding-convention)
9. [Database conventions](#9-database-conventions)
10. [Phân quyền chi tiết](#10-phân-quyền-chi-tiết)
11. [Lộ trình triển khai](#11-lộ-trình-triển-khai)
12. [Quyết định kiến trúc quan trọng](#12-quyết-định-kiến-trúc-quan-trọng)
13. [Bảo mật và quyền riêng tư](#13-bảo-mật-và-quyền-riêng-tư)
14. [Hạ tầng và deployment](#14-hạ-tầng-và-deployment)
15. [Chiến lược chất lượng và testing](#15-chiến-lược-chất-lượng-và-testing)
16. [Vận hành sau khi launch](#16-vận-hành-sau-khi-launch)
17. [Migration từ Moodle](#17-migration-từ-moodle)
18. [Quy ước làm việc với Claude](#18-quy-ước-làm-việc-với-claude)
19. [Tài liệu liên quan](#19-tài-liệu-liên-quan)

---

## 1. Tổng quan dự án

**Tên dự án**: LMS_LumiBach

**Domain**: [Điền domain của bạn]

**Mô tả ngắn**: Hệ thống quản lý học tập cá nhân do một giáo viên Tin học phát triển, lấy cảm hứng từ Canvas LMS về cấu trúc quản lý học tập và JuiceMind về trải nghiệm dạy lập trình tương tác. Mục tiêu là tạo ra LMS chuyên biệt cho việc dạy Tin học - đặc biệt là lập trình - vượt trội hơn các giải pháp hiện có như Moodle ở khía cạnh trải nghiệm code.

**Bản chất sản phẩm**: Sản phẩm cá nhân của giáo viên (không thuộc nhà trường), phục vụ học sinh trường nơi giáo viên dạy + các lớp dạy thêm bên ngoài. Không thương mại hóa trong giai đoạn đầu, có thể mở rộng sau.

**Tầm nhìn dài hạn**: Thay thế hoàn toàn Moodle hiện tại trong vòng 6-12 tháng, trở thành nền tảng dạy Tin học chính cho cả học sinh trường và học viên lớp dạy thêm.

**Tên gọi**: "LumiBach" - [Điền ý nghĩa tên với bạn nếu muốn]

---

## 2. Bối cảnh và lợi thế đặc biệt

Đây là phần quan trọng giúp Claude hiểu đúng tinh thần dự án.

### Lợi thế hiếm có của dự án này

**Đã có Moodle production chạy ổn định**: Moodle hiện đang phục vụ 200-600 học sinh tốt. Điều này có nghĩa là:
- Không có áp lực thời gian phải xong nhanh
- Không có rủi ro "nếu LumiBach trễ thì học sinh không có gì học"
- Có thể làm kỹ lưỡng, test cẩn thận, không vội vàng release
- Có sẵn user base thật để test và nhận feedback khi sẵn sàng
- Có dữ liệu thật từ Moodle để tham khảo (cấu trúc khóa học, loại bài tập thường dùng)

**Kinh nghiệm vận hành LMS thực tế**: Đã tự build và vận hành Moodle, hiểu được:
- Pain points thực sự của giáo viên và học sinh khi dùng LMS
- Tính năng nào quan trọng, tính năng nào ít dùng
- Vấn đề bảo trì và backup thực tế
- Đặc thù người dùng Việt Nam

**Hạ tầng đã sẵn sàng**: Server vật lý + domain đã có, không phải đầu tư hạ tầng mới.

### Hệ quả từ những lợi thế này

- **Ưu tiên chất lượng hơn tốc độ**: Không vội ra mắt, làm tốt từng module trước khi sang module tiếp.
- **Test với học sinh thật từ sớm**: Có thể chọn 5-10 học sinh tin cậy làm beta tester từ tuần đầu.
- **Migration từng phần**: Không cần migrate ồ ạt, chuyển dần từng lớp từ Moodle sang LumiBach khi tính năng tương ứng đã sẵn sàng.
- **Học hỏi từ Moodle**: Quan sát học sinh đang dùng Moodle để hiểu họ cần gì.

### Hạn chế và ràng buộc

- **Solo developer**: Một mình code, test, deploy, support. Phải tự động hóa và đơn giản hóa tối đa.
- **Thời gian giới hạn**: Phải cân bằng với công việc giảng dạy chính.
- **Không có team review code**: Phải dùng Claude và self-discipline để đảm bảo chất lượng.
- **Server tại nhà/trường**: Có rủi ro mất điện, mất mạng, không có redundancy như cloud.

---

## 3. Đối tượng người dùng

### Quy mô dự kiến

- **Tổng người dùng**: 200-600 (kết hợp học sinh trường + học viên lớp dạy thêm)
- **Người dùng đồng thời tối đa**: ~100 (ước tính khi cả lớp lớn cùng làm bài kiểm tra)
- **Số khóa học cùng lúc**: 20-40 (các lớp trong trường + lớp dạy thêm)

### Bốn vai trò người dùng

**Admin** (Quản trị viên - 1-3 người)
- Bạn (chủ dự án) là Admin chính
- Có thể có 1-2 admin phụ là người tin cậy hỗ trợ vận hành
- Quản lý toàn bộ hệ thống: tài khoản, khóa học, cấu hình, báo cáo
- Quyền cao nhất, có thể impersonate user khác để debug

**Teacher** (Giáo viên - 5-10 người)
- Bạn là giáo viên chính
- Có thể có giáo viên khác cùng dạy ở các lớp dạy thêm
- Tạo và quản lý khóa học của mình
- Đăng bài giảng, tạo bài tập, quiz
- Chấm điểm thủ công + tự động
- Xem báo cáo lớp mình dạy
- Quản lý trợ giảng trong lớp của mình

**Teaching Assistant - TA** (Trợ giảng - 5-15 người)
- Học sinh giỏi hoặc cựu học sinh hỗ trợ giáo viên
- Quyền **gần như giáo viên** trong các lớp được phân công:
  - Có thể chấm bài tập (tự động và thủ công)
  - Có thể trả lời câu hỏi học sinh trong forum
  - Có thể xem điểm và tiến độ học sinh
  - Có thể quản lý discussion, moderate forum
  - Có thể tạo và sửa quiz
  - Có thể cho điểm và phản hồi bài làm
  - KHÔNG được sửa cấu trúc khóa học (modules, lessons gốc)
  - KHÔNG được xóa khóa học
  - KHÔNG được thêm/xóa học sinh khỏi lớp
  - KHÔNG được sửa thông tin lớp (tên, mô tả, settings)
- TA chỉ có quyền trên các lớp được giáo viên gán làm trợ giảng

**Student** (Học sinh - 200-580 người)
- Học sinh THPT của trường + học viên lớp dạy thêm
- Tham gia khóa học được đăng ký
- Đọc bài giảng, làm bài tập, làm quiz
- Code trên platform với editor tích hợp
- Submit bài, xem điểm và phản hồi
- Tham gia thảo luận
- Xem tiến độ học tập cá nhân

### Đặc thù người dùng

- Học sinh THPT Việt Nam, độ tuổi 15-18 (trường) + có thể trẻ hơn hoặc lớn hơn ở lớp dạy thêm
- Trình độ công nghệ trung bình, đa số dùng smartphone Android giá rẻ
- Một số học sinh kết nối internet không ổn định (4G mobile)
- Giao diện phải tiếng Việt hoàn toàn
- Mobile responsive cực kỳ quan trọng vì nhiều em không có máy tính riêng

---

## 4. Phạm vi và mục tiêu

### Mục tiêu chính

1. Tạo trải nghiệm dạy lập trình tương tác **vượt trội Moodle**, ngang tầm hoặc tốt hơn JuiceMind
2. Quản lý học tập đầy đủ như Canvas LMS để có thể thay thế Moodle dài hạn
3. Giảm thời gian chấm bài cho giáo viên qua tự động hóa
4. Theo dõi tiến độ chi tiết để phát hiện sớm học sinh gặp khó khăn
5. Hệ thống ổn định, ít bug nghiêm trọng, dễ vận hành cho solo dev

### Tính năng MVP - Giai đoạn 1 (3-4 tháng đầu)

**Foundation** (bắt buộc đầu tiên)
- Authentication: đăng ký, đăng nhập, đổi mật khẩu, quên mật khẩu
- User management: 4 vai trò (Admin/Teacher/TA/Student) với phân quyền
- Profile cá nhân với avatar
- Import user hàng loạt từ Excel
- Audit log cho admin (track ai làm gì khi nào)

**Course Management**
- Tạo khóa học theo cấu trúc Canvas (Module → Item)
- Đăng ký học sinh vào khóa (manual + bulk + qua mã mời)
- Phân công TA cho khóa học
- Sao chép khóa học (clone) để tái sử dụng giữa các kỳ

**Content Delivery**
- Bài giảng với rich text editor (TipTap)
- Upload file đính kèm (PDF, Word, PowerPoint, hình ảnh)
- Embed video YouTube
- Đánh dấu hoàn thành (manual + auto)

**Programming Exercises - Phần đặc thù quan trọng nhất**
- Code editor Monaco tích hợp cho Python (ưu tiên 1)
- HTML/CSS/JS với live preview iframe
- Test cases tự động chấm Python qua Judge0
- Hiển thị kết quả pass/fail từng test case
- Lưu lịch sử submission
- Time limit và memory limit cho code execution

**Assignment & Submission**
- Tạo bài tập với deadline
- Submission types: file upload, text, code
- Late submission policy (cho phép trễ với trừ điểm hoặc cấm)
- Giáo viên + TA chấm thủ công với rubric đơn giản
- Phản hồi inline cho code submission

**Quiz Engine cơ bản**
- Câu hỏi trắc nghiệm 1 đáp án, nhiều đáp án, đúng/sai
- Câu hỏi tự luận
- Câu hỏi code (đơn giản: viết code đáp ứng test cases)
- Time limit cho quiz
- Tự động chấm trắc nghiệm và code
- Ngân hàng câu hỏi tái sử dụng

**Gradebook**
- Tổng hợp điểm tất cả assignment + quiz
- Trọng số theo loại bài tập
- Export Excel
- Học sinh xem điểm cá nhân với phản hồi

**Notification cơ bản**
- In-app notification (chuông)
- Email khi có deadline gần, có điểm mới

### Tính năng Giai đoạn 2 (Tháng 5-7)

- Hỗ trợ thêm C++ và JavaScript trong code execution
- Các loại câu hỏi code nâng cao: Parsons puzzle, Fill-in-blank code, Debug challenge, Output prediction
- Discussion forum theo khóa học và bài học
- Calendar với deadline
- Search toàn hệ thống
- Mobile UX hoàn thiện với PWA
- Phát hiện chép code (plagiarism) cơ bản bằng so sánh AST/string similarity

### Tính năng Giai đoạn 3 (Tháng 8-12)

- Scratch Blocks tích hợp cho học sinh nhỏ tuổi
- Analytics dashboard chi tiết cho từng vai trò
- AI gia sư trả lời câu hỏi học sinh dùng API Claude
- Đề xuất bài tập cá nhân hóa theo năng lực
- Hệ thống huy hiệu và gamification
- Báo cáo chi tiết cho phụ huynh (nếu cần)
- Migration tool từ Moodle sang LumiBach

### Out of scope (KHÔNG làm)

- Thanh toán, đăng ký gói trả phí (sản phẩm cá nhân không thương mại)
- Marketplace khóa học cho giáo viên khác đăng bán
- Hỗ trợ đa tổ chức (multi-tenancy phức tạp)
- Dạy môn ngoài Tin học (focus chính là Tin học và lập trình)
- Tích hợp video conferencing tự xây (nếu cần dùng Google Meet/Zoom)
- Mobile app native (chỉ làm PWA)

### Định nghĩa "thành công"

- LumiBach phục vụ ổn định cho ít nhất 200 học sinh trong 1 học kỳ liên tục
- Tỷ lệ uptime > 99% (cho phép downtime ~7 giờ/tháng)
- Bug nghiêm trọng (P0/P1) < 1 mỗi tháng sau giai đoạn ổn định
- Học sinh và giáo viên feedback tích cực hơn so với Moodle
- Migration ít nhất 50% lớp học từ Moodle sang LumiBach trong năm đầu

---

## 5. Stack công nghệ

### Frontend & Backend (Fullstack)

- **Framework**: Next.js 14+ với App Router
- **Ngôn ngữ**: TypeScript (strict mode bật toàn bộ)
- **Styling**: Tailwind CSS 3+
- **UI Components**: shadcn/ui (dựa trên Radix UI)
- **Form management**: react-hook-form + Zod validation
- **State management**: React Context + Server Components (KHÔNG dùng Redux)
- **Data fetching**: TanStack Query cho client-side, Server Components cho server-side
- **Rich text editor**: TipTap (extensible, headless)
- **Code editor**: Monaco Editor (chuẩn công nghiệp, engine của VS Code)
- **Charts**: Recharts cho dashboard và analytics
- **Date handling**: date-fns (nhẹ, tree-shakeable)
- **Icons**: lucide-react

### Backend Infrastructure

- **Runtime**: Node.js 20 LTS
- **Database**: PostgreSQL 16
- **ORM**: Prisma 5+
- **Authentication**: NextAuth.js v5 (Auth.js)
- **File storage**: MinIO self-hosted (S3-compatible API)
- **Cache & Queue**: Redis 7
- **Background jobs**: BullMQ
- **Email**: Nodemailer với SMTP của Google Workspace hoặc dịch vụ email Việt Nam
- **Logging**: Pino (structured logging, performant)

### Code Execution Engine

- **Engine chính**: Judge0 self-hosted
- **Hỗ trợ ngôn ngữ MVP**: Python 3.11
- **Hỗ trợ ngôn ngữ Phase 2**: C++17, JavaScript (Node.js)
- **HTML/CSS/JS**: Iframe sandbox của trình duyệt (không cần backend)
- **Scratch (Phase 3)**: Scratch VM tích hợp client-side

### DevOps

- **Containerization**: Docker + Docker Compose
- **Web server**: Nginx (reverse proxy, SSL termination, static file serving)
- **SSL**: Let's Encrypt với Certbot, auto-renew
- **Monitoring**: 
  - Uptime Kuma cho uptime monitoring (self-hosted)
  - Grafana + Prometheus cho metrics chi tiết (Phase 2)
- **Error tracking**: Sentry (gói miễn phí 5K errors/tháng đủ dùng)
- **Logging**: Pino → file → Loki (Phase 2)
- **Backup**: Script bash + cron, lưu lên Backblaze B2 (rẻ hơn S3 4 lần)

### Development Tools

- **Code editor**: VS Code với extensions: Prisma, Tailwind CSS IntelliSense, ESLint, Prettier, Error Lens, GitLens, Pretty TypeScript Errors
- **Version control**: Git + GitHub (private repo)
- **Package manager**: pnpm (nhanh hơn npm, tiết kiệm disk)
- **Linting**: ESLint với config Next.js + TypeScript strict
- **Formatting**: Prettier
- **Pre-commit hooks**: Husky + lint-staged (chạy lint + format trước commit)
- **Testing**: 
  - Vitest cho unit tests
  - Playwright cho e2e tests
  - Storybook cho UI component testing (tùy chọn)
- **API testing**: Bruno (open source thay thế Postman)
- **Database GUI**: Prisma Studio + DBeaver

### Lý do chọn stack này

- **TypeScript everywhere**: Bạn quen rồi, type safety giảm bug, AI hỗ trợ tốt hơn
- **Next.js fullstack**: Một framework, một codebase, một deployment - lý tưởng cho solo dev
- **PostgreSQL**: Chuẩn công nghiệp cho ứng dụng dạng này, mạnh, miễn phí
- **Prisma**: Type-safe ORM, migration tự động, schema rõ ràng - tiết kiệm hàng trăm giờ debug
- **shadcn/ui**: Components đẹp sẵn, copy vào project (không phải dependency), tùy biến hoàn toàn
- **Judge0**: Open source được kiểm chứng, không tự xây sandbox (cực kỳ rủi ro bảo mật)
- **Docker**: Deploy nhất quán, dễ rollback, chuẩn industry
- **Self-hosted**: Phù hợp với server vật lý đã có, kiểm soát hoàn toàn

---

## 6. Kiến trúc tổng thể

### Loại kiến trúc

**Modular Monolith** - một ứng dụng đơn nhưng được tổ chức thành các module độc lập rõ ràng. Code execution và file storage là 2 service riêng (vì lý do bảo mật và resource).

Lý do không chọn microservices: Solo developer + 600 user = microservices tạo độ phức tạp không cần thiết. Có thể tách module thành service riêng sau khi cần scale.

### Sơ đồ thành phần hệ thống

```
                    ┌──────────────────────┐
                    │   User (Browser)     │
                    │  Desktop / Mobile    │
                    └──────────┬───────────┘
                               │ HTTPS
                               ▼
                    ┌──────────────────────┐
                    │  Nginx Reverse Proxy │
                    │  - SSL termination   │
                    │  - Rate limiting     │
                    │  - Static caching    │
                    └──────────┬───────────┘
                               │
                               ▼
        ┌────────────────────────────────────────┐
        │        Next.js App (Main)              │
        │  ┌────────┐ ┌────────┐ ┌──────────┐    │
        │  │  Auth  │ │ Course │ │Assignmnt │    │
        │  └────────┘ └────────┘ └──────────┘    │
        │  ┌────────┐ ┌────────┐ ┌──────────┐    │
        │  │  Quiz  │ │Gradebk │ │Discussion│    │
        │  └────────┘ └────────┘ └──────────┘    │
        │  ┌────────┐ ┌────────┐ ┌──────────┐    │
        │  │  User  │ │Notify  │ │Analytics │    │
        │  └────────┘ └────────┘ └──────────┘    │
        └──┬─────────┬──────────┬──────────┬─────┘
           │         │          │          │
           ▼         ▼          ▼          ▼
    ┌──────────┐ ┌──────┐ ┌─────────┐ ┌─────────┐
    │PostgreSQL│ │Redis │ │  MinIO  │ │ Judge0  │
    │ (DB)     │ │(Cache│ │(Storage)│ │(CodeExe)│
    │          │ │ Queue│ │         │ │         │
    └──────────┘ └──────┘ └─────────┘ └─────────┘
                                           │
                                           ▼
                                   ┌───────────────┐
                                   │ Docker isolate│
                                   │  containers   │
                                   │ Python/C++/JS │
                                   └───────────────┘
```

### Các module chính (theo domain)

1. **Auth Module**: Đăng nhập, đăng ký, phân quyền, session, password reset
2. **User Module**: CRUD user, import Excel, profile, audit log
3. **Course Module**: CRUD course, enrollment, module structure, course clone
4. **Content Module**: Lesson, file upload, rich text content, video embed
5. **Assignment Module**: Tạo bài tập, nộp bài, chấm thủ công, rubric
6. **Quiz Module**: Câu hỏi đa dạng, làm bài, chấm tự động, question bank
7. **Code Module**: Code editor, code submission, test cases, Judge0 integration, HTML/CSS/JS sandbox
8. **Gradebook Module**: Tổng hợp điểm, công thức tính, weighting, export
9. **Discussion Module**: Forum, post, reply, moderation (Phase 2)
10. **Notification Module**: In-app + email + queue
11. **Calendar Module**: Lịch deadline, sync iCal (Phase 2)
12. **Analytics Module**: Dashboard cho 4 vai trò
13. **Admin Module**: System config, user management, audit logs

### Data flow điển hình - Học sinh nộp bài code

```
1. Học sinh viết code trong Monaco Editor (Client)
2. Click Submit → POST /api/submissions (Server Action)
3. Server validate input với Zod
4. Server lưu submission vào DB với status "pending"
5. Server đẩy job vào BullMQ queue
6. Server trả response ngay với submissionId
7. Worker pick job từ queue
8. Worker gửi code + test cases tới Judge0
9. Judge0 chạy code trong Docker sandbox isolated
10. Judge0 trả kết quả (pass/fail từng test case + output)
11. Worker update submission trong DB với kết quả
12. Worker emit event qua WebSocket (hoặc dùng polling)
13. Client nhận kết quả realtime, hiển thị cho học sinh
```

---

## 7. Cấu trúc thư mục

```
lumibach/
├── .github/
│   └── workflows/              # CI/CD GitHub Actions
│       ├── test.yml
│       └── deploy.yml
├── docker/
│   ├── nginx/
│   │   └── nginx.conf
│   ├── judge0/
│   │   └── judge0.conf
│   └── postgres/
│       └── init.sql
├── docs/                        # Tài liệu dự án
│   ├── PROJECT_CONTEXT.md      # File này
│   ├── DATABASE_SCHEMA.md
│   ├── API_SPEC.md
│   ├── DEPLOYMENT.md
│   ├── OPERATIONS.md
│   ├── MIGRATION_PLAN.md       # Migration từ Moodle
│   ├── DECISIONS.md            # Architecture decision records
│   └── prompts/                # Prompt hiệu quả với Claude
├── prisma/
│   ├── schema.prisma           # Database schema
│   ├── migrations/
│   └── seed.ts                 # Seed data cho dev
├── public/                      # Static assets
│   ├── images/
│   └── fonts/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth routes (login, register)
│   │   ├── (admin)/           # Admin routes
│   │   ├── (teacher)/         # Teacher + TA routes
│   │   ├── (student)/         # Student routes
│   │   ├── api/               # API routes (chỉ khi cần)
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── forms/             # Form components
│   │   ├── layouts/           # Layout components
│   │   ├── editors/           # Monaco, TipTap, Scratch
│   │   └── features/          # Feature-specific
│   │       ├── auth/
│   │       ├── course/
│   │       ├── assignment/
│   │       ├── quiz/
│   │       ├── code/
│   │       └── ...
│   ├── lib/                    # Utilities và shared code
│   │   ├── auth.ts            # NextAuth config
│   │   ├── db.ts              # Prisma client singleton
│   │   ├── redis.ts           # Redis client
│   │   ├── storage.ts         # MinIO client
│   │   ├── judge0.ts          # Judge0 client
│   │   ├── email.ts           # Email helpers
│   │   ├── permissions.ts     # RBAC checks
│   │   └── utils.ts           # General utilities
│   ├── server/                 # Server-only code
│   │   ├── actions/           # Server actions
│   │   ├── services/          # Business logic
│   │   ├── queries/           # Database queries
│   │   ├── workers/           # Background job workers
│   │   └── middleware.ts      # Custom middleware
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # TypeScript types
│   ├── schemas/                # Zod schemas (shared client+server)
│   └── config/                 # App configuration
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
├── scripts/                    # Utility scripts
│   ├── backup.sh
│   ├── restore.sh
│   ├── import-users.ts
│   └── moodle-migrate.ts      # Migration từ Moodle
├── .env.example
├── .gitignore
├── docker-compose.yml          # Dev environment
├── docker-compose.prod.yml     # Production environment
├── Dockerfile
├── next.config.js
├── package.json
├── pnpm-lock.yaml
├── tailwind.config.ts
├── tsconfig.json
├── README.md
└── CHANGELOG.md
```

### Quy ước đặt tên file

- **Components React**: PascalCase (`UserProfile.tsx`, `CourseCard.tsx`)
- **Utilities, hooks**: camelCase (`useAuth.ts`, `formatDate.ts`)
- **Server actions**: camelCase với suffix `.action.ts` (`createCourse.action.ts`)
- **Services**: camelCase với suffix `.service.ts` (`auth.service.ts`)
- **Types**: PascalCase với suffix `.types.ts` (`User.types.ts`)
- **Schemas**: camelCase với suffix `.schema.ts` (`createCourse.schema.ts`)
- **Pages (Next.js)**: lowercase theo convention (`page.tsx`, `layout.tsx`, `loading.tsx`, `error.tsx`)

---

## 8. Coding convention

### TypeScript

- **Strict mode**: Bật toàn bộ trong `tsconfig.json` (strict, noUncheckedIndexedAccess, noImplicitAny)
- **Tuyệt đối không dùng `any`**: Dùng `unknown` và type guards thay thế
- **Type vs Interface**: Dùng `type` cho mọi thứ, chỉ dùng `interface` khi cần extends/implements
- **Naming**: 
  - PascalCase cho types, interfaces, classes, enums, components
  - camelCase cho variables, functions, methods
  - SCREAMING_SNAKE_CASE cho constants
  - kebab-case cho file names không phải component
- **Type imports**: Dùng `import type { Foo }` khi chỉ import type

### React/Next.js

- **Server Components mặc định**: Chỉ dùng Client Components khi cần interactivity (`"use client"`)
- **Server Actions cho mutations**: Ưu tiên Server Actions hơn API Routes
- **Async components**: Sử dụng async/await trong Server Components để fetch data
- **Suspense boundaries**: Dùng cho loading states với fallback UI
- **Error boundaries**: error.tsx ở mỗi route segment quan trọng
- **Composition over props drilling**: Dùng children prop, context khi cần

### Code style

- **Indentation**: 2 spaces (không dùng tab)
- **Quotes**: Single cho TypeScript, double cho JSX attributes
- **Semicolons**: Có
- **Trailing commas**: Có (multi-line)
- **Max line length**: 100 ký tự (không cứng nhắc)
- **Arrow functions**: Cho callbacks, function declarations cho top-level

### Comments

- **Tiếng Việt**: Cho comment giải thích logic nghiệp vụ
- **Tiếng Anh**: Cho JSDoc, type definitions, code identifiers
- **Khi nào comment**: Logic phức tạp, "tại sao" làm vậy, không phải "làm gì"
- **TODO/FIXME**: Format `// TODO: mô tả` hoặc `// FIXME: mô tả với lý do`
- **JSDoc cho public functions**: Mô tả params, return, ví dụ usage

### Error handling

- **Server actions luôn return**: 
  ```typescript
  type ActionResult<T> = 
    | { success: true; data: T }
    | { success: false; error: string };
  ```
- **Try-catch**: Bao quanh mọi async operation có thể fail
- **User-facing errors**: Tiếng Việt, dễ hiểu, KHÔNG lộ technical details
- **Logging**: Log mọi error với context đầy đủ (user, action, params)
- **Custom error classes**: Cho các loại error đặc biệt (UnauthorizedError, ValidationError, etc.)

### Validation

- **Mọi user input**: Validate Zod ở cả client và server
- **Schema dùng chung**: Đặt trong `src/schemas/`, import ở cả 2 phía
- **KHÔNG tin client**: Server luôn validate lại

### Git commit convention

Theo Conventional Commits:
- `feat: thêm tính năng mới`
- `fix: sửa bug`
- `refactor: tái cấu trúc code, không thay đổi behavior`
- `docs: cập nhật tài liệu`
- `test: thêm/sửa tests`
- `chore: việc lặt vặt (deps, config, etc.)`
- `perf: cải thiện performance`
- `style: formatting, không ảnh hưởng code`

Ví dụ: `feat(auth): thêm chức năng đăng nhập Google`

---

## 9. Database conventions

### Naming

- **Bảng (Model)**: PascalCase, số ít (`User`, `Course`, không phải `users` hay `Courses`)
- **Cột**: camelCase (`createdAt`, `userId`)
- **Khóa chính**: luôn là `id`, kiểu `String` với `cuid()` (tốt hơn UUID cho database)
- **Khóa ngoại**: `<modelName>Id` (ví dụ `userId`, `courseId`)
- **Timestamps**: `createdAt`, `updatedAt` ở mọi bảng quan trọng
- **Soft delete**: `deletedAt` thay vì xóa cứng (cho dữ liệu quan trọng như submission, grade)

### Relations

- **One-to-many**: Khóa ngoại ở phía nhiều
- **Many-to-many**: Tạo bảng trung gian rõ ràng (KHÔNG dùng implicit của Prisma) để có thể thêm metadata sau
- **Cascade**: Cẩn thận với `onDelete: Cascade`, ưu tiên `Restrict` hoặc `SetNull`

### Indexing

- **Index khóa ngoại**: Luôn có
- **Index field thường query**: `email`, `username`, `status`, `slug`
- **Composite index**: Khi query thường có nhiều điều kiện
- **Đo trước khi thêm**: Đừng thêm index không cần thiết, dùng EXPLAIN ANALYZE

### Migrations

- **Đặt tên migration rõ ràng**: `add_user_phone_field`, không phải `update_1`
- **KHÔNG sửa migration đã commit**: Tạo migration mới để rollback
- **Test migration trên dev trước khi production**
- **Backup database trước mọi migration production**

### Data integrity

- **Constraint ở DB level**: Unique, NOT NULL, CHECK constraints
- **Foreign keys luôn có**: Đảm bảo data integrity
- **Validation ở app level**: Bổ sung, không thay thế DB constraints

---

## 10. Phân quyền chi tiết

### Hệ thống RBAC (Role-Based Access Control)

Hệ thống sử dụng role-based với 4 role chính. Permission được định nghĩa theo resource + action.

### Ma trận quyền chi tiết

#### Course (Khóa học)

| Action | Admin | Teacher (own) | TA (assigned) | Student (enrolled) |
|--------|-------|---------------|---------------|-------------------|
| View course list | Có (All) | Có (Own) | Có (Assigned) | Có (Enrolled) |
| View course detail | Có | Có | Có | Có |
| Create course | Có | Có | Không | Không |
| Edit course settings | Có | Có | Không | Không |
| Delete course | Có | Có (own) | Không | Không |
| Clone course | Có | Có (own) | Không | Không |

#### Module/Lesson (Bài giảng)

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| View | Có | Có | Có | Có |
| Create | Có | Có | Không | Không |
| Edit | Có | Có | Không | Không |
| Delete | Có | Có | Không | Không |
| Reorder | Có | Có | Không | Không |

#### Assignment (Bài tập)

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| View list | Có | Có | Có | Có |
| Create | Có | Có | Không | Không |
| Edit | Có | Có | Không | Không |
| Delete | Có | Có | Không | Không |
| Submit | Không | Không | Không | Có |
| View all submissions | Có | Có | Có | Không |
| View own submission | Có | Có | Có | Có |
| Grade submission | Có | Có | Có | Không |
| Override grade | Có | Có | Không | Không |

#### Quiz

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| Create quiz | Có | Có | Có | Không |
| Edit quiz | Có | Có | Có | Không |
| Delete quiz | Có | Có | Không | Không |
| Publish quiz | Có | Có | Không | Không |
| Take quiz | Không | Không | Không | Có |
| View attempts | Có | Có | Có | Không |
| Grade essay questions | Có | Có | Có | Không |

#### Question Bank (Ngân hàng câu hỏi)

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| Create question | Có | Có | Có | Không |
| Edit own | Có | Có | Có | Không |
| Edit any | Có | Không | Không | Không |
| Delete | Có | Có (own) | Có (own) | Không |
| Use in quiz | Có | Có | Có | Không |

#### Gradebook (Sổ điểm)

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| View all grades | Có | Có (own course) | Có (assigned) | Không |
| View own grades | Có | Có | Có | Có |
| Edit grade | Có | Có | Có | Không |
| Override final grade | Có | Có | Không | Không |
| Export | Có | Có | Có | Không |

#### User Management

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| Create user | Có | Không | Không | Không |
| Edit any user | Có | Không | Không | Không |
| Edit own profile | Có | Có | Có | Có |
| Delete user | Có | Không | Không | Không |
| Enroll students | Có | Có (own course) | Không | Không |
| Assign TA | Có | Có (own course) | Không | Không |
| Impersonate user | Có | Không | Không | Không |

#### Discussion (Phase 2)

| Action | Admin | Teacher | TA | Student |
|--------|-------|---------|-----|---------|
| View | Có | Có | Có | Có |
| Post topic | Có | Có | Có | Có |
| Reply | Có | Có | Có | Có |
| Edit own post | Có | Có | Có | Có |
| Edit any post | Có | Có | Có | Không |
| Delete post | Có | Có | Có | Không |
| Pin/Lock topic | Có | Có | Có | Không |

### Implementation

- **Permission check ở 3 lớp**: Database (RLS nếu cần), Server (middleware + service), UI (hide buttons)
- **Helper function**: `hasPermission(user, action, resource)` trong `lib/permissions.ts`
- **TypeScript enums** cho roles và permissions để type-safe
- **Audit log** cho mọi action quan trọng (create/edit/delete)

---

## 11. Lộ trình triển khai

> **Triết lý**: Không vội. Có Moodle backup. Làm kỹ từng bước. Test trước khi mở rộng.

### Tháng 1: Foundation (Tuần 1-4)

**Tuần 1-2: Setup nền tảng**
- Setup project Next.js + TypeScript + Tailwind + shadcn/ui
- Setup PostgreSQL + Prisma
- Docker Compose cho dev environment
- CI/CD GitHub Actions cơ bản
- Setup repository, README, CHANGELOG
- Tạo DATABASE_SCHEMA.md hoàn chỉnh

**Tuần 3-4: Authentication + User Management**
- NextAuth.js với email/password
- Đăng ký, đăng nhập, đổi mật khẩu, quên mật khẩu
- 4 roles: Admin/Teacher/TA/Student
- Profile cá nhân
- Import user từ Excel
- Audit log cơ bản
- **Milestone**: Tạo được tài khoản các vai trò, đăng nhập, phân quyền cơ bản hoạt động

### Tháng 2: Course + Content (Tuần 5-8)

**Tuần 5-6: Course Management**
- CRUD course
- Course structure: Module → ModuleItem
- Enrollment (manual + bulk + invite code)
- Phân công TA cho khóa học
- Course settings, course clone

**Tuần 7-8: Content Module**
- Bài giảng với TipTap editor
- Upload file qua MinIO
- Embed video YouTube
- Đánh dấu hoàn thành
- **Milestone**: Tạo được lớp học, đăng bài giảng, học sinh đọc được

### Tháng 3: Assignment + Quiz cơ bản (Tuần 9-12)

**Tuần 9-10: Assignment Module**
- Tạo assignment với deadline
- Submission file/text
- Late submission policy
- Giáo viên + TA chấm thủ công
- Rubric đơn giản

**Tuần 11-12: Quiz Engine**
- Câu hỏi trắc nghiệm, đúng/sai, tự luận
- Time limit
- Tự động chấm trắc nghiệm
- Question bank
- **Milestone**: Giao và chấm bài tập + thi trắc nghiệm online được

### Tháng 4: Code Execution - Phần khó nhất (Tuần 13-16)

**Tuần 13: Setup Judge0**
- Cài Judge0 trên server riêng (hoặc cùng server với resource hợp lý)
- Test thủ công với Python
- Document setup chi tiết

**Tuần 14: Monaco Editor + UI code**
- Tích hợp Monaco với Next.js
- Theme đẹp, autocomplete
- UI submit code

**Tuần 15: Code Submission Flow**
- Database schema cho code submission, test cases
- BullMQ queue
- Worker gửi code tới Judge0, nhận kết quả
- Hiển thị kết quả realtime cho học sinh
- Chấm tự động Python với test cases

**Tuần 16: HTML/CSS/JS Sandbox**
- Iframe sandbox với live preview
- CodePen-style 3 panels (HTML/CSS/JS + Preview)
- Submission cho HTML/CSS/JS
- **Milestone**: Học sinh code Python, HTML/CSS/JS trên platform được, chấm tự động hoạt động

### Tháng 5: Hoàn thiện MVP + Beta Test (Tuần 17-20)

**Tuần 17-18: Gradebook + Notification**
- Tổng hợp điểm với weighting
- Export Excel
- In-app notification
- Email notification cơ bản

**Tuần 19: Polish UI/UX**
- Mobile responsive hoàn chỉnh
- Loading states, error states
- Accessibility (ARIA, keyboard navigation)
- Tiếng Việt toàn bộ UI

**Tuần 20: Beta Test với 5-10 học sinh**
- Pilot với một lớp dạy thêm nhỏ
- Thu thập feedback
- Fix bug nghiêm trọng
- **Milestone**: MVP có thể dùng cho 1 lớp thật, ổn định

### Tháng 6: Mở rộng dần dần (Tuần 21-24)

- Mở rộng cho 30-50 học sinh (1-2 lớp dạy thêm)
- Theo dõi performance, bug, UX
- Setup monitoring đầy đủ
- Backup automation
- Document vận hành (OPERATIONS.md)
- Migrate lớp đầu tiên từ Moodle sang LumiBach
- **Milestone**: 50 học sinh dùng ổn định 1 tháng liên tục

### Tháng 7-9: Phase 2 Features

- C++ và JavaScript trong code execution
- Các loại câu hỏi code nâng cao (Parsons, Fill-in-blank, Debug)
- Discussion forum
- Calendar và sync
- Search toàn hệ thống
- Plagiarism detection cơ bản
- Mở rộng lên 200-300 học sinh

### Tháng 10-12: Phase 3 + Migration

- Scratch Blocks integration
- Analytics dashboard chi tiết
- AI tutor (tùy chọn)
- Migration tool từ Moodle
- Migrate dần các lớp còn lại
- Mở rộng đầy đủ 600 học sinh
- **Milestone cuối cùng**: LumiBach phục vụ toàn bộ user base, Moodle có thể tắt

---

## 12. Quyết định kiến trúc quan trọng

### QĐ-001: Modular Monolith thay vì Microservices
**Ngày**: [Ngày bắt đầu]
**Quyết định**: Dùng monolith được module hóa rõ ràng, tách Judge0 và MinIO làm service riêng.
**Lý do**: Solo dev + 600 user. Microservices tạo phức tạp không cần thiết. Có thể tách module sau.
**Trade-off**: Khó scale từng module độc lập, nhưng đơn giản triển khai và maintain.

### QĐ-002: Next.js App Router thay vì Pages Router
**Ngày**: [Ngày bắt đầu]
**Quyết định**: App Router với Server Components.
**Lý do**: Tương lai của Next.js, Server Components giảm JS bundle, hỗ trợ streaming, performance tốt.
**Trade-off**: Mới hơn, một số thư viện chưa tương thích hoàn toàn.

### QĐ-003: Prisma làm ORM thay vì query thô
**Ngày**: [Ngày bắt đầu]
**Quyết định**: Prisma cho mọi tương tác database.
**Lý do**: Type-safe, migration tự động, schema rõ ràng, productivity cao cho solo dev.
**Trade-off**: Performance overhead nhỏ, một số query phức tạp cần raw SQL.

### QĐ-004: Judge0 thay vì tự dựng sandbox
**Ngày**: [Ngày bắt đầu]
**Quyết định**: Dùng Judge0 self-hosted cho code execution.
**Lý do**: Bảo mật code execution cực kỳ phức tạp. Judge0 đã được kiểm chứng. Tự xây có rủi ro lớn.
**Trade-off**: Maintain thêm 1 service, tốn resource server.

### QĐ-005: shadcn/ui thay vì Material UI/Ant Design
**Ngày**: [Ngày bắt đầu]
**Quyết định**: shadcn/ui làm component library.
**Lý do**: Components copy vào project (không phải dependency), tùy biến hoàn toàn, đẹp, accessible.
**Trade-off**: Phải tự maintain code components.

### QĐ-006: Self-host trên server vật lý
**Ngày**: [Ngày bắt đầu]
**Quyết định**: Deploy trên server vật lý đã có thay vì cloud.
**Lý do**: Đã có server, không tốn phí hosting hàng tháng, kiểm soát hoàn toàn dữ liệu.
**Trade-off**: Không có auto-scaling, phải tự lo backup off-site, downtime khi mất điện.

### QĐ-007: Song song với Moodle, migrate dần dần
**Ngày**: [Ngày bắt đầu]
**Quyết định**: Moodle vẫn chạy, LumiBach phát triển độc lập, migrate khi sẵn sàng.
**Lý do**: Không có áp lực thời gian, có thể test kỹ trước khi đưa user vào.
**Trade-off**: Maintain 2 hệ thống song song một thời gian, user phải làm quen với cả hai.

<!-- Thêm các quyết định mới ở dưới -->

---

## 13. Bảo mật và quyền riêng tư

### Authentication & Authorization

- **Password hashing**: bcrypt với cost factor 12
- **Session**: JWT trong HTTP-only cookie, secure, sameSite strict, expires 7 ngày
- **CSRF protection**: NextAuth tự xử lý, kiểm tra origin
- **Rate limiting**: 
  - Login: 5 lần/15 phút per IP
  - API: 100 req/phút per user
  - Code submission: 10 lần/phút per user (chống spam Judge0)
- **Phân quyền**: Middleware kiểm tra role + ownership ở mọi route protected
- **2FA** (Phase 2): TOTP cho Admin và Teacher

### Data protection

- **HTTPS bắt buộc**: Mọi traffic, không có HTTP fallback
- **Mã hóa khi nghỉ**: Database backup mã hóa AES-256 trước khi upload
- **PII (thông tin cá nhân)**: 
  - Email và phone không log ra file
  - Mật khẩu KHÔNG BAO GIỜ log, không bao giờ trả về API
  - Dữ liệu tối thiểu (data minimization)

### Code execution security - CỰC KỲ QUAN TRỌNG

Đây là phần rủi ro nhất của hệ thống. Tuyệt đối không tự xây sandbox.

- **Sandbox cách ly**: Judge0 chạy trong Docker container riêng biệt
- **Resource limits chặt chẽ**:
  - CPU: 1 core
  - RAM: 256MB
  - Time: 5 giây
  - Output: 10MB max
  - File size: 1MB max
- **Network isolation**: Container KHÔNG có internet access
- **Filesystem read-only**: Trừ /tmp với quota nhỏ (10MB)
- **KHÔNG chạy code với user root**
- **No persistent storage**: Mỗi lần chạy là môi trường mới
- **Monitoring abuse**: Cảnh báo nếu user gửi code đáng ngờ (cố crash hệ thống, fork bomb)

### Input validation

- **Mọi input**: Validate Zod schema ở server (KHÔNG tin client)
- **SQL injection**: Prisma parameterized queries (an toàn mặc định)
- **XSS**: React escape mặc định, sanitize HTML từ rich text editor (DOMPurify)
- **File upload**: 
  - Whitelist extension (PDF, DOCX, XLSX, hình ảnh)
  - Kiểm tra MIME type thật (không tin extension)
  - Giới hạn size 50MB
  - Scan virus với ClamAV (Phase 2)
- **CORS**: Whitelist origins cụ thể, không dùng wildcard

### Privacy

- **Tuân thủ Nghị định 13/2023** về bảo vệ dữ liệu cá nhân:
  - Có chính sách bảo mật rõ ràng
  - User đồng ý trước khi thu thập dữ liệu
  - Quyền truy cập, sửa, xóa dữ liệu cá nhân
  - Thông báo khi có data breach
- **Tuân thủ luật bảo vệ trẻ em VN**: Học sinh dưới 16 cần đồng ý phụ huynh (form đồng ý khi đăng ký)
- **Data retention**: Xóa dữ liệu user inactive sau 2 năm (giữ điểm số chính thức)
- **Quyền xóa dữ liệu**: User có thể yêu cầu xóa tài khoản, dữ liệu được xóa trong 30 ngày

### Security checklist cho mỗi feature

- Input validation (client + server)
- Authentication check
- Authorization check (đúng role + ownership)
- Rate limiting nếu cần
- Logging cho audit
- Error message không lộ info
- Test với user không có quyền (xem có bypass được không)

---

## 14. Hạ tầng và deployment

### Cấu hình server

**Server vật lý hiện có:**
- RAM: 8-16GB
- CPU: 4-8 cores
- Storage: SSD (cần xác nhận dung lượng)
- OS: [Ubuntu 22.04 LTS đề xuất]

**Phân bổ resource đề xuất:**
- Next.js app: 2-4GB RAM, 2 cores
- PostgreSQL: 2-4GB RAM, 1-2 cores
- Redis: 512MB-1GB RAM
- MinIO: 1GB RAM
- Judge0 + workers: 2-4GB RAM, 2-4 cores (cần tài nguyên cho code execution)
- OS + buffer: 1-2GB

### Môi trường

**Development (máy local)**
- Tất cả services qua Docker Compose
- Database: PostgreSQL local
- File storage: MinIO local
- Code execution: Judge0 local
- URL: http://localhost:3000

**Staging (tùy chọn, có thể bỏ qua giai đoạn đầu)**
- Subdomain: staging.[domain]
- Cùng server, port khác hoặc subdomain riêng
- Dữ liệu test, có thể reset

**Production (server vật lý của bạn)**
- Domain: [domain của bạn]
- Reverse proxy qua Nginx
- SSL Let's Encrypt
- Database production riêng biệt với staging
- Backup tự động hàng ngày

### Deployment workflow

1. **Development**: Code trên branch `feature/xyz`
2. **PR vào `develop`**: Auto-run tests
3. **Merge `develop` → `main`**: Tag version
4. **GitHub Actions**: Build Docker images, push lên registry (hoặc build trực tiếp trên server)
5. **SSH vào server**: Pull latest, run database migration, restart containers
6. **Verify**: Smoke test, check logs

**Rollback plan**: Giữ 3 phiên bản gần nhất, có thể rollback bằng 1 lệnh.

### Backup strategy - CỰC KỲ QUAN TRỌNG

**Database backup:**
- Dump PostgreSQL hàng ngày 2h sáng
- Retention: 7 daily + 4 weekly + 12 monthly
- Encrypted với GPG, upload Backblaze B2
- Test restore mỗi tháng (quan trọng nhất)

**File storage backup:**
- MinIO sync sang Backblaze B2 hàng ngày
- Retention: 30 ngày

**Application backup:**
- Code trên GitHub (đã backup)
- Config files trên server backup hàng tuần
- Document toàn bộ trong DEPLOYMENT.md

**Disaster recovery:**
- RTO (Recovery Time Objective): 4 giờ
- RPO (Recovery Point Objective): 24 giờ
- Tài liệu hóa quy trình restore đầy đủ trong OPERATIONS.md
- Test disaster recovery 6 tháng/lần

### Monitoring và alerting

- **Uptime**: Uptime Kuma ping mỗi 5 phút, alert qua Telegram/email
- **Error tracking**: Sentry (gói miễn phí)
- **Logs**: Pino + log rotation, giữ 30 ngày
- **Metrics** (Phase 2): Grafana + Prometheus
- **Alert thresholds**:
  - CPU > 80% trong 5 phút
  - RAM > 90%
  - Disk > 85%
  - Error rate > 5%
  - Response time p95 > 3s

### Server hardening

- **SSH**: Chỉ key-based auth, không dùng password
- **Firewall**: UFW, chỉ mở port 80, 443, 22 (SSH với IP whitelist)
- **Auto updates**: unattended-upgrades cho security patches
- **Fail2ban**: Block IP brute force
- **Disable root SSH login**

### Lưu ý đặc biệt cho server vật lý tại nhà/trường

- **UPS dự phòng**: Để giữ server chạy khi mất điện ngắn
- **Dynamic DNS hoặc Static IP**: Vì IP có thể thay đổi
- **Dual ISP nếu có thể**: Backup internet khi đứt mạng
- **Backup off-site bắt buộc**: Server tại nhà có thể cháy/mất trộm/lụt
- **Firewall router**: Cấu hình kỹ port forwarding chỉ cho 80/443
- **Monitor nhiệt độ**: Server gia đình dễ quá nhiệt

---

## 15. Chiến lược chất lượng và testing

### Triết lý chất lượng

> **Solo dev thì chất lượng càng quan trọng**: Không có ai code review giúp, phải tự kỷ luật cao. Bug trong sản phẩm = bạn phải tự fix lúc 11h đêm khi học sinh báo.

### Testing pyramid

**Unit tests (60% effort)**
- Test mọi business logic phức tạp
- Test permission checks
- Test calculations (gradebook, weighting)
- Tool: Vitest
- Target: 70%+ coverage cho code logic

**Integration tests (30% effort)**
- Test database interactions
- Test API endpoints / Server Actions
- Test với database thật (test container)
- Tool: Vitest + supertest

**E2E tests (10% effort)**
- Test critical user flows: đăng nhập, nộp bài, chấm bài
- Tool: Playwright
- Chạy trên CI trước mỗi deploy

### Manual testing checklist trước khi release

Mỗi feature mới phải pass checklist:
- Happy path hoạt động
- Validation hiện đúng
- Error states hiển thị đúng
- Loading states đầy đủ
- Mobile responsive
- Accessible với keyboard
- Test với 4 vai trò user khác nhau
- Test với user không có quyền (security)
- Test với mạng yếu (throttle 3G)
- Test với data nhiều (1000+ records)

### Code review với Claude

Vì là solo dev, dùng Claude làm reviewer:
1. Mỗi PR lớn, paste code lên Claude
2. Yêu cầu review về: bảo mật, hiệu năng, code quality, accessibility
3. Áp dụng feedback hợp lý
4. Document những điểm Claude thường bắt được vào CLAUDE_REVIEWS.md

### Bug tracking

- Dùng GitHub Issues cho bug
- Severity:
  - **P0 (Critical)**: Hệ thống sập, data loss, security breach. Fix ngay.
  - **P1 (High)**: Tính năng quan trọng không hoạt động. Fix trong 24h.
  - **P2 (Medium)**: Tính năng phụ lỗi, có workaround. Fix trong tuần.
  - **P3 (Low)**: UI nhỏ, edge cases. Fix khi có thời gian.

### Performance budgets

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Largest Contentful Paint**: < 2.5s
- **API response p95**: < 500ms
- **Code execution p95**: < 5s

---

## 16. Vận hành sau khi launch

### Daily operations checklist

**Hàng ngày (5 phút)**
- Check Uptime Kuma có alert không
- Check Sentry có error mới quan trọng không
- Check logs có pattern bất thường không

**Hàng tuần (30 phút)**
- Review error trends
- Check disk usage, RAM, CPU trends
- Verify backup chạy thành công
- Update dependencies có security fix
- Reply user feedback

**Hàng tháng (2-4 giờ)**
- Test restore backup
- Review performance metrics
- Cleanup old data theo policy
- Plan tính năng tháng tới
- Update CHANGELOG, document changes

**Hàng quý**
- Security audit (review permissions, dependencies, logs)
- Performance optimization
- Disaster recovery drill
- User feedback survey

### Support workflow

**User báo bug:**
1. Reproduce trên dev environment
2. Tạo GitHub issue với severity
3. Fix theo SLA của severity
4. Test, deploy
5. Notify user đã fix

**User cần hỗ trợ vận hành:**
1. Có FAQ trong app
2. Email support: [email]
3. Response time: 24h cho học sinh, 4h cho giáo viên
4. Escalate cho admin nếu cần (nhưng admin chính là bạn)

### Communication với users

- **Thông báo bảo trì**: Banner trong app + email 3 ngày trước
- **Sự cố ngoài ý muốn**: Status page (Uptime Kuma có public status)
- **Feature mới**: Changelog + email update hàng tháng
- **Channel feedback**: Form trong app + email

---

## 17. Migration từ Moodle

### Triết lý migration

> **Không vội. Không bắt buộc. Test kỹ. Có rollback plan.**

### Phases migration

**Phase 0: Preparation (Tháng 5-6)**
- Phân tích cấu trúc dữ liệu Moodle
- Map fields Moodle → LumiBach
- Viết migration script (Python hoặc TypeScript)
- Test migration trên một lớp nhỏ trong staging

**Phase 1: Pilot Migration (Tháng 7)**
- Chọn 1 lớp dạy thêm tin cậy nhất (10-20 học sinh)
- Migrate users, courses, content
- Học sinh có tài khoản trên cả 2 platform
- Dùng song song 1 tháng để so sánh
- Thu feedback, fix issues

**Phase 2: Gradual Migration (Tháng 8-10)**
- Migrate từng lớp một, mỗi tuần 1-2 lớp
- Theo dõi sát mỗi lớp 1-2 tuần
- Moodle vẫn read-only access cho dữ liệu cũ
- Document migration issues vào MIGRATION_PLAN.md

**Phase 3: Full Migration (Tháng 11-12)**
- Migrate các lớp còn lại
- Moodle archive mode (read-only)
- Sau 6 tháng có thể tắt hoàn toàn Moodle

### Data cần migrate

**Bắt buộc:**
- Users (giáo viên, học sinh, admin)
- Courses và enrollment
- Course content (lessons, files)
- Assignments với submissions
- Quiz và quiz attempts
- Grades

**Tùy chọn:**
- Discussion posts
- Calendar events
- Old notifications (có thể bỏ)
- File attachments (có thể keep on Moodle, link sang)

**Không migrate:**
- Logs cũ
- Cache data
- Session data

### Migration script structure

```typescript
// scripts/moodle-migrate.ts
async function migrate() {
  // 1. Connect Moodle DB (read-only)
  // 2. Connect LumiBach DB
  // 3. Migrate trong transaction:
  //    - Users (với password reset)
  //    - Courses
  //    - Enrollments
  //    - Content
  //    - Assignments + Submissions
  //    - Grades
  // 4. Verify counts
  // 5. Generate migration report
}
```

### Rollback plan

- Backup LumiBach trước migration
- Có thể rollback từng lớp nếu có issue
- Moodle vẫn nguyên vẹn, không touch

---

## 18. Quy ước làm việc với Claude

### Khi bắt đầu cuộc hội thoại mới

**LUÔN paste toàn bộ file PROJECT_CONTEXT.md này vào đầu cuộc hội thoại**, sau đó nêu cụ thể:
- Module/feature đang làm
- Trạng thái hiện tại (đã làm gì, đang vướng đâu)
- Câu hỏi/yêu cầu cụ thể
- File/code liên quan (paste vào)

### Format prompt hiệu quả

```
[Paste PROJECT_CONTEXT.md]

---

## Tình huống hiện tại
- Module đang code: [tên]
- Đã hoàn thành: [list]
- Đang làm: [cụ thể]
- File liên quan: [paste code]

## Yêu cầu
[Yêu cầu rõ ràng, một việc tại một lần]

## Constraints
[Những gì phải tuân theo]

## Output mong muốn
[File gì, format nào, có comment giải thích không]
```

### Khi yêu cầu code

- "Hãy code và giải thích từng phần để tôi hiểu"
- "TypeScript types đầy đủ, không dùng any"
- "Liệt kê test case cần kiểm tra sau khi code"
- "Đặt câu hỏi nếu thấy thiếu thông tin trước khi code"
- "Follow coding convention trong PROJECT_CONTEXT.md"

### Khi review code

- Paste code và yêu cầu Claude review về: bảo mật, hiệu năng, code quality, accessibility
- Yêu cầu cụ thể "đề xuất 3 cải thiện quan trọng nhất"

### Khi gặp bug

- Paste **toàn bộ error message** không cắt
- Paste **code liên quan** đầy đủ
- Mô tả **những gì đã thử**
- Yêu cầu Claude debug từng bước, không nhảy thẳng đến giải pháp
- "Hỏi tôi thêm thông tin nếu cần"

### Khi học khái niệm mới

- "Giải thích [concept] với analogy đơn giản"
- "Cho ví dụ thực tế từ codebase của tôi"
- "So sánh với [concept tương tự] tôi đã biết"
- "Tóm tắt 3 điểm quan trọng nhất"

### Đừng bao giờ

- Copy-paste code Claude tạo mà không hiểu
- Tin tưởng 100% Claude về API/version cụ thể (luôn check docs)
- Yêu cầu code module quá lớn trong 1 prompt
- Bỏ qua phần Claude đặt câu hỏi - đó là dấu hiệu cần làm rõ yêu cầu
- Skip testing vì "code Claude viết chắc đúng"

### Pattern tốt với Claude

**Pattern 1: Plan → Code → Review**
1. "Trước khi code, hãy thiết kế chi tiết module X"
2. Review thiết kế, điều chỉnh
3. "Bây giờ code phần Y theo thiết kế đã thống nhất"
4. "Review code vừa viết về [criteria]"

**Pattern 2: Incremental development**
1. Code tính năng cơ bản nhất hoạt động
2. "Thêm validation"
3. "Thêm error handling"
4. "Thêm loading states"
5. "Thêm tests"

**Pattern 3: Debug systematically**
1. "Đây là bug: [paste]. Đặt 5 hypothesis về nguyên nhân"
2. "Test hypothesis 1 thế nào?"
3. "Hypothesis sai, đây là kết quả test: [paste]. Hypothesis tiếp"

---

## 19. Tài liệu liên quan

### Files trong dự án

- **PROJECT_CONTEXT.md** (file này): Context tổng quan
- **DATABASE_SCHEMA.md**: Prisma schema chi tiết với giải thích
- **API_SPEC.md**: Đặc tả tất cả endpoints
- **DEPLOYMENT.md**: Hướng dẫn deploy chi tiết
- **OPERATIONS.md**: Vận hành hàng ngày, troubleshooting
- **MIGRATION_PLAN.md**: Kế hoạch migration từ Moodle
- **DECISIONS.md**: Architecture Decision Records (ADRs)
- **TODO.md**: Task list theo tuần
- **CHANGELOG.md**: Lịch sử thay đổi
- **CLAUDE_REVIEWS.md**: Pattern Claude thường flag để bạn học
- **docs/prompts/**: Prompts hiệu quả

### Tài liệu tham khảo bên ngoài

**Stack chính:**
- Next.js Documentation: https://nextjs.org/docs
- Prisma Documentation: https://www.prisma.io/docs
- shadcn/ui: https://ui.shadcn.com/
- NextAuth.js: https://authjs.dev/
- Tailwind CSS: https://tailwindcss.com/docs
- Monaco Editor: https://microsoft.github.io/monaco-editor/

**Code execution:**
- Judge0 Documentation: https://github.com/judge0/judge0
- Judge0 API: https://ce.judge0.com/

**Tham khảo LMS:**
- Canvas LMS Source: https://github.com/instructure/canvas-lms
- Moodle Documentation: https://docs.moodle.org/
- JuiceMind: https://juicemind.com/

**Best practices:**
- OWASP Top 10: https://owasp.org/Top10/ - bảo mật web
- Web.dev: https://web.dev/ - performance và quality

---

## Changelog của file này

| Ngày | Phiên bản | Thay đổi | Người sửa |
|------|-----------|----------|-----------|
| [Ngày bắt đầu] | 1.0 | Tạo file lần đầu cho LMS_LumiBach | [Tên bạn] |

<!-- Thêm các bản cập nhật mới ở trên cùng -->

---

## Lời kết

LumiBach là dự án solo của một giáo viên đam mê công nghệ, không phải sản phẩm của một công ty phần mềm chuyên nghiệp. Hãy chấp nhận điều đó và tận dụng các lợi thế:

- **Linh hoạt**: Không có team họp hành, ra quyết định nhanh
- **Hiểu user**: Bạn vừa là dev vừa là user chính
- **Có Moodle backup**: Không có áp lực, làm kỹ
- **Tận dụng AI**: Claude là code reviewer 24/7

Và chấp nhận hạn chế:

- **Tốc độ chậm hơn team**: Đó là bình thường, không phải lỗi của bạn
- **Có thể có bug**: Mọi phần mềm đều có, mục tiêu là phát hiện và fix nhanh
- **Cần kỷ luật cao**: Không có ai nhắc bạn viết test, document, backup

File này là kim chỉ nam. Hãy đọc lại mỗi khi lạc hướng. Cập nhật mỗi khi có thay đổi quan trọng. Một file context tốt là tài sản quý giá nhất của dự án solo.

**Chúc bạn thành công với LMS_LumiBach!**
