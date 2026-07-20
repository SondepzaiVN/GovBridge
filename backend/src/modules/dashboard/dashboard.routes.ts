import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import { getAuthUser, requireAuth, requireRole } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { DashboardRepository } from './dashboard.repository.js';

const sanitizeStoredFileName = (fileName: string): string =>
  path.basename(fileName)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180) || 'attachment';

const isSafeStorageKey = (storageKey: string): boolean =>
  storageKey === path.basename(storageKey) && /^[a-zA-Z0-9._-]+$/u.test(storageKey);

export const createDashboardRouter = (
  repository: DashboardRepository,
  authService: AuthService,
): Router => {
  const router = Router();
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, uploadsDir),
    filename: (_request, file, callback) =>
      callback(null, `${Date.now()}-${randomUUID()}-${sanitizeStoredFileName(file.originalname)}`),
  });
  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

  router.use(requireAuth(authService));

  router.get('/', asyncHandler(async (_request, response) => {
    const user = getAuthUser(response);
    const applications = user.role === 'nguoi-dan'
      ? await repository.findByOwner(user.id)
      : await repository.findAll();
    response.json({ success: true, data: applications });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const user = getAuthUser(response);
    const inserted = await repository.insert({
      ...request.body,
      ownerUserId: user.id,
      ownerUsername: user.username,
      ownerName: user.name,
      submittedByRole: user.role,
      ...(user.agencyId ? { submittingAgencyId: user.agencyId } : {}),
    });
    response.status(201).json({ success: true, data: inserted });
  }));

  router.patch('/:id', requireRole('can-bo', 'admin'), asyncHandler(async (request, response) => {
    const updated = await repository.update(request.params.id as string, request.body);
    if (!updated) throw new NotFoundError('Khong tim thay ho so.');
    response.json({ success: true, data: updated });
  }));

  router.post('/upload', upload.single('file'), asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    await repository.recordUpload({
      storageKey: request.file.filename,
      ownerUserId: getAuthUser(response).id,
      originalName: request.file.originalname,
      createdAt: new Date().toISOString(),
    });
    response.json({ success: true, storageKey: request.file.filename });
  }));

  router.get('/attachments/:storageKey', asyncHandler(async (request, response) => {
    const storageKey = request.params.storageKey as string | undefined;
    if (!storageKey || !isSafeStorageKey(storageKey)) {
      throw new ForbiddenError('Storage key khong hop le.');
    }
    if (!await repository.canReadAttachment(storageKey, getAuthUser(response))) {
      throw new ForbiddenError('Tai khoan khong co quyen xem tep dinh kem nay.');
    }

    const filePath = path.join(uploadsDir, storageKey);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Khong tim thay tep dinh kem.');
    response.sendFile(filePath);
  }));

  return router;
};
