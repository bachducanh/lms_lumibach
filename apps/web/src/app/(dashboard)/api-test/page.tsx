import { cookies } from 'next/headers';
import { apiServerClient, ApiError } from '@/lib/api-client';

type Me = {
  user: {
    id: string;
    email: string;
    fullName: string | null;
    role: string;
    status: string;
  };
};

export const dynamic = 'force-dynamic';

export default async function ApiTestPage() {
  const cookieStore = await cookies();
  const api = apiServerClient(cookieStore);

  let result: { ok: true; me: Me } | { ok: false; status: number; code: string; message: string };

  try {
    const me = await api.get<Me>('/me');
    result = { ok: true, me };
  } catch (err) {
    if (err instanceof ApiError) {
      result = { ok: false, status: err.status, code: err.code, message: err.message };
    } else {
      result = { ok: false, status: 0, code: 'NETWORK', message: (err as Error).message };
    }
  }

  return (
    <div className="container mx-auto max-w-3xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">API Bridge Test (Phase 1 demo)</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Server Component này gọi{' '}
          <code className="bg-muted rounded px-1.5 py-0.5">GET /api/v1/me</code> của NestJS backend
          (apps/api) qua cookie NextAuth đã forward. Nếu thấy user info bên dưới ⇒ auth bridge FE→BE
          hoạt động end-to-end.
        </p>
      </header>

      <section className="rounded-lg border p-4">
        <h2 className="mb-2 font-semibold">Kết quả</h2>
        {result.ok ? (
          <pre className="bg-muted overflow-x-auto rounded p-3 text-xs">
            {JSON.stringify(result.me, null, 2)}
          </pre>
        ) : (
          <div className="space-y-1 text-sm">
            <div>
              <span className="font-medium">HTTP:</span> {result.status}
            </div>
            <div>
              <span className="font-medium">Code:</span> {result.code}
            </div>
            <div>
              <span className="font-medium">Message:</span> {result.message}
            </div>
          </div>
        )}
      </section>

      <section className="text-muted-foreground text-xs">
        <p>
          Trang này sẽ được xóa sau khi Phase 1 done. Đường dẫn:{' '}
          <code>apps/web/src/app/(dashboard)/api-test/page.tsx</code>
        </p>
      </section>
    </div>
  );
}
