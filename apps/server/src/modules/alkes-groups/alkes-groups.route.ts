import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as ctrl from './alkes-groups.controller.js';

const router = Router();
router.use(authenticate);

router.get('/', ctrl.list);
router.post('/', authorize('ADMIN', 'MANAGER'), ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', authorize('ADMIN', 'MANAGER'), ctrl.update);
router.delete('/:id', authorize('ADMIN'), ctrl.remove);

export default router;
