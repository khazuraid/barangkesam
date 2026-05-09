import type { Prisma } from '@prisma/client';
import { buildCloudinaryFolder } from '@repo/utils';
import { ReorderAlkesImagesSchema, UpdateAlkesImageSchema } from '@repo/validators';
import type { NextFunction, Request, Response } from 'express';
import sharp from 'sharp';
import { deleteFromCloudinary, uploadToCloudinary } from '../../config/cloudinary.js';
import { prisma } from '../../config/database.js';
import { CacheKeys, delCache } from '../../config/redis.js';
import { AppError } from '../../middlewares/errorHandler.js';
import { logActivity } from '../../shared/utils/activityLogger.js';

export async function upload(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: alkesId } = req.params;
    const alkes = await prisma.alkes.findUnique({ where: { id: alkesId } });
    if (!alkes) throw new AppError(404, 'Alkes tidak ditemukan');

    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) throw new AppError(400, 'Tidak ada file yang diupload');

    // Cek batas 10 foto
    const existingCount = await prisma.alkesImage.count({ where: { alkes_id: alkesId } });
    if (existingCount + files.length > 10) {
      throw new AppError(
        400,
        `Maksimal 10 foto per alkes. Saat ini sudah ada ${existingCount} foto.`,
      );
    }

    const isFirstUpload = existingCount === 0;
    const folder = buildCloudinaryFolder(alkesId);

    const uploaded = await Promise.all(
      files.map(async (file, idx) => {
        // Resize & konversi WebP via Sharp
        const optimized = await sharp(file.buffer)
          .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer();

        const { url, public_id } = await uploadToCloudinary(optimized, folder);
        const isPrimary = isFirstUpload && idx === 0;
        const urutan = existingCount + idx;

        const image = await prisma.alkesImage.create({
          data: {
            alkes_id: alkesId,
            url,
            public_id,
            caption: (req.body?.caption ?? null) as string | null,
            is_primary: isPrimary,
            urutan,
            uploaded_by: req.user?.userId,
          } as Prisma.AlkesImageUncheckedCreateInput,
        });

        // Update image_url di alkes jika foto pertama
        if (isPrimary) {
          await prisma.alkes.update({ where: { id: alkesId }, data: { image_url: url } });
        }

        return image;
      }),
    );

    await delCache(CacheKeys.alkesDetail(alkesId), CacheKeys.alkesImages(alkesId));

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'UPLOAD',
        entity: 'alkes_images',
        entityId: alkesId,
        description: `Upload ${uploaded.length} foto alkes`,
        req,
      });
    }

    res.status(201).json({ success: true, data: { uploaded } });
  } catch (err) {
    next(err);
  }
}

export async function listImages(req: Request, res: Response, next: NextFunction) {
  try {
    const images = await prisma.alkesImage.findMany({
      where: { alkes_id: req.params.id },
      orderBy: { urutan: 'asc' },
    });
    res.json({ success: true, data: images });
  } catch (err) {
    next(err);
  }
}

export async function getImage(req: Request, res: Response, next: NextFunction) {
  try {
    const image = await prisma.alkesImage.findFirst({
      where: { id: req.params.imageId, alkes_id: req.params.id },
    });
    if (!image) throw new AppError(404, 'Foto tidak ditemukan');
    res.json({ success: true, data: image });
  } catch (err) {
    next(err);
  }
}

export async function updateImage(req: Request, res: Response, next: NextFunction) {
  try {
    const body = UpdateAlkesImageSchema.parse(req.body);
    const { id: alkesId, imageId } = req.params;

    // Jika set sebagai primary, reset yang lain dulu
    if (body.is_primary) {
      await prisma.alkesImage.updateMany({
        where: { alkes_id: alkesId },
        data: { is_primary: false },
      });
    }

    const image = await prisma.alkesImage.update({
      where: { id: imageId },
      data: body,
    });

    // Update image_url di alkes jika ini jadi primary
    if (body.is_primary) {
      await prisma.alkes.update({ where: { id: alkesId }, data: { image_url: image.url } });
    }

    await delCache(CacheKeys.alkesDetail(alkesId), CacheKeys.alkesImages(alkesId));

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'UPDATE',
        entity: 'alkes_images',
        entityId: image.id,
        description: 'Metadata foto alkes diperbarui',
        metadata: { fields: Object.keys(body) },
        req,
      });
    }

    res.json({ success: true, data: image });
  } catch (err) {
    next(err);
  }
}

export async function deleteImage(req: Request, res: Response, next: NextFunction) {
  try {
    const { id: alkesId, imageId } = req.params;
    const image = await prisma.alkesImage.findFirst({
      where: { id: imageId, alkes_id: alkesId },
    });
    if (!image) throw new AppError(404, 'Foto tidak ditemukan');

    await deleteFromCloudinary(image.public_id);
    await prisma.alkesImage.delete({ where: { id: imageId } });

    // BUG-06 FIX: ganti nama variabel 'next' → 'nextImage' agar tidak shadow parameter NextFunction
    if (image.is_primary) {
      const nextImage = await prisma.alkesImage.findFirst({
        where: { alkes_id: alkesId },
        orderBy: { urutan: 'asc' },
      });
      if (nextImage) {
        await prisma.alkesImage.update({ where: { id: nextImage.id }, data: { is_primary: true } });
        await prisma.alkes.update({ where: { id: alkesId }, data: { image_url: nextImage.url } });
      } else {
        await prisma.alkes.update({ where: { id: alkesId }, data: { image_url: null } });
      }
    }

    await delCache(CacheKeys.alkesDetail(alkesId), CacheKeys.alkesImages(alkesId));

    if (req.user?.userId) {
      logActivity({
        userId: req.user.userId,
        action: 'DELETE',
        entity: 'alkes_images',
        entityId: image.id,
        description: 'Foto alkes dihapus',
        req,
      });
    }

    res.json({ success: true, message: 'Foto berhasil dihapus' });
  } catch (err) {
    next(err);
  }
}

export async function reorderImages(req: Request, res: Response, next: NextFunction) {
  try {
    const { order } = ReorderAlkesImagesSchema.parse(req.body);
    const { id: alkesId } = req.params;

    await Promise.all(
      order.map((imageId, idx) =>
        prisma.alkesImage.updateMany({
          where: { id: imageId, alkes_id: alkesId },
          data: { urutan: idx },
        }),
      ),
    );

    await delCache(CacheKeys.alkesDetail(alkesId), CacheKeys.alkesImages(alkesId));
    res.json({ success: true, message: 'Urutan foto berhasil diperbarui' });
  } catch (err) {
    next(err);
  }
}
