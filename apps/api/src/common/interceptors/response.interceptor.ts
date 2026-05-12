import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from '@nestjs/common';
import { map, type Observable } from 'rxjs';

/**
 * Bao bọc response shape thống nhất:
 *   { success: true, data: T, meta?: {...} }
 *
 * Nếu controller trả về `{ data, meta }` rõ ràng (vd pagination) thì
 * giữ nguyên meta. Còn lại wrap data trực tiếp.
 *
 * KHÔNG wrap nếu response đã có shape `{ success, ... }` (vd filter đã handle).
 */
@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (
          body !== null &&
          typeof body === 'object' &&
          'success' in (body as Record<string, unknown>)
        ) {
          return body;
        }

        if (
          body !== null &&
          typeof body === 'object' &&
          'data' in (body as Record<string, unknown>) &&
          'meta' in (body as Record<string, unknown>)
        ) {
          const { data, meta } = body as unknown as { data: unknown; meta: unknown };
          return { success: true, data, meta };
        }

        return { success: true, data: body };
      })
    );
  }
}
