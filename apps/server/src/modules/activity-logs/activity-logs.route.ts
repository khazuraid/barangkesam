import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import { getById, list } from './activity-logs.controller.js';

const router = Router();

router.use(authenticate);
router.get('/', authorize('ADMIN', 'MANAGER', 'STAFF'), list);
router.get('/:id', authorize('ADMIN', 'MANAGER', 'STAFF'), getById);

export default router;
