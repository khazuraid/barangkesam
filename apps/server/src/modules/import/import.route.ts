import { type RequestHandler, Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { uploadExcel } from '../../middlewares/upload.js';
import * as ctrl from './import.controller.js';

const router = Router();
router.use(authenticate);

// SEC-02 FIX: hanya ADMIN yang bisa import data massal
router.post(
  '/alkes/preview',
  authorize('ADMIN'),
  uploadExcel.single('file') as unknown as RequestHandler,
  ctrl.previewAlkesImport,
);

router.post(
  '/alkes',
  authorize('ADMIN'),
  uploadExcel.single('file') as unknown as RequestHandler,
  ctrl.importAlkes,
);
router.get('/logs', authorize('ADMIN'), ctrl.getLogs);
router.delete('/logs', authorize('ADMIN'), ctrl.deleteLogs);
router.get('/logs/:id', authorize('ADMIN'), ctrl.getLogById);
router.delete('/logs/:id', authorize('ADMIN'), ctrl.deleteLog);

export default router;
