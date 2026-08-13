import { Module, RequestMethod } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './common/auth/auth.module';
import { CacheModule } from './common/cache/cache.module';
import { HealthModule } from './common/health/health.module';
import { MeModule } from './modules/me/me.module';
import { ActivityModule } from './modules/activity/activity.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ForumModule } from './modules/forum/forum.module';
import { UsersModule } from './modules/users/users.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { CoursesModule } from './modules/courses/courses.module';
import { ModulesModule } from './modules/modules/modules.module';
import { LessonsModule } from './modules/lessons/lessons.module';
import { EnrollmentsModule } from './modules/enrollments/enrollments.module';
import { AttachmentsModule } from './modules/attachments/attachments.module';
import { AssignmentsModule } from './modules/assignments/assignments.module';
import { RubricsModule } from './modules/rubrics/rubrics.module';
import { QuestionsModule } from './modules/questions/questions.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { AttemptsModule } from './modules/attempts/attempts.module';
import { PracticeTestsModule } from './modules/practice-tests/practice-tests.module';
import { GradebookModule } from './modules/gradebook/gradebook.module';
import { CodeExercisesModule } from './modules/code-exercises/code-exercises.module';
import { SandboxModule } from './modules/sandbox/sandbox.module';
import { ScratchModule } from './modules/scratch/scratch.module';
import { CompetenciesModule } from './modules/competencies/competencies.module';
import { GroupsModule } from './modules/groups/groups.module';
import { PortfolioModule } from './modules/portfolio/portfolio.module';
import { RoomsModule } from './modules/rooms/rooms.module';
import { UserAuthModule } from './modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
    }),
    LoggerModule.forRoot({
      forRoutes: [{ path: '{*path}', method: RequestMethod.ALL }],
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
        transport:
          process.env.NODE_ENV === 'production'
            ? undefined
            : { target: 'pino-pretty', options: { singleLine: true, colorize: true } },
        redact: {
          paths: [
            'req.headers.cookie',
            'req.headers.authorization',
            'res.headers["set-cookie"]',
            '*.password',
            '*.passwordHash',
            '*.token',
            '*.secret',
            '*.refreshToken',
          ],
          censor: '[REDACTED]',
        },
        customLogLevel(_req, res, err) {
          if (err || res.statusCode >= 500) return 'error';
          if (res.statusCode >= 400) return 'warn';
          return 'info';
        },
      },
    }),
    // Lưới an toàn chung — không phải hàng rào chính. Các trang Server Component
    // (assignments/quizzes/exercises/practice-tests...) gọi API từ chính máy chủ
    // Next.js, nên req.ip là IP máy chủ, GIỐNG NHAU cho mọi học sinh/mọi lượt xem
    // trang. Nếu để mức thấp, cả trường cùng mở bài trong 1 phút sẽ cạn quota của
    // 1 handler và bị 429 → hiện sai thành 404 ở FE. Mức bảo vệ thật sự nằm ở
    // @Throttle() riêng trên UserAuthController (register/forgot-password/...).
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: 60_000,
        limit: 1000,
      },
    ]),
    PrismaModule,
    CacheModule,
    AuthModule,
    HealthModule,
    MeModule,
    ActivityModule,
    AnalyticsModule,
    NotificationsModule,
    ForumModule,
    UsersModule,
    CategoriesModule,
    CoursesModule,
    ModulesModule,
    LessonsModule,
    EnrollmentsModule,
    AttachmentsModule,
    AssignmentsModule,
    RubricsModule,
    QuestionsModule,
    QuizzesModule,
    AttemptsModule,
    PracticeTestsModule,
    GradebookModule,
    CodeExercisesModule,
    SandboxModule,
    ScratchModule,
    CompetenciesModule,
    GroupsModule,
    PortfolioModule,
    RoomsModule,
    UserAuthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
