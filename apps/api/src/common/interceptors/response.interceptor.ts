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
 * KHÔNG wrap nếu response đã có shape `{ success: boolean, ... }` (vd filter đã handle).
 * DTO có field `success` khác kiểu vẫn được wrap như data bình thường.
 */
@Injectable()
export class ResponseInterceptor<T = unknown> implements NestInterceptor<T> {
  intercept(_context: ExecutionContext, next: CallHandler<T>): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (
          body !== null &&
          typeof body === 'object' &&
          typeof (body as Record<string, unknown>).success === 'boolean'
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
