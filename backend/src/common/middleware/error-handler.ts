import type { ErrorRequestHandler } from 'express';
import multer from 'multer';
import { ZodError } from 'zod';
import { AppError } from '../errors/app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  let normalized: unknown = error;

  if (error instanceof ZodError) {
    normalized = new AppError(
      400,
      'INVALID_REQUEST',
      'Dữ liệu request không hợp lệ.',
      error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    );
  }

  if (error instanceof multer.MulterError) {
    normalized = new AppError(
      400,
      'UPLOAD_ERROR',
      error.code === 'LIMIT_FILE_SIZE'
        ? 'Tệp tải lên vượt quá dung lượng cho phép.'
        : error.message,
    );
  }

  if (normalized instanceof AppError) {
    response.status(normalized.statusCode).json({
      success: false,
      error: {
        code: normalized.code,
        message: normalized.message,
        ...(normalized.details ? { details: normalized.details } : {}),
      },
      requestId: response.locals.requestId as string,
    });
    return;
  }

  console.error('[' + String(response.locals.requestId) + '] Unhandled error', error);
  response.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Máy chủ gặp lỗi ngoài dự kiến.',
    },
    requestId: response.locals.requestId as string,
  });
};
