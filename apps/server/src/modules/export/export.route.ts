import { Router } from 'express';
import { authenticate, authorize } from '../../middlewares/auth.js';
import * as ctrl from './export.controller.js';

const router = Router();
router.use(authenticate);
router.get('/alkes', authorize('ADMIN'), ctrl.exportAlkes);

export default router;
