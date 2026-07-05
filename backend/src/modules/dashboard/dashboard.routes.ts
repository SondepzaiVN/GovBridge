import { Router } from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import { asyncHandler } from '../../common/middleware/async-handler.js';
import type { DashboardRepository } from './dashboard.repository.js';

export const createDashboardRouter = (repository: DashboardRepository): Router => {
  const router = Router();
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadsDir),
    filename: (req, file, cb) => cb(null, `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`),
  });
  const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } }); // 50MB max

  router.get('/', asyncHandler(async (req, res) => {
    const applications = await repository.findAll();
    res.json({ success: true, data: applications });
  }));

  router.post('/', asyncHandler(async (req, res) => {
    const application = req.body;
    const inserted = await repository.insert(application);
    res.status(201).json({ success: true, data: inserted });
  }));

  router.patch('/:id', asyncHandler(async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const updated = await repository.update(id as string, updates);
    if (!updated) {
      res.status(404).json({ success: false, error: 'Không tìm thấy hồ sơ' });
      return;
    }
    res.json({ success: true, data: updated });
  }));

  router.post('/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
      res.status(400).json({ success: false, error: 'No file uploaded' });
      return;
    }
    res.json({ success: true, storageKey: req.file.filename });
  });

  router.get('/attachments/:storageKey', (req, res) => {
    const { storageKey } = req.params;
    const filePath = path.join(uploadsDir, storageKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ success: false, error: 'Không tìm thấy tệp đính kèm' });
      return;
    }
    res.sendFile(filePath);
  });

  return router;
};
