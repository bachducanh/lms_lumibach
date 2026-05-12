import { BadRequestException, Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodSchema, ZodError } from 'zod';

/**
 * Custom Zod pipe — parse query/body via plain `schema.safeParse()` và throw
 * BadRequestException nếu fail.
 *
 * Lý do KHÔNG dùng `createZodDto` từ nestjs-zod 4.3 + Zod v4: package
 * @nest-zod/z (transitive dep) gọi `zod.defaultErrorMap` — API đã bị bỏ ở
 * Zod v4 → runtime crash. Plain Zod parse tránh được vấn đề này.
 *
 * Usage:
 *   @Query(new ZodQueryPipe(MySchema)) query: z.infer<typeof MySchema>
 *
 * Hoặc factory `zodQuery(schema)` cho ergonomics.
 */
@Injectable()
export class ZodQueryPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const error = result.error as ZodError;
      throw new BadRequestException({
        message: 'Request validation failed',
        code: 'VALIDATION_ERROR',
        details: error.issues.map((i) => ({
          path: i.path.join('.'),
          message: i.message,
          code: i.code,
        })),
      });
    }
    return result.data;
  }
}

/** Sugar helper — `@Query(zodQuery(schema))` */
export const zodQuery = <T>(schema: ZodSchema<T>) => new ZodQueryPipe(schema);
