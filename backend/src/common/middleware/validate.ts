import type { RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

export const validate = (
  schema: ZodTypeAny,
  target: 'body' | 'params' | 'query' = 'body',
): RequestHandler => (request, _response, next) => {
  const parsed: unknown = schema.parse(request[target]);

  if (target === 'query') {
    // Express 5 exposes req.query through a getter, so direct assignment can fail.
    Object.defineProperty(request, 'query', {
      value: parsed,
      writable: true,
      configurable: true,
      enumerable: true,
    });
  } else {
    request[target] = parsed as never;
  }
  next();
};
