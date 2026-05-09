import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as ctrl from './users.controller.js';

const router = Router();
router.use(authenticate, authorize('ADMIN'));

router.get('/', ctrl.list);
router.post('/', ctrl.create);
router.get('/:id', ctrl.getById);
router.patch('/:id', ctrl.update);
router.patch('/:id/toggle-active', ctrl.toggleActive);
router.patch('/:id/reset-password', ctrl.resetPassword);
router.delete('/:id', ctrl.remove);

export default router;
