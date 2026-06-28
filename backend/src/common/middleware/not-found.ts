import type { RequestHandler } from 'express';
import { NotFoundError } from '../errors/app-error.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(new NotFoundError('Không tồn tại endpoint ' + request.method + ' ' + request.originalUrl + '.'));
};
