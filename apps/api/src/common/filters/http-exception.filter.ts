import {
  Catch,
  HttpException,
  HttpStatus,
  Logger,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import { Prisma } from '@lumibach/db';
import type { Response } from 'express';
import { Sentry } from '../sentry/sentry';

type ErrorBody = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
};

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const r = exception.getResponse();
      let message = exception.message;
      let details: unknown;
      let code: string | undefined;

      if (r && typeof r === 'object') {
        const obj = r as Record<string, unknown>;
        if (typeof obj.message === 'string') {
          message = obj.message;
        } else if (Array.isArray(obj.message)) {
          message = obj.message.join('; ');
          details = obj.message;
        }
        // Custom code + details (vd: ZodQueryPipe ném { code, details, message }).
        if (typeof obj.code === 'string') code = obj.code;
        if (obj.details !== undefined) details = obj.details;
      }

      res.status(status).json({
        success: false,
        error: {
          code: code ?? this.mapHttpStatusCode(status),
          message,
          ...(details ? { details } : {}),
        },
      } satisfies ErrorBody);
      return;
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      res.status(mapped.status).json({
        success: false,
        error: { code: mapped.code, message: mapped.message, details: mapped.details },
      } satisfies ErrorBody);
      return;
    }

    if (exception instanceof Prisma.PrismaClientValidationError) {
      res.status(HttpStatus.BAD_REQUEST).json({
        success: false,
        error: { code: 'DB_VALIDATION_ERROR', message: 'Invalid database query input' },
      } satisfies ErrorBody);
      return;
    }

    this.logger.error('Unhandled exception', exception);
    Sentry.captureException(exception);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    } satisfies ErrorBody);
  }

  private mapHttpStatusCode(status: number): string {
    const name = HttpStatus[status];
    return typeof name === 'string' ? name : `HTTP_${status}`;
  }

  private mapPrismaError(err: Prisma.PrismaClientKnownRequestError): {
    status: number;
    code: string;
    message: string;
    details?: unknown;
  } {
    switch (err.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          code: 'UNIQUE_CONSTRAINT',
          message: 'Resource already exists',
          details: err.meta,
        };
      case 'P2025': // record not found
        return {
          status: HttpStatus.NOT_FOUND,
          code: 'NOT_FOUND',
          message: 'Resource not found',
          details: err.meta,
        };
      case 'P2003': // foreign key
        return {
          status: HttpStatus.BAD_REQUEST,
          code: 'FK_CONSTRAINT',
          message: 'Invalid reference',
          details: err.meta,
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          code: `PRISMA_${err.code}`,
          message: 'Database error',
        };
    }
  }
}
