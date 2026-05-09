import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as ctrl from './equipment-requests.controller.js';

const router = Router();
router.use(authenticate);

// Static routes
router.get('/pending-count', authorize('ADMIN'), ctrl.pendingCount);

// CRUD
router.get('/', ctrl.list);
router.post('/', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.update);

// Workflow
router.post('/:id/submit', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.submit);
router.post('/:id/approve', authorize('ADMIN'), ctrl.approve);
router.post('/:id/reject', authorize('ADMIN'), ctrl.reject);
router.post('/:id/cancel', authorize('ADMIN', 'MANAGER', 'STAFF'), ctrl.cancel);
router.post('/:id/fulfill', authorize('ADMIN'), ctrl.fulfill);
router.patch('/:id/procure', authorize('ADMIN'), ctrl.procure);
router.get('/:id/verification-logs', ctrl.verificationLogs);

export default router;
