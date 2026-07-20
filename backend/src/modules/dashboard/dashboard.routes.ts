import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ForbiddenError, NotFoundError } from '../../common/errors/app-error.js';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import type { AuditRepositoryPort } from '../audit/audit.repository.js';
import { getAuthUser, requireAuth, requireRole } from '../auth/auth.middleware.js';
import type { AuthService } from '../auth/auth.service.js';
import type { DashboardRepositoryPort } from './dashboard.repository.js';

const sanitizeStoredFileName = (fileName: string): string =>
  path.basename(fileName)
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .slice(0, 180) || 'attachment';

const isSafeStorageKey = (storageKey: string): boolean =>
  storageKey === path.basename(storageKey) && /^[a-zA-Z0-9._-]+$/u.test(storageKey);

export const createDashboardRouter = (
  repository: DashboardRepositoryPort,
  authService: AuthService,
  auditRepository: AuditRepositoryPort,
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

  router.get('/', asyncHandler(async (request, response) => {
    const user = getAuthUser(response);
    const applications = user.role === 'nguoi-dan'
      ? await repository.findByOwner(user.id)
      : await repository.findAll();
    await auditRepository.record({
      actorUserId: user.id,
      action: 'APPLICATION_LIST_VIEW',
      resourceType: 'application',
      resourceId: user.role === 'nguoi-dan' ? `owner:${user.id}` : 'all',
      request,
      metadata: {
        role: user.role,
        resultCount: applications.length,
      },
    });
    response.json({ success: true, data: applications });
  }));

  router.post('/', asyncHandler(async (request, response) => {
    const user = getAuthUser(response);
    const inserted = await repository.insert({
      ...request.body,
      ownerUserId: user.id,
      ownerLoginIdentifier: user.loginIdentifier,
      ownerName: user.name,
      submittedByRole: user.role,
      ...(user.agencyId ? { submittingAgencyId: user.agencyId } : {}),
    });
    await auditRepository.record({
      actorUserId: user.id,
      action: 'APPLICATION_CREATE',
      resourceType: 'application',
      resourceId: String(inserted.id ?? inserted.applicationCode ?? 'unknown'),
      request,
      metadata: {
        ownerUserId: user.id,
        procedure: inserted.procedure ?? inserted.serviceId ?? inserted.serviceName,
      },
    });
    response.status(201).json({ success: true, data: inserted });
  }));

  router.patch('/:id', requireRole('can-bo', 'admin'), asyncHandler(async (request, response) => {
    const user = getAuthUser(response);
    const updated = await repository.update(request.params.id as string, request.body);
    if (!updated) throw new NotFoundError('Khong tim thay ho so.');
    await auditRepository.record({
      actorUserId: user.id,
      action: 'APPLICATION_UPDATE',
      resourceType: 'application',
      resourceId: request.params.id as string,
      request,
      metadata: {
        updates: request.body,
      },
    });
    response.json({ success: true, data: updated });
  }));

  router.post('/upload', upload.single('file'), asyncHandler(async (request, response) => {
    if (!request.file) {
      response.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }

    const user = getAuthUser(response);
    await repository.recordUpload({
      storageKey: request.file.filename,
      ownerUserId: user.id,
      originalName: request.file.originalname,
      createdAt: new Date().toISOString(),
    });
    await auditRepository.record({
      actorUserId: user.id,
      action: 'ATTACHMENT_UPLOAD',
      resourceType: 'attachment',
      resourceId: request.file.filename,
      request,
      metadata: {
        originalName: request.file.originalname,
        size: request.file.size,
        mimeType: request.file.mimetype,
      },
    });
    response.json({ success: true, storageKey: request.file.filename });
  }));

  router.get('/attachments/:storageKey', asyncHandler(async (request, response) => {
    const user = getAuthUser(response);
    const storageKey = request.params.storageKey as string | undefined;
    if (!storageKey || !isSafeStorageKey(storageKey)) {
      throw new ForbiddenError('Storage key khong hop le.');
    }
    if (!await repository.canReadAttachment(storageKey, user)) {
      throw new ForbiddenError('Tai khoan khong co quyen xem tep dinh kem nay.');
    }

    const filePath = path.join(uploadsDir, storageKey);
    if (!fs.existsSync(filePath)) throw new NotFoundError('Khong tim thay tep dinh kem.');
    await auditRepository.record({
      actorUserId: user.id,
      action: 'ATTACHMENT_DOWNLOAD',
      resourceType: 'attachment',
      resourceId: storageKey,
      request,
      metadata: {
        role: user.role,
      },
    });
    response.sendFile(filePath);
  }));

  return router;
};
