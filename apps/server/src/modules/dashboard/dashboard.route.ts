import { Router } from 'express';
import { authenticate } from '../../middlewares/auth.js';
import * as ctrl from './dashboard.controller.js';

const router = Router();
router.use(authenticate);
router.get('/stats', ctrl.stats);
router.get('/chart', ctrl.chart);
router.get('/chart-pengajuan', ctrl.chartPengajuan);
router.get('/perhatian', ctrl.perhatian);

export default router;
