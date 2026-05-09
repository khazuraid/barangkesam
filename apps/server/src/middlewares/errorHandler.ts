import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err: any, _req: Request, res: Response, _next: NextFunction) => {
  // Selalu cetak error ke console agar bisa dilihat di log Coolify
  console.error('🔥 [Error Handler]:', {
    message: err.message,
    stack: err.stack,
    statusCode: err.statusCode || 500,
    code: err.code,
  });

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      error: err.message,
      code: err.code,
    });
  }

  // Handle Prisma error
  if (err.code?.startsWith('P')) {
    return res.status(400).json({
      success: false,
      error: 'Kesalahan database (Prisma)',
      detail: err.message,
    });
  }

  // Fallback untuk error tidak terduga
  res.status(500).json({
    success: false,
    error: 'Terjadi kesalahan internal pada server',
  });
};
