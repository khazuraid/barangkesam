import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import * as ctrl from './auth.controller.js';

const router = Router();

router.post('/login', ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.get('/me', authenticate, ctrl.me);
router.patch('/me', authenticate, ctrl.updateMe);
router.patch('/change-password', authenticate, ctrl.changePassword);

export default router;
