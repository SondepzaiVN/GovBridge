import type { Response } from 'express';

export interface SuccessEnvelope<T> {
  success: true;
  data: T;
  requestId: string;
}

export const sendSuccess = <T>(
  response: Response,
  data: T,
  statusCode = 200,
): Response<SuccessEnvelope<T>> =>
  response.status(statusCode).json({
    success: true,
    data,
    requestId: response.locals.requestId as string,
  });
