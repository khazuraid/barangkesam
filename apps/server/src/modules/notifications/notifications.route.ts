import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import * as ctrl from './notifications.controller.js';

const router = Router();
router.use(authenticate);

// ⚠️ Statis sebelum dinamis
router.get('/unread-count', ctrl.unreadCount);
router.patch('/read-all', ctrl.markAllRead);
router.delete('/', ctrl.removeAll);

router.get('/', ctrl.list);
router.get('/:id', ctrl.getById);
router.patch('/:id/read', ctrl.markRead);
router.delete('/:id', ctrl.remove);

export default router;
