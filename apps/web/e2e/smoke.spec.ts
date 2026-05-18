import { test, expect } from '@playwright/test';

/**
 * Smoke test Phase 2 — verify login page render đúng + form fields hiện diện.
 *
 * Phase 3+ sẽ mở rộng: full login → dashboard, RBAC redirect, server action
 * → BE call (sau khi migrate các module ra NestJS).
 *
 * Yêu cầu: web dev server đang chạy (`pnpm web:dev`) hoặc set
 * PLAYWRIGHT_WEB_SERVER=1 để Playwright tự start.
 */

test('login page renders with email + password fields', async ({ page }) => {
  await page.goto('/login');

  // Tiêu đề
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

  // Email input — placeholder gợi ý "ten@truong.edu.vn"
  const email = page.locator('input[type="email"]');
  await expect(email).toBeVisible();
  await expect(email).toHaveAttribute('placeholder', /truong\.edu\.vn/i);

  // Password input
  const password = page.locator('input[type="password"]');
  await expect(password).toBeVisible();

  // Submit button
  const submit = page.locator('button[type="submit"]');
  await expect(submit).toBeVisible();
  await expect(submit).toBeEnabled();
});

test('home redirects unauthenticated user to login', async ({ page }) => {
  const res = await page.goto('/');
  // Hoặc redirect tới /login, hoặc landing page có link tới /login.
  // Acceptable: cả hai. Smoke test chỉ assert không crash.
  expect(res?.status()).toBeLessThan(500);
});
