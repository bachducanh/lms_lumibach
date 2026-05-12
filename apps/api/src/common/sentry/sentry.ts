import * as Sentry from '@sentry/node';

/**
 * Init Sentry sớm nhất có thể (trước NestFactory.create) để bắt cả lỗi bootstrap.
 * Chỉ active khi SENTRY_DSN env var được set — dev local không cần.
 */
export function initSentry(): boolean {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1),
    sendDefaultPii: false,
    integrations: [Sentry.httpIntegration(), Sentry.requestDataIntegration()],
  });

  return true;
}

export { Sentry };
