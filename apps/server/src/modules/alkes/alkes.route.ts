import { type RequestHandler, Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { uploadImage } from '../../middlewares/upload.js';
import * as imgCtrl from '../alkes-images/alkes-images.controller.js';
import * as ctrl from './alkes.controller.js';

const router = Router();
router.use(authenticate);

// ⚠️ Route statis SEBELUM route dinamis (:id)
router.get('/rusak', ctrl.getRusak);
router.get('/scan/:code', ctrl.scan);
router.get('/pending-count', authorize('ADMIN'), ctrl.pendingCount);
router.post('/bulk-delete', authorize('ADMIN', 'MANAGER'), ctrl.bulkDelete);
router.post('/verify/bulk', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.bulkVerify);

// CRUD Alkes
router.get('/', ctrl.list);
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.update);
router.delete('/:id', authorize('ADMIN', 'MANAGER'), ctrl.remove);

// Workflow verifikasi
router.post('/:id/submit', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.submit);
router.post('/:id/approve', authorize('ADMIN'), ctrl.approve);
router.post('/:id/reject', authorize('ADMIN'), ctrl.reject);
router.post('/:id/resolve', authorize('ADMIN'), ctrl.resolve);
router.get('/:id/verification-logs', ctrl.verificationLogs);

// Images — ⚠️ route statis 'reorder' SEBELUM route dinamis (:imageId)
router.post(
  '/:id/images',
  uploadImage.array('files', 10) as unknown as RequestHandler,
  imgCtrl.upload,
);
router.get('/:id/images', imgCtrl.listImages);
router.patch('/:id/images/reorder', imgCtrl.reorderImages);
router.get('/:id/images/:imageId', imgCtrl.getImage);
router.patch('/:id/images/:imageId', authorize('ADMIN'), imgCtrl.updateImage);
router.delete('/:id/images/:imageId', authorize('ADMIN'), imgCtrl.deleteImage);

export default router;
