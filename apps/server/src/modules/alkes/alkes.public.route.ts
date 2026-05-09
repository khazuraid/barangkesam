import { Router } from 'express';
import * as ctrl from './alkes.controller.js';

// Public routes untuk akses QR code tanpa autentikasi.
// DILARANG menambahkan endpoint yang menampilkan data sensitif di sini.
const router = Router();

router.get('/alkes/:code', ctrl.publicScan);

export default router;
