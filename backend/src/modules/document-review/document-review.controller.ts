import type { Request, Response } from 'express';
import { sendSuccess } from '../../common/http/response.js';
import type { DocumentReviewService } from './document-review.service.js';

export class DocumentReviewController {
  constructor(private readonly service: DocumentReviewService) {}

  reviewCt01 = async (request: Request, response: Response): Promise<Response> => {
    return sendSuccess(response, await this.service.reviewCt01({
      file: request.file,
      currentRoute: request.body.currentRoute,
      formValues: request.body.formValues,
    }));
  };
}
