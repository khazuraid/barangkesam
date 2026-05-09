import multer from 'multer';
import { AppError } from './errorHandler.js';

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_EXCEL_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_EXCEL_TYPES = [
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/octet-stream',
];

export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 10 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'Tipe file tidak didukung. Gunakan JPEG, PNG, atau WebP'));
    }
  },
});

export const uploadExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_EXCEL_SIZE, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.toLowerCase();
    if (
      ext.endsWith('.xls') ||
      ext.endsWith('.xlsx') ||
      ALLOWED_EXCEL_TYPES.includes(file.mimetype)
    ) {
      cb(null, true);
    } else {
      cb(new AppError(400, 'File harus berformat .xls atau .xlsx'));
    }
  },
});
